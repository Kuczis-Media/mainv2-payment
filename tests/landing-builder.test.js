'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const landing = require('../netlify/landing-content.js');
const adminEndpoint = require('../netlify/functions/admin-landing.js');
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

test('publication failure leaves the public page untouched and draft/public revisions stay independent', async (t) => {
  const siteAssets = require('../netlify/site-assets.js');
  t.mock.method(siteAssets, 'readLandingRoute', async () => ({ settings: require('../public/assets/js/landing-delivery-model.js').normalize(), sha: null }));
  const store = new MemoryStore();
  landing._test.setStoreFactory(() => store);
  const user = { id: 'admin-1', app_metadata: { roles: ['admin'] } };
  const context = { clientContext: { user, identity: { url: 'https://course.example/.netlify/identity' } } };
  const headers = {
    authorization: 'Bearer test', 'content-type': 'application/json', origin: 'https://course.example',
    host: 'course.example', 'x-forwarded-proto': 'https'
  };
  t.mock.method(global, 'fetch', async () => new Response(JSON.stringify(user), { status: 200 }));
  const draft = await landing.saveDraft(store, landing.defaultModel(), user.id);
  const publishBody = { action: 'publish', model: draft, expectedPublishedSha: null };
  const event = { httpMethod: 'POST', headers, body: JSON.stringify(publishBody) };
  const publisher = t.mock.method(siteAssets, 'publishLandingConfig', async () => {
    const error = new Error('Failed'); error.code = 'LANDING_STATIC_PUBLISH_FAILED'; error.status = 503; throw error;
  });
  const failure = await adminEndpoint.handler(event, context);
  assert.equal(failure.statusCode, 503);
  assert.equal(store.entries.has(landing.PUBLISHED_KEY), false);
  assert.equal((await landing.readModel(store, landing.DRAFT_KEY)).model.revision, draft.revision);

  publisher.mock.mockImplementation(async (input) => ({
    model: { ...landing.publicModel(input), revision: 12, publishedAt: new Date().toISOString() }, sha: 'a'.repeat(40), mode: 'static-github'
  }));
  const success = await adminEndpoint.handler(event, context);
  assert.equal(success.statusCode, 200);
  const payload = JSON.parse(success.body);
  assert.equal(payload.published.revision, 12);
  assert.equal(payload.draft.revision, draft.revision + 1);
  assert.equal(payload.delivery.static, true);
  payload.draft.sections[0].title = 'Edit after publish';
  const nextSave = await adminEndpoint.handler({ httpMethod: 'PUT', headers, body: JSON.stringify({ model: payload.draft }) }, context);
  assert.equal(nextSave.statusCode, 200);
  assert.match(fs.readFileSync(path.join(__dirname, '../public/members/module/studio/landing/script.js'), 'utf8'), /normalizeLocalModel\(payload.draft \|\| payload.published\)/);
});

