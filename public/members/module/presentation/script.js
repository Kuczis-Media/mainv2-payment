(async () => {
  'use strict';

  const elements = {
    main: document.getElementById('presentation-player-main'),
    loading: document.getElementById('presentation-player-loading'),
    error: document.getElementById('presentation-player-error'),
    errorCopy: document.getElementById('presentation-player-error-copy'),
    retry: document.getElementById('presentation-player-retry'),
    player: document.getElementById('presentation-player'),
    title: document.getElementById('presentation-player-title'),
    outline: document.getElementById('presentation-player-outline'),
    outlineToggle: document.getElementById('presentation-player-outline-toggle'),
    stage: document.getElementById('presentation-player-stage'),
    previous: document.getElementById('presentation-player-previous'),
    next: document.getElementById('presentation-player-next'),
    position: document.getElementById('presentation-player-position'),
    progress: document.getElementById('presentation-player-progress'),
    fullscreen: document.getElementById('presentation-player-fullscreen'),
    theme: document.getElementById('presentation-player-theme'),
    save: document.getElementById('presentation-player-save')
  };

  const state = {
    definition: null,
    index: 0,
    visited: new Set(),
    urls: new Set(),
    materialId: '',
    repositoryId: 'default',
    presentationId: '',
    preview: false,
    availableRepositories: [],
    loading: false
  };

  const progressApi = window.ChemProgress;

  function showError(message) {
    elements.loading.hidden = true;
    elements.player.hidden = true;
    elements.error.hidden = false;
    elements.errorCopy.textContent = message;
  }

  function friendlyError(error) {
    const code = error?.code || error?.message || '';
    if (window.ChemContentLibrary?.ERROR_MESSAGES?.[code]) {
      return window.ChemContentLibrary.ERROR_MESSAGES[code];
    }
    const messages = {
      AUTH_REQUIRED: 'Zaloguj się ponownie, aby przejść do prezentacji.',
      PRESENTATION_NOT_PUBLISHED: 'Prezentacja nie została jeszcze opublikowana.',
      INVALID_PRESENTATION_REFERENCE: 'Nieprawidłowy identyfikator prezentacji lub repozytorium.',
      INVALID_CONTENT_REPOSITORY: 'Wybrane repozytorium materiałów nie zostało skonfigurowane.',
      CONTENT_REPOSITORY_NOT_CONFIGURED: 'Biblioteka materiałów nie została jeszcze skonfigurowana.',
      CONTENT_FILE_NOT_FOUND: 'Nie znaleziono pliku prezentacji w bibliotece.',
      CONTENT_REPOSITORY_TIMEOUT: 'Serwer repozytorium zbyt długo nie odpowiadał. Spróbuj ponownie za chwilę.',
      CONTENT_REPOSITORY_UNAVAILABLE: 'Biblioteka materiałów jest chwilowo niedostępna.'
    };
    return messages[code] || error?.message || 'Nie udało się pobrać prezentacji.';
  }

  function fontStack(font) {
    return ({
      roboto: 'Roboto, Arial, sans-serif',
      'open-sans': '"Open Sans", Arial, sans-serif',
      montserrat: 'Montserrat, Arial, sans-serif',
      poppins: 'Poppins, Arial, sans-serif',
      lato: 'Lato, Arial, sans-serif',
      nunito: 'Nunito, Arial, sans-serif',
      lora: 'Lora, Georgia, serif',
      merriweather: 'Merriweather, Georgia, serif',
      playfair: '"Playfair Display", Georgia, serif',
      georgia: 'Georgia, serif',
      times: '"Times New Roman", serif',
      'jetbrains-mono': '"JetBrains Mono", ui-monospace, monospace',
      'source-code-pro': '"Source Code Pro", ui-monospace, monospace',
      mono: 'ui-monospace, monospace',
      arial: 'Arial, sans-serif',
      verdana: 'Verdana, sans-serif'
    })[font] || 'Inter, system-ui, sans-serif';
  }

  async function fetchPresentation(repoId, presId, isPreview) {
    const token = await window.ChemAuth.getAccessToken();
    const url = new URL('/.netlify/functions/presentation', location.origin);
    url.searchParams.set('presentation', presId);
    url.searchParams.set('repo', repoId);
    if (isPreview) url.searchParams.set('preview', '1');

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => controller?.abort(), 12_000);
    try {
      const response = await fetch(url, {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        ...(controller ? { signal: controller.signal } : {})
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = payload.error || `HTTP_${response.status}`;
        const err = new Error(code);
        err.code = code;
        throw err;
      }
      return payload.presentation;
    } catch (err) {
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('CONTENT_REPOSITORY_TIMEOUT');
        timeoutErr.code = 'CONTENT_REPOSITORY_TIMEOUT';
        throw timeoutErr;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async function requestDefinition() {
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(state.presentationId) || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(state.repositoryId)) {
      throw new Error('INVALID_PRESENTATION_REFERENCE');
    }
    try {
      return await fetchPresentation(state.repositoryId, state.presentationId, state.preview);
    } catch (primaryError) {
      if (['INVALID_CONTENT_REPOSITORY', 'CONTENT_REPOSITORY_NOT_FOUND', 'CONTENT_REPOSITORY_NOT_CONFIGURED'].includes(primaryError.code) && state.repositoryId !== 'default') {
        try {
          const fallback = await fetchPresentation('default', state.presentationId, state.preview);
          state.repositoryId = 'default';
          return fallback;
        } catch (_) {}
      }
      throw primaryError;
    }
  }

  function cleanup() {
    state.urls.forEach((url) => URL.revokeObjectURL(url));
    state.urls.clear();
  }

  function geometry(node, item) {
    Object.assign(node.style, {
      left: `${item.x}%`,
      top: `${item.y}%`,
      width: `${item.width}%`,
      height: `${item.height}%`,
      transform: `rotate(${item.rotation}deg)`,
      zIndex: String(item.z)
    });
    if (item.fontSize) node.style.setProperty('--elem-fs', String(item.fontSize));
  }

  function renderElement(item) {
    const node = document.createElement('div');
    node.className = `presentation-player-element is-${item.type}`;
    geometry(node, item);
    if (item.type === 'text' || item.type === 'heading') {
      const copy = document.createElement('div');
      copy.className = 'presentation-player-text';
      copy.textContent = item.content;
      Object.assign(copy.style, {
        fontFamily: fontStack(item.fontFamily),
        fontSize: `${item.fontSize}px`,
        color: item.color,
        fontWeight: String(item.fontWeight || (item.bold ? 800 : 400)),
        fontStyle: item.italic ? 'italic' : 'normal',
        textDecoration: item.underline ? 'underline' : 'none',
        textAlign: item.align,
        justifyContent: item.verticalAlign === 'center' ? 'center' : item.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start',
        lineHeight: String(item.lineHeight || 1.15),
        letterSpacing: `${item.letterSpacing || 0}px`
      });
      node.append(copy);
    } else if (item.type === 'shape') {
      const shape = document.createElement('div');
      shape.className = `presentation-player-shape is-${item.shape}`;
      Object.assign(shape.style, {
        background: item.fill,
        borderColor: item.border,
        borderWidth: `${item.borderWidth}px`,
        opacity: String(item.opacity)
      });
      node.append(shape);
    } else if (item.type === 'formula') {
      const formula = document.createElement('div');
      formula.className = 'presentation-player-formula';
      formula.style.color = item.color;
      formula.style.fontSize = `${item.fontSize}px`;
      if (window.ChemAssessmentText) {
        let expr = String(item.expression || '').trim();
        if (!expr.startsWith('\\(') && !expr.startsWith('\\[') && !expr.startsWith('$$')) {
          expr = item.mode === 'chemistry' && !expr.startsWith('\\ce{') ? `\\[\\ce{${expr}}\\]` : `\\[${expr}\\]`;
        }
        window.ChemAssessmentText.render(formula, expr);
      } else {
        formula.textContent = item.expression;
      }
      node.append(formula);
    } else if (item.type === 'image') {
      const placeholder = document.createElement('div');
      placeholder.className = 'presentation-player-image-placeholder';
      placeholder.textContent = 'Wczytywanie…';
      node.append(placeholder);
      void loadImage(node, item);
    } else if (item.type === 'icon') {
      const icon = document.createElement('div');
      icon.className = 'presentation-player-icon';
      icon.textContent = item.symbol;
      Object.assign(icon.style, {
        color: item.color,
        background: item.background,
        fontSize: `${item.fontSize}px`,
        borderRadius: `${item.borderRadius}px`
      });
      node.append(icon);
    } else if (item.type === 'table') {
      const table = document.createElement('table');
      table.className = 'presentation-player-table';
      table.style.fontSize = `${item.fontSize}px`;
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      item.headers.forEach((value) => {
        const cell = document.createElement('th');
        cell.textContent = value;
        cell.style.background = item.headerColor;
        headRow.append(cell);
      });
      thead.append(headRow);
      const tbody = document.createElement('tbody');
      item.rows.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        row.forEach((value) => {
          const cell = document.createElement('td');
          cell.textContent = value;
          if (rowIndex % 2) cell.style.background = item.accentColor;
          tr.append(cell);
        });
        tbody.append(tr);
      });
      table.append(thead, tbody);
      node.append(table);
    } else if (item.type === 'button') {
      const link = document.createElement('a');
      link.className = 'presentation-player-button';
      link.textContent = item.label;
      link.href = item.href;
      if (/^https:\/\//.test(item.href)) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      Object.assign(link.style, {
        color: item.color,
        background: item.background,
        borderRadius: `${item.borderRadius}px`
      });
      node.append(link);
    } else if (item.type === 'code') {
      const code = document.createElement('pre');
      code.className = 'presentation-player-code';
      code.textContent = item.code;
      Object.assign(code.style, {
        color: item.color,
        background: item.background,
        fontSize: `${item.fontSize}px`
      });
      node.append(code);
    } else if (item.type === 'embed') {
      const frame = document.createElement('iframe');
      frame.className = 'presentation-player-embed';
      frame.src = item.url;
      frame.title = item.title;
      frame.loading = 'lazy';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-presentation');
      frame.setAttribute('allow', 'fullscreen; encrypted-media');
      node.append(frame);
    }
    return node;
  }

  async function mediaBlob(reference, ownerRepository) {
    const shared = reference.startsWith('assets/shared/');
    let targetRepo = state.repositoryId;
    if (ownerRepository && ownerRepository !== state.repositoryId) {
      const exists = state.availableRepositories.some((r) => r.id === ownerRepository);
      if (exists) targetRepo = ownerRepository;
    }
    try {
      return await window.ChemContentLibrary.readMediaBlob({
        scope: shared ? 'shared' : 'local',
        materialKind: shared ? '' : 'presentation',
        materialId: shared ? '' : state.presentationId,
        reference,
        repositoryId: targetRepo
      });
    } catch (error) {
      if (targetRepo !== state.repositoryId) {
        return window.ChemContentLibrary.readMediaBlob({
          scope: shared ? 'shared' : 'local',
          materialKind: shared ? '' : 'presentation',
          materialId: shared ? '' : state.presentationId,
          reference,
          repositoryId: state.repositoryId
        });
      }
      throw error;
    }
  }

  async function loadImage(node, item) {
    try {
      const blob = await Promise.race([
        mediaBlob(item.ref, item.repositoryId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 8_000))
      ]);
      if (!node.isConnected) return;
      const url = URL.createObjectURL(blob);
      state.urls.add(url);
      const image = document.createElement('img');
      image.src = url;
      image.alt = item.alt;
      image.style.objectFit = item.fit;
      image.style.objectPosition = `${item.focalX}% ${item.focalY}%`;
      image.style.borderRadius = `${item.borderRadius}px`;
      image.style.opacity = String(item.opacity ?? 1);
      node.replaceChildren(image);
    } catch (_) {
      if (!node.isConnected) return;
      node.replaceChildren();
      node.textContent = 'Brak obrazu';
      node.classList.add('is-missing-media');
    }
  }

  async function loadBackground(slide) {
    try {
      const blob = await Promise.race([
        mediaBlob(slide.backgroundRef),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 8_000))
      ]);
      if (!elements.stage.isConnected) return;
      const url = URL.createObjectURL(blob);
      state.urls.add(url);
      elements.stage.style.backgroundImage = `url(${url})`;
      elements.stage.style.backgroundSize = 'cover';
      elements.stage.style.backgroundPosition = 'center';
    } catch (_) {}
  }

  function renderOutline() {
    elements.outline.replaceChildren(...state.definition.slides.map((slide, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.classList.toggle('is-active', index === state.index);
      const number = document.createElement('span');
      number.textContent = index + 1;
      const title = document.createElement('span');
      title.textContent = slide.title;
      button.append(number, title);
      button.addEventListener('click', () => {
        state.index = index;
        render();
      });
      return button;
    }));
  }

  function presentationPercent() {
    const slides = state.definition.slides;
    const mode = state.definition.progress?.mode || 'visited';
    if (mode === 'highest') {
      return Math.max(0, ...Array.from(state.visited).map((id) => slides.findIndex((slide) => slide.slideId === id) + 1)) / slides.length * 100;
    }
    if (mode === 'all_required') {
      const required = slides.filter((slide) => slide.required !== false);
      return required.length ? required.filter((slide) => state.visited.has(slide.slideId)).length / required.length * 100 : 100;
    }
    return state.visited.size / slides.length * 100;
  }

  function render() {
    cleanup();
    const slide = state.definition.slides[state.index];
    state.visited.add(slide.slideId);
    elements.stage.dataset.aspect = state.definition.settings.aspectRatio;
    elements.stage.style.backgroundImage = 'none';
    elements.stage.style.background = slide.backgroundType === 'gradient'
      ? `linear-gradient(${slide.gradientAngle}deg, ${slide.gradientFrom}, ${slide.gradientTo})`
      : slide.background;
    elements.stage.replaceChildren(...slide.elements.slice().sort((a, b) => a.z - b.z).map(renderElement));
    elements.stage.classList.remove('is-animating');
    void elements.stage.offsetWidth;
    elements.stage.classList.add('is-animating');
    if (slide.backgroundRef && slide.backgroundType === 'image') void loadBackground(slide);
    elements.position.textContent = `${state.index + 1} / ${state.definition.slides.length}`;
    elements.progress.style.width = `${presentationPercent()}%`;
    elements.previous.disabled = state.index === 0;
    elements.next.textContent = state.index === state.definition.slides.length - 1 ? 'Zakończ ✓' : 'Dalej →';
    renderOutline();
    saveProgress(slide);
  }

  function saveProgress(slide) {
    if (!progressApi || state.preview) return;
    elements.save.textContent = 'Zapisywanie…';
    progressApi.update({
      materialId: state.materialId,
      materialType: 'presentation',
      action: 'presentation',
      lastPosition: { slideId: slide.slideId, slideIndex: state.index },
      details: {
        lastSlideId: slide.slideId,
        lastSlideIndex: state.index,
        highestReachedSlide: Math.max(state.index + 1, ...Array.from(state.visited).map((id) => state.definition.slides.findIndex((slideItem) => slideItem.slideId === id) + 1)),
        visitedSlides: [...state.visited],
        totalSlides: state.definition.slides.length
      }
    }).then(() => {
      elements.save.textContent = 'Postęp zapisany';
    }).catch(() => {
      elements.save.textContent = 'Zapis ponowi się później';
    });
  }

  async function loadPresentation() {
    if (state.loading) return;
    state.loading = true;
    elements.loading.hidden = false;
    elements.player.hidden = true;
    elements.error.hidden = true;

    let auth;
    try {
      auth = await window.ChemAuth.ready;
    } catch (_) {
      auth = null;
    }
    if (!auth?.authenticated || !auth.session?.ok) {
      state.loading = false;
      showError('Sesja wygasła lub brak uprawnień. Zaloguj się ponownie.');
      return;
    }

    const params = new URLSearchParams(location.search);
    state.presentationId = String(params.get('presentation') || '').trim().toLowerCase();
    state.repositoryId = String(params.get('repo') || 'default').trim().toLowerCase() || 'default';
    state.preview = params.get('preview') === '1';

    if (window.ChemContentLibrary?.repositories) {
      try {
        state.availableRepositories = await window.ChemContentLibrary.repositories();
        if (Array.isArray(state.availableRepositories) && state.availableRepositories.length > 0) {
          const matching = state.availableRepositories.find((r) => r.id === state.repositoryId);
          if (!matching) {
            const fallback = state.availableRepositories.find((r) => r.default) || state.availableRepositories[0];
            if (fallback) state.repositoryId = fallback.id;
          }
        }
      } catch (_) {}
    }

    try {
      state.definition = await requestDefinition();
      state.materialId = progressApi?.materialId('presentation', `${state.repositoryId}:${state.presentationId}`, params.get('material') || '') || '';
      if (progressApi && !state.preview) {
        await progressApi.load().catch(() => {});
        const saved = progressApi.record(state.materialId);
        const lastId = saved?.details?.lastSlideId || saved?.lastPosition?.slideId;
        const last = state.definition.slides.findIndex((slide) => slide.slideId === lastId);
        if (last >= 0) state.index = last;
        (saved?.details?.visitedSlides || []).forEach((id) => state.visited.add(id));
      }
      elements.title.textContent = state.definition.metadata.title;
      window.NextMedBrand ? window.NextMedBrand.setTitle(state.definition.metadata.title) : (document.title = state.definition.metadata.title + " — NextMed");
      elements.loading.hidden = true;
      elements.player.hidden = false;
      render();
    } catch (error) {
      showError(friendlyError(error));
    } finally {
      state.loading = false;
    }
  }

  // Bind controls
  if (elements.retry) elements.retry.addEventListener('click', () => loadPresentation());
  elements.previous.addEventListener('click', () => { if (state.index > 0) { state.index -= 1; render(); } });
  elements.next.addEventListener('click', () => {
    if (state.index < state.definition.slides.length - 1) {
      state.index += 1;
      render();
    } else {
      location.href = window.ChemModuleReturn?.url || '/members/';
    }
  });
  elements.outlineToggle.addEventListener('click', () => elements.outline.classList.toggle('is-open'));
  elements.fullscreen.addEventListener('click', () => document.fullscreenElement ? document.exitFullscreen() : elements.main.requestFullscreen());
  elements.theme.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('chem.theme', next); } catch (_) {}
  });

  document.addEventListener('keydown', (event) => {
    if (event.target.matches('input,textarea,select')) return;
    if (!state.definition?.slides?.length) return;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) {
      if (event.target.matches('button') && (event.key === ' ' || event.key === 'Enter')) return;
      if (state.index < state.definition.slides.length - 1) {
        event.preventDefault();
        state.index += 1;
        render();
      }
    } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(event.key)) {
      if (state.index > 0) {
        event.preventDefault();
        state.index -= 1;
        render();
      }
    } else if (event.key === 'Home') {
      if (state.index !== 0) {
        event.preventDefault();
        state.index = 0;
        render();
      }
    } else if (event.key === 'End') {
      const last = state.definition.slides.length - 1;
      if (state.index !== last) {
        event.preventDefault();
        state.index = last;
        render();
      }
    } else if ((event.key === 'f' || event.key === 'F') && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      document.fullscreenElement ? document.exitFullscreen() : elements.main.requestFullscreen();
    }
  });

  let touchStart = null;
  elements.stage.addEventListener('touchstart', (event) => {
    const point = event.changedTouches[0];
    touchStart = point ? { x: point.clientX, y: point.clientY } : null;
  }, { passive: true });
  elements.stage.addEventListener('touchend', (event) => {
    if (!touchStart || !state.definition?.slides?.length) return;
    const point = event.changedTouches[0];
    const dx = point ? point.clientX - touchStart.x : 0;
    const dy = point ? point.clientY - touchStart.y : 0;
    touchStart = null;
    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    if (dx < 0 && state.index < state.definition.slides.length - 1) state.index += 1;
    else if (dx > 0 && state.index > 0) state.index -= 1;
    else return;
    render();
  }, { passive: true });

  await loadPresentation();
})();
