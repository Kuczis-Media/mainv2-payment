'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const landing = require('../netlify/landing-content.js');
const publicEndpoint = require('../netlify/functions/landing.js');

class MemoryStore {
  constructor() { this.entries = new Map(); this.revision = 0; }
  async getWithMetadata(key) {
    const entry = this.entries.get(key);
    return entry ? { data: entry.data, etag: entry.etag, metadata: entry.metadata || {} } : null;
  }
  async set(key, data, options = {}) {
    const current = this.entries.get(key);
    if (options.onlyIfNew && current) return { modified: false };
    if (options.onlyIfMatch && (!current || current.etag !== options.onlyIfMatch)) return { modified: false };
    this.revision += 1;
    this.entries.set(key, { data, etag: `etag-${this.revision}`, metadata: options.metadata || {} });
    return { modified: true };
  }
}

test.afterEach(() => landing._test.resetStoreFactory());

test('landing model has stable sections and rejects unsafe URLs and styles', () => {
  const model = landing.defaultModel();
  assert.equal(model.version, 2);
  assert.equal(model.branding.logoAlt, 'ChemDisk');
  assert.match(model.sections[0].imageUrl, /^https:\/\/cdn\.jsdelivr\.net\/gh\/Kuczis-Media\/landing-page-assets@main\/images\/banner-chemical\.png$/);
  assert.equal(model.sections.find((section) => section.id === 'about').ctaHref, '#services');
  assert.equal(model.sections.find((section) => section.id === 'skills').ctaHref, '#pricing');
  assert.deepEqual(model.sections.map((section) => section.id), landing.SECTION_IDS);
  const unsafe = structuredClone(model);
  unsafe.sections[0].imageUrl = 'javascript:alert(1)';
  assert.throws(() => landing.normalizeModel(unsafe, true), /INVALID_LANDING_IMAGE_URL/);
  unsafe.sections[0].imageUrl = 'https://example.com/hero.jpg';
  unsafe.sections[0].ctaHref = 'data:text/html,<script>alert(1)</script>';
  assert.throws(() => landing.normalizeModel(unsafe, true), /INVALID_LANDING_LINK/);
  unsafe.sections[0].ctaHref = '#pricing';
  unsafe.sections[0].backgroundColor = 'expression(alert(1))';
  assert.throws(() => landing.normalizeModel(unsafe, true), /INVALID_LANDING_COLOR/);
});

test('landing rejects a CTA targeting a disabled section', () => {
  const model = landing.defaultModel();
  model.sections.find((section) => section.id === 'about').ctaHref = '#services';
  model.sections.find((section) => section.id === 'services').enabled = false;
  assert.throws(
    () => landing.normalizeModel(model, true),
    (error) => error.code === 'INVALID_LANDING_LINK_TARGET' && error.status === 400
  );
});

test('landing model preserves intentional blanks and converts GitHub image links to jsDelivr', () => {
  const model = landing.defaultModel();
  model.sections[0].title = '';
  model.sections[0].imageAlt = 'Opis hero';
  model.branding.logoUrl = 'https://github.com/Kuczis-Media/logo/blob/main/benzene-ring.svg';
  const normalized = landing.normalizeModel(model, true);
  assert.equal(normalized.sections[0].title, '');
  assert.equal(normalized.sections[0].imageAlt, 'Opis hero');
  assert.equal(normalized.branding.logoUrl, 'https://cdn.jsdelivr.net/gh/Kuczis-Media/logo@main/benzene-ring.svg');
});

test('landing v1 migration preserves the page that was actually visible before empty fields became editable', () => {
  const legacy = landing.defaultModel();
  legacy.version = 1;
  legacy.sections[0].imageUrl = '';
  legacy.sections.find((section) => section.id === 'about').body = '';
  legacy.sections.find((section) => section.id === 'about').ctaLabel = '';
  legacy.sections.find((section) => section.id === 'about').ctaHref = '';
  legacy.sections.find((section) => section.id === 'skills').ctaLabel = '';
  legacy.sections.find((section) => section.id === 'skills').ctaHref = '';

  const migrated = landing.normalizeModel(legacy);
  assert.match(migrated.sections[0].imageUrl, /banner-chemical\.png$/);
  assert.equal(migrated.sections.find((section) => section.id === 'about').body, 'Pomagamy uczniom zdać maturę pewnie i wysoko. Oferujemy kursy z matematyki, języka polskiego, języka angielskiego, chemii i biologii. Pracujemy na sprawdzonych metodach, arkuszach CKE i autorskich materiałach. Uczymy skutecznych strategii, powtarzamy kluczowe zagadnienia i trenujemy rozwiązywanie zadań pod presją czasu.');
  assert.equal(migrated.sections.find((section) => section.id === 'about').ctaHref, '#services');
  assert.equal(migrated.sections.find((section) => section.id === 'skills').ctaHref, '#pricing');
});

