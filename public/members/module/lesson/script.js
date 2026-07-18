(async () => {
  'use strict';

  const authState = await window.ChemAuth.ready;
  if (!authState?.authenticated || !authState.session?.ok) return;

  const parser = window.ChemLesson;
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
    themeToggle: document.getElementById('theme-toggle')
  };

  const state = {
    filename: '',
    lesson: null,
    index: 0,
    maxReached: 0,
    solved: new Set(),
    completed: false,
    attempts: new Map()
  };

  function readFilename() {
    const params = new URLSearchParams(window.location.search);
    const files = params.getAll('file');
    if (files.length !== 1) return '';
    return parser.validateFilename(files[0]);
  }

  function progressKey() {
    return `chemdisk.lesson.v1:${state.filename}`;
  }

  function loadProgress() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(progressKey()) || 'null');
      if (!saved || !state.lesson || saved.signature !== state.lesson.signature) return;
      const lastIndex = state.lesson.slides.length - 1;
      state.index = Math.min(lastIndex, Math.max(0, Number(saved.index) || 0));
      state.maxReached = Math.min(lastIndex, Math.max(state.index, Number(saved.maxReached) || 0));
      state.solved = new Set(
        Array.isArray(saved.solved)
          ? saved.solved.filter((index) => Number.isSafeInteger(index) && index >= 0 && index <= lastIndex)
          : []
      );
      state.completed = Boolean(saved.completed);
    } catch {}
  }

  function saveProgress() {
    if (!state.lesson) return;
    try {
      sessionStorage.setItem(progressKey(), JSON.stringify({
        index: state.index,
        maxReached: state.maxReached,
        solved: [...state.solved],
        completed: state.completed,
        signature: state.lesson.signature
      }));
    } catch {}
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
    elements.lessonPosition.textContent = 'Błąd wczytywania';
    elements.app.removeAttribute('aria-busy');
  }

  function friendlyLoadError(error) {
    if (error?.code || error?.name === 'LessonFormatError') return error.message;
    if (error?.message === 'NOT_FOUND') return `Nie znaleziono pliku „${state.filename}” w folderze modułu lesson.`;
    if (error?.message === 'TOO_LARGE') return 'Plik lekcji jest zbyt duży.';
    return 'Sprawdź połączenie, nazwę pliku i spróbuj ponownie.';
  }

  async function loadLesson() {
    elements.app.setAttribute('aria-busy', 'true');
    elements.loading.hidden = false;
    elements.error.hidden = true;
    elements.slideCard.hidden = true;
    elements.completion.hidden = true;
    elements.navigation.hidden = true;

    state.filename = readFilename();
    if (!state.filename) {
      showError(
        'Brakuje poprawnej nazwy pliku',
        'Otwórz moduł przez link w formacie /members/module/lesson/?file=izotopy-wegla.md. Nazwa może zawierać litery, cyfry, kropki, myślniki i podkreślenia.',
        false
      );
      return;
    }

    try {
      const response = await fetch(`./${encodeURIComponent(state.filename)}`, {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'text/markdown,text/plain;q=0.9' }
      });
      if (response.status === 404) throw new Error('NOT_FOUND');
      if (!response.ok) throw new Error('FETCH_FAILED');
      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength > 512 * 1024) throw new Error('TOO_LARGE');
      const markdown = await response.text();
      state.lesson = parser.parseLesson(markdown, state.filename);
      state.index = 0;
      state.maxReached = 0;
      state.solved = new Set();
      state.completed = false;
      state.attempts = new Map();
      loadProgress();

      document.title = `${state.lesson.title} — ChemDisk`;
      elements.lessonTitle.textContent = state.lesson.title;
      buildOutline();
      elements.loading.hidden = true;
      elements.app.removeAttribute('aria-busy');
      if (state.completed) showCompletion();
      else renderSlide();
    } catch (error) {
      console.error('Nie udało się wczytać lekcji', error);
      showError('Nie udało się wczytać lekcji', friendlyLoadError(error));
    }
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
        if (index > state.maxReached || state.completed) return;
        state.index = index;
        saveProgress();
        renderSlide();
      });
      item.appendChild(button);
      elements.outlineList.appendChild(item);
    });
  }

  function updateOutline() {
    elements.outlineList.querySelectorAll('button').forEach((button, index) => {
      const accessible = index <= state.maxReached && !state.completed;
      const current = index === state.index && !state.completed;
      const complete = state.completed || index < state.maxReached || state.solved.has(index);
      button.disabled = !accessible;
      button.classList.toggle('is-current', current);
      button.classList.toggle('is-complete', complete);
      if (current) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
      const marker = button.querySelector('.outline-marker');
      if (marker) marker.textContent = complete ? '✓' : String(index + 1);
    });
  }

  function renderSlide() {
    const slide = state.lesson.slides[state.index];
    const isSolved = state.solved.has(state.index);
    const progress = ((state.index + 1) / state.lesson.slides.length) * 100;

    elements.error.hidden = true;
    elements.completion.hidden = true;
    elements.slideCard.hidden = false;
    elements.navigation.hidden = false;
    elements.slideNumber.textContent = `Krok ${state.index + 1} z ${state.lesson.slides.length}`;
    elements.lessonPosition.textContent = `Krok ${state.index + 1} z ${state.lesson.slides.length}`;
    elements.progressBar.style.width = `${progress}%`;
    elements.slideContent.innerHTML = slide.html;
    elements.slideStatus.textContent = slide.task
      ? (isSolved ? 'Zadanie rozwiązane' : 'Zadanie do wykonania')
      : 'Materiał';
    elements.slideStatus.dataset.state = isSolved ? 'complete' : (slide.task ? 'task' : 'content');

    renderTask(slide.task, isSolved);
    elements.previous.disabled = state.index === 0;
    elements.next.disabled = Boolean(slide.task && !isSolved);
    elements.next.querySelector('span').textContent =
      state.index === state.lesson.slides.length - 1 ? 'Zakończ lekcję' : 'Dalej';
    elements.navigationHint.textContent =
      slide.task && !isSolved ? 'Najpierw podaj poprawną odpowiedź.' : '';
    updateOutline();
    saveProgress();
    elements.slideCard.focus?.({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    if (task.type === 'choice') {
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
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (state.solved.has(state.index)) return;
      const answer = readValue();
      const attempts = (state.attempts.get(state.index) || 0) + 1;
      state.attempts.set(state.index, attempts);

      if (parser.checkAnswer(task, answer)) {
        state.solved.add(state.index);
        feedback.dataset.state = 'success';
        feedback.textContent = task.success;
        submit.disabled = true;
        submit.textContent = 'Odpowiedź zaliczona';
        form.querySelectorAll('input, fieldset').forEach((field) => { field.disabled = true; });
        elements.next.disabled = false;
        elements.navigationHint.textContent = '';
        elements.slideStatus.textContent = 'Zadanie rozwiązane';
        elements.slideStatus.dataset.state = 'complete';
        updateOutline();
        saveProgress();
        elements.next.focus();
      } else {
        feedback.dataset.state = 'error';
        feedback.textContent = task.hint
          ? `Jeszcze nie. Podpowiedź: ${task.hint}`
          : 'Jeszcze nie — sprawdź obliczenia i spróbuj ponownie.';
        const firstInput = form.querySelector('input:not([type="radio"]), input[type="radio"]:checked, input[type="radio"]');
        firstInput?.setAttribute('aria-invalid', 'true');
        firstInput?.focus();
      }
    });
    elements.taskHost.appendChild(form);
  }

  function goNext() {
    const slide = state.lesson.slides[state.index];
    if (slide.task && !state.solved.has(state.index)) return;
    if (state.index === state.lesson.slides.length - 1) {
      state.completed = true;
      saveProgress();
      showCompletion();
      return;
    }
    state.index += 1;
    state.maxReached = Math.max(state.maxReached, state.index);
    renderSlide();
  }

  function goPrevious() {
    if (state.index === 0) return;
    state.index -= 1;
    renderSlide();
  }

  function showCompletion() {
    state.completed = true;
    elements.slideCard.hidden = true;
    elements.navigation.hidden = true;
    elements.error.hidden = true;
    elements.completion.hidden = false;
    elements.progressBar.style.width = '100%';
    elements.lessonPosition.textContent = 'Lekcja ukończona';
    updateOutline();
    saveProgress();
    elements.restart.focus();
  }

  function restartLesson() {
    try { sessionStorage.removeItem(progressKey()); } catch {}
    state.index = 0;
    state.maxReached = 0;
    state.solved = new Set();
    state.completed = false;
    state.attempts = new Map();
    renderSlide();
  }

  elements.themeToggle.addEventListener('click', toggleTheme);
  elements.retry.addEventListener('click', loadLesson);
  elements.previous.addEventListener('click', goPrevious);
  elements.next.addEventListener('click', goNext);
  elements.restart.addEventListener('click', restartLesson);
  document.addEventListener('keydown', (event) => {
    if (elements.navigation.hidden || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
    if (event.key === 'ArrowLeft') goPrevious();
    if (event.key === 'ArrowRight' && !elements.next.disabled) goNext();
  });

  initializeTheme();
  await loadLesson();
})();
