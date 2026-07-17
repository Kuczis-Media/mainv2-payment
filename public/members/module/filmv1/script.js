(async () => {
  'use strict';

  const VIDEOJS_VERSION = '8.23.4';
  const YOUTUBE_TECH_VERSION = '3.0.1';
  const media = window.ChemMedia;
  const params = media.readParamsAndHide(window);
  const STORAGE_KEY = 'chemdisk.filmv1.v1';
  const fromUrl = params.has('id');
  const rawInput = fromUrl ? String(params.get('id') || '').trim() : '';
  const explicitType = params.has('type');
  const explicitProvider = String(params.get('provider') || '').toLowerCase();
  const inferredProvider = media.inferVideoProvider(rawInput);
  const requestedType = explicitType
    ? media.normalizeType(params.get('type'), ['1', '2', '3'], '1')
    : explicitProvider === 'drive' || inferredProvider === 'drive' ? '2' : explicitProvider === 'youtube' ? '3' : '1';
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
  const videoHost = document.getElementById('video-host');
  const driveFrame = document.getElementById('drive-frame');
  const loading = document.getElementById('loading');
  const slow = document.getElementById('slow');
  const error = document.getElementById('error');
  const errorCopy = document.getElementById('error-copy');
  const errorHint = document.getElementById('error-hint');
  const retryTop = document.getElementById('retry-top');
  const providerLink = document.getElementById('provider-link');
  const providerTop = document.getElementById('provider-top');
  const providerCopy = document.getElementById('provider-copy');
  const modeBadge = document.getElementById('mode-badge');
  let player = null;
  let slowTimer = 0;
  let failTimer = 0;
  let attempt = 0;
  let youtubeFrameObserver = null;

  function clearTimers() {
    window.clearTimeout(slowTimer);
    window.clearTimeout(failTimer);
  }

  function disposePlayer() {
    if (player && typeof player.dispose === 'function') {
      try { player.dispose(); } catch {}
    }
    player = null;
    videoHost.replaceChildren();
  }

  function showReady() {
    clearTimers();
    loading.hidden = true;
    slow.hidden = true;
    error.hidden = true;
    stage.classList.add('is-ready');
    retryTop.hidden = false;
    app.removeAttribute('aria-busy');
  }

  function showError(message, hint) {
    clearTimers();
    loading.hidden = true;
    slow.hidden = true;
    error.hidden = false;
    errorCopy.textContent = message;
    errorHint.textContent = hint || '';
    retryTop.hidden = false;
    app.removeAttribute('aria-busy');
  }

  if (!state) {
    showError(
      'Brakuje poprawnego ID lub linku do filmu YouTube albo Google Drive.',
      'Dla samego ID pliku z Dysku Google ustaw type=2 albo provider=drive.'
    );
    return;
  }

  const isDrive = state.type === '2';
  const protectedMode = state.type === '1';
  const encodedId = encodeURIComponent(state.id);
  const outsideUrl = isDrive
    ? `https://drive.google.com/file/d/${encodedId}/view`
    : `https://www.youtube.com/watch?v=${encodedId}`;
  providerCopy.textContent = isDrive ? 'Google Drive · podgląd dostawcy' : 'YouTube · Video.js';
  modeBadge.textContent = isDrive ? 'Osadzenie Drive' : protectedMode ? 'Video.js · ograniczony' : 'Video.js';
  document.getElementById('loading-copy').textContent = isDrive
    ? 'Google Drive przygotowuje film. Ten dostawca korzysta z własnego odtwarzacza osadzonego w aplikacji.'
    : 'Ładowanie Video.js oraz technologii YouTube może potrwać kilka sekund.';
  document.getElementById('slow-copy').textContent = isDrive
    ? 'Google może nadal przetwarzać film albo wymagać dostępu i plików cookie innych firm.'
    : 'Film może mieć wyłączone osadzanie albo dostawca odtwarzacza jest chwilowo niedostępny.';
  providerLink.href = outsideUrl;
  providerTop.href = outsideUrl;
  providerTop.hidden = protectedMode;
  providerLink.hidden = protectedMode;
  stage.classList.toggle('is-protected', protectedMode);

  if (protectedMode) {
    const secureYouTubeFrames = () => {
      videoHost.querySelectorAll('iframe').forEach((iframe) => {
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
        iframe.setAttribute('allow', 'autoplay; encrypted-media');
        iframe.removeAttribute('allowfullscreen');
      });
    };
    youtubeFrameObserver = new MutationObserver(secureYouTubeFrames);
    youtubeFrameObserver.observe(videoHost, { childList: true, subtree: true });
    document.addEventListener('contextmenu', (event) => event.preventDefault(), { capture: true });
    document.addEventListener('keydown', (event) => {
      const key = String(event.key || '').toLowerCase();
      if ((event.ctrlKey || event.metaKey) && ['s', 'p', 'u'].includes(key)) event.preventDefault();
    }, { capture: true });
  }

  function loadStylesheet(href, id) {
    const existing = document.getElementById(id);
    if (existing?.dataset.loaded === 'true') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const link = existing || document.createElement('link');
      const onLoad = () => {
        link.dataset.loaded = 'true';
        resolve();
      };
      const onError = () => {
        link.remove();
        reject(new Error(`Nie udało się wczytać stylów: ${href}`));
      };
      link.addEventListener('load', onLoad, { once: true });
      link.addEventListener('error', onError, { once: true });
      if (!existing) {
        link.id = id;
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
      }
    });
  }

  function loadScript(src, id) {
    const existing = document.getElementById(id);
    if (existing?.dataset.loaded === 'true') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = existing || document.createElement('script');
      const onLoad = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      const onError = () => {
        script.remove();
        reject(new Error(`Nie udało się wczytać skryptu: ${src}`));
      };
      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', onError, { once: true });
      if (!existing) {
        script.id = id;
        script.src = src;
        script.async = true;
        document.head.appendChild(script);
      }
    });
  }

  function startTimers() {
    clearTimers();
    slowTimer = window.setTimeout(() => {
      if (!stage.classList.contains('is-ready')) {
        loading.hidden = true;
        slow.hidden = false;
        retryTop.hidden = false;
      }
    }, 15000);
    failTimer = window.setTimeout(() => {
      if (!stage.classList.contains('is-ready')) {
        showError(
          'Dostawca filmu nie potwierdził uruchomienia odtwarzacza.',
          isDrive ? 'Sprawdź udostępnianie i przetwarzanie filmu na Dysku Google.' : 'Sprawdź, czy właściciel filmu pozwala na osadzanie w innych witrynach.'
        );
      }
    }, 45000);
  }

  async function startYouTube(loadAttempt) {
    driveFrame.hidden = true;
    driveFrame.removeAttribute('src');
    videoHost.hidden = false;
    disposePlayer();
    window.HELP_IMPROVE_VIDEOJS = false;

    try {
      await Promise.all([
        loadStylesheet(`https://vjs.zencdn.net/${VIDEOJS_VERSION}/video-js.min.css`, 'videojs-styles'),
        loadScript(`https://vjs.zencdn.net/${VIDEOJS_VERSION}/video.min.js`, 'videojs-core')
      ]);
      await loadScript(`https://unpkg.com/videojs-youtube@${YOUTUBE_TECH_VERSION}/dist/Youtube.min.js`, 'videojs-youtube-tech');
      if (loadAttempt !== attempt) return;
      if (typeof window.videojs !== 'function') throw new Error('Video.js nie został udostępniony przez CDN.');

      const element = document.createElement('video');
      element.id = 'course-video';
      element.className = 'video-js vjs-big-play-centered';
      element.setAttribute('controls', '');
      element.setAttribute('playsinline', '');
      videoHost.appendChild(element);

      player = window.videojs(element, {
        techOrder: ['youtube'],
        controls: true,
        autoplay: false,
        preload: 'auto',
        fluid: false,
        fill: true,
        responsive: true,
        sources: [{
          type: 'video/youtube',
          src: `https://www.youtube.com/watch?v=${encodedId}`
        }],
        youtube: {
          ytControls: 0,
          iv_load_policy: 3,
          rel: 0,
          playsinline: 1,
          fs: protectedMode ? 0 : 1,
          disablekb: protectedMode ? 1 : 0,
          customVars: { origin: location.origin }
        }
      }, () => {
        if (protectedMode) {
          videoHost.querySelectorAll('iframe').forEach((iframe) => {
            iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
            iframe.setAttribute('allow', 'autoplay; encrypted-media');
            iframe.removeAttribute('allowfullscreen');
          });
        }
        if (loadAttempt === attempt) showReady();
      });
      player.on('loadedmetadata', () => {
        if (loadAttempt === attempt) showReady();
      });
      player.on('error', () => {
        if (loadAttempt !== attempt) return;
        const details = player?.error?.();
        showError(
          details?.message || 'YouTube zwrócił błąd odtwarzania.',
          'Film może być prywatny, niedostępny albo mieć wyłączone osadzanie.'
        );
      });
    } catch (reason) {
      if (loadAttempt !== attempt) return;
      showError(
        'Nie udało się załadować Video.js.',
        reason instanceof Error ? reason.message : 'Sprawdź połączenie i spróbuj ponownie.'
      );
    }
  }

  function startDrive() {
    disposePlayer();
    videoHost.hidden = true;
    driveFrame.hidden = false;
    driveFrame.src = 'about:blank';
    window.requestAnimationFrame(() => {
      const source = `https://drive.google.com/file/d/${encodedId}/preview`;
      driveFrame.src = attempt === 1 ? source : media.withCacheBust(source, attempt);
    });
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
    startTimers();
    if (isDrive) startDrive();
    else void startYouTube(attempt);
  }

  driveFrame.addEventListener('load', () => {
    if (!driveFrame.src || driveFrame.src === 'about:blank') return;
    showReady();
  });
  driveFrame.addEventListener('error', () => showError(
    'Nie udało się połączyć z Google Drive.',
    'Sprawdź udostępnianie pliku i spróbuj ponownie.'
  ));

  document.getElementById('keep-waiting').addEventListener('click', () => {
    slow.hidden = true;
    stage.classList.add('is-ready');
    app.removeAttribute('aria-busy');
  });
  document.getElementById('retry').addEventListener('click', beginLoad);
  document.getElementById('retry-error').addEventListener('click', beginLoad);
  retryTop.addEventListener('click', beginLoad);
  window.addEventListener('pagehide', () => {
    if (youtubeFrameObserver) youtubeFrameObserver.disconnect();
    disposePlayer();
  }, { once: true });

  beginLoad();
})();
