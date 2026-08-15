(function initializeExamPlayer() {
  'use strict';

  const client = window.ChemExamClient;
  const byId = (id) => document.getElementById(id);
  const elements = {
    loading: byId('exam-loading'), start: byId('exam-start'), attempt: byId('exam-attempt'), result: byId('exam-result'),
    title: byId('exam-title'), description: byId('exam-description'), instruction: byId('exam-instruction'), facts: byId('exam-facts'),
    before: byId('exam-before-message'), cover: byId('exam-cover'), history: byId('exam-attempt-history'), startButton: byId('exam-start-button'),
    startMessage: byId('exam-start-message'), saveState: byId('exam-save-state'), timer: byId('exam-timer'), theme: byId('exam-theme'),
    navigator: byId('exam-navigator'), navigatorGrid: byId('exam-navigator-grid'), progressCopy: byId('exam-progress-copy'), progressBar: byId('exam-progress-bar'),
    questionPosition: byId('exam-question-position'), attemptTitle: byId('exam-attempt-title'), flag: byId('exam-flag-button'),
    questionList: byId('exam-question-list'), attemptMessage: byId('exam-attempt-message'), previous: byId('exam-previous-button'),
    save: byId('exam-save-button'), next: byId('exam-next-button'), submit: byId('exam-submit-button'),
    resultIcon: byId('exam-result-icon'), resultTitle: byId('exam-result-title'), resultMessage: byId('exam-result-message'),
    resultMetrics: byId('exam-result-metrics'), resultQuestions: byId('exam-result-questions'), another: byId('exam-another-attempt')
  };
  const state = {
    reference: null,
    definition: null,
    attempts: [],
    attempt: null,
    preview: false,
    materialId: '',
    serverOffset: 0,
    timerId: 0,
    dirtyQuestions: new Set(),
    saveTimer: 0,
    mutationQueue: Promise.resolve(),
    objectUrls: []
  };

  const ERROR_MESSAGES = {
    AUTH_REQUIRED: 'Sesja wygasła. Zaloguj się ponownie.',
    EXAM_NOT_PUBLISHED: 'Ten egzamin nie jest jeszcze opublikowany.',
    EXAM_NOT_OPEN_YET: 'Egzamin nie jest jeszcze dostępny.',
    EXAM_CLOSED: 'Okno dostępności egzaminu zostało zamknięte.',
    USER_NOT_ALLOWED: 'Ten egzamin nie jest przypisany do Twojego konta.',
    ATTEMPT_LIMIT_REACHED: 'Wykorzystano wszystkie dozwolone próby.',
    ATTEMPT_COOLDOWN: 'Następna próba będzie dostępna po zakończeniu cooldownu.',
    ANSWER_REQUIRED: 'Najpierw zapisz odpowiedź na bieżące pytanie.',
    ANSWER_ALREADY_CONFIRMED: 'Ta odpowiedź została już zatwierdzona i nie można jej zmienić.',
    IMMEDIATE_FEEDBACK_DISABLED: 'Natychmiastowe sprawdzanie nie jest włączone dla tego egzaminu.',
    SKIPPING_DISABLED: 'Konfiguracja egzaminu nie pozwala pominąć pytania.',
    BACK_NAVIGATION_DISABLED: 'Cofanie zostało wyłączone dla tego egzaminu.',
    QUESTION_TIME_EXPIRED: 'Czas na to pytanie minął.',
    UNANSWERED_QUESTIONS: 'Odpowiedz na wszystkie wymagane pytania przed zakończeniem.',
    EXAM_UNAVAILABLE: 'Egzamin jest chwilowo niedostępny.'
  };

  function parseReference() {
    const params = new URLSearchParams(window.location.search);
    const examId = params.get('exam') || '';
    const repositoryId = (params.get('repo') || 'default').toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(examId) || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(repositoryId)) return null;
    state.preview = params.get('preview') === '1';
    state.materialId = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(params.get('material') || '') ? params.get('material') : '';
    return { examId, repositoryId };
  }

  function setView(view) {
    elements.loading.hidden = view !== 'loading';
    elements.start.hidden = view !== 'start';
    elements.attempt.hidden = view !== 'attempt';
    elements.result.hidden = view !== 'result';
  }

  function setMessage(target, message, error = true) {
    target.textContent = message || '';
    target.dataset.state = error ? 'error' : 'success';
  }

  function errorMessage(error) {
    return ERROR_MESSAGES[error?.code || error?.message] || error?.message || ERROR_MESSAGES.EXAM_UNAVAILABLE;
  }

  async function start() {
    state.reference = parseReference();
    if (!state.reference || !client) return fatal('Nieprawidłowe odwołanie do egzaminu.');
    initializeTheme();
    bind();
    let auth;
    try { auth = await window.ChemAuth.ready; } catch (_) { auth = null; }
    if (!auth?.authenticated || !auth.session?.ok) return fatal('Sesja nie jest aktywna. Zaloguj się ponownie.');
    try {
      const payload = await client.definition({ ...state.reference, preview: state.preview });
      state.definition = payload.exam;
      state.attempts = payload.attempts || [];
      syncServerTime(payload.serverNow);
      await client.mutate('open', { ...state.reference, preview: state.preview, body: { materialId: state.materialId } });
      renderStart();
    } catch (error) { fatal(errorMessage(error)); }
  }

  function bind() {
    elements.startButton.addEventListener('click', beginAttempt);
    elements.another.addEventListener('click', async () => {
      elements.another.disabled = true;
      await reloadAttemptHistory();
      elements.another.disabled = false;
      setView('start');
      renderStart();
    });
    elements.previous.addEventListener('click', () => navigatePage(-1));
    elements.next.addEventListener('click', () => navigatePage(1));
    elements.save.addEventListener('click', () => saveVisible(true));
    elements.submit.addEventListener('click', submitAttempt);
    elements.flag.addEventListener('click', toggleFlag);
    elements.navigatorGrid.addEventListener('click', (event) => {
      const button = event.target.closest('[data-question-index]');
      if (button && !button.disabled) void navigateTo(Number(button.dataset.questionIndex));
    });
    elements.questionList.addEventListener('input', answerChanged);
    elements.questionList.addEventListener('change', answerChanged);
    elements.questionList.addEventListener('click', questionAction);
    elements.theme.addEventListener('click', toggleTheme);
    window.addEventListener('pagehide', () => logLifecycle('leave', true));
    document.addEventListener('visibilitychange', () => {
      if (state.attempt?.status === 'active') void logLifecycle(document.hidden ? 'visibility_hidden' : 'visibility_visible');
    });
    window.addEventListener('beforeunload', (event) => {
      if (state.attempt?.status !== 'active') return;
      const policy = state.attempt.exam.security.leavePolicy;
      if (policy === 'warn' || policy === 'end_attempt') {
        event.preventDefault();
        event.returnValue = '';
      }
    });
  }

  function renderStart() {
    clearTimer();
    setView('start');
    const metadata = state.definition.metadata;
    document.title = `${metadata.name} — ChemDisk`;
    elements.title.textContent = metadata.name;
    elements.description.textContent = metadata.description;
    elements.description.hidden = !metadata.description;
    elements.instruction.textContent = metadata.instruction;
    elements.instruction.hidden = !metadata.instruction;
    elements.before.textContent = metadata.beforeStartMessage;
    elements.before.hidden = !metadata.beforeStartMessage;
    elements.facts.replaceChildren();
    const timing = state.definition.timing.mode === 'none'
      ? 'Bez limitu czasu'
      : state.definition.timing.mode === 'exam'
        ? `${Math.round(state.definition.timing.limitSeconds / 60)} min na egzamin`
        : `${state.definition.timing.questionLimitSeconds} s na pytanie`;
    [timing, `Próg ${metadata.passThreshold}%`, attemptLimitLabel()].forEach((label) => elements.facts.append(tag(label)));
    elements.cover.hidden = true;
    if (metadata.cover?.ref) void setBackgroundImage(elements.cover, metadata.cover.ref);
    elements.history.replaceChildren();
    state.attempts.slice().reverse().forEach((attempt) => {
      const button = document.createElement('button');
      button.type = 'button';
      const active = attempt.status === 'active';
      button.append(
        Object.assign(document.createElement('strong'), { textContent: `Próba ${attempt.number}` }),
        Object.assign(document.createElement('span'), {
          textContent: active ? 'Wznów'
            : attempt.scorePercent == null ? 'Wynik ukryty'
              : `${attempt.scorePercent}%${attempt.passed == null ? '' : attempt.passed ? ' · zaliczona' : ' · niezaliczona'}`
        })
      );
      button.addEventListener('click', () => active ? resumeAttempt(attempt.attemptId) : showStoredResult(attempt.attemptId));
      elements.history.append(button);
    });
    const active = state.attempts.find((attempt) => attempt.status === 'active');
    elements.startButton.textContent = active ? 'Wznów aktywną próbę' : 'Rozpocznij egzamin';
    elements.startButton.dataset.attemptId = active?.attemptId || '';
    setMessage(elements.startMessage, '', false);
  }

  async function beginAttempt() {
    const activeId = elements.startButton.dataset.attemptId;
    if (activeId) return resumeAttempt(activeId);
    elements.startButton.disabled = true;
    setMessage(elements.startMessage, 'Tworzę bezpieczną próbę…', false);
    try {
      const payload = await client.mutate('start', {
        ...state.reference,
        preview: state.preview,
        body: { materialId: state.materialId }
      });
      state.attempt = payload.attempt;
      renderAttempt();
    } catch (error) { setMessage(elements.startMessage, errorMessage(error)); }
    finally { elements.startButton.disabled = false; }
  }

  async function resumeAttempt(attemptId) {
    try {
      const payload = await client.attempt({ ...state.reference, attemptId, preview: state.preview });
      syncServerTime(payload.serverNow);
      state.attempt = payload.attempt;
      if (state.attempt.status === 'active') {
        renderAttempt();
        const navigation = performance.getEntriesByType?.('navigation')?.[0];
        await logLifecycle(navigation?.type === 'reload' ? 'refresh' : 'resume');
      }
      else renderResult(state.attempt.result);
    } catch (error) { setMessage(elements.startMessage, errorMessage(error)); }
  }

  async function showStoredResult(attemptId) {
    try {
      const payload = await client.result({ ...state.reference, attemptId, preview: state.preview });
      renderResult(payload.result);
    } catch (error) { setMessage(elements.startMessage, errorMessage(error)); }
  }

  function renderAttempt() {
    setView('attempt');
    elements.attemptTitle.textContent = state.attempt.exam.metadata.name;
    renderQuestions();
    renderNavigator();
    updateControls();
    startTimer();
    setMessage(elements.attemptMessage, '', false);
  }

  function visibleIndices() {
    const display = state.attempt.exam.display;
    if (display.mode === 'all') return state.attempt.questions.map((_, index) => index);
    if (display.mode === 'page') {
      const size = display.questionsPerPage;
      const first = Math.floor(state.attempt.currentIndex / size) * size;
      return state.attempt.questions.map((_, index) => index).slice(first, first + size);
    }
    return [state.attempt.currentIndex];
  }

  function renderQuestions() {
    revokeObjectUrls();
    const indices = visibleIndices();
    elements.questionList.replaceChildren(...indices.map((index) => questionView(state.attempt.questions[index], index)));
    const first = indices[0] + 1;
    const last = indices.at(-1) + 1;
    elements.questionPosition.textContent = first === last ? `Pytanie ${first} z ${state.attempt.totalQuestions}` : `Pytania ${first}–${last} z ${state.attempt.totalQuestions}`;
    elements.flag.hidden = state.attempt.exam.display.mode !== 'one' || !state.attempt.exam.navigation.allowFlagging;
    const currentQuestion = state.attempt.questions[state.attempt.currentIndex];
    const flagged = state.attempt.flags.includes(currentQuestion.questionId);
    elements.flag.textContent = flagged ? '★ Oznaczone' : '☆ Oznacz';
    elements.flag.setAttribute('aria-pressed', String(flagged));
  }

  function questionView(question, index) {
    const article = document.createElement('article');
    article.className = 'exam-question';
    article.dataset.questionId = question.questionId;
    article.dataset.questionIndex = String(index);
    article.append(tag(`${index + 1}. ${typeLabel(question.type)}`, 'small'));
    const heading = document.createElement('h2'); heading.textContent = question.prompt || question.template; article.append(heading);
    if (question.images?.length) article.append(imageGrid(question.images));
    article.append(answerControl(question, state.attempt.answers[question.questionId]));
    const immediate = state.attempt.exam.resultVisibility?.feedbackMode === 'immediate';
    const confirmed = state.attempt.confirmedQuestionIds?.includes(question.questionId);
    if (immediate) {
      const actions = document.createElement('div'); actions.className = 'exam-question-check';
      const confirm = document.createElement('button'); confirm.type = 'button'; confirm.className = 'exam-button is-primary';
      confirm.dataset.confirmQuestion = question.questionId;
      confirm.textContent = confirmed ? 'Odpowiedź zatwierdzona' : 'Zatwierdź i sprawdź odpowiedź';
      confirm.disabled = confirmed; actions.append(confirm); article.append(actions);
      const feedback = state.attempt.immediateFeedback?.[question.questionId];
      if (confirmed && feedback) article.append(immediateFeedbackView(feedback));
      if (confirmed) article.querySelectorAll('[data-answer-input], [data-order-action]').forEach((control) => { control.disabled = true; });
    }
    if (state.attempt.timedOutQuestionIds.includes(question.questionId)) {
      const warning = tag('Czas na to pytanie minął. Odpowiedź jest zablokowana.', 'p'); warning.className = 'exam-message'; article.append(warning);
      article.querySelectorAll('input,select,button').forEach((control) => { control.disabled = true; });
    }
    return article;
  }

  function immediateFeedbackView(feedback) {
    const card = document.createElement('div');
    card.className = `exam-immediate-feedback ${feedback.correct ? 'is-correct' : 'is-incorrect'}`;
    card.append(tag(feedback.correct ? 'Odpowiedź poprawna' : 'Odpowiedź niepoprawna', 'strong'));
    appendResultAnswer(card, 'Prawidłowa odpowiedź', feedback.correctAnswerDisplay);
    if (feedback.explanation) card.append(tag(feedback.explanation, 'p'));
    return card;
  }

  function answerControl(question, value) {
    if (question.options) {
      const fieldset = document.createElement('fieldset'); fieldset.className = 'exam-options';
      const multiple = question.type === 'multiple_choice';
      question.options.forEach((option) => {
        const label = document.createElement('label'); label.className = 'exam-option';
        const control = document.createElement('input'); control.type = multiple ? 'checkbox' : 'radio'; control.name = `answer-${question.questionId}`; control.value = option.answerId;
        control.checked = multiple ? Array.isArray(value) && value.includes(option.answerId) : value === option.answerId;
        control.dataset.answerInput = '1';
        const copy = document.createElement('div'); copy.textContent = option.text;
        label.append(control, copy);
        if (option.images?.length) label.append(imageGrid(option.images, 'exam-answer-images'));
        fieldset.append(label);
      });
      return fieldset;
    }
    if (question.type === 'short_text' || question.type === 'number') {
      const control = document.createElement('input'); control.className = 'exam-text-answer'; control.type = question.type === 'number' ? 'text' : 'text'; control.inputMode = question.type === 'number' ? 'decimal' : 'text'; control.value = value ?? ''; control.dataset.answerInput = '1'; control.autocomplete = 'off';
      return control;
    }
    if (question.type === 'matching') {
      const host = document.createElement('div'); host.className = 'exam-matching';
      const illustratedAnswers = question.right.filter((right) => right.images?.length);
      if (illustratedAnswers.length) {
        const legend = document.createElement('div'); legend.className = 'exam-matching-answer-legend';
        illustratedAnswers.forEach((right) => {
          const item = document.createElement('div');
          item.append(tag(right.text || 'Odpowiedź', 'strong'), imageGrid(right.images, 'exam-answer-images'));
          legend.append(item);
        });
        host.append(legend);
      }
      question.left.forEach((left) => {
        const label = document.createElement('label');
        const copy = document.createElement('div'); copy.textContent = left.text;
        if (left.images?.length) copy.append(imageGrid(left.images, 'exam-answer-images'));
        const select = document.createElement('select'); select.dataset.answerInput = '1'; select.dataset.matchLeft = left.pairId;
        select.append(new Option('Wybierz dopasowanie…', ''));
        question.right.forEach((right) => select.append(new Option(right.text, right.answerId)));
        select.value = value?.[left.pairId] || '';
        label.append(copy, select); host.append(label);
      });
      return host;
    }
    if (question.type === 'ordering') {
      const host = document.createElement('div'); host.className = 'exam-ordering';
      host.dataset.answerInput = '1';
      const requested = Array.isArray(value) && value.length === question.items.length ? value : question.items.map((item) => item.itemId);
      const byId = new Map(question.items.map((item) => [item.itemId, item]));
      requested.forEach((itemId, index) => {
        const item = byId.get(itemId); if (!item) return;
        const line = document.createElement('div'); line.className = 'exam-order-item'; line.dataset.itemId = itemId;
        const copy = document.createElement('div'); copy.textContent = item.text;
        if (item.images?.length) copy.append(imageGrid(item.images, 'exam-answer-images'));
        line.append(tag(index + 1, 'strong'), copy);
        const actions = document.createElement('span');
        for (const [direction, label] of [['up', '↑'], ['down', '↓']]) {
          const button = document.createElement('button'); button.type = 'button'; button.dataset.orderAction = direction; button.textContent = label; button.setAttribute('aria-label', direction === 'up' ? 'Przesuń wyżej' : 'Przesuń niżej'); actions.append(button);
        }
        line.append(actions); host.append(line);
      });
      return host;
    }
    const host = document.createElement('div'); host.className = 'exam-blanks';
    const sentence = document.createElement('p'); sentence.className = 'exam-blank-sentence';
    let blankIndex = 0;
    String(question.template || '').split(/(\{\{[^{}]*\}\})/).forEach((part) => {
      if (!/^\{\{[^{}]*\}\}$/.test(part)) {
        sentence.append(document.createTextNode(part));
        return;
      }
      const blank = question.blanks[blankIndex];
      if (!blank) return;
      const control = document.createElement('input');
      control.className = 'exam-text-answer';
      control.dataset.answerInput = '1';
      control.dataset.blankId = blank.blankId;
      control.value = value?.[blank.blankId] || '';
      control.placeholder = part.slice(2, -2).trim() || `Luka ${blankIndex + 1}`;
      control.setAttribute('aria-label', `Luka ${blankIndex + 1}: ${control.placeholder}`);
      sentence.append(control);
      blankIndex += 1;
    });
    host.append(sentence);
    return host;
  }

  function answerChanged(event) {
    const article = event.target.closest('[data-question-id]');
    if (!article) return;
    state.dirtyQuestions.add(article.dataset.questionId);
    elements.saveState.textContent = 'Niezapisana odpowiedź';
    window.clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(() => saveVisible(false), 700);
  }

  function readAnswer(article, question) {
    if (question.options) {
      const selected = Array.from(article.querySelectorAll('input:checked')).map((input) => input.value);
      return question.type === 'multiple_choice' ? selected : selected[0] || '';
    }
    if (question.type === 'short_text' || question.type === 'number') return article.querySelector('[data-answer-input]')?.value || '';
    if (question.type === 'matching') return Object.fromEntries(Array.from(article.querySelectorAll('[data-match-left]')).map((select) => [select.dataset.matchLeft, select.value]));
    if (question.type === 'ordering') return Array.from(article.querySelectorAll('[data-item-id]')).map((item) => item.dataset.itemId);
    return Object.fromEntries(Array.from(article.querySelectorAll('[data-blank-id]')).map((input) => [input.dataset.blankId, input.value]));
  }

  async function saveVisible(explicit) {
    window.clearTimeout(state.saveTimer);
    const articles = Array.from(elements.questionList.querySelectorAll('[data-question-id]'));
    const confirmed = new Set(state.attempt.confirmedQuestionIds || []);
    const targets = articles.filter((article) => !confirmed.has(article.dataset.questionId)
      && (explicit || state.dirtyQuestions.has(article.dataset.questionId)));
    if (!targets.length) return true;
    elements.saveState.textContent = 'Zapisywanie…';
    for (const article of targets) {
      const question = state.attempt.questions.find((candidate) => candidate.questionId === article.dataset.questionId);
      if (!question) continue;
      try {
        const payload = await mutate('autosave', {
          questionId: question.questionId,
          answer: readAnswer(article, question)
        });
        state.attempt = payload.attempt;
        state.dirtyQuestions.delete(question.questionId);
      } catch (error) {
        if (error.code === 'ATTEMPT_VERSION_CONFLICT' && error.payload?.attempt) {
          state.attempt = error.payload.attempt;
          renderAttempt();
        }
        setMessage(elements.attemptMessage, errorMessage(error));
        elements.saveState.textContent = 'Błąd zapisu';
        return false;
      }
    }
    elements.saveState.textContent = 'Odpowiedzi zapisane';
    renderNavigator();
    return true;
  }

  async function navigatePage(direction) {
    if (!await saveVisible(true)) return;
    const indices = visibleIndices();
    const target = direction < 0 ? indices[0] - 1 : indices.at(-1) + 1;
    if (target < 0 || target >= state.attempt.totalQuestions) return;
    await navigateTo(target);
  }

  async function navigateTo(targetIndex) {
    if (!await saveVisible(true)) return;
    try {
      const payload = await mutate('navigate', { targetIndex });
      state.attempt = payload.attempt;
      renderAttempt();
    } catch (error) { setMessage(elements.attemptMessage, errorMessage(error)); }
  }

  async function toggleFlag() {
    const question = state.attempt.questions[state.attempt.currentIndex];
    const flagged = !state.attempt.flags.includes(question.questionId);
    try {
      const payload = await mutate('navigate', { targetIndex: state.attempt.currentIndex, flagged });
      state.attempt = payload.attempt;
      renderAttempt();
    } catch (error) { setMessage(elements.attemptMessage, errorMessage(error)); }
  }

  function orderingAction(event) {
    const button = event.target.closest('[data-order-action]');
    if (!button) return;
    const item = button.closest('[data-item-id]');
    const sibling = button.dataset.orderAction === 'up' ? item.previousElementSibling : item.nextElementSibling;
    if (!sibling) return;
    if (button.dataset.orderAction === 'up') item.parentNode.insertBefore(item, sibling);
    else item.parentNode.insertBefore(sibling, item);
    const article = button.closest('[data-question-id]');
    state.dirtyQuestions.add(article.dataset.questionId);
    renderOrderNumbers(item.parentNode);
    answerChanged({ target: button });
  }

  function questionAction(event) {
    const confirm = event.target.closest('[data-confirm-question]');
    if (confirm) { void confirmQuestion(confirm.dataset.confirmQuestion); return; }
    orderingAction(event);
  }

  async function confirmQuestion(questionId) {
    if (!await saveVisible(true)) return;
    const button = elements.questionList.querySelector(`[data-confirm-question="${CSS.escape(questionId)}"]`);
    if (button) button.disabled = true;
    try {
      const payload = await mutate('confirm-answer', { questionId });
      state.attempt = payload.attempt;
      renderAttempt();
    } catch (error) {
      if (button) button.disabled = false;
      setMessage(elements.attemptMessage, errorMessage(error));
    }
  }

  function renderOrderNumbers(host) {
    host.querySelectorAll('[data-item-id]').forEach((item, index) => { item.querySelector('strong').textContent = String(index + 1); });
  }

  async function submitAttempt() {
    if (!await saveVisible(true)) return;
    const unanswered = state.attempt.totalQuestions - state.attempt.answeredCount;
    if (unanswered > 0 && !window.confirm(`Pozostało ${unanswered} pytań bez odpowiedzi. Zakończyć próbę?`)) return;
    elements.submit.disabled = true;
    try {
      const payload = await mutate('submit', { force: unanswered > 0 });
      state.attempt = payload.attempt;
      renderResult(payload.result);
    } catch (error) { setMessage(elements.attemptMessage, errorMessage(error)); }
    finally { elements.submit.disabled = false; }
  }

  function mutate(action, body) {
    const operation = () => client.mutate(action, {
      ...state.reference,
      preview: state.preview,
      body: {
        attemptId: state.attempt.attemptId,
        revision: state.attempt.revision,
        operationId: operationId(),
        ...body
      }
    });
    const result = state.mutationQueue.then(operation, operation);
    state.mutationQueue = result.catch(() => undefined);
    return result;
  }

  async function logLifecycle(eventType, keepalive) {
    if (state.attempt?.status !== 'active') return;
    const attemptId = state.attempt.attemptId;
    try {
      const payload = keepalive
        ? await client.mutate('event', {
          ...state.reference,
          preview: state.preview,
          body: { attemptId, revision: state.attempt.revision, operationId: operationId(), eventType }
        }, { keepalive: true })
        : await mutate('event', { eventType });
      if (payload?.attempt?.attemptId === attemptId
        && state.attempt?.attemptId === attemptId
        && Number(payload.attempt.revision) >= Number(state.attempt.revision)) {
        state.attempt = payload.attempt;
      }
    } catch (_) {}
  }

  function renderNavigator() {
    const answered = Object.values(state.attempt.answers || {}).filter(answerPresent).length;
    elements.progressCopy.textContent = `${answered}/${state.attempt.totalQuestions}`;
    elements.progressBar.style.width = `${state.attempt.totalQuestions ? (answered / state.attempt.totalQuestions) * 100 : 0}%`;
    elements.navigator.hidden = !state.attempt.exam.navigation.allowFreeNavigation && state.attempt.exam.display.mode !== 'all';
    elements.navigatorGrid.replaceChildren(...state.attempt.questions.map((question, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = String(index + 1); button.dataset.questionIndex = String(index);
      button.classList.toggle('is-current', visibleIndices().includes(index));
      button.classList.toggle('is-answered', answerPresent(state.attempt.answers[question.questionId]));
      button.classList.toggle('is-flagged', state.attempt.flags.includes(question.questionId));
      button.disabled = !state.attempt.exam.navigation.allowFreeNavigation && index > state.attempt.highestReachedIndex + 1;
      return button;
    }));
  }

  function updateControls() {
    const indices = visibleIndices();
    elements.previous.disabled = indices[0] === 0 || !state.attempt.exam.navigation.allowBack;
    elements.next.disabled = indices.at(-1) >= state.attempt.totalQuestions - 1;
    elements.next.hidden = state.attempt.exam.display.mode === 'all';
    elements.previous.hidden = state.attempt.exam.display.mode === 'all';
    elements.submit.hidden = state.attempt.exam.display.mode !== 'all' && indices.at(-1) < state.attempt.totalQuestions - 1;
  }

  function startTimer() {
    clearTimer();
    if (state.attempt.exam.timing.mode === 'none') return;
    elements.timer.hidden = state.attempt.exam.timing.display === 'hidden';
    updateTimer();
    state.timerId = window.setInterval(updateTimer, 500);
  }

  function updateTimer() {
    if (!state.attempt || state.attempt.status !== 'active') return clearTimer();
    const now = Date.now() + state.serverOffset;
    const timing = state.attempt.exam.timing;
    const expiresAt = timing.mode === 'exam' ? state.attempt.expiresAt : state.attempt.currentQuestionExpiresAt;
    const remaining = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
    const startedAt = timing.mode === 'question'
      ? state.attempt.currentQuestionStartedAt
      : state.attempt.startedAt;
    const displayed = timing.display === 'countup'
      ? Math.max(0, Math.floor((now - Date.parse(startedAt || state.attempt.startedAt)) / 1000))
      : remaining;
    elements.timer.textContent = formatClock(displayed);
    if (remaining <= 0) void timerExpired(timing.mode);
  }

  async function timerExpired(mode) {
    clearTimer();
    if (mode === 'exam') {
      try {
        const payload = await client.attempt({ ...state.reference, attemptId: state.attempt.attemptId, preview: state.preview });
        state.attempt = payload.attempt;
        if (state.attempt.status !== 'active') renderResult(state.attempt.result);
      } catch (error) { setMessage(elements.attemptMessage, errorMessage(error)); }
      return;
    }
    setMessage(elements.attemptMessage, 'Czas na bieżące pytanie minął. Przejdź dalej.');
    try {
      const target = Math.min(state.attempt.totalQuestions - 1, state.attempt.currentIndex + 1);
      const payload = await mutate('navigate', { targetIndex: target });
      state.attempt = payload.attempt;
      renderAttempt();
    } catch (_) { renderAttempt(); }
  }

  function clearTimer() {
    window.clearInterval(state.timerId); state.timerId = 0; elements.timer.hidden = true;
  }

  function renderResult(result) {
    clearTimer();
    setView('result');
    const passed = result.passed;
    elements.resultIcon.textContent = passed === false ? '×' : '✓';
    elements.resultIcon.dataset.state = passed === false ? 'failed' : 'passed';
    elements.resultTitle.textContent = passed == null ? 'Wynik zapisany' : passed ? 'Egzamin zaliczony' : 'Egzamin niezaliczony';
    elements.resultMessage.textContent = state.definition.metadata.afterFinishMessage || 'Twoja próba została bezpiecznie zapisana.';
    elements.resultMetrics.replaceChildren();
    if (result.scorePercent != null) metric('Wynik', `${result.scorePercent}%`);
    if (result.points != null) metric('Punkty', `${result.points}/${result.maxPoints}`);
    if (result.passed != null) metric('Status', result.passed ? 'Zaliczono' : 'Nie zaliczono');
    if (result.durationSeconds != null) metric('Czas', formatDuration(result.durationSeconds));
    elements.resultQuestions.replaceChildren();
    (result.questions || []).forEach((question, index) => {
      const item = document.createElement('article'); item.className = 'exam-result-question';
      item.append(tag(`${index + 1}. ${question.prompt}`, 'strong'));
      if (Object.hasOwn(question, 'correct')) item.append(tag(question.correct ? 'Odpowiedź poprawna' : 'Odpowiedź niepoprawna', 'small'));
      appendResultAnswer(item, 'Twoja odpowiedź', question.answerDisplay);
      appendResultAnswer(item, 'Prawidłowa odpowiedź', question.correctAnswerDisplay);
      if (question.explanation) item.append(tag(question.explanation, 'small'));
      elements.resultQuestions.append(item);
    });
    void reloadAttemptHistory();
  }

  function appendResultAnswer(item, label, values) {
    if (!Array.isArray(values)) return;
    const row = document.createElement('div');
    row.className = 'exam-result-answer';
    row.append(tag(label, 'small'));
    row.append(tag(values.length ? values.join(' · ') : 'Brak odpowiedzi', 'span'));
    item.append(row);
  }

  async function reloadAttemptHistory() {
    try {
      const payload = await client.definition({ ...state.reference, preview: state.preview });
      state.definition = payload.exam;
      state.attempts = payload.attempts || [];
      syncServerTime(payload.serverNow);
    } catch (_) {}
  }

  function metric(label, value) {
    const item = document.createElement('div'); item.append(tag(label, 'small'), tag(value, 'strong')); elements.resultMetrics.append(item);
  }

  async function setBackgroundImage(node, ref) {
    try {
      const objectUrl = await protectedImageUrl(ref);
      node.style.backgroundImage = `url("${objectUrl}")`; node.hidden = false;
    } catch (_) { node.hidden = true; }
  }

  function imageGrid(images, className = 'exam-question-images') {
    const grid = document.createElement('div'); grid.className = className;
    images.forEach((image) => {
      const img = document.createElement('img'); img.alt = image.alt || 'Ilustracja'; img.loading = 'lazy'; grid.append(img);
      protectedImageUrl(image.ref).then((url) => { img.src = url; }).catch(() => { img.remove(); });
    });
    return grid;
  }

  async function protectedImageUrl(ref) {
    const token = await window.ChemAuth.getAccessToken();
    const response = await fetch(client.imageUrl({ ...state.reference, preview: state.preview }, ref), { headers: { Authorization: `Bearer ${token}` }, credentials: 'same-origin' });
    if (!response.ok) throw new Error('IMAGE_UNAVAILABLE');
    const url = URL.createObjectURL(await response.blob()); state.objectUrls.push(url); return url;
  }

  function revokeObjectUrls() {
    state.objectUrls.splice(0).forEach((url) => URL.revokeObjectURL(url));
  }

  function initializeTheme() {
    let theme = ''; try { theme = localStorage.getItem('chem.theme') || ''; } catch (_) {}
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
  }

  function toggleTheme() {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme; try { localStorage.setItem('chem.theme', theme); } catch (_) {}
  }

  function syncServerTime(serverNow) {
    const value = Date.parse(serverNow || ''); state.serverOffset = Number.isFinite(value) ? value - Date.now() : 0;
  }

  function fatal(message) {
    setView('loading'); elements.loading.querySelector('.exam-spinner').hidden = true; elements.loading.querySelector('h1').textContent = 'Nie można otworzyć egzaminu'; elements.loading.querySelector('p').textContent = message;
  }

  function tag(value, tagName = 'span') { const node = document.createElement(tagName); node.textContent = String(value); return node; }
  function typeLabel(type) { return ({ single_choice: 'Jedna odpowiedź', multiple_choice: 'Wiele odpowiedzi', true_false: 'Prawda / fałsz', short_text: 'Krótka odpowiedź', number: 'Liczba', matching: 'Dopasowywanie', ordering: 'Kolejność', fill_blanks: 'Uzupełnianie luk' })[type] || 'Pytanie'; }
  function attemptLimitLabel() { const config = state.definition.attempts; return config.mode === 'unlimited' ? 'Próby bez limitu' : config.mode === 'one' ? 'Jedna próba' : `${config.maxAttempts} prób`; }
  function answerPresent(value) { return Array.isArray(value) ? value.length > 0 : value && typeof value === 'object' ? Object.values(value).some((entry) => String(entry).trim()) : value != null && String(value).trim() !== ''; }
  function operationId() { return `op:${cryptoId()}`; }
  function cryptoId() { return window.crypto?.randomUUID?.() || `${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`; }
  function formatClock(seconds) { const value = Math.max(0, Math.floor(seconds)); const hours = Math.floor(value / 3600); const minutes = Math.floor((value % 3600) / 60); const rest = value % 60; return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}` : `${minutes}:${String(rest).padStart(2, '0')}`; }
  function formatDuration(seconds) { const value = Math.max(0, Math.round(Number(seconds) || 0)); const minutes = Math.floor(value / 60); return minutes ? `${minutes} min ${value % 60} s` : `${value} s`; }

  document.addEventListener('DOMContentLoaded', start);
})();