test('landing model has stable sections and rejects unsafe URLs and styles', () => {
  const model = landing.defaultModel();
  assert.equal(model.version, 3);
  assert.equal(model.branding.brandName, 'NextMed');
  assert.equal(model.branding.logoAlt, 'NextMed');
  assert.equal(model.branding.companyName, 'NextMed');
  assert.equal(model.branding.primaryColor, '#176b54');
  assert.equal(model.sections.find((section) => section.id === 'about').imageUrl, '/assets/start_site/learning-map.svg');
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

test('landing rejects backslash paths that browsers can reinterpret as a remote host', () => {
  const unsafeImage = landing.defaultModel();
  unsafeImage.sections[0].imageUrl = '/\\evil.example/hero.png';
  assert.throws(
    () => landing.normalizeModel(unsafeImage, true),
    (error) => error.code === 'INVALID_LANDING_IMAGE_URL' && error.status === 400
  );

  const unsafeLink = landing.defaultModel();
  unsafeLink.sections[0].ctaHref = '/\\evil.example/checkout';
  assert.throws(
    () => landing.normalizeModel(unsafeLink, true),
    (error) => error.code === 'INVALID_LANDING_LINK' && error.status === 400
  );
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
  legacy.sections.find((section) => section.id === 'about').imageUrl = '';
  legacy.sections.find((section) => section.id === 'about').body = '';
  legacy.sections.find((section) => section.id === 'about').ctaLabel = '';
  legacy.sections.find((section) => section.id === 'about').ctaHref = '';
  legacy.sections.find((section) => section.id === 'skills').ctaLabel = '';
  legacy.sections.find((section) => section.id === 'skills').ctaHref = '';

  const migrated = landing.normalizeModel(legacy);
  const defaults = landing.defaultModel();
  assert.equal(migrated.sections.find((section) => section.id === 'about').imageUrl, '/assets/start_site/learning-map.svg');
  assert.equal(migrated.sections.find((section) => section.id === 'about').body, defaults.sections.find((section) => section.id === 'about').body);
  assert.equal(migrated.sections.find((section) => section.id === 'about').ctaHref, '#services');
  assert.equal(migrated.sections.find((section) => section.id === 'skills').ctaHref, '#pricing');
});

test('landing v2 migrates former ChemDisk defaults to NextMed without replacing custom branding', () => {
  const legacy = landing.defaultModel();
  legacy.version = 2;
  legacy.branding = {
    brandName: 'ChemDisk',
    logoUrl: '',
    logoAlt: 'ChemDisk',
    siteTitle: 'ChemDisk — kursy maturalne online',
    siteDescription: 'Własny opis SEO',
    companyName: 'Kursy Maturalne',
    footerText: 'Kursy Maturalne · kursy maturalne'
  };
  legacy.sections.find((section) => section.id === 'home').subtitle = 'Witaj w ChemDisk';

  const migrated = landing.normalizeModel(legacy);
  assert.equal(migrated.version, 3);
  assert.equal(migrated.branding.brandName, 'NextMed');
  assert.equal(migrated.branding.logoAlt, 'NextMed');
  assert.equal(migrated.branding.siteTitle, 'NextMed — kursy maturalne online');
  assert.equal(migrated.branding.companyName, 'NextMed');
  assert.equal(migrated.branding.footerText, 'NextMed · kursy maturalne');
  assert.equal(migrated.branding.siteDescription, 'Własny opis SEO');
  assert.equal(migrated.sections.find((section) => section.id === 'home').subtitle, 'Twój kierunek: więcej możliwości');

  legacy.branding.brandName = 'MedNova';
  legacy.branding.logoAlt = 'Logo MedNova';
  legacy.branding.siteTitle = 'MedNova — indywidualny kurs';
  legacy.branding.companyName = 'MedNova sp. z o.o.';
  legacy.branding.footerText = '© MedNova';
  const custom = landing.normalizeModel(legacy);
  assert.equal(custom.branding.brandName, 'MedNova');
  assert.equal(custom.branding.logoAlt, 'Logo MedNova');
  assert.equal(custom.branding.siteTitle, 'MedNova — indywidualny kurs');
  assert.equal(custom.branding.companyName, 'MedNova sp. z o.o.');
  assert.equal(custom.branding.footerText, '© MedNova');
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
  assert.match(response.headers['Cache-Control'], /max-age=60/);
  draft.sections[0].title = 'Wersja publiczna';
  await landing.publish(store, draft, 'admin-1');
  response = await publicEndpoint.handler({ httpMethod: 'GET' });
  const payload = JSON.parse(response.body);
  assert.equal(payload.active, true);
  assert.equal(payload.model.sections[0].title, 'Wersja publiczna');
  assert.equal(payload.model.updatedBy, undefined);
  assert.ok(payload.model.publishedAt);
  assert.equal(payload.model.branding.logoAlt, 'NextMed');
});

test('admin landing handler rejects a missing model instead of saving or publishing defaults', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  let identityCalls = 0;
  global.fetch = async () => {
    identityCalls += 1;
    return new Response(JSON.stringify({ id: 'admin-1', app_metadata: { roles: ['admin'] } }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  landing._test.setStoreFactory(() => { throw new Error('storage must not be opened'); });
  const context = {
    clientContext: {
      user: { id: 'admin-1', app_metadata: { roles: ['admin'] } },
      identity: { url: 'https://course.example/.netlify/identity' }
    }
  };
  const headers = {
    authorization: 'Bearer verified-admin-token',
    'content-type': 'application/json; charset=utf-8',
    origin: 'https://course.example',
    host: 'course.example',
    'x-forwarded-proto': 'https'
  };

  const put = await adminEndpoint.handler({ httpMethod: 'PUT', headers, body: '{}' }, context);
  assert.equal(put.statusCode, 400);
  assert.deepEqual(JSON.parse(put.body), { error: 'INVALID_LANDING_MODEL' });

  const post = await adminEndpoint.handler({
    httpMethod: 'POST',
    headers,
    body: JSON.stringify({ action: 'publish' })
  }, context);
  assert.equal(post.statusCode, 400);
  assert.deepEqual(JSON.parse(post.body), { error: 'INVALID_LANDING_MODEL' });
  assert.equal(identityCalls, 2);
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
  assert.match(builder, /nextmed:landing-preview:model/);
  assert.match(builder, /expectedPublishedSha: publication.sha/);
  assert.match(html, /<iframe[^>]*id="landing-preview"/);
  assert.match(builder, /fetchPriority = 'low'/);
  assert.match(html, /rel="preconnect" href="https:\/\/cdn\.jsdelivr\.net"/);
  assert.match(studio, /rel="preconnect" href="https:\/\/cdn\.jsdelivr\.net"/);
  assert.doesNotMatch(builder, /innerHTML\s*=/);
  assert.match(runtime, /textContent\s*=/);
  assert.match(runtime, /fetchPayload\(FUNCTION_ENDPOINT,\s*'default'\)/);
  assert.match(runtime, /nextmed-landing-config/);
  assert.match(runtime, /branding/);
  assert.doesNotMatch(runtime, /innerHTML\s*=/);
  assert.match(studio, /Landing Page Builder/);
  assert.match(studio, /Logo i assety strony/);
  assert.match(studio, /AI Limits \/ Usage/);
  assert.match(studio, /Progress \/ Reports/);
  assert.match(netlifyConfig, /node_bundler\s*=\s*"esbuild"/);
});
