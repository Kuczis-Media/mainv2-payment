(function applyPublishedLanding() {
  'use strict';

  const ENDPOINT = '/.netlify/functions/landing';
  const CACHE_KEY = 'chem.landing.public.v2';
  const REQUEST_TIMEOUT_MS = 5_000;
  let brandingRequestId = 0;
  const COPY_TARGETS = {
    home: { title: '.text-2', subtitle: '.text-1', body: '.text-3', image: 'background', cta: '#login-cta' },
    about: { title: '.title', subtitle: '.column.right .text', body: '.column.right p', image: '.column.left img', cta: '.column.right a' },
    services: { title: '.title', subtitle: '.landing-section-subtitle', body: '.landing-section-body', image: 'managed', cta: '.landing-section-cta' },
    pricing: { title: '.title', subtitle: '.landing-section-subtitle', body: '.pricing-intro', image: 'managed', cta: '.landing-section-cta' },
    skills: { title: '.title', subtitle: '.column.left .text', body: '.column.left p', image: 'managed', cta: '.column.left a' },
    contact: { title: '.title', subtitle: '.column.left .text', body: '.column.left > p', image: 'managed', cta: '.landing-section-cta' }
  };

  const cached = readCache();
  if (cached) applyModel(cached);
  void refresh();

  async function refresh() {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(ENDPOINT, {
        cache: 'default',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      if (!response.ok) return;
      const payload = await response.json();
      if (payload?.active === false) {
        let cacheRemoved = false;
        try {
          localStorage.removeItem(CACHE_KEY);
          cacheRemoved = !readCache();
        } catch {}
        if (cached && cacheRemoved && typeof window.location?.reload === 'function') window.location.reload();
        return;
      }
      if (payload?.active !== true || !Array.isArray(payload.model?.sections)) return;
      applyModel(payload.model);
      writeCache(payload.model);
    } catch {
      // The checked-in HTML and the last local copy remain a fast fallback.
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function applyModel(model) {
    applyBranding(model.branding || {});
    const footer = document.querySelector('footer');
    const ordered = [...model.sections].sort((left, right) => (left.order || 0) - (right.order || 0));
    const enabledSectionIds = new Set(ordered.filter((section) => section.enabled !== false).map((section) => section.id));
    ordered.forEach((config) => {
      const section = document.getElementById(config.id);
      if (!section) return;
      section.hidden = config.enabled === false;
      section.dataset.landingManaged = 'true';
      setStyle(section, 'background-color', config.backgroundColor);
      setStyle(section, 'color', config.textColor);
      setStyle(section, '--landing-accent', config.accentColor);
      const targets = COPY_TARGETS[config.id] || {};
      setText(section, targets.title, config.title);
      setText(section, targets.subtitle, config.subtitle);
      setText(section, targets.body, config.body);
      applyImage(section, targets.image, config);
      applyCta(section, targets.cta, config, enabledSectionIds);
      syncNavigation(config);
      if (footer) footer.before(section);
    });
    reorderNavigation(ordered);
    const firstVisible = ordered.find((section) => section.enabled !== false);
    document.querySelector('.navbar')?.classList.toggle('landing-solid', needsSolidNavbar(firstVisible));
    document.documentElement.dataset.landingPublished = 'true';
    document.dispatchEvent(new CustomEvent('chemdisk-landing-applied', { detail: { revision: model.revision || 0 } }));
  }

  function applyBranding(branding) {
    const requestId = ++brandingRequestId;
    if (typeof branding.siteTitle === 'string') document.title = branding.siteTitle;
    const description = document.querySelector('meta[name="description"]');
    if (description && typeof branding.siteDescription === 'string') description.content = branding.siteDescription;
    const anchor = document.querySelector('.navbar .logo a');
    if (!anchor) return;
    const logoUrl = safeImageUrl(branding.logoUrl);
    if (!logoUrl) {
      anchor.classList.remove('has-brand-image');
      const accent = document.createElement('span');
      accent.textContent = 'Disk';
      anchor.replaceChildren(document.createTextNode('Chem'), accent);
      return;
    }
    const image = document.createElement('img');
    image.src = logoUrl;
    image.alt = String(branding.logoAlt || 'ChemDisk');
    image.decoding = 'async';
    image.fetchPriority = 'high';
    image.addEventListener('error', () => {
      if (requestId !== brandingRequestId) return;
      anchor.classList.remove('has-brand-image');
      const accent = document.createElement('span');
      accent.textContent = 'Disk';
      anchor.replaceChildren(document.createTextNode('Chem'), accent);
    }, { once: true });
    anchor.classList.add('has-brand-image');
    anchor.replaceChildren(image);
  }

  function applyImage(section, target, config) {
    const url = safeImageUrl(config.imageUrl);
    if (target === 'background') {
      section.style.backgroundImage = url
        ? `linear-gradient(rgba(0,0,0,.46), rgba(0,0,0,.46)), url("${url.replace(/["\\]/g, '')}")`
        : 'none';
      return;
    }
    const image = target === 'managed'
      ? ensureManagedImage(section)
      : target ? section.querySelector(target) : null;
    if (!image) return;
    if (target === '.column.left img') section.classList.toggle('landing-no-image', !url);
    image.hidden = !url;
    image.alt = String(config.imageAlt || '');
    if (url) {
      image.src = url;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.fetchPriority = 'low';
    } else {
      image.removeAttribute('src');
    }
  }

  function ensureManagedImage(section) {
    let image = section.querySelector('.landing-section-image');
    if (image) return image;
    const container = section.querySelector('.max-width') || section;
    image = document.createElement('img');
    image.className = 'landing-section-image';
    image.hidden = true;
    const lead = container.querySelector('.landing-section-body, .pricing-intro, .title');
    if (lead) lead.after(image);
    else container.prepend(image);
    return image;
  }

  function applyCta(section, selector, config, enabledSectionIds) {
    if (!selector) return;
    const cta = section.querySelector(selector);
    if (!cta) return;
    const label = String(config.ctaLabel || '');
    const href = safeHref(config.ctaHref, enabledSectionIds);
    cta.textContent = label;
    cta.hidden = !label || !href;
    cta.dataset.landingManaged = 'true';
    if (label && href) cta.setAttribute('href', href);
    else cta.removeAttribute('href');
  }

  function setText(root, selector, value) {
    if (!selector) return;
    const element = root.querySelector(selector);
    if (!element) return;
    const text = typeof value === 'string' ? value : '';
    element.textContent = text;
    element.hidden = !text;
  }

  function setStyle(element, property, value) {
    if (value) element.style.setProperty(property, value);
    else element.style.removeProperty(property);
  }

  function syncNavigation(config) {
    const link = document.querySelector(`.navbar .menu a[href="#${config.id}"]`);
    const item = link?.closest('li');
    if (item) item.hidden = config.enabled === false;
  }

  function reorderNavigation(ordered) {
    const menu = document.querySelector('.navbar .menu');
    if (!menu) return;
    const items = ordered.map((config) => document.querySelector(`.navbar .menu a[href="#${config.id}"]`)?.closest('li')).filter(Boolean);
    const fixedItem = Array.from(menu.children).find((item) => !items.includes(item)) || null;
    items.forEach((item) => menu.insertBefore(item, fixedItem));
  }

  function needsSolidNavbar(firstVisible) {
    if (!firstVisible || firstVisible.id !== 'home') return true;
    if (safeImageUrl(firstVisible.imageUrl) || !firstVisible.backgroundColor) return false;
    const match = /^#([0-9a-f]{6})$/i.exec(firstVisible.backgroundColor);
    if (!match) return true;
    const value = Number.parseInt(match[1], 16);
    const red = (value >> 16) & 255;
    const green = (value >> 8) & 255;
    const blue = value & 255;
    return (red * 299 + green * 587 + blue * 114) / 255000 > 0.56;
  }

  function safeHref(value, enabledSectionIds) {
    const raw = String(value || '').trim();
    const hash = /^#([A-Za-z][A-Za-z0-9_-]{0,79})$/.exec(raw);
    if (hash) return !enabledSectionIds || enabledSectionIds.has(hash[1]) ? raw : '';
    if (/^\/(?!\/)[^\s]*$/.test(raw)) return raw;
    try {
      const url = new URL(raw);
      return url.protocol === 'https:' && url.hostname ? url.toString() : '';
    } catch { return ''; }
  }

  function safeImageUrl(value) {
    const raw = String(value || '');
    return /^(?:https:\/\/|\/(?!\/))/.test(raw) ? raw : '';
  }

  function readCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      return parsed && Array.isArray(parsed.sections) ? parsed : null;
    } catch { return null; }
  }

  function writeCache(model) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(model)); } catch {}
  }
})();
