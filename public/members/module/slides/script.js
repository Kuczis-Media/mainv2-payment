(async () => {
  'use strict';

  const media = window.ChemMedia;
  const params = media.readParamsAndHide(window);
  const STORAGE_KEY = 'chemdisk.slides.v3';

  const fromUrl = params.has('id');
  const parsedFromUrl = fromUrl ? media.extractSlides(params.get('id')) : null;
  const requestedType = media.normalizeType(params.get('type'), ['1', '2'], '1');
  if (parsedFromUrl) {
    media.saveState(sessionStorage, STORAGE_KEY, {
      id: parsedFromUrl.id,
      published: parsedFromUrl.published,
      type: requestedType
    });
  }

  const saved = !fromUrl ? media.loadState(sessionStorage, STORAGE_KEY) : null;
  const state = parsedFromUrl
    ? { ...parsedFromUrl, type: requestedType }
    : saved && media.isDriveId(saved.id)
      ? { id: saved.id, published: saved.published === true, type: media.normalizeType(saved.type, ['1', '2'], '1') }
      : null;

  const authState = await window.ChemAuth.ready;
  if (!authState?.authenticated || !authState.session?.ok) return;

  const app = document.getElementById('app');
  const stage = document.getElementById('stage');
  const frame = document.getElementById('slides-frame');
  const loading = document.getElementById('loading');
  const slow = document.getElementById('slow');
  const error = document.getElementById('error');
  const errorCopy = document.getElementById('error-copy');
  const retryTop = document.getElementById('retry-top');
  const providerLink = document.getElementById('provider-link');
  const providerTop = document.getElementById('provider-top');
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
    showError('Brakuje poprawnego ID lub linku do prezentacji Google Slides.');
    return;
  }

  const protectedMode = state.type === '2';
  modeBadge.textContent = protectedMode ? 'Tryb ograniczony' : 'Zwykły podgląd';
  stage.classList.toggle('is-protected', protectedMode);
  if (protectedMode) {
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-presentation');
    document.addEventListener('contextmenu', (event) => event.preventDefault(), { capture: true });
    document.addEventListener('keydown', (event) => {
      const key = String(event.key || '').toLowerCase();
      if ((event.ctrlKey || event.metaKey) && ['s', 'p', 'u'].includes(key)) event.preventDefault();
    }, { capture: true });
  }

  const encodedId = encodeURIComponent(state.id);
  const base = state.published
    ? `https://docs.google.com/presentation/d/e/${encodedId}`
    : `https://docs.google.com/presentation/d/${encodedId}`;
  const sourceUrl = state.published
    ? `${base}/embed?start=false&loop=false&delayms=3000`
    : protectedMode
      ? `${base}/embed?start=false&loop=false&delayms=3000&rm=minimal`
      : `${base}/preview?start=false&loop=false&delayms=3000`;
  const outsideUrl = state.published ? `${base}/pub` : `${base}/view`;
  providerTop.hidden = protectedMode;
  providerLink.hidden = protectedMode;
  if (!protectedMode) {
    providerTop.href = outsideUrl;
    providerLink.href = outsideUrl;
  } else {
    providerTop.removeAttribute('href');
    providerLink.removeAttribute('href');
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
        retryTop.hidden = false;
      }
    }, 12000);
    failTimer = window.setTimeout(() => {
      if (!stage.classList.contains('is-ready')) {
        showError('Google nie potwierdził załadowania prezentacji. Upewnij się, że plik jest udostępniony odbiorcom.');
      }
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
  frame.addEventListener('error', () => showError('Nie udało się połączyć z Google Slides.'));

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
