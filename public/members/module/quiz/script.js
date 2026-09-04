(async () => {
  'use strict';

  const auth = await window.ChemAuth.ready;
  if (!auth?.authenticated || !auth.session?.ok) return;
  const params = new URLSearchParams(location.search);
  const quizId = String(params.get('quiz') || '').trim().toLowerCase();
  const repositoryId = String(params.get('repo') || 'default').trim().toLowerCase() || 'default';
  const preview = params.get('preview') === '1';
  const progressApi = window.ChemProgress;
  const elements = {
    loading: document.getElementById('quiz-player-loading'),
    error: document.getElementById('quiz-player-error'),
    errorCopy: document.getElementById('quiz-player-error-copy'),
    player: document.getElementById('quiz-player'),
    title: document.getElementById('quiz-player-title'),
    description: document.getElementById('quiz-player-description'),
    cover: document.getElementById('quiz-player-cover'),
    questionCount: document.getElementById('quiz-player-question-count'),
    threshold: document.getElementById('quiz-player-threshold'),
    points: document.getElementById('quiz-player-points'),
    form: document.getElementById('quiz-player-form'),
    check: document.getElementById('quiz-player-check'),
    retry: document.getElementById('quiz-player-retry'),
    validation: document.getElementById('quiz-player-validation'),
    result: document.getElementById('quiz-player-result'),
    save: document.getElementById('quiz-player-save'),
    theme: document.getElementById('quiz-player-theme')
  };
  const state = {
    quiz: null, questions: [], materialId: '', attempts: 0, savedRecord: null,
    urls: new Set(), lockedAfterAttempt: false, imageObserver: null
  };

  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };

  function showError(message) {
    elements.loading.hidden = true;
    elements.player.hidden = true;
    elements.error.hidden = false;
    elements.errorCopy.textContent = message;
  }

  async function requestQuiz() {
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(quizId) || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(repositoryId)) {
      throw new Error('Nieprawidłowa referencja quizu.');
    }
    const token = await window.ChemAuth.getAccessToken();
    const url = new URL('/.netlify/functions/quiz', location.origin);
    url.searchParams.set('quiz', quizId);
    url.searchParams.set('repo', repositoryId);
    if (preview) url.searchParams.set('preview', '1');
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (payload.error === 'QUIZ_NOT_PUBLISHED') throw new Error('Quiz nie został jeszcze opublikowany.');
      if (payload.error === 'ADMIN_REQUIRED') throw new Error('Podgląd draftu jest dostępny tylko dla administratora.');
      throw new Error(payload.error || 'Nie udało się pobrać quizu.');
    }
    return payload.quiz;
  }

  async function beginProgress() {
    if (!progressApi || preview) return;
    await progressApi.load().catch(() => {});
    state.savedRecord = progressApi.record(state.materialId) || null;
    state.attempts = Number(state.savedRecord?.details?.attempts) || 0;
    try {
      const payload = await progressApi.update({
        materialId: state.materialId,
        materialType: 'quiz',
        action: 'quiz',
        opened: true,
        details: { started: true, completed: false, attempts: state.attempts }
      }, { immediate: true, throwOnError: true });
      state.savedRecord = payload?.record || state.savedRecord;
      state.attempts = Number(state.savedRecord?.details?.attempts) || state.attempts;
    } catch (error) {
      if (error?.code === 'SEQUENCE_LOCKED') {
        throw new Error('Ten quiz jest jeszcze zablokowany. Najpierw ukończ poprzedni krok organizatora.');
      }
      throw new Error('Nie udało się potwierdzić dostępu do quizu. Spróbuj ponownie.');
    }
  }

  function normalized(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl');
  }

  function shuffle(values) {
    const result = values.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  async function mediaBlob(reference) {
    const shared = reference.startsWith('assets/shared/');
    return window.ChemContentLibrary.readMediaBlob({
      scope: shared ? 'shared' : 'local',
      materialKind: shared ? '' : 'quiz',
      materialId: shared ? '' : quizId,
      reference,
      repositoryId
    });
  }

  async function loadImage(image, reference, priority = false) {
    try {
      const blob = await mediaBlob(reference);
      if (!image.isConnected) return;
      const url = URL.createObjectURL(blob);
      state.urls.add(url);
      image.loading = priority ? 'eager' : 'lazy';
      image.decoding = 'async';
      image.fetchPriority = priority ? 'high' : 'auto';
      image.src = url;
      image.hidden = false;
    } catch (_) {
      image.replaceWith(create('p', 'quiz-player-feedback is-wrong', 'Nie udało się wczytać obrazu.'));
    }
  }

  function renderQuestion(question, index) {
    const fieldset = create('fieldset', 'quiz-player-question');
    fieldset.dataset.questionId = question.questionId;
    const heading = create('div', 'quiz-player-question-heading');
    heading.append(create('span', '', `Pytanie ${index + 1}`), create('span', '', `${question.points} ${question.points === 1 ? 'pkt' : 'pkt'}`));
    const legend = create('legend', '', question.prompt);
    fieldset.append(heading, legend);
    if (question.image.ref) {
      const image = create('img');
      image.alt = question.image.alt || '';
      image.hidden = true;
      image.dataset.quizMediaRef = question.image.ref;
      fieldset.append(image);
    }
    if (question.type === 'text') {
      const input = create('input', 'quiz-player-text');
      input.type = 'text'; input.autocomplete = 'off'; input.placeholder = 'Wpisz odpowiedź'; input.dataset.answerText = '1';
      fieldset.append(input);
    } else {
      question.options.forEach((option) => {
        const label = create('label', 'quiz-player-option');
        const input = create('input');
        input.type = question.type === 'multiple' ? 'checkbox' : 'radio';
        input.name = `quiz-answer-${question.questionId}`;
        input.value = option.optionId;
        label.append(input, create('span', '', option.text));
        fieldset.append(label);
      });
    }
    const feedback = create('p', 'quiz-player-feedback');
    feedback.hidden = true;
    fieldset.append(feedback);
    return fieldset;
  }

  function queueQuestionImages() {
    state.imageObserver?.disconnect();
    state.imageObserver = null;
    const images = Array.from(elements.form.querySelectorAll('[data-quiz-media-ref]'));
    if (!images.length) return;
    if (typeof window.IntersectionObserver !== 'function') {
      images.forEach((image) => void loadImage(image, image.dataset.quizMediaRef));
      return;
    }
    state.imageObserver = new window.IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        state.imageObserver?.unobserve(entry.target);
        const image = entry.target.querySelector('[data-quiz-media-ref]');
        if (image) void loadImage(image, image.dataset.quizMediaRef);
      });
    }, { rootMargin: '400px 0px' });
    images.forEach((image) => {
      const target = image.closest('.quiz-player-question');
      if (target) state.imageObserver.observe(target);
      else void loadImage(image, image.dataset.quizMediaRef);
    });
  }

  function renderQuiz() {
    const quiz = state.quiz;
    elements.title.textContent = quiz.metadata.title;
    elements.description.textContent = quiz.metadata.description;
    elements.description.hidden = !quiz.metadata.description;
    document.title = `${quiz.metadata.title} — ChemDisk`;
    elements.questionCount.textContent = String(quiz.questions.length);
    elements.threshold.textContent = `${quiz.settings.passingScore}%`;
    elements.points.textContent = String(quiz.questions.reduce((sum, question) => sum + question.points, 0));
    if (quiz.metadata.cover.ref) void loadImage(elements.cover, quiz.metadata.cover.ref, true);
    state.questions = quiz.settings.shuffleQuestions ? shuffle(quiz.questions) : quiz.questions.slice();
    elements.form.replaceChildren(...state.questions.map(renderQuestion));
    queueQuestionImages();
  }

  function answerFor(question) {
    const fieldset = elements.form.querySelector(`[data-question-id="${question.questionId}"]`);
    if (!fieldset) return [];
    if (question.type === 'text') return fieldset.querySelector('[data-answer-text]')?.value || '';
    return Array.from(fieldset.querySelectorAll('input:checked')).map((input) => input.value);
  }

  function isAnswered(question, answer) {
    return question.type === 'text' ? Boolean(normalized(answer)) : Array.isArray(answer) && answer.length > 0;
  }

  function correct(question, answer) {
    if (question.type === 'text') {
      const candidate = normalized(answer);
      return Boolean(candidate) && question.acceptedAnswers.some((value) => normalized(value) === candidate);
    }
    const selected = new Set(Array.isArray(answer) ? answer : []);
    const expected = new Set(question.options.filter((option) => option.correct).map((option) => option.optionId));
    return selected.size === expected.size && [...selected].every((optionId) => expected.has(optionId));
  }

  function lockControls(locked) {
    elements.form.querySelectorAll('input').forEach((input) => { input.disabled = locked; });
    elements.check.disabled = locked;
  }

  async function saveResult(result) {
    if (!progressApi || preview) return;
    elements.save.textContent = 'Zapisywanie wyniku…';
    try {
      await progressApi.update({
        materialId: state.materialId,
        materialType: 'quiz',
        action: 'quiz',
        details: {
          started: true,
          completed: true,
          scorePercent: result.percent,
          passed: result.passed,
          attempts: state.attempts
        }
      }, { immediate: true, throwOnError: true });
      elements.save.textContent = 'Wynik zapisany';
    } catch (_) {
      elements.save.textContent = 'Nie udało się zapisać wyniku';
    }
  }

  function showResult(earned, maximum, percent, passed) {
    elements.result.className = `quiz-player-result${passed ? ' is-passed' : ''}`;
    elements.result.hidden = false;
    const score = create('strong', '', `${percent}%`);
    const copy = create('div');
    copy.append(
      create('h2', '', passed ? 'Quiz zaliczony' : 'Quiz ukończony'),
      create('p', '', `${earned}/${maximum} pkt. Próg zaliczenia wynosi ${state.quiz.settings.passingScore}%.`)
    );
    elements.result.replaceChildren(score, copy);
    elements.result.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }

  function showSavedResult(record) {
    const percent = Math.max(0, Math.min(100, Number(record?.details?.scorePercent) || 0));
    const passed = record?.details?.passed === true;
    elements.result.className = `quiz-player-result${passed ? ' is-passed' : ''}`;
    elements.result.hidden = false;
    const score = create('strong', '', `${Math.round(percent)}%`);
    const copy = create('div');
    copy.append(
      create('h2', '', passed ? 'Quiz został już zaliczony' : 'Quiz został już ukończony'),
      create('p', '', 'Autor wyłączył ponowne rozwiązywanie tego quizu. Wyświetlamy zapisany wynik.')
    );
    elements.result.replaceChildren(score, copy);
    elements.save.textContent = 'Wynik zapisany';
    elements.retry.hidden = true;
    state.lockedAfterAttempt = true;
    lockControls(true);
  }

  async function checkAnswers() {
    if (state.lockedAfterAttempt) return;
    const answers = Object.fromEntries(state.quiz.questions.map((question) => [question.questionId, answerFor(question)]));
    const unanswered = state.quiz.questions.filter((question) => question.required && !isAnswered(question, answers[question.questionId]));
    if (unanswered.length) {
      elements.validation.textContent = `Uzupełnij ${unanswered.length === 1 ? 'wymagane pytanie' : `${unanswered.length} wymagane pytania`}.`;
      elements.form.querySelector(`[data-question-id="${unanswered[0].questionId}"]`)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      return;
    }
    elements.validation.textContent = '';
    let earned = 0;
    const maximum = state.quiz.questions.reduce((sum, question) => sum + question.points, 0);
    state.quiz.questions.forEach((question) => {
      const ok = correct(question, answers[question.questionId]);
      if (ok) earned += question.points;
      const fieldset = elements.form.querySelector(`[data-question-id="${question.questionId}"]`);
      const feedback = fieldset?.querySelector('.quiz-player-feedback');
      fieldset?.classList.toggle('is-correct', ok);
      fieldset?.classList.toggle('is-wrong', !ok);
      if (feedback) {
        feedback.hidden = false;
        feedback.className = `quiz-player-feedback ${ok ? 'is-correct' : 'is-wrong'}`;
        feedback.textContent = `${ok ? 'Poprawnie' : 'Niepoprawnie'}${state.quiz.settings.showFeedback && question.explanation ? ` — ${question.explanation}` : ''}`;
      }
    });
    const percent = maximum ? Math.round((earned / maximum) * 100) : 0;
    const passed = percent >= state.quiz.settings.passingScore;
    state.attempts += 1;
    showResult(earned, maximum, percent, passed);
    state.lockedAfterAttempt = true;
    lockControls(true);
    elements.retry.hidden = !state.quiz.settings.allowRetry;
    await saveResult({ percent, passed });
  }

  function retry() {
    if (!state.quiz.settings.allowRetry) return;
    state.lockedAfterAttempt = false;
    elements.form.querySelectorAll('input').forEach((input) => {
      input.disabled = false;
      if (['checkbox', 'radio'].includes(input.type)) input.checked = false;
      else input.value = '';
    });
    elements.form.querySelectorAll('.quiz-player-question').forEach((question) => question.classList.remove('is-correct', 'is-wrong'));
    elements.form.querySelectorAll('.quiz-player-feedback').forEach((feedback) => { feedback.hidden = true; });
    elements.result.hidden = true;
    elements.retry.hidden = true;
    elements.check.disabled = false;
    elements.validation.textContent = '';
    window.scrollTo({ top: elements.form.offsetTop - 80, behavior: 'smooth' });
  }

  try {
    state.materialId = progressApi?.materialId('quiz', `${repositoryId}:${quizId}`, params.get('material') || '') || '';
    await beginProgress();
    state.quiz = await requestQuiz();
    renderQuiz();
    elements.loading.hidden = true;
    elements.player.hidden = false;
    if (!preview && !state.quiz.settings.allowRetry && state.savedRecord?.status === 'completed' && state.attempts > 0) {
      showSavedResult(state.savedRecord);
    }
  } catch (error) {
    showError(error.message);
    return;
  }

  elements.check.addEventListener('click', () => void checkAnswers());
  elements.retry.addEventListener('click', retry);
  elements.form.addEventListener('submit', (event) => event.preventDefault());
  elements.theme.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('chem.theme', next); } catch (_) {}
  });
  window.addEventListener('pagehide', () => {
    state.imageObserver?.disconnect();
    state.urls.forEach((url) => URL.revokeObjectURL(url));
  });
})();