test('landing draft is separate from published content and public endpoint never returns draft', async () => {
  const store = new MemoryStore();
  landing._test.setStoreFactory(() => store);
  const model = landing.defaultModel();
  model.sections[0].title = 'Tylko draft';
  const draft = await landing.saveDraft(store, model, 'admin-1');
  let response = await publicEndpoint.handler({ httpMethod: 'GET' });
  assert.deepEqual(JSON.parse(response.body), { active: false });
  assert.match(response.headers['Netlify-CDN-Cache-Control'], /durable/);
  assert.match(response.headers['Cache-Control'], /max-age=30/);
  draft.sections[0].title = 'Wersja publiczna';
  await landing.publish(store, draft, 'admin-1');
  response = await publicEndpoint.handler({ httpMethod: 'GET' });
  const payload = JSON.parse(response.body);
  assert.equal(payload.active, true);
  assert.equal(payload.model.sections[0].title, 'Wersja publiczna');
  assert.equal(payload.model.updatedBy, undefined);
  assert.ok(payload.model.publishedAt);
  assert.equal(payload.model.branding.logoAlt, 'ChemDisk');
});

test('landing draft rejects a stale editor revision instead of overwriting newer changes', async () => {
  const store = new MemoryStore();
  const first = await landing.saveDraft(store, landing.defaultModel(), 'admin-1');
  const stale = structuredClone(first);
  const newer = structuredClone(first);
  newer.sections[0].title = 'Nowsza zmiana';
  const saved = await landing.saveDraft(store, newer, 'admin-2');
  assert.equal(saved.revision, first.revision + 1);
  stale.sections[0].title = 'Stare nadpisanie';
  await assert.rejects(() => landing.saveDraft(store, stale, 'admin-1'), /LANDING_CONFLICT/);
});

test('landing storage failures are not cached as a successful inactive page', async () => {
  landing._test.setStoreFactory(() => ({ getWithMetadata: async () => { throw new Error('offline'); } }));
  const response = await publicEndpoint.handler({ httpMethod: 'GET' });
  assert.equal(response.statusCode, 503);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.equal(JSON.parse(response.body).error, 'LANDING_STORAGE_UNAVAILABLE');
});

test('landing builder uses textContent and server normalization instead of arbitrary HTML', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'public/members/module/studio/landing/index.html'), 'utf8');
  const builder = fs.readFileSync(path.join(root, 'public/members/module/studio/landing/script.js'), 'utf8');
  const runtime = fs.readFileSync(path.join(root, 'public/assets/js/landing-runtime.js'), 'utf8');
  const studio = fs.readFileSync(path.join(root, 'public/members/module/studio/index.html'), 'utf8');
  const netlifyConfig = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
  assert.match(html, /id="section-list"/);
  assert.match(html, /id="landing-preview"/);
  assert.match(html, /id="branding-logo"/);
  assert.match(html, /id="asset-dialog"/);
  assert.match(builder, /admin-landing/);
  assert.match(builder, /admin-site-assets/);
  assert.match(builder, /beforeunload/);
  assert.match(builder, /normalizeGitHubUrl/);
  assert.match(builder, /const raw = normalizeGitHubUrl\(value\)/);
  assert.match(builder, /schedulePreview\(350\)/);
  assert.match(builder, /imagePreviewRequestId/);
  assert.match(builder, /image\.dataset\.previewUrl === url/);
  assert.match(builder, /previewSectionNodes\.get\(section\.id\)/);
  assert.match(builder, /image\.dataset\.previewUrl !== imageUrl/);
  assert.match(builder, /current\?\.tagName === 'IMG'/);
  assert.match(builder, /fetchPriority = 'low'/);
  assert.match(html, /rel="preconnect" href="https:\/\/cdn\.jsdelivr\.net"/);
  assert.match(studio, /rel="preconnect" href="https:\/\/cdn\.jsdelivr\.net"/);
  assert.doesNotMatch(builder, /innerHTML\s*=/);
  assert.match(runtime, /textContent\s*=/);
  assert.match(runtime, /cache:\s*'default'/);
  assert.match(runtime, /branding/);
  assert.doesNotMatch(runtime, /innerHTML\s*=/);
  assert.match(studio, /Landing Page Builder/);
  assert.match(studio, /Logo i assety strony/);
  assert.match(studio, /AI Limits \/ Usage/);
  assert.match(studio, /Progress \/ Reports/);
  assert.match(netlifyConfig, /node_bundler\s*=\s*"esbuild"/);
});
