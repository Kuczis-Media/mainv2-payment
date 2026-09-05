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
    urls: new Set(), lockedAfterAttempt: false, imageObserver: null, latestAttempt: null
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
    return payload;
  }

  async function submitForServerGrading(answers) {
    const token = await window.ChemAuth.getAccessToken();
    const response = await fetch('/.netlify/functions/quiz', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'submit', repositoryId, quizId, answers,
        materialId: state.materialId, preview
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const messages = {
        QUIZ_ANSWERS_REQUIRED: 'Uzupełnij wymagane pytania.',
        ATTEMPT_LIMIT_REACHED: 'Ten quiz został już wysłany i nie pozwala na kolejną próbę.',
        AI_DISABLED_FOR_USER: 'Ocena AI jest wyłączona dla tego konta.'
      };
      throw new Error(messages[payload.error] || 'Nie udało się ocenić pytań otwartych. Spróbuj ponownie.');
    }
    return payload;
  }

  async function requestStoredResult(attemptId) {
    const token = await window.ChemAuth.getAccessToken();
    const url = new URL('/.netlify/functions/quiz', location.origin);
    url.searchParams.set('action', 'result');
    url.searchParams.set('repo', repositoryId);
    url.searchParams.set('quiz', quizId);
    url.searchParams.set('attemptId', attemptId);
    const response = await fetch(url, {
      credentials: 'same-origin', cache: 'no-store',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Nie udało się pobrać ocenionego wyniku.');
    return payload.result;
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
    const pointLabel = question.type === 'open' && question.gradingMode === 'ungraded'
      ? 'bez punktów' : `${question.points} pkt`;
    heading.append(create('span', '', `Pytanie ${index + 1}`), create('span', '', pointLabel));
    const legend = create('legend', '', question.prompt);
    fieldset.append(heading, legend);
    if (question.image.ref) {
      const image = create('img');
      image.alt = question.image.alt || '';
      image.hidden = true;
      image.dataset.quizMediaRef = question.image.ref;
      fieldset.append(image);
    }
    if (question.type === 'open') {
      const input = create(question.multiline === false ? 'input' : 'textarea', 'quiz-player-text quiz-player-open-answer');
      if (question.multiline !== false) input.rows = 7;
      input.maxLength = 8000; input.autocomplete = 'off';
      input.placeholder = 'Wpisz własną odpowiedź…'; input.dataset.answerText = '1';
      fieldset.append(input);
    } else if (question.type === 'text') {
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
    elements.points.textContent = String(quiz.questions.reduce((sum, question) => (
      sum + (question.type === 'open' && question.gradingMode === 'ungraded' ? 0 : question.points)
    ), 0));
    if (quiz.metadata.cover.ref) void loadImage(elements.cover, quiz.metadata.cover.ref, true);
    state.questions = quiz.settings.shuffleQuestions ? shuffle(quiz.questions) : quiz.questions.slice();
    elements.form.replaceChildren(...state.questions.map(renderQuestion));
    elements.check.textContent = checkButtonLabel();
    queueQuestionImages();
  }

  function checkButtonLabel() {
    return state.quiz?.questions?.some((question) => question.type === 'open' && question.gradingMode === 'ai' && question.points > 0)
      ? 'Sprawdź odpowiedzi za pomocą AI'
      : 'Sprawdź odpowiedzi';
  }

  function answerFor(question) {
    const fieldset = elements.form.querySelector(`[data-question-id="${question.questionId}"]`);
    if (!fieldset) return [];
    if (['text', 'open'].includes(question.type)) return fieldset.querySelector('[data-answer-text]')?.value || '';
    return Array.from(fieldset.querySelectorAll('input:checked')).map((input) => input.value);
  }

  function isAnswered(question, answer) {
    return ['text', 'open'].includes(question.type) ? Boolean(normalized(answer)) : Array.isArray(answer) && answer.length > 0;
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
    elements.form.querySelectorAll('input, textarea').forEach((input) => { input.disabled = locked; });
    elements.check.disabled = locked;
  }

  async function saveResult(result, alreadySaved = false) {
    if (!progressApi || preview) return;
    if (alreadySaved) {
      elements.save.textContent = 'Wynik zapisany';
      return;
    }
    elements.save.textContent = 'Zapisywanie wyniku…';
    try {
      await progressApi.update({
        materialId: state.materialId,
        materialType: 'quiz',
        action: 'quiz',
        details: {
          started: true,
          completed: true,
          scorePercent: result.percent ?? null,
          passed: result.passed ?? null,
          attempts: state.attempts,
          gradingStatus: result.gradingStatus,
          ...(result.attemptId ? { attemptId: result.attemptId } : {})
        }
      }, { immediate: true, throwOnError: true });
      elements.save.textContent = 'Wynik zapisany';
    } catch (_) {
      elements.save.textContent = 'Nie udało się zapisać wyniku';
    }
  }

  function showResult(result) {
    const { earned, maximum, percent, passed } = result;
    const pending = result.gradingStatus === 'pending_review';
    const unscored = result.gradingStatus === 'not_scored';
    const aiDeferred = pending && Number(result.aiDeferredCount) > 0;
    elements.result.className = `quiz-player-result${passed ? ' is-passed' : ''}${pending || unscored ? ' is-pending' : ''}`;
    elements.result.hidden = false;
    const score = create('strong', '', pending ? '…' : unscored ? '—' : `${percent}%`);
    const copy = create('div');
    copy.append(
      create('h2', '', pending ? 'Quiz czeka na ocenę' : unscored ? 'Odpowiedzi zapisane' : passed ? 'Quiz zaliczony' : 'Quiz ukończony'),
      create('p', '', unscored
        ? 'Ten quiz nie ma punktowanych pytań, dlatego nie wyznacza wyniku ani statusu zaliczenia.'
        : pending
        ? aiDeferred
          ? `AI nie mogło teraz ocenić ${result.aiDeferredCount === 1 ? 'jednej odpowiedzi' : `${result.aiDeferredCount} odpowiedzi`}. Wszystko zostało zapisane — autor może przyznać punkty ręcznie. Później kliknij „Odśwież wynik”.`
          : `Sprawdzający musi ocenić ${result.pendingQuestionCount || 1} ${result.pendingQuestionCount === 1 ? 'pytanie otwarte' : 'pytań otwartych'}. Po sprawdzeniu kliknij „Odśwież wynik”.`
        : `${earned}/${maximum} pkt. Próg zaliczenia wynosi ${state.quiz.settings.passingScore}%.`)
    );
    if (pending && result.attemptId) {
      const refresh = create('button', 'quiz-player-button is-secondary', 'Odśwież wynik');
      refresh.type = 'button';
      refresh.addEventListener('click', async () => {
        refresh.disabled = true;
        refresh.textContent = 'Odświeżanie…';
        try {
          const updated = await requestStoredResult(result.attemptId);
          updated.attemptId = result.attemptId;
          renderQuestionResults(updated);
          showResult(updated);
          elements.save.textContent = updated.gradingStatus === 'pending_review'
            ? 'Odpowiedzi zapisane — oczekują na ocenę' : 'Wynik zapisany';
        } catch (error) {
          elements.validation.textContent = error.message;
          refresh.disabled = false;
          refresh.textContent = 'Odśwież wynik';
        }
      });
      copy.append(refresh);
    }
    elements.result.replaceChildren(score, copy);
    elements.result.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }

  function showSavedResult(record) {
    if (record?.details?.gradingStatus === 'pending_review') {
      showResult({
        earned: 0,
        maximum: 0,
        percent: null,
        passed: null,
        gradingStatus: 'pending_review',
        pendingQuestionCount: 1
      });
      elements.save.textContent = 'Odpowiedzi zapisane — oczekują na ocenę';
      elements.retry.hidden = true;
      state.lockedAfterAttempt = true;
      lockControls(true);
      return;
    }
    if (record?.details?.gradingStatus === 'not_scored') {
      showResult({ earned: 0, maximum: 0, percent: null, passed: null, gradingStatus: 'not_scored', pendingQuestionCount: 0 });
      elements.save.textContent = 'Odpowiedzi zapisane';
      elements.retry.hidden = true;
      state.lockedAfterAttempt = true;
      lockControls(true);
      return;
    }
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

  function renderQuestionResults(result) {
    (result.results || []).forEach((entry) => {
      const fieldset = elements.form.querySelector(`[data-question-id="${entry.questionId}"]`);
      const feedback = fieldset?.querySelector('.quiz-player-feedback');
      const pending = entry.reviewStatus === 'pending';
      const ungraded = entry.reviewStatus === 'not_scored';
      if (!pending && !ungraded) {
        fieldset?.classList.toggle('is-correct', entry.correct === true);
        fieldset?.classList.toggle('is-wrong', entry.correct === false);
      }
      if (feedback) {
        feedback.hidden = false;
        feedback.className = `quiz-player-feedback ${pending || ungraded ? '' : entry.correct ? 'is-correct' : 'is-wrong'}`;
        feedback.textContent = pending
          ? 'Odpowiedź zapisana — oczekuje na ocenę.'
          : ungraded
            ? 'Odpowiedź zapisana — to pytanie nie wpływa na wynik.'
            : `${entry.correct ? 'Poprawnie' : 'Ocena częściowa lub niepoprawna'} · ${entry.points}/${entry.maximum} pkt${entry.feedback ? ` — ${entry.feedback}` : entry.explanation ? ` — ${entry.explanation}` : ''}`;
      }
    });
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
    if (state.quiz.questions.some((question) => question.type === 'open')) {
      elements.check.disabled = true;
      elements.check.textContent = 'Ocenianie odpowiedzi…';
      try {
        const payload = await submitForServerGrading(answers);
        const result = payload.result;
        result.attemptId = payload.attemptId || '';
        renderQuestionResults(result);
        state.attempts = Number(payload.attemptNumber) || state.attempts + 1;
        showResult(result);
        state.lockedAfterAttempt = true;
        lockControls(true);
        elements.retry.hidden = !state.quiz.settings.allowRetry;
        await saveResult(result, payload.progressSaved === true);
      } catch (error) {
        elements.validation.textContent = error.message;
        elements.check.disabled = false;
      } finally {
        elements.check.textContent = checkButtonLabel();
      }
      return;
    }
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
    const percent = maximum ? Math.round((earned / maximum) * 100) : null;
    const passed = percent == null ? null : percent >= state.quiz.settings.passingScore;
    const gradingStatus = maximum > 0 ? 'graded' : 'not_scored';
    state.attempts += 1;
    showResult({ earned, maximum, percent, passed, gradingStatus, pendingQuestionCount: 0 });
    state.lockedAfterAttempt = true;
    lockControls(true);
    elements.retry.hidden = !state.quiz.settings.allowRetry;
    await saveResult({ percent, passed, gradingStatus });
  }

  function retry() {
    if (!state.quiz.settings.allowRetry) return;
    state.lockedAfterAttempt = false;
    elements.form.querySelectorAll('input, textarea').forEach((input) => {
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
    const quizPayload = await requestQuiz();
    state.quiz = quizPayload.quiz;
    state.latestAttempt = quizPayload.latestAttempt || null;
    state.attempts = Math.max(state.attempts, Number(state.latestAttempt?.number) || 0);
    renderQuiz();
    elements.loading.hidden = true;
    elements.player.hidden = false;
    if (!preview && state.attempts > 0) {
      const attemptId = state.latestAttempt?.status === 'submitted'
        ? state.latestAttempt.attemptId : state.savedRecord?.status === 'completed' ? state.savedRecord?.details?.attemptId : '';
      if (attemptId && state.quiz.questions.some((question) => question.type === 'open')) {
        try {
          const result = await requestStoredResult(attemptId);
          result.attemptId = attemptId;
          renderQuestionResults(result);
          showResult(result);
          elements.save.textContent = result.gradingStatus === 'pending_review'
            ? 'Odpowiedzi zapisane — oczekują na ocenę'
            : 'Wynik zapisany';
          state.lockedAfterAttempt = true;
          lockControls(true);
          elements.retry.hidden = !state.quiz.settings.allowRetry;
        } catch (_) {
          if (!state.quiz.settings.allowRetry && state.latestAttempt?.status !== 'active') showSavedResult(state.savedRecord);
        }
      } else if (!state.quiz.settings.allowRetry && state.latestAttempt?.status !== 'active') showSavedResult(state.savedRecord);
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
