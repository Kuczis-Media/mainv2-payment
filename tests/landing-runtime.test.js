'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(name) { this.values.add(name); }
  remove(name) { this.values.delete(name); }
  contains(name) { return this.values.has(name); }
  toggle(name, force) {
    const enabled = force === undefined ? !this.values.has(name) : Boolean(force);
    if (enabled) this.values.add(name);
    else this.values.delete(name);
    return enabled;
  }
}

class FakeStyle {
  constructor() { this.values = {}; }
  setProperty(name, value) { this.values[name] = value; }
  removeProperty(name) { delete this.values[name]; }
}

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.hidden = false;
    this.dataset = {};
    this.style = new FakeStyle();
    this.classList = new FakeClassList();
    this.className = '';
    this.children = [];
    this.attributes = new Map();
    this.selectors = new Map();
    this.textContent = '';
    this.parent = null;
  }
  addEventListener(name, listener) { this[`on${name}`] = listener; }
  append(...nodes) { nodes.forEach((node) => this.insert(node, false)); }
  prepend(...nodes) { [...nodes].reverse().forEach((node) => this.insert(node, true)); }
  insert(node, first) {
    if (node && typeof node === 'object' && node.parent) {
      const previousIndex = node.parent.children.indexOf(node);
      if (previousIndex >= 0) node.parent.children.splice(previousIndex, 1);
    }
    if (node && typeof node === 'object') node.parent = this;
    if (first) this.children.unshift(node);
    else this.children.push(node);
  }
  insertBefore(node, reference) {
    if (node && typeof node === 'object' && node.parent) {
      const previousIndex = node.parent.children.indexOf(node);
      if (previousIndex >= 0) node.parent.children.splice(previousIndex, 1);
    }
    if (node && typeof node === 'object') node.parent = this;
    const index = reference ? this.children.indexOf(reference) : -1;
    this.children.splice(index < 0 ? this.children.length : index, 0, node);
  }
  after(node) {
    if (!this.parent) return;
    const index = this.parent.children.indexOf(this);
    if (node && typeof node === 'object') node.parent = this.parent;
    this.parent.children.splice(index < 0 ? this.parent.children.length : index + 1, 0, node);
  }
  before(node) { this.beforeCalls = [...(this.beforeCalls || []), node]; }
  replaceChildren(...nodes) {
    this.children = [];
    this.textContent = '';
    this.append(...nodes);
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  querySelector(selector) {
    if (this.selectors.has(selector)) return this.selectors.get(selector);
    if (selector === '.landing-section-image') return this.findByClass('landing-section-image');
    return null;
  }
  findByClass(name) {
    for (const child of this.children) {
      if (!child || typeof child !== 'object') continue;
      if (String(child.className || '').split(/\s+/).includes(name)) return child;
      const nested = typeof child.findByClass === 'function' ? child.findByClass(name) : null;
      if (nested) return nested;
    }
    return null;
  }
  closest(selector) { return selector === 'li' ? this.listItem || null : null; }
}

