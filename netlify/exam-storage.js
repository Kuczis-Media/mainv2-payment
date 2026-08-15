'use strict';

const { getStore } = require('@netlify/blobs');
const { storageConfig } = require('./progress-storage.js');

const STORE_NAME = 'chemdisk-exams';
const MAX_WRITE_RETRIES = 8;
let injectedStoreFactory = null;

function getExamStore() {
  if (injectedStoreFactory) return injectedStoreFactory();
  const config = storageConfig();
  if (!config) throw new Error('Exam Blob store is not configured');
  return getStore({ name: STORE_NAME, siteID: config.siteId, token: config.token, consistency: 'strong' });
}

function encode(value) {
  return Buffer.from(String(value || ''), 'utf8').toString('base64url');
}

function examKey(repositoryId, examId) {
  return encode(`${repositoryId || 'default'}:${examId}`);
}

function attemptKey(repositoryId, examId, userId, attemptId) {
  return `attempts/${examKey(repositoryId, examId)}/${encode(userId)}/${encode(attemptId)}.json`;
}

function userExamKey(repositoryId, examId, userId) {
  return `users/${encode(userId)}/${examKey(repositoryId, examId)}.json`;
}

function reportKey(repositoryId, examId) {
  return `reports/${examKey(repositoryId, examId)}.json`;
}

async function readEntry(store, key) {
  const entry = await store.getWithMetadata(key, { type: 'text', consistency: 'strong' });
  if (!entry) return null;
  if (typeof entry.data !== 'string' || !entry.etag) throw new Error('Invalid exam Blob entry');
  let value;
  try { value = JSON.parse(entry.data); } catch { throw new Error('Invalid exam Blob JSON'); }
  return { value, etag: entry.etag, metadata: entry.metadata || {} };
}

async function conditionalSet(store, key, value, etag, metadata) {
  const result = await store.set(key, JSON.stringify(value), {
    ...(etag ? { onlyIfMatch: etag } : { onlyIfNew: true }),
    metadata: metadata || {}
  });
  return Boolean(result?.modified);
}

async function updateJson(store, key, initialValue, updater, metadataFactory) {
  for (let retry = 0; retry < MAX_WRITE_RETRIES; retry += 1) {
    const current = await readEntry(store, key);
    const base = current ? current.value : structuredClone(initialValue);
    const outcome = await updater(base, { current, retry });
    if (outcome?.abort) return { modified: false, value: base, result: outcome.result };
    const value = Object.prototype.hasOwnProperty.call(outcome || {}, 'value') ? outcome.value : outcome;
    const metadata = typeof metadataFactory === 'function' ? metadataFactory(value) : metadataFactory;
    if (await conditionalSet(store, key, value, current?.etag || null, metadata)) {
      return { modified: true, value, result: outcome?.result };
    }
  }
  const error = new Error('Concurrent exam update conflict');
  error.code = 'EXAM_CONFLICT';
  throw error;
}

function emptyUserIndex(repositoryId, examId, userId, profile = {}) {
  return {
    version: 1,
    repositoryId,
    examId,
    userId,
    profile: { email: String(profile.email || ''), name: String(profile.name || '') },
    attempts: [],
    revision: 0,
    updatedAt: null
  };
}

function attemptSummary(attempt) {
  return {
    attemptId: attempt.attemptId,
    status: attempt.status,
    number: attempt.number,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt || null,
    submittedAt: attempt.submittedAt || null,
    lastActivityAt: attempt.lastActivityAt,
    answeredCount: Object.keys(attempt.answers || {}).length,
    totalQuestions: Array.isArray(attempt.questions) ? attempt.questions.length : 0,
    scorePercent: attempt.result?.scorePercent ?? null,
    points: attempt.result?.points ?? null,
    maxPoints: attempt.result?.maxPoints ?? null,
    passed: attempt.result?.passed ?? null,
    durationSeconds: attempt.durationSeconds ?? null,
    resetAt: attempt.resetAt || null
  };
}

function maxAttemptCount(config) {
  if (config.mode === 'unlimited') return Number.POSITIVE_INFINITY;
  return config.mode === 'limited' ? config.maxAttempts : 1;
}

