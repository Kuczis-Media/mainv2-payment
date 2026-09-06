'use strict';

const { json, mutationGuard, parseJsonBody, requireAdmin, responseForFailure } = require('../admin-common.js');
const landing = require('../landing-content.js');
const siteAssets = require('../site-assets.js');

exports.handler = async (event = {}, context = {}) => {
  const method = String(event.httpMethod || '').toUpperCase();
  if (method === 'OPTIONS') return { statusCode: 204, headers: { Allow: 'GET, PUT, POST, OPTIONS', 'Cache-Control': 'no-store', Vary: 'Origin' }, body: '' };
  if (!['GET', 'PUT', 'POST'].includes(method)) return json({ error: 'METHOD_NOT_ALLOWED' }, 405, { Allow: 'GET, PUT, POST, OPTIONS' });
  const auth = await requireAdmin(event, context);
  if (!auth.ok) return responseForFailure(auth);
  try {
    if (method === 'GET') {
      const [stored, remote] = await Promise.allSettled([
        Promise.resolve().then(() => landing.readEditorState(landing.getLandingStore())),
        siteAssets.readLandingConfig()
      ]);
      const published = remote.status === 'fulfilled' ? remote.value.model : null;
      const draft = stored.status === 'fulfilled' && stored.value.draftExists
        ? stored.value.draft : published || (stored.status === 'fulfilled' ? stored.value.draft : landing.defaultModel());
      return json({
        draft,
        published,
        storage: stored.status === 'fulfilled' ? { available: true } : { available: false, error: 'LANDING_STORAGE_UNAVAILABLE' },
        publication: remote.status === 'fulfilled'
          ? { available: true, mode: 'static-github', sha: remote.value.sha }
          : { available: false, mode: 'static-github', sha: null, error: remote.reason?.code || 'LANDING_STATIC_PUBLISH_FAILED' },
        staticConfigUrl: siteAssets.publicConfiguration().landingConfigUrl
      });
    }
    const guard = mutationGuard(event, { maxBodyBytes: 64_000 });
    if (!guard.ok) return responseForFailure(guard);
    const parsed = parseJsonBody(event);
    if (!parsed.ok) return responseForFailure(parsed);
    const allowed = method === 'PUT' ? ['model'] : ['action', 'model', 'expectedPublishedSha'];
    if (Object.keys(parsed.value).some((key) => !allowed.includes(key))) return json({ error: 'UNEXPECTED_FIELDS' }, 400);
    if (!parsed.value.model || typeof parsed.value.model !== 'object' || Array.isArray(parsed.value.model)) {
      return json({ error: 'INVALID_LANDING_MODEL' }, 400);
    }
    if (method === 'PUT') return json({ draft: await landing.saveDraft(landing.getLandingStore(), parsed.value.model, auth.userId) });
    if (parsed.value.action !== 'publish') return json({ error: 'INVALID_LANDING_ACTION' }, 400);
    if (!Object.hasOwn(parsed.value, 'expectedPublishedSha')
      || (parsed.value.expectedPublishedSha !== null && !/^[a-f0-9]{40}$/i.test(parsed.value.expectedPublishedSha))) {
      return json({ error: 'LANDING_PUBLICATION_REQUIRED' }, 400);
    }
    const input = landing.normalizeModel(parsed.value.model, true);
    let store = null;
    let currentDraft = null;
    try {
      store = landing.getLandingStore();
      currentDraft = await landing.readModel(store, landing.DRAFT_KEY);
    } catch { store = null; }
    if (currentDraft?.exists && input.revision !== currentDraft.model.revision
      && landing.comparableModel(input) !== landing.comparableModel(currentDraft.model)) {
      return json({ error: 'LANDING_CONFLICT' }, 409);
    }
    // GitHub is the publication source. A failure must never be reported as a
    // successful Blob publish which an older public GitHub artifact would hide.
    const result = await siteAssets.publishLandingConfig(input, process.env, { expectedSha: parsed.value.expectedPublishedSha });
    const { model: published, ...delivery } = result;
    let draft = published;
    let draftWarning = '';
    if (store) {
      try {
        draft = await landing.saveDraft(store, {
          ...published,
          revision: currentDraft?.exists ? currentDraft.model.revision : input.revision
        }, auth.userId);
      } catch (error) { draftWarning = error?.code || 'LANDING_DRAFT_SYNC_FAILED'; }
    }
    return json({
      published,
      draft,
      delivery: { ...delivery, static: true },
      publication: { available: true, mode: 'static-github', sha: delivery.sha },
      draftWarning,
      storage: { available: Boolean(store) && !draftWarning }
    });
  } catch (error) {
    return json({ error: error && error.code || 'LANDING_STORAGE_UNAVAILABLE' }, Number.isInteger(error && error.status) ? error.status : 503);
  }
};