function landingDom() {
  const ids = ['home', 'about', 'services', 'pricing', 'skills', 'contact'];
  const targetSelectors = {
    home: ['.text-2', '.text-1', '.text-3', '#login-cta'],
    about: ['.title', '.column.right .text', '.column.right p', '.column.left img', '.column.right a'],
    services: ['.title', '.landing-section-subtitle', '.landing-section-body', '.landing-section-cta'],
    pricing: ['.title', '.landing-section-subtitle', '.pricing-intro', '.landing-section-cta'],
    skills: ['.title', '.column.left .text', '.column.left p', '.column.left a'],
    contact: ['.title', '.column.left .text', '.column.left > p', '.landing-section-cta']
  };
  const sections = {};
  ids.forEach((id) => {
    const section = new FakeElement('section');
    section.id = id;
    const container = new FakeElement('div');
    section.children.push(container);
    container.parent = section;
    section.selectors.set('.max-width', container);
    targetSelectors[id].forEach((selector) => {
      const element = new FakeElement(selector.includes('img') ? 'img' : selector.includes('a') || selector.includes('cta') ? 'a' : 'div');
      element.textContent = 'wartość statyczna';
      element.setAttribute('src', '/old.png');
      section.selectors.set(selector, element);
      container.children.push(element);
      element.parent = container;
    });
    const lead = section.selectors.get('.landing-section-body')
      || section.selectors.get('.pricing-intro')
      || section.selectors.get('.title');
    if (lead) container.selectors.set('.landing-section-body, .pricing-intro, .title', lead);
    sections[id] = section;
  });

  const footer = new FakeElement('footer');
  const navbar = new FakeElement('nav');
  const menu = new FakeElement('ul');
  const brand = new FakeElement('a');
  const description = { content: 'opis statyczny' };
  const links = Object.fromEntries(ids.map((id) => {
    const link = new FakeElement('a');
    link.listItem = new FakeElement('li');
    link.listItem.id = `nav-${id}`;
    link.listItem.append(link);
    menu.append(link.listItem);
    return [id, link];
  }));
  const fixedMenuItem = new FakeElement('li');
  fixedMenuItem.id = 'nav-login';
  menu.append(fixedMenuItem);
  const document = {
    title: 'Tytuł statyczny',
    documentElement: { dataset: {} },
    events: [],
    getElementById: (id) => sections[id] || null,
    createElement: (tag) => new FakeElement(tag),
    createTextNode: (value) => ({ nodeType: 3, textContent: String(value) }),
    dispatchEvent(event) { this.events.push(event); },
    querySelector(selector) {
      if (selector === 'footer') return footer;
      if (selector === '.navbar') return navbar;
      if (selector === '.navbar .menu') return menu;
      if (selector === '.navbar .logo a') return brand;
      if (selector === 'meta[name="description"]') return description;
      const match = /^\.navbar \.menu a\[href="#([a-z]+)"\]$/.exec(selector);
      return match ? links[match[1]] || null : null;
    }
  };
  return { document, sections, footer, navbar, menu, brand, description, links };
}

test('published landing runtime clears fields, reorders sections and applies the local cache without waiting for a Function', () => {
  const dom = landingDom();
  const model = {
    version: 2,
    revision: 7,
    branding: { logoUrl: '', logoAlt: '', siteTitle: '', siteDescription: '' },
    sections: [
      { id: 'home', order: 2, enabled: false, title: '', subtitle: '', body: '', imageUrl: '', imageAlt: '', backgroundColor: '', textColor: '', accentColor: '', ctaLabel: '', ctaHref: '' },
      { id: 'about', order: 1, enabled: true, title: '', subtitle: '', body: '', imageUrl: '', imageAlt: '', backgroundColor: '', textColor: '', accentColor: '', ctaLabel: 'Bez linku', ctaHref: '' },
      { id: 'services', order: 0, enabled: true, title: 'Nowe usługi', subtitle: 'Podtytuł', body: 'Opis', imageUrl: 'https://cdn.example/service.webp', imageAlt: 'Usługi', backgroundColor: '#123456', textColor: '#ffffff', accentColor: '#abcdef', ctaLabel: 'Więcej', ctaHref: '/members/' },
      { id: 'pricing', order: 3, enabled: true, title: 'Cennik', subtitle: '', body: '', imageUrl: '', imageAlt: '', backgroundColor: '', textColor: '', accentColor: '', ctaLabel: '', ctaHref: '' },
      { id: 'skills', order: 4, enabled: true, title: 'Start', subtitle: '', body: '', imageUrl: '', imageAlt: '', backgroundColor: '', textColor: '', accentColor: '', ctaLabel: '', ctaHref: '' },
      { id: 'contact', order: 5, enabled: true, title: 'Kontakt', subtitle: '', body: '', imageUrl: '', imageAlt: '', backgroundColor: '', textColor: '', accentColor: '', ctaLabel: '', ctaHref: '' }
    ]
  };
  const storage = new Map([['chem.landing.public.v2', JSON.stringify(model)]]);
  const context = {
    console,
    document: dom.document,
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key)
    },
    fetch: async () => ({ ok: false }),
    AbortController,
    CustomEvent: class CustomEvent { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    URL
  };
  context.window = context;
  context.window.setTimeout = () => 1;
  context.window.clearTimeout = () => {};

  const script = fs.readFileSync(path.join(__dirname, '../public/assets/js/landing-runtime.js'), 'utf8');
  vm.runInNewContext(script, context, { filename: 'landing-runtime.js' });

  assert.equal(dom.sections.home.hidden, true);
  assert.equal(dom.sections.home.style.backgroundImage, 'none');
  assert.equal(dom.sections.about.selectors.get('.title').textContent, '');
  assert.equal(dom.sections.about.selectors.get('.title').hidden, true);
  assert.equal(dom.sections.about.selectors.get('.column.left img').hidden, true);
  assert.equal(dom.sections.about.classList.contains('landing-no-image'), true);
  assert.equal(dom.sections.about.selectors.get('.column.right a').hidden, true);
  assert.equal(dom.sections.about.selectors.get('.column.right a').attributes.has('href'), false);
  assert.equal(dom.sections.services.selectors.get('.title').textContent, 'Nowe usługi');
  assert.equal(dom.sections.services.style.values['background-color'], '#123456');
  assert.equal(dom.sections.services.style.values['--landing-accent'], '#abcdef');
  assert.equal(dom.sections.services.querySelector('.landing-section-image').attributes.get('src'), undefined);
  assert.equal(dom.sections.services.querySelector('.landing-section-image').src, 'https://cdn.example/service.webp');
  assert.equal(dom.sections.services.selectors.get('.landing-section-cta').attributes.get('href'), '/members/');
  assert.equal(dom.links.home.listItem.hidden, true);
  assert.equal(dom.links.about.listItem.hidden, false);
  assert.equal(dom.navbar.classList.contains('landing-solid'), true);
  assert.deepEqual(dom.menu.children.map((item) => item.id), ['nav-services', 'nav-about', 'nav-home', 'nav-pricing', 'nav-skills', 'nav-contact', 'nav-login']);
  assert.deepEqual(dom.footer.beforeCalls.map((section) => section.id), ['services', 'about', 'home', 'pricing', 'skills', 'contact']);
  assert.equal(dom.document.title, '');
  assert.equal(dom.description.content, '');
  assert.equal(dom.brand.classList.contains('has-brand-image'), false);
  assert.equal(dom.document.documentElement.dataset.landingPublished, 'true');
  assert.equal(dom.document.events[0].detail.revision, 7);
});

