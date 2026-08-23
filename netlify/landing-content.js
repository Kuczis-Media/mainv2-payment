'use strict';

const { getStore } = require('@netlify/blobs');
const { storageConfig } = require('./progress-storage.js');

const STORE_NAME = 'chemdisk-landing';
const DRAFT_KEY = 'draft.json';
const PUBLISHED_KEY = 'published.json';
const MAX_RETRIES = 8;
const SECTION_IDS = Object.freeze(['home', 'about', 'services', 'pricing', 'skills', 'contact']);
const DEFAULT_COPY = Object.freeze({
  home: ['Twoja matura, dobrze zaplanowana', 'Witaj w ChemDisk', 'Ucz się skutecznie'],
  about: ['O nas', 'Jesteśmy zespołem wspierającym maturzystów', 'Pomagamy uczniom zdać maturę pewnie i wysoko. Pracujemy na sprawdzonych metodach, arkuszach CKE i autorskich materiałach.'],
  services: ['Nasze Moduły', 'Wszystko w jednym miejscu', 'Materiały, ćwiczenia, narzędzia i wsparcie prowadzącego.'],
  pricing: ['Wybierz dostęp', 'Pakiety kursu', 'Jednorazowa płatność kartą przez Stripe. Dostępne pakiety i zasady ich przedłużania są zawsze widoczne przy aktualnej ofercie.'],
  skills: ['Jak zacząć', 'Jak się zapisać?', 'Utwórz konto, wybierz pakiet i po opłaceniu rozpocznij naukę.'],
  contact: ['Kontakt', 'Napisz do nas', 'Masz pytania o kursy, terminy lub poziomy? Wyślij wiadomość — odpowiemy.']
});
let injectedStoreFactory = null;

function getLandingStore() {
  if (injectedStoreFactory) return injectedStoreFactory();
  const config = storageConfig();
  if (!config) throw landingError('LANDING_STORAGE_UNAVAILABLE', 503);
  return getStore({ name: STORE_NAME, siteID: config.siteId, token: config.token, consistency: 'strong' });
}

function defaultModel() {
  return {
    version: 1,
    revision: 0,
    sections: SECTION_IDS.map((id, index) => ({
      id,
      order: index,
      enabled: true,
      title: DEFAULT_COPY[id][0],
      subtitle: DEFAULT_COPY[id][1],
      body: DEFAULT_COPY[id][2],
      imageUrl: id === 'about' ? 'https://cdn.jsdelivr.net/gh/Kuczis-Media/landing-page-assets/images/banner-chemical.png' : '',
      backgroundColor: '',
      textColor: '',
      accentColor: '',
      ctaLabel: id === 'home' ? 'Zaloguj się' : '',
      ctaHref: id === 'home' ? '/members/' : ''
    })),
    createdAt: null,
    updatedAt: null,
    updatedBy: null,
    publishedAt: null
  };
}

function normalizeModel(raw, strict = false) {
  const source = plainObject(raw) ? raw : {};
  const defaults = defaultModel();
  const byId = new Map((Array.isArray(source.sections) ? source.sections : []).filter(plainObject).map((section) => [String(section.id || ''), section]));
  const sections = SECTION_IDS.map((id, fallbackOrder) => {
    const value = byId.get(id) || {};
    return {
      id,
      order: Number.isSafeInteger(value.order) && value.order >= 0 ? value.order : fallbackOrder,
      enabled: value.enabled !== false,
      title: cleanText(value.title, 120) || defaults.sections[fallbackOrder].title,
      subtitle: cleanText(value.subtitle, 180),
      body: cleanText(value.body, 2_000),
      imageUrl: safeUrl(value.imageUrl, 'image', strict),
      backgroundColor: safeColor(value.backgroundColor, strict),
      textColor: safeColor(value.textColor, strict),
      accentColor: safeColor(value.accentColor, strict),
      ctaLabel: cleanText(value.ctaLabel, 80),
      ctaHref: safeUrl(value.ctaHref, 'link', strict)
    };
  }).sort((left, right) => left.order - right.order).map((section, order) => ({ ...section, order }));
  return {
    version: 1,
    revision: Number.isSafeInteger(source.revision) && source.revision >= 0 ? source.revision : 0,
    sections,
    createdAt: isoOrNull(source.createdAt),
    updatedAt: isoOrNull(source.updatedAt),
    updatedBy: cleanText(source.updatedBy, 160) || null,
    publishedAt: isoOrNull(source.publishedAt)
  };
}

