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

test('landing draft is separate from published content and public endpoint never returns draft', async () => {
  const store = new MemoryStore();
  landing._test.setStoreFactory(() => store);
  const model = landing.defaultModel();
  model.sections[0].title = 'Tylko draft';
  await landing.saveDraft(store, model, 'admin-1');
  let response = await publicEndpoint.handler({ httpMethod: 'GET' });
  assert.deepEqual(JSON.parse(response.body), { active: false });
  model.sections[0].title = 'Wersja publiczna';
  await landing.publish(store, model, 'admin-1');
  response = await publicEndpoint.handler({ httpMethod: 'GET' });
  const payload = JSON.parse(response.body);
  assert.equal(payload.active, true);
  assert.equal(payload.model.sections[0].title, 'Wersja publiczna');
  assert.equal(payload.model.updatedBy, undefined);
  assert.ok(payload.model.publishedAt);
});

test('landing builder uses textContent and server normalization instead of arbitrary HTML', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'public/members/module/studio/landing/index.html'), 'utf8');
  const builder = fs.readFileSync(path.join(root, 'public/members/module/studio/landing/script.js'), 'utf8');
  const runtime = fs.readFileSync(path.join(root, 'public/assets/js/landing-runtime.js'), 'utf8');
  const studio = fs.readFileSync(path.join(root, 'public/members/module/studio/index.html'), 'utf8');
  assert.match(html, /id="section-list"/);
  assert.match(html, /id="landing-preview"/);
  assert.match(builder, /admin-landing/);
  assert.doesNotMatch(builder, /innerHTML\s*=/);
  assert.match(runtime, /textContent\s*=/);
  assert.doesNotMatch(runtime, /innerHTML\s*=/);
  assert.match(studio, /Landing Page Builder/);
  assert.match(studio, /AI Limits \/ Usage/);
  assert.match(studio, /Progress \/ Reports/);
});
