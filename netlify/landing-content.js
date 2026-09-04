'use strict';

const { getStore } = require('@netlify/blobs');
const { storageConfig } = require('./progress-storage.js');

const STORE_NAME = 'chemdisk-landing';
const DRAFT_KEY = 'draft.json';
const PUBLISHED_KEY = 'published.json';
const MAX_RETRIES = 8;
const MODEL_VERSION = 2;
const SECTION_IDS = Object.freeze(['home', 'about', 'services', 'pricing', 'skills', 'contact']);
const DEFAULT_HERO_IMAGE_URL = 'https://cdn.jsdelivr.net/gh/Kuczis-Media/landing-page-assets@main/images/banner-chemical.png';
const DEFAULT_BRANDING = Object.freeze({
  logoUrl: '',
  logoAlt: 'ChemDisk',
  siteTitle: 'ChemDisk — kursy maturalne online',
  siteDescription: 'Kursy maturalne, materiały, ćwiczenia i wsparcie prowadzącego w jednym miejscu.'
});
const DEFAULT_COPY = Object.freeze({
  home: ['Twoja matura, dobrze zaplanowana', 'Witaj w ChemDisk', 'Ucz się skutecznie'],
  about: ['O nas', 'Jesteśmy zespołem wspierającym maturzystów', 'Pomagamy uczniom zdać maturę pewnie i wysoko. Oferujemy kursy z matematyki, języka polskiego, języka angielskiego, chemii i biologii. Pracujemy na sprawdzonych metodach, arkuszach CKE i autorskich materiałach. Uczymy skutecznych strategii, powtarzamy kluczowe zagadnienia i trenujemy rozwiązywanie zadań pod presją czasu.'],
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
    version: MODEL_VERSION,
    revision: 0,
    branding: { ...DEFAULT_BRANDING },
    sections: SECTION_IDS.map((id, index) => ({
      id,
      order: index,
      enabled: true,
      title: DEFAULT_COPY[id][0],
      subtitle: DEFAULT_COPY[id][1],
      body: DEFAULT_COPY[id][2],
      imageUrl: ['home', 'about'].includes(id) ? DEFAULT_HERO_IMAGE_URL : '',
      imageAlt: id === 'about' ? 'Ilustracja związana z nauką chemii' : '',
      backgroundColor: '',
      textColor: '',
      accentColor: '',
      ctaLabel: id === 'home' ? 'Zaloguj się' : id === 'about' ? 'Poznaj moduły' : id === 'skills' ? 'Wybierz pakiet' : '',
      ctaHref: id === 'home' ? '/members/' : id === 'about' ? '#services' : id === 'skills' ? '#pricing' : ''
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
  const legacy = !Number.isSafeInteger(source.version) || source.version < MODEL_VERSION;
  const byId = new Map((Array.isArray(source.sections) ? source.sections : []).filter(plainObject).map((section) => [String(section.id || ''), section]));
  const sections = SECTION_IDS.map((id, fallbackOrder) => {
    const value = byId.get(id) || {};
    const fallback = defaults.sections[fallbackOrder];
    return {
      id,
      order: Number.isSafeInteger(value.order) && value.order >= 0 ? value.order : fallbackOrder,
      enabled: value.enabled !== false,
      title: textField(value, 'title', fallback.title, 120, legacy),
      subtitle: textField(value, 'subtitle', fallback.subtitle, 180, legacy),
      body: textField(value, 'body', fallback.body, 2_000, legacy),
      imageUrl: urlField(value, 'imageUrl', fallback.imageUrl, 'image', strict, legacy),
      imageAlt: textField(value, 'imageAlt', fallback.imageAlt, 180),
      backgroundColor: safeColor(value.backgroundColor, strict),
      textColor: safeColor(value.textColor, strict),
      accentColor: safeColor(value.accentColor, strict),
      ctaLabel: textField(value, 'ctaLabel', fallback.ctaLabel, 80, legacy),
      ctaHref: urlField(value, 'ctaHref', fallback.ctaHref, 'link', strict, legacy)
    };
  }).sort((left, right) => left.order - right.order).map((section, order) => ({ ...section, order }));
  if (strict) {
    const enabledIds = new Set(sections.filter((section) => section.enabled !== false).map((section) => section.id));
    for (const section of sections) {
      const target = /^#([A-Za-z][A-Za-z0-9_-]{0,79})$/.exec(section.ctaHref);
      if (section.ctaLabel && target && !enabledIds.has(target[1])) throw landingError('INVALID_LANDING_LINK_TARGET', 400);
    }
  }
  const branding = plainObject(source.branding) ? source.branding : {};
  return {
    version: MODEL_VERSION,
    revision: Number.isSafeInteger(source.revision) && source.revision >= 0 ? source.revision : 0,
    branding: {
      logoUrl: urlField(branding, 'logoUrl', DEFAULT_BRANDING.logoUrl, 'image', strict),
      logoAlt: textField(branding, 'logoAlt', DEFAULT_BRANDING.logoAlt, 120),
      siteTitle: textField(branding, 'siteTitle', DEFAULT_BRANDING.siteTitle, 160),
      siteDescription: textField(branding, 'siteDescription', DEFAULT_BRANDING.siteDescription, 320)
    },
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
  const current = await readEntry(store, DRAFT_KEY);
  const previous = normalizeModel(current && current.value);
  if (current && input.revision !== previous.revision) throw landingError('LANDING_CONFLICT', 409);
  const now = new Date().toISOString();
  const next = normalizeModel({
    ...input,
    revision: current ? previous.revision + 1 : input.revision + 1,
    createdAt: previous.createdAt || input.createdAt || now,
    updatedAt: now,
    updatedBy: cleanText(adminId, 160) || null,
    publishedAt: input.publishedAt
  });
  const result = await store.set(DRAFT_KEY, JSON.stringify(next), {
    ...(current ? { onlyIfMatch: current.etag } : { onlyIfNew: true }),
    metadata: { revision: String(next.revision), updatedAt: now, published: 'false' }
  });
  if (!result || result.modified !== true) throw landingError('LANDING_CONFLICT', 409);
  return next;
}

async function publish(store, raw, adminId) {
  const draft = await saveDraft(store, raw, adminId);
  return writePublishedModel(store, draft, adminId);
}

async function writePublishedModel(store, input, adminId) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const current = await readEntry(store, PUBLISHED_KEY);
    const previous = normalizeModel(current && current.value);
    if (current && previous.revision > input.revision) throw landingError('LANDING_CONFLICT', 409);
    const now = new Date().toISOString();
    const next = normalizeModel({
      ...input,
      revision: input.revision,
      createdAt: previous.createdAt || input.createdAt || now,
      updatedAt: now,
      updatedBy: cleanText(adminId, 160) || null,
      publishedAt: now
    });
    const result = await store.set(PUBLISHED_KEY, JSON.stringify(next), {
      ...(current ? { onlyIfMatch: current.etag } : { onlyIfNew: true }),
      metadata: { revision: String(next.revision), updatedAt: now, published: 'true' }
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
    if (url.protocol === 'https:') return kind === 'image' ? normalizeGitHubImageUrl(url) : url.toString();
  } catch {}
  if (strict) throw landingError(kind === 'image' ? 'INVALID_LANDING_IMAGE_URL' : 'INVALID_LANDING_LINK', 400);
  return '';
}

function normalizeGitHubImageUrl(url) {
  const parts = url.pathname.split('/').filter(Boolean);
  if (url.hostname === 'github.com' && parts.length >= 5 && parts[2] === 'blob') {
    const [owner, repository, , ref, ...path] = parts;
    if (owner && repository && ref && path.length) {
      return `https://cdn.jsdelivr.net/gh/${owner}/${repository}@${ref}/${path.join('/')}`;
    }
  }
  if (url.hostname === 'raw.githubusercontent.com' && parts.length >= 4) {
    const [owner, repository, ref, ...path] = parts;
    if (owner && repository && ref && path.length) {
      return `https://cdn.jsdelivr.net/gh/${owner}/${repository}@${ref}/${path.join('/')}`;
    }
  }
  return url.toString();
}

function textField(source, key, fallback, max, legacyFallback = false) {
  if (!Object.prototype.hasOwnProperty.call(source, key)) return fallback;
  const value = cleanText(source[key], max);
  return legacyFallback && !value ? fallback : value;
}

function urlField(source, key, fallback, kind, strict, legacyFallback = false) {
  if (!Object.prototype.hasOwnProperty.call(source, key)) return fallback;
  const value = safeUrl(source[key], kind, strict);
  return legacyFallback && !value ? fallback : value;
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
  MODEL_VERSION,
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
