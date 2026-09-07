(function applySiteBrand() {
  'use strict';

  // Public branding only; reuse the shared, cached source result. No session.
  const DEFAULT_CONFIG_URL = 'https://raw.githubusercontent.com/Kuczis-Media/logo/main/landing/config.json';
  let CONFIG_URL = DEFAULT_CONFIG_URL;
  const CACHE_KEY = 'nextmed.site-brand.v1';
  const LANDING_CACHE_KEY = 'chem.landing.public.v3';
  const TTL = 15 * 60 * 1000;
  const SECTION_IDS = ['home', 'about', 'services', 'pricing', 'skills', 'contact'];
  const COLORS = {
    primaryColor: ['--primary', '--chem-primary', '--page-primary'],
    secondaryColor: ['--site-secondary'],
    accentColor: ['--accent', '--chem-accent'],
    backgroundColor: ['--surface-soft', '--chem-bg', '--page-bg'],
    surfaceColor: ['--surface', '--chem-surface', '--page-surface'],
    textColor: ['--ink', '--chem-text', '--page-ink'],
    mutedColor: ['--muted', '--chem-muted', '--page-muted']
  };
  const titleNode = document.querySelector('title[data-brand-title]');
  let logoGeneration = 0;
  let currentRevision = -1;
  let publicationVersion = '';
  function initialize() {
    const cached = readCache();
    if (cached) apply(cached.model);
    if (!cached || Date.now() - cached.checkedAt >= TTL
      || (publicationVersion && cached.publicationVersion !== publicationVersion)) void refresh();
  }
  if (window.NextMedLandingSource) {
    window.NextMedLandingSource.ready.then((route) => {
      publicationVersion = route.publication?.version || '';
      if (route.publication?.mode === 'netlify-blobs' && route.publication.active === true && validModel(route.publication.model)) {
        CONFIG_URL = '/.netlify/functions/landing';
        apply(route.publication.model);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ model: route.publication.model, checkedAt: Date.now(), configUrl: CONFIG_URL, publicationVersion })); } catch {}
        return;
      }
      CONFIG_URL = window.NextMedLandingDelivery.rawUrl(route.target);
      initialize();
    }).catch(initialize);
  } else initialize();

  function validModel(model) {
    if (!plainObject(model) || !plainObject(model.branding) || !Array.isArray(model.sections)) return false;
    if (model.version !== 3) return false;
    if (!Number.isSafeInteger(model.revision) || model.revision < 0) return false;
    const ids = new Set(model.sections.map((section) => plainObject(section) && section.id));
    return model.sections.length === SECTION_IDS.length && SECTION_IDS.every((id) => ids.has(id)) && Boolean(text(model.branding.brandName, 120));
  }

  function readCache() {
    const candidates = [];
    for (const key of [CACHE_KEY, LANDING_CACHE_KEY]) {
      try {
        const entry = JSON.parse(localStorage.getItem(key) || 'null');
        if ((entry?.configUrl || DEFAULT_CONFIG_URL) !== CONFIG_URL) continue;
        if (validModel(entry?.model) && Number.isFinite(entry.checkedAt) && entry.checkedAt > 0 && entry.checkedAt <= Date.now()) candidates.push(entry);
      } catch (_) { /* Storage is optional, including in private browsing. */ }
    }
    return candidates.sort((a, b) => b.model.revision - a.model.revision || b.checkedAt - a.checkedAt)[0] || null;
  }

  async function refresh() {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(CONFIG_URL, { cache: 'no-cache', credentials: 'omit', headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) return;
      const payload = await response.json();
      if (payload?.active !== true || !validModel(payload.model) || payload.model.revision < currentRevision) return;
      apply(payload.model);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ model: payload.model, checkedAt: Date.now(), configUrl: CONFIG_URL, publicationVersion })); } catch (_) { /* Optional cache. */ }
    } catch (_) { /* Keep the checked-in or cached brand when GitHub is unavailable. */ }
    finally { window.clearTimeout(timer); }
  }

  function apply(model) {
    const brand = model.branding;
    const name = text(brand.brandName, 120);
    currentRevision = model.revision;
    setText('[data-brand-name]', name);
    setText('[data-company-name]', text(brand.companyName, 160) || name);
    setText('[data-brand-tagline]', text(brand.tagline, 180));
    setText('[data-footer-text]', text(brand.footerText, 240) || name);
    document.querySelectorAll('[data-brand-home]').forEach((link) => link.setAttribute('aria-label', `${name} — panel kursanta`));
    if (titleNode) document.title = `${titleNode.dataset.brandTitle} — ${name}`;
    const favicon = imageUrl(brand.faviconUrl);
    if (favicon) document.querySelectorAll('link[rel="icon"]').forEach((link) => {
      link.href = favicon;
      link.removeAttribute('type');
    });
    const scope = window.NextMedAppearance?.scopeForPath(window.location?.pathname);
    if (plainObject(brand.palettes?.[scope])) document.documentElement?.setAttribute('data-site-palette', scope);
    else document.documentElement?.removeAttribute('data-site-palette');
    applyPalette(window.NextMedAppearance?.paletteFor(brand, scope) || brand);
    applyLogo(imageUrl(brand.logoUrl), text(brand.logoAlt, 120) || name);
  }

  function applyLogo(url, alt) {
    const generation = ++logoGeneration;
    document.querySelectorAll('[data-brand-logo-slot]').forEach((slot) => {
      const previous = slot.querySelector('[data-site-brand-image]');
      if (!url) {
        previous?.remove();
        slot.querySelector('svg')?.removeAttribute('hidden');
        return;
      }
      if (previous?.getAttribute('src') === url) return;
      const image = document.createElement('img');
      image.alt = alt;
      image.decoding = 'async';
      image.setAttribute('data-site-brand-image', '');
      image.style.cssText = 'width:100%;height:100%;max-width:100%;object-fit:contain;display:block';
      image.onload = () => {
        if (generation !== logoGeneration) return;
        previous?.remove();
        slot.querySelector('svg')?.setAttribute('hidden', '');
        slot.append(image);
      };
      // The original mark stays visible until the image has loaded successfully.
      image.src = url;
    });
  }

  function applyPalette(brand) {
    const declarations = [];
    for (const [field, variables] of Object.entries(COLORS)) {
      const color = typeof brand[field] === 'string' && /^#[0-9a-f]{6}$/i.test(brand[field]) ? brand[field] : '';
      if (color) for (const variable of variables) declarations.push(`${variable}:${color}`);
    }
    if (/^#[0-9a-f]{6}$/i.test(brand.primaryColor || '')) {
      const hover = mixColor(brand.primaryColor, 0, 0.15);
      const soft = mixColor(brand.primaryColor, 255, 0.9);
      declarations.push(`--primary-hover:${hover}`, `--chem-primary-hover:${hover}`,
        `--primary-soft:${soft}`, `--chem-primary-soft:${soft}`, `--page-primary-soft:${soft}`);
    }
    let stylesheet = document.getElementById('site-brand-palette');
    if (!stylesheet) {
      stylesheet = document.createElement('style');
      stylesheet.id = 'site-brand-palette';
      document.head.append(stylesheet);
    }
    // A selector rather than inline variables lets theme switching keep its dark palette.
    const priceVariables = { primaryColor: '--chem-price-primary', textColor: '--chem-price-ink', mutedColor: '--chem-price-muted', surfaceColor: '--chem-price-surface' };
    const priceDeclarations = Object.entries(priceVariables).filter(([field]) => /^#[0-9a-f]{6}$/i.test(brand[field] || '')).map(([field, variable]) => `${variable}:${brand[field]}`);
    if (/^#[0-9a-f]{6}$/i.test(brand.primaryColor || '')) priceDeclarations.push(`--chem-price-primary-hover:${mixColor(brand.primaryColor, 0, 0.15)}`, `--chem-price-soft:${mixColor(brand.primaryColor, 255, 0.9)}`);
    stylesheet.textContent = `:root:not([data-theme="dark"]){${declarations.join(';')}} :root:not([data-theme="dark"]) .chem-pricing{${priceDeclarations.join(';')}} [data-brand-logo-slot] svg[hidden]{display:none}`;
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach((element) => { element.textContent = value; });
  }

  function mixColor(hex, target, amount) {
    return '#' + hex.slice(1).match(/../g).map((value) => Math.round(parseInt(value, 16) * (1 - amount) + target * amount).toString(16).padStart(2, '0')).join('');
  }

  function text(value, maximum) {
    return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maximum) : '';
  }

  function imageUrl(value) {
    const candidate = text(value, 2048);
    if (!candidate || candidate.includes('\\')) return '';
    if (/^\/(?!\/)/.test(candidate)) return candidate;
    try {
      const url = new URL(candidate);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch (_) { return ''; }
  }

  function plainObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }
})();