async function reserveAttempt(store, input) {
  const key = userExamKey(input.repositoryId, input.examId, input.userId);
  return updateJson(store, key, emptyUserIndex(input.repositoryId, input.examId, input.userId, input.profile), (raw) => {
    const index = raw && typeof raw === 'object' ? raw : emptyUserIndex(input.repositoryId, input.examId, input.userId, input.profile);
    index.profile = { ...index.profile, ...input.profile };
    index.attempts = Array.isArray(index.attempts) ? index.attempts : [];
    const active = index.attempts.find((entry) => entry.status === 'active' && !entry.resetAt);
    if (active && input.allowResume) {
      return { abort: true, result: { resumed: true, attemptId: active.attemptId } };
    }
    const counted = index.attempts.filter((entry) => entry.status !== 'reset' && !entry.resetAt);
    if (counted.length >= maxAttemptCount(input.attemptsConfig)) {
      return { abort: true, result: { error: 'ATTEMPT_LIMIT_REACHED' } };
    }
    const previous = counted.filter((entry) => entry.submittedAt).sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt))[0];
    const cooldownMs = Number(input.attemptsConfig.cooldownSeconds || 0) * 1000;
    if (previous && cooldownMs > 0) {
      const availableAt = Date.parse(previous.submittedAt) + cooldownMs;
      if (availableAt > input.now) {
        return { abort: true, result: { error: 'ATTEMPT_COOLDOWN', availableAt: new Date(availableAt).toISOString() } };
      }
    }
    const number = counted.length + 1;
    index.attempts.push({
      attemptId: input.attemptId,
      status: 'active',
      number,
      startedAt: input.startedAt,
      expiresAt: input.expiresAt || null,
      submittedAt: null,
      lastActivityAt: input.startedAt,
      answeredCount: 0,
      totalQuestions: input.totalQuestions,
      scorePercent: null,
      passed: null
    });
    index.revision = Number(index.revision || 0) + 1;
    index.updatedAt = input.startedAt;
    return { value: index, result: { resumed: false, attemptId: input.attemptId, number } };
  }, (index) => ({ userId: encode(input.userId), updatedAt: index.updatedAt || '' }));
}

async function createAttempt(store, attempt) {
  const key = attemptKey(attempt.repositoryId, attempt.examId, attempt.userId, attempt.attemptId);
  const modified = await conditionalSet(store, key, attempt, null, {
    userId: encode(attempt.userId),
    exam: examKey(attempt.repositoryId, attempt.examId),
    status: attempt.status,
    updatedAt: attempt.lastActivityAt
  });
  if (!modified) {
    const error = new Error('Attempt already exists');
    error.code = 'EXAM_CONFLICT';
    throw error;
  }
  return attempt;
}

async function readAttempt(store, repositoryId, examId, userId, attemptId) {
  return readEntry(store, attemptKey(repositoryId, examId, userId, attemptId));
}

async function updateAttempt(store, input, updater) {
  const key = attemptKey(input.repositoryId, input.examId, input.userId, input.attemptId);
  return updateJson(store, key, null, (attempt) => {
    if (!attempt || attempt.userId !== input.userId || attempt.attemptId !== input.attemptId) {
      return { abort: true, result: { error: 'ATTEMPT_NOT_FOUND' } };
    }
    const operationId = String(input.operationId || '');
    const operations = Array.isArray(attempt.operationIds) ? attempt.operationIds : [];
    if (operationId && operations.includes(operationId)) {
      return { abort: true, result: { duplicate: true, attempt } };
    }
    if (input.expectedRevision != null && Number(input.expectedRevision) !== Number(attempt.revision || 0)) {
      return { abort: true, result: { error: 'ATTEMPT_VERSION_CONFLICT', attempt } };
    }
    const outcome = updater(attempt) || {};
    if (outcome.error) return { abort: true, result: outcome };
    attempt.revision = Number(attempt.revision || 0) + 1;
    attempt.lastActivityAt = new Date(input.now || Date.now()).toISOString();
    if (operationId) attempt.operationIds = [...operations, operationId].slice(-100);
    return { value: attempt, result: { attempt, ...outcome } };
  }, (attempt) => ({
    userId: encode(input.userId),
    exam: examKey(input.repositoryId, input.examId),
    status: attempt?.status || '',
    updatedAt: attempt?.lastActivityAt || ''
  }));
}

