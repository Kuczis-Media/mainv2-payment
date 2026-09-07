'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const script = fs.readFileSync(require.resolve('../public/assets/js/site-brand.js'), 'utf8');
const ids = ['home', 'about', 'services', 'pricing', 'skills', 'contact'];
function model(branding = {}) {
  return { version: 3, revision: 2, branding: { brandName: 'TestMed', companyName: 'Test Company', primaryColor: '#112233', faviconUrl: 'https://example.com/favicon.png', ...branding }, sections: ids.map((id) => ({ id })) };
}

async function run({ cache, response = null, route } = {}) {
  const storage = new Map(Object.entries(cache || {}));
  const names = [{ textContent: 'NextMed' }];
  const company = [{ textContent: 'NextMed' }];
  const title = { dataset: { brandTitle: 'Panel kursanta' } };
  const icon = { href: '/icon.svg', type: 'image/svg+xml', removeAttribute(name) { delete this[name]; } };
  const styles = [];
  const calls = [];
  const document = {
    title: 'Panel kursanta — NextMed',
    querySelector: (selector) => selector === 'title[data-brand-title]' ? title : null,
    querySelectorAll: (selector) => ({ '[data-brand-name]': names, '[data-company-name]': company, 'link[rel="icon"]': [icon] }[selector] || []),
    getElementById: (id) => styles.find((entry) => entry.id === id),
    createElement: () => ({}),
    head: { append: (node) => styles.push(node) }
  };
  vm.runInNewContext(script, {
    document, URL, AbortController, Date,
    window: { setTimeout, clearTimeout, ...(route ? { NextMedLandingSource: { ready: Promise.resolve(route) }, NextMedLandingDelivery: require('../public/assets/js/landing-delivery-model.js') } : {}) },
    localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => response }; }
  });
  await new Promise((resolve) => setImmediate(resolve));
  return { document, names, company, icon, styles, calls, storage };
}

test('shared public cache updates shell names, title and favicon without another request', async () => {
  const result = await run({ cache: { 'chem.landing.public.v3': JSON.stringify({ model: model(), checkedAt: Date.now() }) } });
  assert.equal(result.names[0].textContent, 'TestMed');
  assert.equal(result.company[0].textContent, 'Test Company');
  assert.equal(result.document.title, 'Panel kursanta — TestMed');
  assert.equal(result.icon.href, 'https://example.com/favicon.png');
  assert.equal(result.icon.type, undefined);
  assert.equal(result.calls.length, 0);
});

test('branding follows the custom JSON source, ignoring a fresh cache from another repository', async () => {
  const delivery = require('../public/assets/js/landing-delivery-model.js');
  const route = delivery.normalize({ externalEnabled: true, externalUrl: 'start.netlify.app', target: { repository: 'NextMed/site', ref: 'main', path: 'custom.json' } });
  const result = await run({ route,
    cache: { 'chem.landing.public.v3': JSON.stringify({ model: model({ brandName: 'Wrong repository' }), checkedAt: Date.now() }) },
    response: { active: true, model: model({ brandName: 'Selected repository' }) }
  });
  assert.equal(result.names[0].textContent, 'Selected repository');
  assert.equal(result.calls[0].url, delivery.rawUrl(route.target));
  assert.equal(result.calls[0].options.credentials, 'omit');
  assert.equal(JSON.parse(result.storage.get('nextmed.site-brand.v1')).configUrl, delivery.rawUrl(route.target));
});

test('Blob publication branding overrides an older GitHub cache with no second request', async () => {
  const delivery = require('../public/assets/js/landing-delivery-model.js');
  const route = { ...delivery.normalize(), publication: { mode: 'netlify-blobs', active: true, version: 'new', model: model({ brandName: 'Live Blobs' }) } };
  const result = await run({ route, cache: { 'chem.landing.public.v3': JSON.stringify({ model: model({ brandName: 'Old GitHub' }), checkedAt: Date.now() }) } });
  assert.equal(result.names[0].textContent, 'Live Blobs');
  assert.equal(result.calls.length, 0);
});

test('a new GitHub publication version refreshes branding even when the previous cache is fresh', async () => {
  const delivery = require('../public/assets/js/landing-delivery-model.js');
  const route = { ...delivery.normalize(), publication: { mode: 'static-github', active: false, version: 'new' } };
  const result = await run({ route, cache: { 'chem.landing.public.v3': JSON.stringify({ model: model({ brandName: 'Old GitHub' }), checkedAt: Date.now(), publicationVersion: 'old' }) }, response: { active: true, model: model({ brandName: 'New GitHub' }) } });
  assert.equal(result.names[0].textContent, 'New GitHub');
  assert.equal(result.calls.length, 1);
  assert.equal(JSON.parse(result.storage.get('nextmed.site-brand.v1')).publicationVersion, 'new');
});

test('expired shell cache refreshes only public GitHub data without credentials', async () => {
  const result = await run({
    cache: { 'nextmed.site-brand.v1': JSON.stringify({ model: model({ brandName: 'Old' }), checkedAt: Date.now() - 16 * 60 * 1000 }) },
    response: { active: true, model: model({ brandName: 'New' }) }
  });
  assert.equal(result.calls.length, 1);
  assert.equal(result.calls[0].url, 'https://raw.githubusercontent.com/Kuczis-Media/logo/main/landing/config.json');
  assert.equal(result.calls[0].options.credentials, 'omit');
  assert.equal(result.calls[0].options.headers.Authorization, undefined);
  assert.equal(result.names[0].textContent, 'New');
  assert.equal(JSON.parse(result.storage.get('nextmed.site-brand.v1')).model.branding.brandName, 'New');
});

test('malformed public models cannot overwrite the checked-in brand', async () => {
  const broken = model();
  broken.sections[0].id = 'about';
  const result = await run({ response: { active: true, model: broken } });
  assert.equal(result.names[0].textContent, 'NextMed');
  assert.equal(result.styles.length, 0);
  assert.equal(result.storage.has('nextmed.site-brand.v1'), false);
});

test('unsafe asset URLs and CSS are ignored while valid palette stays scoped to light mode', async () => {
  const result = await run({ response: { active: true, model: model({ faviconUrl: 'javascript:alert(1)', textColor: 'red;}body{display:none', brandName: '<img src=x>' }) } });
  assert.equal(result.names[0].textContent, '<img src=x>');
  assert.equal(result.icon.href, '/icon.svg');
  assert.match(result.styles[0].textContent, /:root:not\(\[data-theme="dark"\]\)/);
  assert.match(result.styles[0].textContent, /--primary:#112233/);
  assert.doesNotMatch(result.styles[0].textContent, /display:none[^}]*body|--ink:/);
});

test('an older GitHub revision does not replace a newer cached brand', async () => {
  const recent = model({ brandName: 'Recent' });
  recent.revision = 8;
  const result = await run({
    cache: { 'chem.landing.public.v3': JSON.stringify({ model: recent, checkedAt: Date.now() - 16 * 60 * 1000 }) },
    response: { active: true, model: model({ brandName: 'Old CDN revision' }) }
  });
  assert.equal(result.names[0].textContent, 'Recent');
  assert.equal(result.storage.has('nextmed.site-brand.v1'), false);
});