async function readModel(store, key) {
  const entry = await readEntry(store, key);
  return { model: normalizeModel(entry && entry.value), exists: Boolean(entry), etag: entry && entry.etag || null };
}

async function readEditorState(store) {
  const [draft, published] = await Promise.all([readModel(store, DRAFT_KEY), readModel(store, PUBLISHED_KEY)]);
  return {
    draft: draft.exists ? draft.model : published.exists ? published.model : defaultModel(),
    published: published.exists ? published.model : null
  };
}

async function saveDraft(store, raw, adminId) {
  const input = normalizeModel(raw, true);
  return writeModel(store, DRAFT_KEY, input, adminId, false);
}

async function publish(store, raw, adminId) {
  const draft = await saveDraft(store, raw, adminId);
  return writeModel(store, PUBLISHED_KEY, draft, adminId, true);
}

async function writeModel(store, key, input, adminId, publishing) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const current = await readEntry(store, key);
    const previous = normalizeModel(current && current.value);
    const now = new Date().toISOString();
    const next = normalizeModel({
      ...input,
      revision: previous.revision + 1,
      createdAt: previous.createdAt || now,
      updatedAt: now,
      updatedBy: cleanText(adminId, 160) || null,
      publishedAt: publishing ? now : input.publishedAt
    });
    const result = await store.set(key, JSON.stringify(next), {
      ...(current ? { onlyIfMatch: current.etag } : { onlyIfNew: true }),
      metadata: { revision: String(next.revision), updatedAt: now, published: String(publishing) }
    });
    if (result && result.modified === true) return next;
  }
  throw landingError('LANDING_CONFLICT', 409);
}

async function readEntry(store, key) {
  const entry = await store.getWithMetadata(key, { type: 'text', consistency: 'strong' });
  if (!entry) return null;
  if (typeof entry.data !== 'string' || !entry.etag) throw landingError('LANDING_STORAGE_INVALID', 503);
  try { return { value: JSON.parse(entry.data), etag: entry.etag }; }
  catch { throw landingError('LANDING_STORAGE_INVALID', 503); }
}

function safeUrl(value, kind, strict) {
  const raw = cleanText(value, 1_000);
  if (!raw) return '';
  if (kind === 'link' && /^#[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(raw)) return raw;
  if (/^\/(?!\/)[^\s]*$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:') return url.toString();
  } catch {}
  if (strict) throw landingError(kind === 'image' ? 'INVALID_LANDING_IMAGE_URL' : 'INVALID_LANDING_LINK', 400);
  return '';
}

function safeColor(value, strict) {
  const color = cleanText(value, 20);
  if (!color) return '';
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) return color.toLowerCase();
  if (strict) throw landingError('INVALID_LANDING_COLOR', 400);
  return '';
}

function cleanText(value, max) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max) : '';
}

function isoOrNull(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}

function plainObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }

function landingError(code, status) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

module.exports = {
  DRAFT_KEY,
  PUBLISHED_KEY,
  SECTION_IDS,
  STORE_NAME,
  defaultModel,
  getLandingStore,
  normalizeModel,
  publish,
  readEditorState,
  readModel,
  saveDraft,
  _test: {
    resetStoreFactory() { injectedStoreFactory = null; },
    setStoreFactory(factory) { injectedStoreFactory = typeof factory === 'function' ? factory : null; }
  }
};
