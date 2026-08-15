(function exposeChemProgress(root) {
  'use strict';

  const PROGRESS_URL = '/.netlify/functions/progress';
  const CACHE_KEY = 'chem.progress.cache.v1';
  const MATERIAL_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
  const pending = new Map();
  const timers = new Map();
  const openedThisPage = new Set();
  let initialUrl = null;
  try { initialUrl = new URL(root.location.href); } catch (_) {}
  let serverState = null;
  let loadPromise = null;
  let accessToken = '';

  function safeJson(value) {
    try { return JSON.parse(value); } catch (_) { return null; }
  }

  function cachedState() {
    try {
      const cached = safeJson(localStorage.getItem(CACHE_KEY) || 'null');
      if (!cached || !cached.savedAt || Date.now() - cached.savedAt > 15 * 60 * 1000) return null;
      return cached.state || null;
    } catch (_) { return null; }
  }

  function saveCache(state) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), state })); } catch (_) {}
  }

  async function token() {
    if (accessToken) return accessToken;
    const auth = root.ChemAuth;
    const authState = await auth?.ready;
    if (!authState?.authenticated || !authState?.session?.ok) throw new Error('AUTH_REQUIRED');
    accessToken = await auth.getAccessToken();
    return accessToken;
  }

  async function request(method, body, query, keepalive) {
    const authorization = await token();
    const response = await fetch(`${PROGRESS_URL}${query || ''}`, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      keepalive: Boolean(keepalive),
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${authorization}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    let payload = null;
    try { payload = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(payload?.error || `PROGRESS_HTTP_${response.status}`);
      error.code = payload?.error || 'PROGRESS_REQUEST_FAILED';
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function load(options = {}) {
    if (loadPromise && !options.force) return loadPromise;
    loadPromise = request('GET')
      .then((state) => {
        serverState = state;
        saveCache(state);
        root.dispatchEvent(new CustomEvent('chemdisk-progress-ready', { detail: state }));
        return state;
      })
      .catch((error) => {
        serverState = serverState || cachedState();
        root.dispatchEvent(new CustomEvent('chemdisk-progress-error', { detail: { error } }));
        if (serverState) return serverState;
        throw error;
      });
    return loadPromise;
  }

  function fnv(value) {
    let hash = 2166136261;
    const text = String(value || '');
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function materialId(type, source, explicit) {
    const requested = String(explicit || '').trim();
    if (MATERIAL_ID.test(requested)) return requested;
    const normalizedType = String(type || 'other').toLowerCase().replace(/[^a-z0-9_]/g, '') || 'other';
    return `${normalizedType}-${fnv(`${normalizedType}:${String(source || location.pathname)}`)}`;
  }

  function materialFromLocation(type, source) {
    let explicit = '';
    try { explicit = new URL(location.href).searchParams.get('material') || ''; } catch (_) {}
    return materialId(type, source, explicit);
  }

  function mergeObjects(previous, next) {
    const output = { ...(previous || {}), ...(next || {}) };
    if (previous?.details || next?.details) {
      output.details = { ...(previous?.details || {}), ...(next?.details || {}) };
      ['visitedSlides', 'completedStepIds', 'watchedRanges'].forEach((key) => {
        if (previous?.details?.[key] || next?.details?.[key]) {
          output.details[key] = [
            ...(Array.isArray(previous?.details?.[key]) ? previous.details[key] : []),
            ...(Array.isArray(next?.details?.[key]) ? next.details[key] : [])
          ].slice(-1_000);
        }
      });
    }
    return output;
  }

  async function send(event, options = {}) {
    if (!event || !MATERIAL_ID.test(String(event.materialId || ''))) throw new Error('INVALID_MATERIAL_ID');
    const payload = await request('POST', event, '', options.keepalive);
    if (payload?.record && serverState) {
      serverState.records = serverState.records || {};
      serverState.records[event.materialId] = payload.record;
      saveCache(serverState);
      root.dispatchEvent(new CustomEvent('chemdisk-progress-updated', {
        detail: { materialId: event.materialId, record: payload.record }
      }));
    }
    return payload;
  }

  function update(event, options = {}) {
    const id = event?.materialId;
    if (!MATERIAL_ID.test(String(id || ''))) return Promise.reject(new Error('INVALID_MATERIAL_ID'));
    if (options.immediate) {
      const payload = mergeObjects(pending.get(id), event);
      pending.delete(id);
      root.clearTimeout(timers.get(id));
      timers.delete(id);
      return send(payload, options).catch((error) => {
        reportBackgroundError(error);
        if (options.throwOnError) throw error;
        return null;
      });
    }
    pending.set(id, mergeObjects(pending.get(id), event));
    root.clearTimeout(timers.get(id));
    return new Promise((resolve) => {
      timers.set(id, root.setTimeout(async () => {
        const payload = pending.get(id);
        pending.delete(id);
        timers.delete(id);
        try { resolve(await send(payload)); }
        catch (error) { reportBackgroundError(error); resolve(null); }
      }, Math.max(750, Number(options.debounceMs) || 3_000)));
    });
  }

  function open(options) {
    const material = options || {};
    if (openedThisPage.has(material.materialId) && material.force !== true) {
      return Promise.resolve({ saved: false, record: record(material.materialId) });
    }
    openedThisPage.add(material.materialId);
    return update({
      materialId: material.materialId,
      materialType: material.materialType || 'other',
      action: 'open',
      opened: true,
      ...(material.details ? { details: material.details } : {})
    }, { immediate: true });
  }

  async function flush() {
    const jobs = [];
    pending.forEach((event, id) => {
      root.clearTimeout(timers.get(id));
      jobs.push(send(event, { keepalive: true }).catch(reportBackgroundError));
    });
    pending.clear();
    timers.clear();
    await Promise.allSettled(jobs);
  }

  function reset(materialIdValue) {
    if (!MATERIAL_ID.test(String(materialIdValue || ''))) return Promise.reject(new Error('INVALID_MATERIAL_ID'));
    return request('DELETE', { materialId: materialIdValue }).then((payload) => {
      if (serverState?.records) delete serverState.records[materialIdValue];
      saveCache(serverState);
      return payload;
    });
  }

  function resetAll() {
    return request('DELETE', { scope: 'course' }).then((payload) => {
      if (serverState) serverState.records = {};
      saveCache(serverState);
      return payload;
    });
  }

  function record(materialIdValue) {
    return serverState?.records?.[materialIdValue] || null;
  }

  function statusLabel(value) {
    const status = typeof value === 'string' ? value : value?.status;
    if (status === 'completed') return 'Ukończono';
    if (status === 'in_progress') return 'W trakcie';
    if (status === 'opened') return 'Otwarto';
    return 'Nie rozpoczęto';
  }

  function percentLabel(value) {
    const percent = Math.max(0, Math.min(100, Number(value) || 0));
    if (percent === 0) return '0%';
    if (percent < 1) return '<1%';
    if (percent < 10) return `${String(Math.round(percent * 10) / 10).replace('.', ',')}%`;
    return `${Math.round(percent)}%`;
  }

  function progressView(input, options = {}) {
    const recordValue = input || null;
    const percent = Math.max(0, Math.min(100, Number(recordValue?.progressPercent) || 0));
    const wrapper = document.createElement('div');
    wrapper.className = `chem-progress${options.compact ? ' is-compact' : ''}`;
    wrapper.dataset.status = recordValue?.status || 'not_started';
    const line = document.createElement('span');
    line.className = 'chem-progress-label';
    const value = document.createElement('strong');
    value.textContent = percentLabel(percent);
    const status = document.createElement('small');
    status.textContent = statusLabel(recordValue);
    line.append(value, status);
    const track = document.createElement('span');
    track.className = 'chem-progress-track';
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    track.setAttribute('aria-valuenow', String(Math.round(percent * 10) / 10));
    const bar = document.createElement('span');
    bar.className = 'chem-progress-bar';
    bar.style.width = `${percent}%`;
    bar.style.minWidth = percent > 0 ? '3px' : '0';
    track.append(bar);
    wrapper.append(line, track);
    return wrapper;
  }

  function reportBackgroundError(error) {
    if (!['AUTH_REQUIRED', 'ACCESS_REQUIRED', 'ACCESS_EXPIRED'].includes(error?.code)) {
      console.warn('Nie udało się zsynchronizować postępu ChemDisk', error?.code || error?.message || error);
    }
    return null;
  }

  root.addEventListener('pagehide', () => { flush(); });
  root.addEventListener('chem-auth-user-changed', (event) => {
    if (!event.detail?.authenticated) {
      accessToken = '';
      serverState = null;
      loadPromise = null;
    }
  });

  function automaticMaterial() {
    if (!initialUrl) return null;
    const match = initialUrl.pathname.match(/^\/members\/module\/([^/]+)\/?$/i);
    if (!match || match[1].toLowerCase() === 'studio') return null;
    const moduleName = match[1].toLowerCase();
    const types = {
      lesson: 'lesson', slides: 'presentation', film: 'video', yt: 'video', pdf: 'pdf', forms: 'quiz',
      chat: 'script', bitpaper: 'other', whiteboard: 'other', kalkulator: 'other', classic: 'other',
      contact: 'other', atonom: 'embed'
    };
    const source = initialUrl.searchParams.get('file')
      || initialUrl.searchParams.get('id')
      || initialUrl.searchParams.get('prompt')
      || `${initialUrl.pathname}?${initialUrl.searchParams.toString()}`;
    const explicit = initialUrl.searchParams.get('material') || '';
    const type = types[moduleName] || 'other';
    return { materialId: materialId(type, source, explicit), materialType: type };
  }

  Promise.resolve(root.ChemAuth?.ready).then((authState) => {
    if (!authState?.authenticated || !authState?.session?.ok) return;
    const material = automaticMaterial();
    if (material) open(material).catch(reportBackgroundError);
  });

  root.ChemProgress = Object.freeze({
    flush,
    load,
    materialFromLocation,
    materialId,
    open,
    progressView,
    record,
    reset,
    resetAll,
    send,
    percentLabel,
    statusLabel,
    update,
    get state() { return serverState; }
  });
})(window);
