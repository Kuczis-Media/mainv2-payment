(function () {
  'use strict';
  const api = window.NextMedLandingDelivery;
  if (!api) return;
  const CACHE_KEY = 'nextmed.landing.route.v1';
  const TTL = 60_000;
  let cached;
  try {
    const entry = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (entry && Number.isFinite(entry.checkedAt) && entry.checkedAt <= Date.now()) cached = { settings: api.normalize(entry.settings), checkedAt: entry.checkedAt };
  } catch {}
  const preview = new URLSearchParams(location.search).get('landing-preview') === '1' && window.parent !== window;
  const exported = Boolean(document.querySelector('meta[name="nextmed-landing-export"]'));
  async function resolve() {
    if (preview || exported) return api.normalize();
    if (cached && Date.now() - cached.checkedAt < TTL) return cached.settings;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(api.ROUTE_URL, { cache: 'no-cache', credentials: 'omit', signal: controller.signal });
      if (!response.ok && response.status !== 404) throw new Error('Route unavailable');
      const settings = response.status === 404 ? api.normalize() : api.normalize(await response.json());
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ settings, checkedAt: Date.now() })); } catch {}
      return settings;
    } catch { return cached?.settings || api.normalize(); }
    finally { window.clearTimeout(timer); }
  }
  window.NextMedLandingSource = Object.freeze({ ready: resolve(), cacheKey: CACHE_KEY });
})();
