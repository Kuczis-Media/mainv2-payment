(async () => {
  'use strict';

  const authState = await window.ChemAuth.ready;
  if (!authState?.authenticated || !authState.session?.ok) return;

  const parser = window.ChemLesson;
  const progressApi = window.ChemProgress;
  const elements = {
    app: document.getElementById('app'),
    lessonTitle: document.getElementById('lesson-title'),
    lessonPosition: document.getElementById('lesson-position'),
    progressBar: document.getElementById('progress-bar'),
    outlineList: document.getElementById('outline-list'),
    loading: document.getElementById('loading-state'),
    error: document.getElementById('error-state'),
    errorTitle: document.getElementById('error-title'),
    errorMessage: document.getElementById('error-message'),
    retry: document.getElementById('retry-button'),
    slideCard: document.getElementById('slide-card'),
    slideNumber: document.getElementById('slide-number'),
    slideStatus: document.getElementById('slide-status'),
    slideContent: document.getElementById('slide-content'),
    taskHost: document.getElementById('task-host'),
    completion: document.getElementById('completion-state'),
    navigation: document.getElementById('lesson-navigation'),
    navigationHint: document.getElementById('navigation-hint'),
    previous: document.getElementById('previous-button'),
    next: document.getElementById('next-button'),
    restart: document.getElementById('restart-button'),
    themeToggle: document.getElementById('theme-toggle'),
    topbarToggle: document.getElementById('topbar-toggle'),
    outlineToggle: document.getElementById('outline-toggle'),
    sequenceToggle: document.getElementById('sequence-toggle'),
    sequenceToggleHint: document.getElementById('sequence-toggle-hint'),
    outlineTipCopy: document.getElementById('outline-tip-copy'),
    resetProgress: document.getElementById('reset-progress-button'),
    libraryButton: document.getElementById('lesson-library-button'),
    libraryDialog: document.getElementById('lesson-library-dialog'),
    libraryClose: document.getElementById('lesson-library-close'),
    librarySearch: document.getElementById('lesson-library-search'),
    libraryRepository: document.getElementById('lesson-library-repository'),
    libraryStatus: document.getElementById('lesson-library-status'),
    libraryList: document.getElementById('lesson-library-list'),
    completionMessage: document.getElementById('completion-message')
  };

  const state = {
    filename: '',
    repositoryId: '',
    lesson: null,
    index: 0,
    maxReached: 0,
    solved: new Set(),
    completedStepIds: new Set(),
    completed: false,
    sequential: true,
    attempts: new Map(),
    libraryAssets: [],
    repositories: [],
    mediaObjectUrls: [],
    isAdmin: false,
    topbarCollapsed: false,
    outlineCollapsed: false
  };

  const UI_PREFERENCES_KEY = 'chemdisk.lesson.ui.v1';

  function isAdminUser(user) {
    const roles = user?.app_metadata?.roles;
    return Array.isArray(roles) && roles.includes('admin');
  }

  function initializePermissions() {
    const user = typeof window.ChemAuth.getUser === 'function'
      ? window.ChemAuth.getUser()
      : null;
    state.isAdmin = isAdminUser(user);
    elements.libraryButton.hidden = !state.isAdmin;
    elements.libraryDialog.setAttribute('aria-hidden', String(!state.isAdmin));
  }

  function loadUiPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem(UI_PREFERENCES_KEY) || 'null');
      if (!saved || typeof saved !== 'object') return;
      state.topbarCollapsed = saved.topbarCollapsed === true;
      state.outlineCollapsed = saved.outlineCollapsed === true;
    } catch {}
  }

  function saveUiPreferences() {
    try {
      localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify({
        topbarCollapsed: state.topbarCollapsed,
        outlineCollapsed: state.outlineCollapsed
      }));
    } catch {}
  }

  function applyUiState() {
    elements.app.classList.toggle('is-topbar-collapsed', state.topbarCollapsed);
    elements.app.classList.toggle('is-outline-collapsed', state.outlineCollapsed);

    const topbarLabel = state.topbarCollapsed ? 'Rozwiń górny pasek' : 'Zwiń górny pasek';
    elements.topbarToggle.setAttribute('aria-expanded', String(!state.topbarCollapsed));
    elements.topbarToggle.setAttribute('aria-label', topbarLabel);
    elements.topbarToggle.title = topbarLabel;

    const outlineLabel = state.outlineCollapsed ? 'Rozwiń plan lekcji' : 'Zwiń plan lekcji';
    elements.outlineToggle.setAttribute('aria-expanded', String(!state.outlineCollapsed));
    elements.outlineToggle.setAttribute('aria-label', outlineLabel);
    elements.outlineToggle.title = outlineLabel;
  }

  function toggleTopbar() {
    state.topbarCollapsed = !state.topbarCollapsed;
    applyUiState();
    saveUiPreferences();
  }

  function toggleOutline() {
    state.outlineCollapsed = !state.outlineCollapsed;
    applyUiState();
    saveUiPreferences();
  }

  function readFilename() {
    const params = new URLSearchParams(window.location.search);
    const files = params.getAll('file');
    if (files.length !== 1) return '';
    return parser.validateFilename(files[0]);
  }

  function readRepositoryId() {
    const params = new URLSearchParams(window.location.search);
    const values = params.getAll('repo');
    if (values.length > 1) return '';
    const value = values[0] ? values[0].trim().toLowerCase() : '';
    return !value || /^[a-z0-9][a-z0-9-]{0,39}$/.test(value) ? value : '';
  }

  function progressKey() {
    return `chemdisk.lesson.v1:${state.repositoryId || 'default'}:${state.filename}`;
  }

  function lessonMaterialId() {
    if (state.materialId) return state.materialId;
    const params = new URLSearchParams(window.location.search);
    state.materialId = progressApi
      ? progressApi.materialId('lesson', `${state.repositoryId || 'default'}:${state.filename}`, params.get('material') || '')
      : '';
    return state.materialId;
  }

  async function loadProgress() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(progressKey()) || 'null');
      if (saved && state.lesson && saved.signature === state.lesson.signature) {
        const lastIndex = state.lesson.slides.length - 1;
        state.index = Math.min(lastIndex, Math.max(0, Number(saved.index) || 0));
        state.maxReached = Math.min(lastIndex, Math.max(state.index, Number(saved.maxReached) || 0));
        state.solved = new Set(
          Array.isArray(saved.solved)
            ? saved.solved.filter((index) => Number.isSafeInteger(index) && index >= 0 && index <= lastIndex)
            : []
        );
        state.completedStepIds = new Set(Array.isArray(saved.completedStepIds) ? saved.completedStepIds : []);
        state.completed = Boolean(saved.completed);
        state.sequential = saved.sequential !== false;
      }
    } catch {}
    state.sequential = state.lesson?.navigation !== 'free';
    if (!progressApi) return;
    try {
      await progressApi.load();
      const record = progressApi.record(lessonMaterialId());
      const details = record?.details || {};
      const currentIndex = state.lesson.slides.findIndex((slide) => slide.id === details.currentStepId);
      const highestIndex = state.lesson.slides.findIndex((slide) => slide.id === details.highestReachedStepId);
      if (currentIndex >= 0) state.index = currentIndex;
      if (highestIndex >= 0) state.maxReached = Math.max(state.index, highestIndex);
      state.completedStepIds = new Set(Array.isArray(details.completedStepIds) ? details.completedStepIds : []);
      state.solved = new Set(state.lesson.slides
        .map((slide, index) => slide.task && state.completedStepIds.has(slide.id) ? index : -1)
        .filter((index) => index >= 0));
      state.completed = record?.status === 'completed';
      const skipMode = progressApi.state?.preferences?.skipMode || 'DEFAULT';
      if (skipMode === 'ALLOW') state.sequential = false;
      if (skipMode === 'DENY') state.sequential = true;
    } catch (_) {
      // sessionStorage pozostaje wyłącznie awaryjnym cache'em interfejsu.
    }
  }

  function trackedSlides() {
    return state.lesson.slides.filter((slide) => slide.includeInLesson !== 'OFF');
  }

  function saveProgress(immediate = false, throwOnError = false) {
    if (!state.lesson) return Promise.resolve(null);
    try {
      sessionStorage.setItem(progressKey(), JSON.stringify({
        index: state.index,
        maxReached: state.maxReached,
        solved: [...state.solved],
        completedStepIds: [...state.completedStepIds],
        completed: state.completed,
        sequential: state.sequential,
        signature: state.lesson.signature
      }));
    } catch {}
    if (progressApi && lessonMaterialId()) {
      const slide = state.lesson.slides[state.index];
      const tracked = trackedSlides();
      const completedTrackedSteps = tracked.filter((step) => state.completedStepIds.has(step.id)).length;
      return progressApi.update({
        materialId: lessonMaterialId(),
        materialType: 'lesson',
        action: state.completed ? 'complete' : 'lesson_step',
        lastPosition: { stepId: slide?.id || '', stepIndex: state.index },
        details: {
          currentStepId: slide?.id || '',
          currentStepIndex: state.index,
          completedStepIds: [...state.completedStepIds],
          completedTrackedSteps,
          totalTrackedSteps: tracked.length
        }
      }, { immediate, debounceMs: 1200, throwOnError });
    }
    return Promise.resolve(null);
  }

  function initializeTheme() {
    let theme = '';
    try { theme = localStorage.getItem('chem.theme') || ''; } catch {}
    if (!theme) {
      theme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme(theme);
  }

  function applyTheme(theme) {
    const dark = theme === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    elements.themeToggle.setAttribute('aria-pressed', String(dark));
    elements.themeToggle.setAttribute('aria-label', dark ? 'Włącz jasny motyw' : 'Włącz ciemny motyw');
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('chem.theme', next); } catch {}
  }

  function showError(title, message, canRetry = true) {
    elements.loading.hidden = true;
    elements.slideCard.hidden = true;
    elements.completion.hidden = true;
    elements.navigation.hidden = true;
    elements.error.hidden = false;
    elements.errorTitle.textContent = title;
    elements.errorMessage.textContent = message;
    elements.retry.hidden = !canRetry;
    elements.resetProgress.disabled = true;
    elements.lessonPosition.textContent = 'Błąd wczytywania';
    elements.app.removeAttribute('aria-busy');
  }

  function friendlyLoadError(error) {
    if (error?.code || error?.name === 'LessonFormatError') return error.message;
    if (error?.message === 'NOT_FOUND') return `Nie znaleziono lekcji „${state.filename}” w prywatnej bibliotece.`;
    if (error?.message === 'TOO_LARGE') return 'Plik lekcji jest zbyt duży.';
    return 'Sprawdź połączenie, nazwę pliku i spróbuj ponownie.';
  }

  async function loadLesson() {
    elements.app.setAttribute('aria-busy', 'true');
    elements.resetProgress.disabled = true;
    elements.loading.hidden = false;
    elements.error.hidden = true;
    elements.slideCard.hidden = true;
    elements.completion.hidden = true;
    elements.navigation.hidden = true;

    state.filename = readFilename();
    state.repositoryId = readRepositoryId();
    if (!state.filename) {
      if (state.isAdmin) {
        showError(
          'Wybierz lekcję z biblioteki',
          'Otwórz bibliotekę u góry i wybierz materiał z prywatnego repozytorium.',
          false
        );
        openLessonLibrary();
      } else {
        showError(
          'Nie wskazano lekcji',
          'Wróć do panelu kursu i otwórz przypisaną lekcję.',
          false
        );
      }
      return;
    }

    try {
      const markdown = await fetchLessonMarkdown(state.filename, state.repositoryId);
      state.lesson = parser.parseLesson(markdown, state.filename);
      state.index = 0;
      state.maxReached = 0;
      state.solved = new Set();
      state.completed = false;
      state.sequential = true;
      state.attempts = new Map();
      await loadProgress();
      updateSequenceControl();

      document.title = `${state.lesson.title} — ChemDisk`;
      elements.lessonTitle.textContent = state.lesson.title;
      buildOutline();
      elements.loading.hidden = true;
      elements.resetProgress.disabled = false;
      elements.app.removeAttribute('aria-busy');
      if (state.completed) showCompletion();
      else renderSlide();
    } catch (error) {
      console.error('Nie udało się wczytać lekcji', error);
      showError('Nie udało się wczytać lekcji', friendlyLoadError(error));
    }
  }

  async function fetchLessonMarkdown(filename, repositoryId) {
    const library = window.ChemContentLibrary;
    if (library && typeof library.readLesson === 'function') {
      try {
        const asset = await library.readLesson(filename, { repositoryId });
        return asset.content;
      } catch (error) {
        if (repositoryId) throw error;
        const mayUseBundledFallback = [
          'CONTENT_REPOSITORY_NOT_CONFIGURED',
          'CONTENT_DIRECTORY_NOT_FOUND',
          'CONTENT_FILE_NOT_FOUND'
        ].includes(error && error.code);
        if (!mayUseBundledFallback) throw error;
      }
    }
    const response = await fetch(`./${encodeURIComponent(filename)}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'text/markdown,text/plain;q=0.9' }
    });
    if (response.status === 404) throw new Error('NOT_FOUND');
    if (!response.ok) throw new Error('FETCH_FAILED');
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > 512 * 1024) throw new Error('TOO_LARGE');
    return response.text();
  }

  async function openLessonLibrary() {
    if (!state.isAdmin) return;
    if (!elements.libraryDialog.open) {
      if (typeof elements.libraryDialog.showModal === 'function') elements.libraryDialog.showModal();
      else elements.libraryDialog.setAttribute('open', '');
    }
    elements.librarySearch.value = '';
    elements.librarySearch.focus();
    try {
      await loadRepositoryOptions();
    } catch (error) {
      elements.libraryStatus.className = 'lesson-library-status is-error';
      elements.libraryStatus.textContent = error && error.message
        ? error.message
        : 'Nie udało się pobrać listy repozytoriów.';
      return;
    }
    if (state.libraryAssets.length) {
      renderLessonLibrary();
      return;
    }
    elements.libraryStatus.className = 'lesson-library-status is-loading';
    elements.libraryStatus.textContent = 'Pobieranie listy lekcji…';
    elements.libraryList.replaceChildren();
    try {
      state.libraryAssets = await window.ChemContentLibrary.list('lesson', {
        repositoryId: state.repositoryId
      });
      elements.libraryStatus.className = 'lesson-library-status';
      elements.libraryStatus.textContent = state.libraryAssets.length
        ? `${state.libraryAssets.length} lekcji w wybranym repozytorium.`
        : 'Repozytorium nie zawiera jeszcze lekcji.';
      renderLessonLibrary();
    } catch (error) {
      elements.libraryStatus.className = 'lesson-library-status is-error';
      elements.libraryStatus.textContent = error && error.message
        ? error.message
        : 'Nie udało się pobrać biblioteki.';
    }
  }

  async function loadRepositoryOptions() {
    if (!state.repositories.length) {
      state.repositories = await window.ChemContentLibrary.repositories();
    }
    if (!state.repositories.length) throw new Error('Nie skonfigurowano żadnego repozytorium.');
    const selected = state.repositories.find((repository) => repository.id === state.repositoryId)
      || state.repositories.find((repository) => repository.default)
      || state.repositories[0];
    state.repositoryId = selected.id;
    elements.libraryRepository.replaceChildren(
      ...state.repositories.map((repository) => {
        const option = document.createElement('option');
        option.value = repository.id;
        option.textContent = repository.label || repository.repository;
        return option;
      })
    );
    elements.libraryRepository.value = state.repositoryId;
  }

  function closeLessonLibrary() {
    if (typeof elements.libraryDialog.close === 'function') elements.libraryDialog.close();
    else elements.libraryDialog.removeAttribute('open');
  }

  function renderLessonLibrary() {
    const library = window.ChemContentLibrary;
    const assets = library.search(state.libraryAssets, elements.librarySearch.value);
    const fragment = document.createDocumentFragment();
    assets.forEach((asset) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'lesson-library-item';
      const icon = document.createElement('span');
      icon.className = 'lesson-library-icon';
      icon.textContent = 'L';
      icon.setAttribute('aria-hidden', 'true');
      const copy = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = asset.title || asset.filename;
      const description = document.createElement('small');
      description.textContent = asset.description || asset.filename;
      copy.append(title, description);
      const arrow = document.createElement('span');
      arrow.textContent = '→';
      arrow.setAttribute('aria-hidden', 'true');
      button.append(icon, copy, arrow);
      button.addEventListener('click', () => selectLibraryLesson(asset));
      fragment.append(button);
    });
    if (!assets.length && state.libraryAssets.length) {
      const empty = document.createElement('p');
      empty.className = 'lesson-library-empty';
      empty.textContent = 'Nie znaleziono lekcji pasującej do wyszukiwania.';
      fragment.append(empty);
    }
    elements.libraryList.replaceChildren(fragment);
  }

  function selectLibraryLesson(asset) {
    if (!asset || !asset.filename) return;
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('file', asset.filename);
    if (asset.repositoryId) url.searchParams.set('repo', asset.repositoryId);
    window.history.pushState({}, '', url);
    closeLessonLibrary();
    loadLesson();
  }

  function buildOutline() {
    elements.outlineList.replaceChildren();
    state.lesson.slides.forEach((slide, index) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      const marker = document.createElement('span');
      const label = document.createElement('span');
      marker.className = 'outline-marker';
      marker.textContent = String(index + 1);
      label.className = 'outline-label';
      label.textContent = slide.title;
      button.type = 'button';
      button.dataset.slideIndex = String(index);
      button.append(marker, label);
      button.addEventListener('click', () => {
        if ((state.sequential && index > state.maxReached) || state.completed) return;
        state.index = index;
        state.maxReached = Math.max(state.maxReached, index);
        saveProgress();
        renderSlide();
      });
      item.appendChild(button);
      elements.outlineList.appendChild(item);
    });
  }

  function updateOutline() {
    elements.outlineList.querySelectorAll('button').forEach((button, index) => {
      const slide = state.lesson.slides[index];
      const accessible = (!state.sequential || index <= state.maxReached) && !state.completed;
      const current = index === state.index && !state.completed;
      const complete = state.solved.has(index)
        || ((!slide.task || state.solved.has(index)) && (state.completed || index < state.maxReached));
      button.disabled = !accessible;
      button.classList.toggle('is-current', current);
      button.classList.toggle('is-complete', complete);
      if (current) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
      const marker = button.querySelector('.outline-marker');
      if (marker) marker.textContent = complete ? '✓' : String(index + 1);
    });
  }

  function updateSequenceControl() {
    elements.sequenceToggle.checked = state.sequential;
    elements.sequenceToggle.disabled = !state.isAdmin;
    elements.sequenceToggleHint.textContent = state.sequential
      ? (state.isAdmin ? 'Tryb ustawiony w Lesson Builderze; administrator może go podglądowo zmienić.' : 'Kroki są odblokowywane po kolei.')
      : 'Wszystkie kroki są dostępne.';
    elements.outlineTipCopy.textContent = state.sequential
      ? 'Zadanie trzeba rozwiązać, aby odblokować kolejny krok.'
      : 'Możesz przejść dalej i wrócić do trudnego zadania później.';
  }

  function updateNavigationAccess(slide, isSolved) {
    const examGate = currentExamGate();
    const taskBlocked = Boolean(slide.task && !isSolved);
    const blocked = state.sequential && (taskBlocked || !examGate.satisfied);
    elements.next.disabled = blocked;
    elements.navigationHint.textContent = blocked
      ? (!examGate.satisfied
        ? examGate.message
        : 'Najpierw podaj poprawną odpowiedź albo wyłącz tryb „Nauka po kolei”.')
      : slide.task && !isSolved
        ? 'Możesz pominąć to zadanie i wrócić do niego później.'
        : '';
    updateOutline();
  }

  function toggleSequentialLearning() {
    state.sequential = elements.sequenceToggle.checked;
    if (state.sequential) state.maxReached = Math.max(state.maxReached, state.index);
    updateSequenceControl();
    const slide = state.lesson && state.lesson.slides[state.index];
    if (slide) updateNavigationAccess(slide, state.solved.has(state.index));
    saveProgress();
  }

  function renderSlide() {
    const slide = state.lesson.slides[state.index];
    const isSolved = state.solved.has(state.index);
    const tracked = trackedSlides();
    const completedTracked = tracked.filter((step) => state.completedStepIds.has(step.id)).length;
    const progress = tracked.length ? (completedTracked / tracked.length) * 100 : 0;

    elements.error.hidden = true;
    elements.completion.hidden = true;
    elements.slideCard.hidden = false;
    elements.navigation.hidden = false;
    elements.slideNumber.textContent = `Krok ${state.index + 1} z ${state.lesson.slides.length}`;
    elements.lessonPosition.textContent = `Krok ${state.index + 1} z ${state.lesson.slides.length}`;
    elements.progressBar.style.width = `${progress}%`;
    clearTypesetMath(elements.slideContent);
    state.mediaObjectUrls.splice(0).forEach((url) => URL.revokeObjectURL(url));
    elements.slideContent.classList.toggle('is-canvas-layout', slide.layout === 'canvas');
    elements.slideContent.innerHTML = slide.html;
    initializeInteractiveBlocks(elements.slideContent);
    void hydrateManagedImages(elements.slideContent);
    typesetMath(elements.slideContent);
    elements.slideStatus.textContent = slide.task
      ? (isSolved ? 'Zadanie rozwiązane' : 'Zadanie do wykonania')
      : 'Materiał';
    elements.slideStatus.dataset.state = isSolved ? 'complete' : (slide.task ? 'task' : 'content');

    renderTask(slide.task, isSolved);
    playSlideTransition(slide.transition);
    elements.previous.disabled = state.index === 0;
    elements.next.querySelector('span').textContent =
      state.index === state.lesson.slides.length - 1 ? 'Zakończ lekcję' : 'Dalej';
    updateNavigationAccess(slide, isSolved);
    saveProgress();
    elements.slideCard.focus?.({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function hydrateManagedImages(root) {
    const library = window.ChemContentLibrary;
    if (!library?.readMediaBlob) return;
    const figures = Array.from(root.querySelectorAll('[data-lesson-media-ref]'));
    await Promise.all(figures.map(async (figure) => {
      const reference = figure.dataset.lessonMediaRef || '';
      try {
        const blob = await library.readMediaBlob({
          scope: figure.dataset.lessonMediaScope === 'shared' ? 'shared' : 'local',
          materialKind: figure.dataset.lessonMediaScope === 'shared' ? '' : 'lesson',
          materialId: figure.dataset.lessonMediaScope === 'shared' ? '' : state.filename,
          reference,
          repositoryId: figure.dataset.lessonMediaRepository || state.repositoryId
        });
        if (!figure.isConnected) return;
        const objectUrl = URL.createObjectURL(blob);
        state.mediaObjectUrls.push(objectUrl);
        const image = document.createElement('img');
        image.src = objectUrl;
        image.alt = figure.dataset.lessonMediaAlt || 'Ilustracja';
        image.loading = 'lazy';
        image.decoding = 'async';
        figure.replaceChildren(image);
      } catch (_) {
        const placeholder = figure.querySelector('.lesson-managed-image-placeholder');
        if (placeholder) placeholder.replaceChildren(document.createTextNode('Nie udało się wczytać obrazu.'));
        figure.classList.add('is-error');
      }
    }));
  }

  function playSlideTransition(value) {
    const transition = ['none', 'fade', 'rise', 'slide', 'zoom'].includes(value)
      ? value
      : 'fade';
    elements.slideCard.dataset.transition = transition;
    elements.slideCard.classList.remove('is-entering');
    if (transition === 'none') return;
    void elements.slideCard.offsetWidth;
    elements.slideCard.classList.add('is-entering');
  }

  function clearTypesetMath(root) {
    const formulas = root
      ? Array.from(root.querySelectorAll('.lesson-formula-display'))
      : [];
    if (!formulas.length) return;
    try {
      window.MathJax?.typesetClear?.(formulas);
    } catch (_) {
      // Wzory są dodatkiem i nie mogą zablokować całej lekcji.
    }
  }

  function typesetMath(root) {
    const mathJax = window.MathJax;
    const formulas = root
      ? Array.from(root.querySelectorAll('.lesson-formula-display'))
      : [];
    if (!formulas.length || !mathJax || typeof mathJax.typesetPromise !== 'function') return;
    const startup = mathJax.startup?.promise || Promise.resolve();
    const previous = window.__chemDiskMathPromise || startup;
    window.__chemDiskMathPromise = previous
      .catch(() => undefined)
      .then(() => mathJax.typesetPromise(formulas))
      .catch(() => undefined);
  }

  function slideAiContext(root) {
    const clone = root.cloneNode(true);
    clone.querySelectorAll(
      '.lesson-ai-help, button, input, select, textarea, iframe, script, style'
    ).forEach((node) => node.remove());
    return String(clone.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000);
  }

  function openSlideAiHelp(button, root) {
    const card = button.closest('.lesson-ai-help');
    if (!card) return;

    const url = new URL('/members/module/chat/', window.location.origin);
    const prompt = card.dataset.aiPrompt || '';
    const repository = card.dataset.aiRepository || '';
    const point = card.dataset.aiPoint || '1';
    if (/\.json$/i.test(prompt)) url.searchParams.set('prompt', prompt);
    if (/\.txt$/i.test(prompt)) {
      url.searchParams.set('plik', prompt);
      url.searchParams.set('punkt', point);
    }
    if (repository) url.searchParams.set('repo', repository);

    try {
      const contextId = typeof window.crypto?.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      const context = slideAiContext(root);
      if (context) {
        const slideTitle = root.querySelector('h1, h2, h3')?.textContent?.trim()
          || state.lesson?.title
          || state.filename
          || 'Lekcja';
        localStorage.setItem(`chem.lesson-ai-context.${contextId}`, JSON.stringify({
          context,
          title: slideTitle.slice(0, 180),
          createdAt: Date.now()
        }));
        url.searchParams.set('lesson_context', contextId);
      }
    } catch (_) {
      // Czat nadal może zostać otwarty bez automatycznego kontekstu.
    }

    window.open(url.toString(), '_blank', 'noopener');
  }

  function initializeInteractiveBlocks(root) {
    initializeExamBlocks(root);
    root.querySelectorAll('.lesson-flashcard').forEach((card) => {
      card.addEventListener('click', () => {
        const flipped = card.getAttribute('aria-pressed') !== 'true';
        card.setAttribute('aria-pressed', String(flipped));
        card.classList.toggle('is-flipped', flipped);
      });
    });
    root.querySelectorAll('.lesson-atonom-open').forEach((button) => {
      button.addEventListener('click', () => {
        const figure = button.closest('.lesson-atonom');
        const frameHost = figure?.querySelector('.lesson-atonom-frame');
        if (!frameHost) return;
        const expanded = button.getAttribute('aria-expanded') === 'true';
        if (expanded) {
          frameHost.replaceChildren();
          frameHost.hidden = true;
          button.setAttribute('aria-expanded', 'false');
          button.textContent = 'Pokaż związek';
          return;
        }
        const iframe = frameHost.ownerDocument.createElement('iframe');
        iframe.src = button.dataset.atonomSrc;
        iframe.title = button.dataset.atonomTitle || 'Interaktywny model cząsteczki';
        iframe.loading = 'lazy';
        iframe.setAttribute('allow', 'fullscreen');
        frameHost.replaceChildren(iframe);
        frameHost.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        button.textContent = 'Ukryj model';
      });
    });
    root.querySelectorAll('[data-lesson-ai-open]').forEach((button) => {
      button.addEventListener('click', () => openSlideAiHelp(button, root));
    });
  }

  function examGateFor(card) {
    const requirement = card?.dataset.examRequirement || 'optional';
    if (requirement === 'optional') return { satisfied: true, message: '' };
    const record = progressApi?.record(card.dataset.examMaterial) || null;
    const score = Number(record?.details?.scorePercent);
    if (requirement === 'completed' && record?.status === 'completed') {
      return { satisfied: true, message: 'Egzamin ukończony.' };
    }
    if (requirement === 'passed' && record?.status === 'completed' && record?.details?.passed === true) {
      return { satisfied: true, message: 'Egzamin zaliczony.' };
    }
    const minimum = Math.max(0, Math.min(100, Number(card?.dataset.examMinimumScore) || 0));
    if (requirement === 'minimum_score' && Number.isFinite(score) && score >= minimum) {
      return { satisfied: true, message: `Osiągnięto wymagane ${minimum}%.` };
    }
    if (requirement === 'passed') {
      return { satisfied: false, message: 'Aby przejść dalej, zalicz egzamin.' };
    }
    if (requirement === 'minimum_score') {
      return { satisfied: false, message: `Aby przejść dalej, uzyskaj z egzaminu co najmniej ${minimum}%.` };
    }
    return { satisfied: false, message: 'Aby przejść dalej, ukończ egzamin.' };
  }

  function initializeExamBlocks(root) {
    root.querySelectorAll('.lesson-exam-card').forEach((card) => {
      const gate = examGateFor(card);
      const record = progressApi?.record(card.dataset.examMaterial) || null;
      const status = card.querySelector('[data-exam-state]');
      card.dataset.gate = gate.satisfied ? 'open' : 'locked';
      if (!status) return;
      if (!record) status.textContent = card.dataset.examRequirement === 'optional'
        ? 'Egzamin opcjonalny'
        : gate.message;
      else if (record.status === 'completed') {
        if (record.details?.studentResultVisible === false) {
          status.textContent = 'Egzamin ukończony · wynik dostępny administratorowi';
          return;
        }
        const score = Number(record.details?.scorePercent);
        status.textContent = `${record.details?.passed === true ? 'Zaliczono' : 'Ukończono'}${Number.isFinite(score) ? ` · wynik ${Math.round(score)}%` : ''}`;
      } else {
        status.textContent = `${progressApi.statusLabel(record)} · postęp ${progressApi.percentLabel(record.progressPercent)}`;
      }
    });
  }

  function currentExamGate() {
    const cards = Array.from(elements.slideContent.querySelectorAll('.lesson-exam-card'));
    return cards.map(examGateFor).find((gate) => !gate.satisfied) || { satisfied: true, message: '' };
  }

  async function refreshExamProgress(force = false) {
    if (!progressApi || !elements.slideContent.querySelector('.lesson-exam-card')) return;
    try { await progressApi.load({ force }); } catch (_) {}
    initializeExamBlocks(elements.slideContent);
    const slide = state.lesson?.slides[state.index];
    if (slide) updateNavigationAccess(slide, state.solved.has(state.index));
  }

  function renderTask(task, solved) {
    elements.taskHost.replaceChildren();
    elements.taskHost.hidden = !task;
    if (!task) return;

    const form = document.createElement('form');
    const heading = document.createElement('h2');
    const label = document.createElement('label');
    const controls = document.createElement('div');
    const submit = document.createElement('button');
    const feedback = document.createElement('p');
    const fieldId = `lesson-answer-${state.index}`;

    form.className = 'task-card';
    form.noValidate = true;
    heading.textContent = 'Sprawdź, czy rozumiesz';
    label.className = 'task-label';
    label.textContent = task.label;
    label.htmlFor = fieldId;
    controls.className = 'task-controls';
    feedback.className = 'task-feedback';
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');
    submit.className = 'button task-submit';
    submit.type = 'submit';
    submit.textContent = solved ? 'Odpowiedź zaliczona' : 'Sprawdź odpowiedź';
    submit.disabled = solved;

    let readValue;
    let perGapMode = false;
    const gapFields = [];
    const checkedGaps = new Set();
    if (task.type === 'gaps' || task.type === 'gaps-text') {
      const exercise = document.createElement('p');
      exercise.className = 'gap-exercise';
      String(task.text || '').split(/(\{\{[^{}]*\}\})/).forEach((part) => {
        const gap = /^\{\{([^{}]*)\}\}$/.exec(part);
        if (!gap) {
          exercise.appendChild(document.createTextNode(part));
          return;
        }
        const gapIndex = gapFields.length;
        const gapLabel = gap[1].trim() || `luka ${gapIndex + 1}`;
        if (task.type === 'gaps') {
          const select = document.createElement('select');
          const blank = document.createElement('option');
          blank.value = '';
          blank.textContent = gapLabel;
          select.id = `${fieldId}-${gapIndex}`;
          select.name = `${fieldId}-${gapIndex}`;
          select.setAttribute('aria-label', `Luka ${gapIndex + 1}: ${gapLabel}`);
          select.disabled = solved;
          select.appendChild(blank);
          task.options.forEach((option) => {
            const item = document.createElement('option');
            item.value = option;
            item.textContent = option;
            select.appendChild(item);
          });
          gapFields.push(select);
          exercise.appendChild(select);
          return;
        }

        const wrapper = document.createElement('span');
        const input = document.createElement('input');
        wrapper.className = 'text-gap-control';
        wrapper.dataset.state = solved ? 'success' : '';
        input.type = 'text';
        input.id = `${fieldId}-${gapIndex}`;
        input.name = `${fieldId}-${gapIndex}`;
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.placeholder = gapLabel;
        input.setAttribute('aria-label', `Luka ${gapIndex + 1}: ${gapLabel}`);
        input.setAttribute('aria-describedby', `${fieldId}-feedback`);
        input.disabled = solved;
        wrapper.appendChild(input);
        if (task.checkMode === 'each') {
          const check = document.createElement('button');
          check.type = 'button';
          check.className = 'gap-check-one';
          check.dataset.gapIndex = String(gapIndex);
          check.textContent = '✓';
          check.setAttribute('aria-label', `Sprawdź lukę ${gapIndex + 1}`);
          check.disabled = solved;
          wrapper.appendChild(check);
          perGapMode = true;
        }
        gapFields.push(input);
        exercise.appendChild(wrapper);
      });
      controls.classList.add('gap-controls');
      controls.appendChild(exercise);
      label.hidden = true;
      readValue = () => gapFields.map((field) => field.value);
    } else if (task.type === 'choice') {
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = task.label;
      fieldset.id = fieldId;
      fieldset.className = 'choice-grid';
      fieldset.classList.toggle('is-abcd', task.choiceStyle === 'abcd');
      fieldset.disabled = solved;
      task.options.forEach((option, optionIndex) => {
        const optionLabel = document.createElement('label');
        const input = document.createElement('input');
        const marker = document.createElement('span');
        const copy = document.createElement('span');
        input.type = 'radio';
        input.name = fieldId;
        input.value = task.choiceStyle === 'abcd' ? String.fromCharCode(65 + optionIndex) : option;
        input.id = `${fieldId}-${optionIndex}`;
        marker.className = 'choice-letter';
        marker.textContent = String.fromCharCode(65 + optionIndex);
        marker.setAttribute('aria-hidden', 'true');
        copy.className = 'choice-copy';
        copy.textContent = option;
        optionLabel.htmlFor = input.id;
        optionLabel.append(input);
        if (task.choiceStyle === 'abcd') optionLabel.append(marker);
        optionLabel.append(copy);
        fieldset.appendChild(optionLabel);
      });
      controls.appendChild(fieldset);
      label.hidden = true;
      readValue = () => form.elements[fieldId]?.value || '';
    } else {
      const input = document.createElement('input');
      input.id = fieldId;
      input.name = fieldId;
      input.type = 'text';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.placeholder = task.placeholder;
      input.inputMode = task.type === 'number' ? 'decimal' : 'text';
      input.disabled = solved;
      input.setAttribute('aria-describedby', `${fieldId}-feedback`);
      controls.appendChild(input);
      readValue = () => input.value;
    }

    feedback.id = `${fieldId}-feedback`;
    if (solved) {
      feedback.dataset.state = 'success';
      feedback.textContent = task.success;
    }

    form.append(heading, label, controls, submit, feedback);
    submit.hidden = perGapMode;

    const completeTask = () => {
      state.solved.add(state.index);
      state.completedStepIds.add(state.lesson.slides[state.index].id);
      feedback.dataset.state = 'success';
      feedback.textContent = task.success;
      submit.disabled = true;
      submit.textContent = 'Odpowiedź zaliczona';
      form.querySelectorAll('input, select, fieldset, .gap-check-one').forEach((field) => {
        field.disabled = true;
      });
      elements.next.disabled = false;
      elements.navigationHint.textContent = '';
      elements.slideStatus.textContent = 'Zadanie rozwiązane';
      elements.slideStatus.dataset.state = 'complete';
      updateOutline();
      saveProgress(true);
      elements.next.focus();
    };

    const showWrongAnswer = (field, prefix = 'Jeszcze nie') => {
      feedback.dataset.state = 'error';
      feedback.textContent = task.hint
        ? `${prefix}. Podpowiedź: ${task.hint}`
        : `${prefix} — popraw odpowiedź i spróbuj ponownie.`;
      field?.setAttribute('aria-invalid', 'true');
      field?.focus();
    };

    if (perGapMode) {
      form.querySelectorAll('.gap-check-one').forEach((button) => {
        button.addEventListener('click', () => {
          if (state.solved.has(state.index)) return;
          const gapIndex = Number(button.dataset.gapIndex);
          const input = gapFields[gapIndex];
          const attempts = (state.attempts.get(state.index) || 0) + 1;
          state.attempts.set(state.index, attempts);
          if (parser.checkGapAnswer(task, input.value, gapIndex)) {
            checkedGaps.add(gapIndex);
            input.removeAttribute('aria-invalid');
            input.disabled = true;
            button.disabled = true;
            button.closest('.text-gap-control').dataset.state = 'success';
            feedback.dataset.state = 'success';
            feedback.textContent = `Luka ${gapIndex + 1} jest poprawna.`;
            if (checkedGaps.size === gapFields.length) completeTask();
            else gapFields.find((field, index) => !checkedGaps.has(index))?.focus();
          } else {
            button.closest('.text-gap-control').dataset.state = 'error';
            showWrongAnswer(input, `Luka ${gapIndex + 1} jest niepoprawna`);
          }
        });
      });
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (state.solved.has(state.index) || perGapMode) return;
      const answer = readValue();
      const attempts = (state.attempts.get(state.index) || 0) + 1;
      state.attempts.set(state.index, attempts);

      if (parser.checkAnswer(task, answer)) {
        completeTask();
      } else {
        const firstInput = form.querySelector('select:not([disabled]), input:not([type="radio"]), input[type="radio"]:checked, input[type="radio"]');
        showWrongAnswer(firstInput);
      }
    });
    elements.taskHost.appendChild(form);
  }

  async function goNext() {
    const slide = state.lesson.slides[state.index];
    await refreshExamProgress(true);
    if (state.sequential && (slide.task && !state.solved.has(state.index) || !currentExamGate().satisfied)) return;
    const previousIndex = state.index;
    const wasCompleted = state.completed;
    state.completedStepIds.add(slide.id);
    if (state.index === state.lesson.slides.length - 1) {
      state.completed = true;
      try {
        await saveProgress(true, true);
        showCompletion();
      } catch (error) {
        state.completed = wasCompleted;
        elements.navigationHint.textContent = error?.code === 'LESSON_INCOMPLETE'
          ? 'Nie wszystkie wymagane kroki i egzaminy są ukończone.'
          : 'Nie udało się potwierdzić ukończenia. Spróbuj ponownie.';
        updateNavigationAccess(slide, state.solved.has(state.index));
      }
      return;
    }
    state.index += 1;
    state.maxReached = Math.max(state.maxReached, state.index);
    try {
      await saveProgress(true, true);
      renderSlide();
    } catch (error) {
      state.index = previousIndex;
      elements.navigationHint.textContent = error?.code === 'STEP_NOT_UNLOCKED'
        ? 'Warunek tego kroku nie został jeszcze spełniony.'
        : 'Nie udało się potwierdzić przejścia. Spróbuj ponownie.';
      updateNavigationAccess(slide, state.solved.has(state.index));
    }
  }

  function goPrevious() {
    if (state.index === 0) return;
    state.index -= 1;
    renderSlide();
  }

  function showCompletion() {
    state.completed = true;
    state.lesson.slides.forEach((slide) => {
      if (!slide.task || state.solved.has(state.lesson.slides.indexOf(slide))) state.completedStepIds.add(slide.id);
    });
    const unresolvedTasks = state.lesson.slides.filter(
      (slide, index) => slide.task && !state.solved.has(index)
    ).length;
    elements.slideCard.hidden = true;
    elements.navigation.hidden = true;
    elements.error.hidden = true;
    elements.completion.hidden = false;
    elements.progressBar.style.width = '100%';
    elements.lessonPosition.textContent = 'Lekcja ukończona';
    elements.completionMessage.textContent = unresolvedTasks
      ? `Przejrzano wszystkie kroki. Pominięte zadania: ${unresolvedTasks}. Możesz powtórzyć lekcję i wrócić do nich później.`
      : 'Wszystkie kroki zostały przejrzane, a zadania rozwiązane poprawnie.';
    updateOutline();
    saveProgress(true);
    elements.restart.focus();
  }

  function restartLesson() {
    try { sessionStorage.removeItem(progressKey()); } catch {}
    state.index = 0;
    state.maxReached = 0;
    state.solved = new Set();
    state.completedStepIds = new Set();
    state.completed = false;
    state.sequential = true;
    state.attempts = new Map();
    if (progressApi && lessonMaterialId()) progressApi.reset(lessonMaterialId()).catch(() => {});
    updateSequenceControl();
    renderSlide();
  }

  function confirmResetProgress() {
    if (!state.lesson) return;
    const confirmed = window.confirm(
      'Zresetować postęp tej lekcji? Rozwiązane zadania i zapamiętany krok zostaną usunięte.'
    );
    if (!confirmed) return;
    restartLesson();
  }

  elements.themeToggle.addEventListener('click', toggleTheme);
  elements.topbarToggle.addEventListener('click', toggleTopbar);
  elements.outlineToggle.addEventListener('click', toggleOutline);
  elements.libraryButton.addEventListener('click', openLessonLibrary);
  elements.libraryClose.addEventListener('click', closeLessonLibrary);
  elements.librarySearch.addEventListener('input', renderLessonLibrary);
  elements.libraryRepository.addEventListener('change', async () => {
    state.repositoryId = elements.libraryRepository.value;
    state.libraryAssets = [];
    await openLessonLibrary();
  });
  elements.libraryDialog.addEventListener('click', (event) => {
    if (event.target === elements.libraryDialog) closeLessonLibrary();
  });
  window.addEventListener('popstate', loadLesson);
  window.addEventListener('focus', () => { void refreshExamProgress(true); });
  elements.retry.addEventListener('click', loadLesson);
  elements.previous.addEventListener('click', goPrevious);
  elements.next.addEventListener('click', goNext);
  elements.sequenceToggle.addEventListener('change', toggleSequentialLearning);
  elements.resetProgress.addEventListener('click', confirmResetProgress);
  elements.restart.addEventListener('click', restartLesson);
  document.addEventListener('chemdisk-mathjax-ready', () => typesetMath(elements.slideContent));
  document.addEventListener('keydown', (event) => {
    if (elements.navigation.hidden || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
    if (event.key === 'ArrowLeft') goPrevious();
    if (event.key === 'ArrowRight' && !elements.next.disabled) goNext();
  });

  initializePermissions();
  initializeTheme();
  loadUiPreferences();
  applyUiState();
  await loadLesson();
})();
