(async () => {
  'use strict';

  const media = window.ChemMedia;
  const params = media.readParamsAndHide(window);
  const STORAGE_KEY = 'chemdisk.film.v3';
  const fromUrl = params.has('id');
  const rawInput = fromUrl ? String(params.get('id') || '').trim() : '';
  const explicitType = params.has('type');
  const inferredProvider = media.inferVideoProvider(rawInput);
  const requestedType = explicitType
    ? media.normalizeType(params.get('type'), ['1', '2', '3'], '1')
    : inferredProvider === 'drive' ? '2' : '1';
  const idFromUrl = fromUrl
    ? requestedType === '2' ? media.extractDriveId(rawInput) : media.extractYouTubeId(rawInput)
    : '';

  if (idFromUrl) media.saveState(sessionStorage, STORAGE_KEY, { id: idFromUrl, type: requestedType });
  const saved = !fromUrl ? media.loadState(sessionStorage, STORAGE_KEY) : null;
  const savedType = media.normalizeType(saved?.type, ['1', '2', '3'], '1');
  const savedIdIsValid = savedType === '2'
    ? media.isDriveId(saved?.id)
    : /^[A-Za-z0-9_-]{11}$/.test(String(saved?.id || ''));
  const state = idFromUrl
    ? { id: idFromUrl, type: requestedType }
    : saved && savedIdIsValid ? { id: saved.id, type: savedType } : null;

  const authState = await window.ChemAuth.ready;
  if (!authState?.authenticated || !authState.session?.ok) return;

  const app = document.getElementById('app');
  const stage = document.getElementById('stage');
  const frame = document.getElementById('film-frame');
  const loading = document.getElementById('loading');
  const slow = document.getElementById('slow');
  const error = document.getElementById('error');
  const errorCopy = document.getElementById('error-copy');
  const retryTop = document.getElementById('retry-top');
  const providerLink = document.getElementById('provider-link');
  const providerTop = document.getElementById('provider-top');
  const providerCopy = document.getElementById('provider-copy');
  const modeBadge = document.getElementById('mode-badge');
  let slowTimer = 0;
  let failTimer = 0;
  let attempt = 0;

  function clearTimers() {
    window.clearTimeout(slowTimer);
    window.clearTimeout(failTimer);
  }

  function showError(message) {
    clearTimers();
    loading.hidden = true;
    slow.hidden = true;
    error.hidden = false;
    errorCopy.textContent = message;
    retryTop.hidden = false;
    app.removeAttribute('aria-busy');
  }

  if (!state) {
    showError('Brakuje poprawnego ID lub linku do filmu YouTube albo Google Drive.');
    return;
  }

  const isDrive = state.type === '2';
  const protectedMode = state.type === '1';
  const encodedId = encodeURIComponent(state.id);
  const query = new URLSearchParams({ rel: '0', playsinline: '1', origin: location.origin });
  if (protectedMode) {
    query.set('controls', '1');
    query.set('fs', '0');
    query.set('disablekb', '1');
    query.set('iv_load_policy', '3');
  }

  const sourceUrl = isDrive
    ? `https://drive.google.com/file/d/${encodedId}/preview`
    : `${protectedMode ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com'}/embed/${encodedId}?${query.toString()}`;
  const outsideUrl = isDrive
    ? `https://drive.google.com/file/d/${encodedId}/view`
    : `https://www.youtube.com/watch?v=${encodedId}`;
  providerTop.href = outsideUrl;
  providerTop.hidden = protectedMode;
  providerLink.hidden = protectedMode;

  providerCopy.textContent = isDrive ? 'Google Drive' : 'YouTube';
  modeBadge.textContent = isDrive ? 'Wideo z Dysku' : protectedMode ? 'Tryb ograniczony' : 'Pełny odtwarzacz';
  document.getElementById('loading-copy').textContent = isDrive
    ? 'Google Drive przygotowuje odtwarzacz. Film musi być udostępniony odbiorcom.'
    : 'Ładowanie odtwarzacza YouTube może potrwać kilka sekund.';
  document.getElementById('slow-copy').textContent = isDrive
    ? 'Film może być nadal przetwarzany przez Google albo wymagać włączonych plików cookie innych firm.'
    : 'Film może mieć wyłączone osadzanie albo być niedostępny dla odbiorcy.';
  stage.classList.toggle('is-protected', protectedMode);

  if (protectedMode) {
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
    frame.setAttribute('allow', 'autoplay; encrypted-media');
    frame.removeAttribute('allowfullscreen');
    document.addEventListener('contextmenu', (event) => event.preventDefault(), { capture: true });
    document.addEventListener('keydown', (event) => {
      const key = String(event.key || '').toLowerCase();
      if ((event.ctrlKey || event.metaKey) && ['s', 'p', 'u'].includes(key)) event.preventDefault();
    }, { capture: true });
  } else {
    frame.setAttribute('allowfullscreen', '');
  }

  function beginLoad() {
    attempt += 1;
    clearTimers();
    stage.classList.remove('is-ready');
    loading.hidden = false;
    slow.hidden = true;
    error.hidden = true;
    retryTop.hidden = true;
    app.setAttribute('aria-busy', 'true');
    frame.src = 'about:blank';
    window.requestAnimationFrame(() => {
      frame.src = attempt === 1 ? sourceUrl : media.withCacheBust(sourceUrl, attempt);
    });

    slowTimer = window.setTimeout(() => {
      if (!stage.classList.contains('is-ready')) {
        loading.hidden = true;
        slow.hidden = false;
        providerLink.href = outsideUrl;
        retryTop.hidden = false;
      }
    }, 12000);
    failTimer = window.setTimeout(() => {
      if (!stage.classList.contains('is-ready')) showError('Dostawca filmu nie potwierdził uruchomienia odtwarzacza.');
    }, 45000);
  }

  frame.addEventListener('load', () => {
    if (!frame.src || frame.src === 'about:blank') return;
    clearTimers();
    loading.hidden = true;
    slow.hidden = true;
    error.hidden = true;
    stage.classList.add('is-ready');
    retryTop.hidden = false;
    app.removeAttribute('aria-busy');
  });
  frame.addEventListener('error', () => showError('Nie udało się połączyć z dostawcą filmu.'));

  document.getElementById('keep-waiting').addEventListener('click', () => {
    slow.hidden = true;
    stage.classList.add('is-ready');
    app.removeAttribute('aria-busy');
  });
  document.getElementById('retry').addEventListener('click', beginLoad);
  document.getElementById('retry-error').addEventListener('click', beginLoad);
  retryTop.addEventListener('click', beginLoad);

  beginLoad();
})();