test('landing runtime uses a solid navbar over a light hero without an image', () => {
  const dom = landingDom();
  const model = {
    revision: 1,
    branding: {},
    sections: [
      { id: 'home', order: 0, enabled: true, title: '', subtitle: '', body: '', imageUrl: '', backgroundColor: '#ffffff', ctaLabel: '', ctaHref: '' },
      ...['about', 'services', 'pricing', 'skills', 'contact'].map((id, index) => ({ id, order: index + 1, enabled: true, title: '', subtitle: '', body: '', imageUrl: '', ctaLabel: '', ctaHref: '' }))
    ]
  };
  const context = {
    console,
    document: dom.document,
    localStorage: { getItem: () => JSON.stringify(model), setItem: () => {}, removeItem: () => {} },
    fetch: async () => ({ ok: false }),
    AbortController,
    CustomEvent: class CustomEvent {},
    URL
  };
  context.window = context;
  context.window.setTimeout = () => 1;
  context.window.clearTimeout = () => {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/assets/js/landing-runtime.js'), 'utf8'), context);
  assert.equal(dom.navbar.classList.contains('landing-solid'), true);
});

test('landing runtime leaves checked-in HTML untouched when neither cache nor Function is available', async () => {
  const dom = landingDom();
  const context = {
    console,
    document: dom.document,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    fetch: async () => { throw new Error('offline'); },
    AbortController,
    CustomEvent: class CustomEvent {},
    URL
  };
  context.window = context;
  context.window.setTimeout = () => 1;
  context.window.clearTimeout = () => {};

  const script = fs.readFileSync(path.join(__dirname, '../public/assets/js/landing-runtime.js'), 'utf8');
  vm.runInNewContext(script, context, { filename: 'landing-runtime.js' });
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(dom.document.title, 'Tytuł statyczny');
  assert.equal(dom.sections.about.selectors.get('.title').textContent, 'wartość statyczna');
  assert.equal(dom.document.documentElement.dataset.landingPublished, undefined);
  assert.equal(dom.footer.beforeCalls, undefined);
});

test('an error from an obsolete logo request cannot replace the newer logo', async () => {
  const dom = landingDom();
  const sections = ['home', 'about', 'services', 'pricing', 'skills', 'contact'].map((id, order) => ({
    id, order, enabled: true, title: id, subtitle: '', body: '', imageUrl: '', imageAlt: '', ctaLabel: '', ctaHref: ''
  }));
  const cached = { revision: 1, branding: { logoUrl: 'https://cdn.example/old.svg', logoAlt: 'Stare' }, sections };
  const fresh = { revision: 2, branding: { logoUrl: 'https://cdn.example/new.svg', logoAlt: 'Nowe' }, sections };
  const context = {
    console,
    document: dom.document,
    localStorage: { getItem: () => JSON.stringify(cached), setItem: () => {}, removeItem: () => {} },
    fetch: async () => ({ ok: true, json: async () => ({ active: true, model: fresh }) }),
    AbortController,
    CustomEvent: class CustomEvent { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    URL,
    location: { reload() {} }
  };
  context.window = context;
  context.window.setTimeout = () => 1;
  context.window.clearTimeout = () => {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/assets/js/landing-runtime.js'), 'utf8'), context);
  const obsoleteImage = dom.brand.children[0];
  await new Promise((resolve) => setImmediate(resolve));
  const currentImage = dom.brand.children[0];
  assert.equal(currentImage.src, 'https://cdn.example/new.svg');
  obsoleteImage.onerror();
  assert.equal(dom.brand.children[0], currentImage);
  assert.equal(dom.brand.classList.contains('has-brand-image'), true);
});

test('an inactive server model clears a previously applied cache and restores static HTML once', async () => {
  const dom = landingDom();
  const model = {
    revision: 1,
    branding: {},
    sections: ['home', 'about', 'services', 'pricing', 'skills', 'contact'].map((id, order) => ({
      id, order, enabled: true, title: `Cache ${id}`, subtitle: '', body: '', imageUrl: '', ctaLabel: '', ctaHref: ''
    }))
  };
  const storage = new Map([['chem.landing.public.v2', JSON.stringify(model)]]);
  let reloads = 0;
  const context = {
    console,
    document: dom.document,
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key)
    },
    fetch: async () => ({ ok: true, json: async () => ({ active: false }) }),
    AbortController,
    CustomEvent: class CustomEvent {},
    URL,
    location: { reload: () => { reloads += 1; } }
  };
  context.window = context;
  context.window.setTimeout = () => 1;
  context.window.clearTimeout = () => {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/assets/js/landing-runtime.js'), 'utf8'), context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(storage.has('chem.landing.public.v2'), false);
  assert.equal(reloads, 1);
});

test('a blocked landing cache cannot cause an endless reload loop', async () => {
  const dom = landingDom();
  const model = {
    revision: 1,
    branding: {},
    sections: ['home', 'about', 'services', 'pricing', 'skills', 'contact'].map((id, order) => ({
      id, order, enabled: true, title: id, subtitle: '', body: '', imageUrl: '', ctaLabel: '', ctaHref: ''
    }))
  };
  let reloads = 0;
  const context = {
    console,
    document: dom.document,
    localStorage: {
      getItem: () => JSON.stringify(model),
      setItem: () => {},
      removeItem: () => { throw new Error('storage blocked'); }
    },
    fetch: async () => ({ ok: true, json: async () => ({ active: false }) }),
    AbortController,
    CustomEvent: class CustomEvent {},
    URL,
    location: { reload: () => { reloads += 1; } }
  };
  context.window = context;
  context.window.setTimeout = () => 1;
  context.window.clearTimeout = () => {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/assets/js/landing-runtime.js'), 'utf8'), context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reloads, 0);
});

test('a malformed active response keeps the last valid landing cache', async () => {
  const dom = landingDom();
  const model = {
    revision: 8,
    branding: {},
    sections: ['home', 'about', 'services', 'pricing', 'skills', 'contact'].map((id, order) => ({
      id, order, enabled: true, title: `Cached ${id}`, subtitle: '', body: '', imageUrl: '', ctaLabel: '', ctaHref: ''
    }))
  };
  const cachedText = JSON.stringify(model);
  const storage = new Map([['chem.landing.public.v2', cachedText]]);
  let reloads = 0;
  const context = {
    console,
    document: dom.document,
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key)
    },
    fetch: async () => ({ ok: true, json: async () => ({ active: true, model: { revision: 9 } }) }),
    AbortController,
    CustomEvent: class CustomEvent {},
    URL,
    location: { reload: () => { reloads += 1; } }
  };
  context.window = context;
  context.window.setTimeout = () => 1;
  context.window.clearTimeout = () => {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/assets/js/landing-runtime.js'), 'utf8'), context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(storage.get('chem.landing.public.v2'), cachedText);
  assert.equal(dom.sections.home.selectors.get('.text-2').textContent, 'Cached home');
  assert.equal(reloads, 0);
});
