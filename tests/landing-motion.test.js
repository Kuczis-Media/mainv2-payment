'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup({ reduced = false, preview = false } = {}) {
  const listeners = {}; const documentListeners = {}; const scheduled = new Map();
  const mediaListeners = {}; const appended = []; const removed = []; let sequence = 0;
  function node() {
    const events = {}; const properties = {}; const classes = new Set();
    return {
      events, dataset: {}, attributes: {}, style: { setProperty: (key, value) => { properties[key] = value; }, removeProperty: (key) => { delete properties[key]; }, properties },
      classList: { toggle: (key, on) => { if (on) classes.add(key); else classes.delete(key); return on; }, add: (key) => classes.add(key), remove: (key) => classes.delete(key), contains: (key) => classes.has(key) },
      setAttribute(key, value) { this.attributes[key] = value; }, addEventListener: (name, cb) => { events[name] = cb; },
      remove() { removed.push(this); }, getBoundingClientRect: () => ({ top: 100, bottom: 300, height: 200 })
    };
  }
  const offer = node(), toggle = node(), progress = node(), parallax = node(), reveal = node();
  parallax.dataset.parallax = '80';
  const root = node(); root.scrollHeight = 2400; root.scrollTop = 0;
  const media = { matches: reduced, addEventListener: (event, listener) => { mediaListeners[event] = listener; } };
  const context = {
    URLSearchParams, location: { search: preview ? '?landing-preview=1' : '' },
    sessionStorage: { getItem: () => null, setItem() {} },
    innerHeight: 800, innerWidth: 1280, scrollY: 400,
    matchMedia: () => media,
    requestAnimationFrame: (callback) => { scheduled.set(++sequence, callback); return sequence; },
    cancelAnimationFrame: (id) => scheduled.delete(id),
    addEventListener: (event, listener) => { listeners[event] = listener; },
    setTimeout: () => 1, clearTimeout() {},
    document: {
      documentElement: root, hidden: false,
      getElementById: (id) => ({ 'motion-toggle': toggle, 'load-offer': offer })[id] || null,
      querySelector: (selector) => selector === '.reading-progress span' ? progress : null,
      querySelectorAll: (selector) => selector === '[data-parallax]' ? [parallax] : selector === '[data-reveal]' ? [reveal] : [],
      addEventListener: (event, listener) => { documentListeners[event] = listener; },
      createElement: node, head: { append: (item) => appended.push(item) }
    },
    IntersectionObserver: class { observe() {} disconnect() {} unobserve() {} }
  };
  context.window = context; context.parent = preview ? {} : context;
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/assets/start_site/script.js'), 'utf8'), context);
  function flush() { const pending = [...scheduled.values()]; scheduled.clear(); pending.forEach((callback) => callback()); }
  return { context, listeners, documentListeners, scheduled, media, mediaListeners, appended, removed, offer, toggle, progress, parallax, reveal, root, flush };
}

test('landing parallax batches scroll events into one frame and has no idle animation loop', () => {
  const scene = setup(); scene.flush();
  assert.equal(scene.scheduled.size, 0);
  scene.listeners.scroll(); scene.listeners.scroll(); scene.listeners.scroll();
  assert.equal(scene.scheduled.size, 1);
  scene.flush();
  assert.equal(scene.scheduled.size, 0);
  assert.equal(scene.progress.style.transform, 'scaleX(0.25)');
  assert.ok(scene.parallax.style.properties['--parallax-y']);
  assert.equal(scene.appended.length, 0, 'Initial visit never loads payments or Identity scripts');
});

test('reduced motion, page setting and reader toggle disable movement', () => {
  const scene = setup({ reduced: true }); scene.flush();
  assert.equal(scene.root.classList.contains('motion-enabled'), false);
  assert.equal(scene.parallax.style.properties['--parallax-y'], undefined);
  assert.equal(scene.reveal.classList.contains('is-visible'), true);
  scene.media.matches = false; scene.mediaListeners.change(); scene.flush();
  assert.equal(scene.root.classList.contains('motion-enabled'), true);
  scene.toggle.events.click(); scene.flush();
  assert.equal(scene.root.classList.contains('motion-enabled'), false);
  scene.root.dataset.motion = 'off'; scene.documentListeners['chemdisk-landing-applied']();
  assert.equal(scene.toggle.hidden, true);
});

test('public pricing is opt-in, deduplicated and retryable without an eager Function request', () => {
  const scene = setup();
  scene.offer.events.click(); scene.offer.events.click();
  assert.equal(scene.appended.length, 1);
  assert.equal(scene.appended[0].src, '/assets/payments/payments.js');
  scene.appended[0].onerror();
  assert.equal(scene.offer.disabled, false);
  scene.offer.events.click(); assert.equal(scene.appended.length, 2);
});

test('editor preview never fetches live pricing, even when the offer button is clicked', () => {
  const scene = setup({ preview: true }); scene.offer.events.click();
  assert.equal(scene.appended.length, 0);
});