function emptyReport(repositoryId, examId) {
  return { version: 1, repositoryId, examId, attempts: {}, participants: {}, revision: 0, updatedAt: null };
}

async function syncAttemptIndexes(store, attempt, profile = {}) {
  const summary = attemptSummary(attempt);
  const userKey = userExamKey(attempt.repositoryId, attempt.examId, attempt.userId);
  await updateJson(store, userKey, emptyUserIndex(attempt.repositoryId, attempt.examId, attempt.userId, profile), (index) => {
    index.profile = { ...index.profile, ...profile };
    index.attempts = Array.isArray(index.attempts) ? index.attempts : [];
    const position = index.attempts.findIndex((entry) => entry.attemptId === attempt.attemptId);
    if (position >= 0) index.attempts[position] = summary;
    else index.attempts.push(summary);
    index.revision = Number(index.revision || 0) + 1;
    index.updatedAt = attempt.lastActivityAt;
    return { value: index };
  }, (index) => ({ userId: encode(attempt.userId), updatedAt: index.updatedAt || '' }));

  const key = reportKey(attempt.repositoryId, attempt.examId);
  return updateJson(store, key, emptyReport(attempt.repositoryId, attempt.examId), (report) => {
    report.attempts = report.attempts && typeof report.attempts === 'object' ? report.attempts : {};
    report.participants = report.participants && typeof report.participants === 'object' ? report.participants : {};
    report.attempts[attempt.attemptId] = { ...summary, userId: attempt.userId, profile };
    const participantAttempts = Object.values(report.attempts).filter((entry) => entry.userId === attempt.userId && entry.status !== 'reset');
    report.participants[attempt.userId] = {
      userId: attempt.userId,
      profile,
      attempts: participantAttempts.length,
      lastActivityAt: participantAttempts.map((entry) => entry.lastActivityAt).filter(Boolean).sort().at(-1) || null,
      bestScore: participantAttempts.reduce((best, entry) => Math.max(best, Number(entry.scorePercent) || 0), 0),
      passed: participantAttempts.some((entry) => entry.passed === true)
    };
    report.revision = Number(report.revision || 0) + 1;
    report.updatedAt = attempt.lastActivityAt;
    return { value: report };
  }, (report) => ({ exam: examKey(attempt.repositoryId, attempt.examId), updatedAt: report.updatedAt || '' }));
}

async function readUserExamIndex(store, repositoryId, examId, userId, profile = {}) {
  const entry = await readEntry(store, userExamKey(repositoryId, examId, userId));
  return entry ? entry.value : emptyUserIndex(repositoryId, examId, userId, profile);
}

async function readReport(store, repositoryId, examId) {
  const entry = await readEntry(store, reportKey(repositoryId, examId));
  return entry ? entry.value : emptyReport(repositoryId, examId);
}

async function softResetAttempt(store, input) {
  const outcome = await updateAttempt(store, { ...input, expectedRevision: null }, (attempt) => {
    const previous = attemptSummary(attempt);
    attempt.status = 'reset';
    attempt.resetAt = new Date(input.now || Date.now()).toISOString();
    attempt.resetBy = input.adminId;
    return { previous };
  });
  const attempt = outcome.result?.attempt;
  if (attempt) await syncAttemptIndexes(store, attempt, input.profile);
  return outcome;
}

function setStoreFactory(factory) {
  injectedStoreFactory = typeof factory === 'function' ? factory : null;
}

module.exports = {
  STORE_NAME,
  attemptKey,
  attemptSummary,
  createAttempt,
  encode,
  examKey,
  getExamStore,
  readAttempt,
  readEntry,
  readReport,
  readUserExamIndex,
  reportKey,
  reserveAttempt,
  setStoreFactory,
  softResetAttempt,
  syncAttemptIndexes,
  updateAttempt,
  updateJson,
  userExamKey
};
