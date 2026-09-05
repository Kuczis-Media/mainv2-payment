(function initializeQuizBuilder(root) {
  'use strict';

  const modelApi = root.ChemQuizStudioModel;
  const library = root.ChemContentLibrary;
  const pagedListApi = root.ChemStudioPagedList;
  if (!modelApi || !library || !pagedListApi) return;

  const byId = (id) => root.document.getElementById(id);
  const elements = {
    workspace: byId('quiz-workspace'),
    repository: byId('quiz-repository-select'),
    search: byId('quiz-library-search'),
    library: byId('quiz-library'),
    libraryStatus: byId('quiz-library-status'),
    id: byId('quiz-id'),
    title: byId('quiz-title'),
    description: byId('quiz-description'),
    passingScore: byId('quiz-passing-score'),
    tags: byId('quiz-tags'),
    shuffle: byId('quiz-shuffle'),
    showFeedback: byId('quiz-show-feedback'),
    allowRetry: byId('quiz-allow-retry'),
    coverReference: byId('quiz-cover-reference'),
    coverSelect: byId('quiz-cover-select'),
    coverRemove: byId('quiz-cover-remove'),
    questions: byId('quiz-question-list'),
    questionCount: byId('quiz-question-count'),
    validation: byId('quiz-validation'),
    preview: byId('quiz-preview'),
    badge: byId('quiz-status-badge'),
    status: byId('quiz-builder-status'),
    newButton: byId('quiz-new-button'),
    deleteButton: byId('quiz-delete-button'),
    saveButton: byId('quiz-save-draft-button'),
    publishButton: byId('quiz-publish-button'),
    reportPanel: byId('quiz-report-panel'),
    reportRefresh: byId('quiz-report-refresh'),
    reportStatus: byId('quiz-report-status'),
    reportBody: byId('quiz-report-body')
  };
  if (!elements.workspace) return;

  const DRAFT_KEY = 'chemdisk.studio.quiz.v1';
  const state = {
    quiz: null,
    repositoryId: '',
    repositories: [],
    assets: [],
    remoteId: '',
    remoteSha: '',
    loaded: false,
    active: false,
    busy: false,
    libraryPaging: pagedListApi.createState(),
    objectUrls: new Set(),
    previewImageObserver: null,
    report: null,
    attemptReport: null,
    reportLoading: false
  };

  const create = (tag, className, text) => {
    const node = root.document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function setStatus(message, error) {
    elements.status.textContent = message || '';
    elements.status.classList.toggle('is-error', Boolean(error));
  }

  function setLibraryStatus(message, error = false) {
    if (!elements.libraryStatus) return;
    elements.libraryStatus.textContent = message || '';
    elements.libraryStatus.classList.toggle('is-error', Boolean(error));
  }

  function saveLocal() {
    try { root.localStorage.setItem(DRAFT_KEY, JSON.stringify(state.quiz)); } catch (_) {}
  }

  function flush() { if (state.quiz) saveLocal(); }

  function loadDraft() {
    let value = null;
    try { value = root.localStorage.getItem(DRAFT_KEY); } catch (_) {}
    try { state.quiz = value ? modelApi.parse(value) : modelApi.createQuiz(); }
    catch (_) { state.quiz = modelApi.createQuiz(); }
  }

  function markChanged(message = 'Niezapisane zmiany zapisano lokalnie.') {
    saveLocal();
    elements.badge.textContent = 'Draft lokalny';
    setStatus(message);
  }

  function questionLabel(count) {
    if (count === 1) return '1 pytanie';
    if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14)) return `${count} pytania`;
    return `${count} pytań`;
  }

  function renderSettings() {
    const { quiz } = state;
    elements.id.value = quiz.quizId;
    elements.title.value = quiz.metadata.title;
    elements.description.value = quiz.metadata.description;
    elements.passingScore.value = String(quiz.settings.passingScore);
    elements.tags.value = quiz.metadata.tags.join(', ');
    elements.shuffle.checked = quiz.settings.shuffleQuestions;
    elements.showFeedback.checked = quiz.settings.showFeedback;
    elements.allowRetry.checked = quiz.settings.allowRetry;
    elements.coverReference.textContent = quiz.metadata.cover.ref || 'Brak obrazu';
    elements.coverRemove.disabled = !quiz.metadata.cover.ref;
    elements.deleteButton.disabled = !state.remoteSha || state.remoteId !== quiz.quizId || state.busy;
    elements.saveButton.disabled = state.busy;
    elements.publishButton.disabled = state.busy;
    elements.badge.textContent = state.remoteSha && state.remoteId === quiz.quizId
      ? quiz.metadata.status === 'published' ? 'Opublikowany' : 'Draft w GitHubie'
      : 'Draft lokalny';
  }

  function fieldLabel(label, control, className = '') {
    const wrapper = create('label', className);
    wrapper.append(create('span', '', label), control);
    return wrapper;
  }

  function questionSelect(question) {
    const select = create('select', 'quiz-question-type');
    select.dataset.quizField = 'type';
    [
      ['single', 'Jedna odpowiedź'],
      ['multiple', 'Wiele odpowiedzi'],
      ['true_false', 'Prawda / fałsz'],
      ['text', 'Odpowiedź tekstowa'],
      ['open', 'Pytanie otwarte']
    ].forEach(([value, label]) => {
      const option = create('option', '', label);
      option.value = value;
      select.append(option);
    });
    select.value = question.type;
    return select;
  }

  function renderOptions(question, index) {
    const section = create('div', 'quiz-options-editor');
    if (question.type === 'open') {
      const mode = create('select');
      mode.dataset.quizField = 'gradingMode';
      [
        ['ai', 'Uczeń uruchamia sprawdzanie AI'],
        ['manual', 'Sprawdzający przyznaje punkty'],
        ['ungraded', 'Bez punktów — nie licz do wyniku']
      ].forEach(([value, label]) => {
        const option = create('option', '', label); option.value = value; mode.append(option);
      });
      mode.value = question.gradingMode;
      const answerKey = create('textarea');
      answerKey.rows = 5; answerKey.maxLength = 10000; answerKey.value = question.answerKey;
      answerKey.placeholder = 'Wzorcowa odpowiedź i najważniejsze wymagane elementy';
      answerKey.dataset.quizField = 'answerKey';
      const instruction = create('textarea');
      instruction.rows = 3; instruction.maxLength = 2000; instruction.value = question.aiInstruction;
      instruction.placeholder = 'Opcjonalnie: kryteria punktacji, elementy częściowo poprawne…';
      instruction.dataset.quizField = 'aiInstruction';
      const multiline = create('input');
      multiline.type = 'checkbox'; multiline.checked = question.multiline !== false;
      multiline.dataset.quizField = 'multiline';
      section.append(
        fieldLabel('Sposób oceniania', mode),
        fieldLabel('Klucz odpowiedzi', answerKey),
        fieldLabel('Dodatkowe kryteria dla AI', instruction),
        fieldLabel('Odpowiedź wielowierszowa', multiline),
        create('small', 'quiz-options-hint', question.gradingMode === 'manual'
          ? 'Wynik ucznia pojawi się dopiero po przyznaniu punktów w raporcie.'
          : question.gradingMode === 'ungraded'
            ? 'Odpowiedź zostanie zachowana, ale pytanie nie zmieni wyniku.'
            : 'AI uruchomi się dopiero po kliknięciu przez ucznia „Sprawdź odpowiedzi za pomocą AI”. Jedno zbiorcze żądanie ogranicza zużycie funkcji i tokenów.')
      );
      return section;
    }
    if (question.type === 'text') {
      const accepted = create('textarea');
      accepted.rows = 3;
      accepted.value = question.acceptedAnswers.join('\n');
      accepted.placeholder = 'Każda akceptowana odpowiedź w osobnym wierszu';
      accepted.dataset.quizField = 'acceptedAnswers';
      section.append(fieldLabel('Akceptowane odpowiedzi', accepted));
      return section;
    }
    section.append(create('small', 'quiz-options-hint', question.type === 'multiple'
      ? 'Zaznacz wszystkie poprawne odpowiedzi.'
      : 'Zaznacz jedną poprawną odpowiedź.'));
    question.options.forEach((option, optionIndex) => {
      const row = create('div', 'quiz-option-row');
      const correct = create('input');
      correct.type = question.type === 'multiple' ? 'checkbox' : 'radio';
      correct.name = `quiz-correct-${question.questionId}`;
      correct.checked = option.correct;
      correct.dataset.quizCorrect = '1';
      correct.dataset.optionId = option.optionId;
      correct.setAttribute('aria-label', `Poprawna odpowiedź ${optionIndex + 1} w pytaniu ${index + 1}`);
      const copy = create('input');
      copy.type = 'text';
      copy.maxLength = 500;
      copy.value = option.text;
      copy.dataset.quizField = 'optionText';
      copy.dataset.optionId = option.optionId;
      const remove = create('button', 'mini-button is-danger', '×');
      remove.type = 'button';
      remove.title = 'Usuń odpowiedź';
      remove.setAttribute('aria-label', `Usuń odpowiedź ${optionIndex + 1}`);
      remove.dataset.quizAction = 'delete-option';
      remove.dataset.optionId = option.optionId;
      remove.disabled = question.type === 'true_false' || question.options.length <= 2;
      row.append(correct, copy, remove);
      section.append(row);
    });
    if (question.type !== 'true_false' && question.options.length < 12) {
      const add = create('button', 'mini-button quiz-add-option', '＋ Dodaj odpowiedź');
      add.type = 'button';
      add.dataset.quizAction = 'add-option';
      section.append(add);
    }
    return section;
  }

  function renderQuestions() {
    const fragment = root.document.createDocumentFragment();
    state.quiz.questions.forEach((question, index) => {
      const card = create('article', 'quiz-question-card');
      card.dataset.questionId = question.questionId;
      const heading = create('header', 'quiz-question-card-heading');
      const title = create('div');
      title.append(create('small', '', `Pytanie ${index + 1}`), create('strong', '', `${question.points} ${question.points === 1 ? 'punkt' : 'pkt'}`));
      const actions = create('div', 'quiz-question-actions');
      const up = create('button', 'mini-button', '↑'); up.type = 'button'; up.title = 'Przenieś wyżej'; up.dataset.quizAction = 'up'; up.disabled = index === 0;
      const down = create('button', 'mini-button', '↓'); down.type = 'button'; down.title = 'Przenieś niżej'; down.dataset.quizAction = 'down'; down.disabled = index === state.quiz.questions.length - 1;
      const duplicate = create('button', 'mini-button', 'Duplikuj'); duplicate.type = 'button'; duplicate.dataset.quizAction = 'duplicate';
      const remove = create('button', 'mini-button is-danger', 'Usuń'); remove.type = 'button'; remove.dataset.quizAction = 'delete'; remove.disabled = state.quiz.questions.length === 1;
      actions.append(up, down, duplicate, remove);
      heading.append(title, actions);

      const controls = create('div', 'quiz-question-controls');
      const points = create('input'); points.type = 'number'; points.min = '0'; points.max = '10000'; points.step = '0.1'; points.value = String(question.points); points.dataset.quizField = 'points';
      const required = create('input'); required.type = 'checkbox'; required.checked = question.required; required.dataset.quizField = 'required';
      controls.append(
        fieldLabel('Rodzaj', questionSelect(question)),
        fieldLabel('Punkty', points),
        fieldLabel('Wymagane', required, 'quiz-inline-check')
      );

      const prompt = create('textarea');
      prompt.rows = 3; prompt.maxLength = 3000; prompt.value = question.prompt; prompt.dataset.quizField = 'prompt';
      const explanation = create('textarea');
      explanation.rows = 2; explanation.maxLength = 3000; explanation.value = question.explanation; explanation.dataset.quizField = 'explanation'; explanation.placeholder = 'Opcjonalne wyjaśnienie po sprawdzeniu';

      const media = create('div', 'quiz-question-media');
      const mediaCopy = create('div');
      mediaCopy.append(create('small', '', 'Obraz do pytania'), create('code', '', question.image.ref || 'Brak obrazu'));
      const selectMedia = create('button', 'mini-button', 'Wybierz obraz'); selectMedia.type = 'button'; selectMedia.dataset.quizAction = 'select-media';
      const removeMedia = create('button', 'mini-button is-danger', 'Usuń referencję'); removeMedia.type = 'button'; removeMedia.dataset.quizAction = 'remove-media'; removeMedia.disabled = !question.image.ref;
      media.append(mediaCopy, selectMedia, removeMedia);

      card.append(
        heading,
        controls,
        fieldLabel('Treść pytania', prompt),
        media,
        renderOptions(question, index),
        fieldLabel('Informacja zwrotna / wyjaśnienie', explanation)
      );
      fragment.append(card);
    });
    elements.questions.replaceChildren(fragment);
    elements.questionCount.textContent = questionLabel(state.quiz.questions.length);
  }

  function revokeObjectUrls() {
    state.previewImageObserver?.disconnect();
    state.previewImageObserver = null;
    state.objectUrls.forEach((url) => root.URL.revokeObjectURL(url));
    state.objectUrls.clear();
  }

  async function hydratePreviewImage(image, priority = false) {
    const ref = image.dataset.quizPreviewImage;
    try {
      const blob = await library.readMediaBlob({
        scope: ref.startsWith('assets/shared/') ? 'shared' : 'local',
        materialKind: ref.startsWith('assets/shared/') ? '' : 'quiz',
        materialId: ref.startsWith('assets/shared/') ? '' : state.quiz.quizId,
        reference: ref,
        repositoryId: state.repositoryId
      });
      if (!image.isConnected) return;
      const url = root.URL.createObjectURL(blob);
      state.objectUrls.add(url);
      image.loading = priority ? 'eager' : 'lazy';
      image.decoding = 'async';
      image.fetchPriority = priority ? 'high' : 'auto';
      image.src = url;
      image.hidden = false;
    } catch (_) {
      if (image.isConnected) image.replaceWith(create('span', 'quiz-preview-image-error', 'Nie udało się wczytać obrazu.'));
    }
  }

  function hydratePreviewImages() {
    const images = Array.from(elements.preview.querySelectorAll('[data-quiz-preview-image]'));
    const cover = images.find((image) => image.classList.contains('quiz-preview-cover'));
    if (cover) void hydratePreviewImage(cover, true);
    const questionImages = images.filter((image) => image !== cover);
    if (!questionImages.length) return;
    if (typeof root.IntersectionObserver !== 'function') {
      questionImages.forEach((image) => { void hydratePreviewImage(image); });
      return;
    }
    state.previewImageObserver = new root.IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        state.previewImageObserver?.unobserve(entry.target);
        const image = entry.target.querySelector('[data-quiz-preview-image]');
        if (image) void hydratePreviewImage(image);
      });
    }, { root: elements.preview.closest('.quiz-preview-panel'), rootMargin: '320px 0px' });
    questionImages.forEach((image) => {
      const question = image.closest('.quiz-preview-question');
      if (question) state.previewImageObserver.observe(question);
    });
  }

  function previewQuestion(question, index) {
    const fieldset = create('fieldset', 'quiz-preview-question');
    fieldset.dataset.previewQuestion = question.questionId;
    const legend = create('legend');
    legend.append(create('span', '', `${index + 1}. ${question.prompt}`), create('small', '', `${question.points} ${question.points === 1 ? 'pkt' : 'pkt'}`));
    fieldset.append(legend);
    if (question.image.ref) {
      const image = create('img', 'quiz-preview-image');
      image.alt = question.image.alt || '';
      image.hidden = true;
      image.dataset.quizPreviewImage = question.image.ref;
      fieldset.append(image);
    }
    if (question.type === 'open') {
      const input = create(question.multiline === false ? 'input' : 'textarea');
      if (question.multiline !== false) input.rows = 5;
      input.placeholder = 'Twoja odpowiedź'; input.dataset.previewText = '1';
      fieldset.append(input);
    } else if (question.type === 'text') {
      const input = create('input');
      input.type = 'text'; input.placeholder = 'Twoja odpowiedź'; input.dataset.previewText = '1';
      fieldset.append(input);
    } else {
      question.options.forEach((option) => {
        const label = create('label', 'quiz-preview-option');
        const input = create('input');
        input.type = question.type === 'multiple' ? 'checkbox' : 'radio';
        input.name = `quiz-preview-${question.questionId}`;
        input.value = option.optionId;
        label.append(input, create('span', '', option.text));
        fieldset.append(label);
      });
    }
    const feedback = create('p', 'quiz-preview-feedback');
    feedback.hidden = true;
    fieldset.append(feedback);
    return fieldset;
  }

  function renderPreview() {
    revokeObjectUrls();
    const quiz = state.quiz;
    const shell = create('form', 'quiz-preview-form');
    shell.addEventListener('submit', (event) => event.preventDefault());
    if (quiz.metadata.cover.ref) {
      const cover = create('img', 'quiz-preview-cover');
      cover.alt = quiz.metadata.cover.alt || '';
      cover.hidden = true;
      cover.dataset.quizPreviewImage = quiz.metadata.cover.ref;
      shell.append(cover);
    }
    shell.append(create('h2', '', quiz.metadata.title));
    if (quiz.metadata.description) shell.append(create('p', 'quiz-preview-description', quiz.metadata.description));
    quiz.questions.forEach((question, index) => shell.append(previewQuestion(question, index)));
    const result = create('p', 'quiz-preview-result');
    result.hidden = true;
    const check = create('button', 'button button-primary', 'Sprawdź odpowiedzi');
    check.type = 'button';
    check.addEventListener('click', () => checkPreview(shell, result));
    shell.append(check, result);
    elements.preview.replaceChildren(shell);
    if (quiz.metadata.cover.ref || quiz.questions.some((question) => question.image.ref)) hydratePreviewImages();
  }

  function checkPreview(form, resultNode) {
    const answers = {};
    state.quiz.questions.forEach((question) => {
      const fieldset = form.querySelector(`[data-preview-question="${question.questionId}"]`);
      if (!fieldset) return;
      if (['text', 'open'].includes(question.type)) answers[question.questionId] = fieldset.querySelector('[data-preview-text]')?.value || '';
      else answers[question.questionId] = Array.from(fieldset.querySelectorAll('input:checked')).map((input) => input.value);
    });
    const scored = modelApi.score(state.quiz, answers);
    scored.results.forEach((entry) => {
      const fieldset = form.querySelector(`[data-preview-question="${entry.questionId}"]`);
      const feedback = fieldset?.querySelector('.quiz-preview-feedback');
      if (!feedback) return;
      const question = state.quiz.questions.find((item) => item.questionId === entry.questionId);
      feedback.hidden = false;
      const pending = entry.reviewStatus === 'pending';
      const ungraded = entry.reviewStatus === 'not_scored';
      feedback.className = `quiz-preview-feedback ${pending || ungraded ? '' : entry.correct ? 'is-correct' : 'is-wrong'}`;
      feedback.textContent = pending
        ? 'Odpowiedź będzie oceniona przez AI lub sprawdzającego po wysłaniu.'
        : ungraded
          ? 'Odpowiedź zostanie zapisana, ale nie wpływa na wynik.'
          : `${entry.correct ? 'Poprawnie' : 'Niepoprawnie'} · ${entry.points}/${entry.maximum} pkt${state.quiz.settings.showFeedback && question?.explanation ? ` — ${question.explanation}` : ''}`;
    });
    resultNode.hidden = false;
    resultNode.className = `quiz-preview-result ${scored.passed == null ? '' : scored.passed ? 'is-passed' : 'is-failed'}`;
    resultNode.textContent = scored.gradingStatus === 'pending_review'
      ? `Wynik oczekuje na ocenę pytań otwartych · obecnie ${scored.earned}/${scored.maximum} pkt.`
      : scored.gradingStatus === 'not_scored'
        ? 'Odpowiedzi zostaną zapisane, ale ten quiz nie ma punktacji.'
      : `${scored.earned}/${scored.maximum} pkt · ${scored.percent}% · ${scored.passed ? 'zaliczony' : 'jeszcze niezaliczony'}`;
  }

  function renderValidation() {
    const validation = modelApi.validate(state.quiz);
    elements.validation.replaceChildren();
    if (validation.valid) {
      const ok = create('div', 'quiz-validation-ok');
      ok.append(create('strong', '', '✓ Quiz jest gotowy do zapisu'), create('span', '', `${state.quiz.questions.length} pytań · próg ${state.quiz.settings.passingScore}%`));
      elements.validation.append(ok);
      return;
    }
    const warning = create('div', 'quiz-validation-errors');
    warning.append(create('strong', '', 'Uzupełnij quiz przed zapisem'));
    const list = create('ul');
    validation.errors.slice(0, 8).forEach((error) => list.append(create('li', '', error.message)));
    warning.append(list);
    elements.validation.append(warning);
  }

  function renderLibrary() {
    const assets = library.search(state.assets, elements.search.value);
    const paged = pagedListApi.page(state.libraryPaging, 'quiz-library', assets);
    elements.library.replaceChildren(...paged.items.map((asset) => {
      const button = create('button', `repository-asset${state.remoteId === asset.filename ? ' is-active' : ''}`);
      button.type = 'button';
      const copy = create('span');
      copy.append(create('strong', '', asset.title || asset.filename), create('small', '', asset.filename));
      button.append(
        create('span', 'repository-asset-kind', 'QUIZ'),
        copy,
        create('span', 'repository-asset-action', 'Otwórz')
      );
      button.addEventListener('click', () => void openAsset(asset));
      return button;
    }));
    if (assets.length) {
      elements.library.append(pagedListApi.controls(root.document, state.libraryPaging, paged, {
        label: 'quizów',
        onMore: renderLibrary
      }));
      setLibraryStatus(`${assets.length} pasujących quizów.`);
    } else {
      setLibraryStatus(state.assets.length ? 'Brak quizów pasujących do wyszukiwania.' : 'Brak quizów w tym repozytorium.');
    }
  }

  function render() {
    renderSettings();
    renderQuestions();
    renderValidation();
    renderPreview();
    renderLibrary();
    renderReport();
  }

  function renderReport() {
    if (!elements.reportBody) return;
    elements.reportRefresh.disabled = state.reportLoading || !state.remoteSha || state.remoteId !== state.quiz.quizId;
    elements.reportRefresh.textContent = state.reportLoading ? 'Pobieranie…' : '↻ Odśwież raport';
    elements.reportBody.replaceChildren();
    if (!state.remoteSha || state.remoteId !== state.quiz.quizId) {
      elements.reportStatus.textContent = 'Zapisz lub wczytaj quiz z GitHuba, aby otworzyć raport.';
      return;
    }
    if (!state.report) {
      elements.reportStatus.textContent = 'Kliknij „Odśwież raport”, aby pobrać odpowiedzi oczekujące na ocenę.';
      return;
    }
    const metrics = create('div', 'quiz-report-metrics');
    [
      ['Uczestnicy', state.report.metrics.participants],
      ['Próby z pytaniami otwartymi', state.report.metrics.attempts],
      ['Do sprawdzenia', state.report.metrics.pendingReview],
      ['Ocenione', state.report.metrics.graded],
      ['Średnia', `${state.report.metrics.average}%`]
    ].forEach(([label, value]) => {
      const item = create('article'); item.append(create('small', '', label), create('strong', '', value)); metrics.append(item);
    });
    const list = create('div', 'quiz-report-attempts');
    state.report.attempts.forEach((attempt) => {
      const button = create('button'); button.type = 'button'; button.dataset.quizReportAction = 'open';
      button.dataset.userId = attempt.userId; button.dataset.attemptId = attempt.attemptId;
      button.append(
        create('span', '', attempt.profile?.name || attempt.profile?.email || attempt.userId),
        create('strong', '', attempt.gradingStatus === 'pending_review'
          ? `Próba ${attempt.number} · oczekuje na ocenę`
          : attempt.gradingStatus === 'not_scored'
            ? `Próba ${attempt.number} · bez punktacji`
            : `Próba ${attempt.number} · ${attempt.scorePercent ?? '—'}%`)
      );
      list.append(button);
    });
    if (!state.report.attempts.length) list.append(create('p', '', 'Brak prób wymagających raportowania.'));
    elements.reportStatus.textContent = state.report.truncated ? 'Pokazano najnowsze próby.' : 'Raport jest aktualny.';
    elements.reportBody.append(metrics, list);
    if (state.attemptReport) elements.reportBody.append(quizAttemptReport(state.attemptReport));
  }

  function quizAttemptReport(attempt) {
    const section = create('section', 'quiz-attempt-report');
    section.append(create('h3', '', `${attempt.profile?.name || attempt.profile?.email || attempt.userId} · próba ${attempt.number}`));
    attempt.questions.forEach((question, index) => {
      const graded = attempt.result?.results?.find((entry) => entry.questionId === question.questionId);
      const details = document.createElement('details'); details.open = question.type === 'open';
      const summary = document.createElement('summary');
      summary.append(
        create('span', '', `${index + 1}. ${question.prompt}`),
        create('strong', '', question.type === 'open' && question.gradingMode === 'ungraded'
          ? 'bez punktów'
          : `${graded?.points ?? '—'}/${graded?.maxPoints ?? question.points} pkt`)
      );
      details.append(summary, create('pre', '', `Odpowiedź ucznia:\n${String(attempt.answers?.[question.questionId] ?? 'Brak odpowiedzi')}`));
      if (question.type === 'open' && question.gradingMode !== 'ungraded' && Number(question.points) > 0) {
        const editor = create('div', 'quiz-grade-editor');
        const points = create('input'); points.type = 'number'; points.min = '0'; points.max = String(graded?.maxPoints ?? question.points); points.step = '0.1'; points.value = graded?.points ?? '';
        points.dataset.quizGradePoints = question.questionId;
        const feedback = create('textarea'); feedback.rows = 3; feedback.maxLength = 2000; feedback.value = graded?.feedback || ''; feedback.placeholder = 'Komentarz dla ucznia';
        feedback.dataset.quizGradeFeedback = question.questionId;
        editor.append(fieldLabel(`Punkty (maks. ${graded?.maxPoints ?? question.points})`, points), fieldLabel('Komentarz', feedback));
        details.append(editor);
      }
      section.append(details);
    });
    if (attempt.questions.some((question) => question.type === 'open' && question.gradingMode !== 'ungraded' && question.points > 0)) {
      const save = create('button', 'button button-primary', 'Zapisz punkty i przelicz wynik');
      save.type = 'button'; save.dataset.quizReportAction = 'grade'; section.append(save);
    }
    return section;
  }

  async function loadReport() {
    if (state.reportLoading || !state.remoteSha) return;
    state.reportLoading = true; renderReport();
    try {
      state.report = await quizAdminRequest({ view: 'overview', repo: state.repositoryId, quiz: state.quiz.quizId });
      if (state.attemptReport) {
        const selected = state.report.attempts.find((attempt) => attempt.attemptId === state.attemptReport.attemptId);
        if (!selected) state.attemptReport = null;
      }
    } catch (error) {
      elements.reportStatus.textContent = error.message;
    } finally { state.reportLoading = false; renderReport(); }
  }

  async function openQuizAttempt(userId, attemptId) {
    try {
      const payload = await quizAdminRequest({ view: 'attempt', repo: state.repositoryId, quiz: state.quiz.quizId, userId, attemptId });
      state.attemptReport = payload.attempt; renderReport();
    } catch (error) { elements.reportStatus.textContent = error.message; }
  }

  async function gradeQuizAttempt() {
    const attempt = state.attemptReport;
    if (!attempt) return;
    const grades = Array.from(elements.reportBody.querySelectorAll('[data-quiz-grade-points]')).map((control) => ({
      questionId: control.dataset.quizGradePoints,
      points: control.value === '' ? NaN : Number(control.value),
      feedback: elements.reportBody.querySelector(`[data-quiz-grade-feedback="${CSS.escape(control.dataset.quizGradePoints)}"]`)?.value || ''
    }));
    if (!grades.length || grades.some((grade) => !Number.isFinite(grade.points))) {
      elements.reportStatus.textContent = 'Wpisz punkty dla każdego ocenianego pytania.'; return;
    }
    try {
      const payload = await quizAdminMutation({
        action: 'grade', repositoryId: state.repositoryId, quizId: state.quiz.quizId,
        targetUserId: attempt.userId, attemptId: attempt.attemptId, revision: attempt.revision,
        operationId: `quiz-grade:${root.crypto?.randomUUID?.() || Date.now()}`, grades
      });
      state.attemptReport = payload.attempt;
      elements.reportStatus.textContent = payload.warnings?.length
        ? 'Punkty są zapisane. Synchronizacja części raportu dokończy się później.'
        : 'Punkty zapisano i wynik ucznia został przeliczony.';
      await loadReport();
    } catch (error) { elements.reportStatus.textContent = error.message; }
  }

  async function quizAdminRequest(params) {
    const token = await root.ChemAuth.getAccessToken();
    const url = new URL('/.netlify/functions/admin-quizzes', root.location.origin);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Nie udało się pobrać raportu quizu.');
    return payload;
  }

  async function quizAdminMutation(body) {
    const token = await root.ChemAuth.getAccessToken();
    const response = await fetch('/.netlify/functions/admin-quizzes', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Nie udało się zapisać punktów.');
    return payload;
  }

  async function loadLibrary(refresh = false) {
    setLibraryStatus('Pobieranie biblioteki quizów…');
    try {
      if (!state.repositories.length) state.repositories = await library.repositories();
      if (!state.repositoryId) state.repositoryId = state.repositories.find((entry) => entry.default)?.id || state.repositories[0]?.id || '';
      elements.repository.replaceChildren(...state.repositories.map((entry) => {
        const option = create('option', '', entry.label || entry.repository || entry.id);
        option.value = entry.id;
        return option;
      }));
      elements.repository.value = state.repositoryId;
      state.assets = await library.list('quiz', { repositoryId: state.repositoryId, refresh });
      renderLibrary();
    } catch (error) {
      setLibraryStatus(error?.message || 'Nie udało się wczytać biblioteki quizów.', true);
      setStatus(error?.message || 'Nie udało się wczytać biblioteki quizów.', true);
    }
  }

  function updateMetadata() {
    state.quiz.quizId = elements.id.value.trim().toLowerCase();
    state.quiz.metadata.title = elements.title.value;
    state.quiz.metadata.description = elements.description.value;
    state.quiz.metadata.tags = elements.tags.value.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 20);
    state.quiz.settings.passingScore = Math.max(0, Math.min(100, Math.round(Number(elements.passingScore.value) || 0)));
    state.quiz.settings.shuffleQuestions = elements.shuffle.checked;
    state.quiz.settings.showFeedback = elements.showFeedback.checked;
    state.quiz.settings.allowRetry = elements.allowRetry.checked;
    markChanged();
    renderValidation();
    renderPreview();
    renderSettings();
  }

  function questionFor(node) {
    const card = node.closest('[data-question-id]');
    return state.quiz.questions.find((question) => question.questionId === card?.dataset.questionId) || null;
  }

  function updateQuestionControl(control, rerender) {
    const question = questionFor(control);
    if (!question) return;
    const field = control.dataset.quizField;
    if (field === 'type') {
      const replacement = modelApi.createQuestion({ ...clone(question), type: control.value, questionId: question.questionId });
      state.quiz.questions.splice(state.quiz.questions.indexOf(question), 1, replacement);
    } else if (field === 'prompt') question.prompt = control.value;
    else if (field === 'points') question.points = Math.round(Math.max(0, Math.min(10000, Number(control.value) || 0)) * 100) / 100;
    else if (field === 'required') question.required = control.checked;
    else if (field === 'explanation') question.explanation = control.value;
    else if (field === 'acceptedAnswers') question.acceptedAnswers = control.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean).slice(0, 20);
    else if (field === 'gradingMode') question.gradingMode = ['ai', 'manual', 'ungraded'].includes(control.value) ? control.value : 'ai';
    else if (field === 'answerKey') question.answerKey = control.value.slice(0, 10000);
    else if (field === 'aiInstruction') question.aiInstruction = control.value.slice(0, 2000);
    else if (field === 'multiline') question.multiline = control.checked;
    else if (field === 'optionText') {
      const option = question.options.find((entry) => entry.optionId === control.dataset.optionId);
      if (option) option.text = control.value;
    } else if (control.dataset.quizCorrect) {
      if (question.type !== 'multiple') question.options.forEach((option) => { option.correct = false; });
      const option = question.options.find((entry) => entry.optionId === control.dataset.optionId);
      if (option) option.correct = control.checked;
    }
    markChanged();
    if (rerender) render();
    else { renderValidation(); renderPreview(); }
  }

  function moveQuestion(question, offset) {
    const index = state.quiz.questions.indexOf(question);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= state.quiz.questions.length) return;
    state.quiz.questions.splice(index, 1);
    state.quiz.questions.splice(target, 0, question);
  }

  function handleQuestionAction(button) {
    const action = button.dataset.quizAction;
    const question = questionFor(button);
    if (!question) return;
    if (action === 'up') moveQuestion(question, -1);
    else if (action === 'down') moveQuestion(question, 1);
    else if (action === 'duplicate') {
      const index = state.quiz.questions.indexOf(question);
      state.quiz.questions.splice(index + 1, 0, modelApi.duplicateQuestion(question));
    } else if (action === 'delete' && state.quiz.questions.length > 1) {
      if (!root.confirm('Usunąć to pytanie?')) return;
      state.quiz.questions = state.quiz.questions.filter((entry) => entry !== question);
    } else if (action === 'add-option') {
      question.options.push(modelApi.createOption({ text: `Odpowiedź ${question.options.length + 1}` }, question.options.length));
    } else if (action === 'delete-option' && question.options.length > 2) {
      question.options = question.options.filter((entry) => entry.optionId !== button.dataset.optionId);
      if (!question.options.some((option) => option.correct)) question.options[0].correct = true;
    } else if (action === 'select-media') {
      openMediaManager(question);
      return;
    } else if (action === 'remove-media') {
      question.image = { ref: '', alt: '' };
    } else return;
    markChanged();
    render();
  }

  function addQuestion(type) {
    state.quiz.questions.push(modelApi.createQuestion({ type, prompt: `Nowe pytanie ${state.quiz.questions.length + 1}` }));
    markChanged('Pytanie dodano do lokalnego draftu.');
    render();
    elements.questions.lastElementChild?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  function openMediaManager(question = null) {
    if (!root.ChemMediaManager?.open) {
      setStatus('Media Manager jest chwilowo niedostępny.', true);
      return;
    }
    const canUseLocal = Boolean(state.remoteSha && state.remoteId === state.quiz.quizId);
    void root.ChemMediaManager.open({
      scope: canUseLocal ? 'local' : 'shared',
      materialKind: canUseLocal ? 'quiz' : '',
      materialId: canUseLocal ? state.quiz.quizId : '',
      repositoryId: state.repositoryId,
      onSelect(asset) {
        const selected = {
          ref: asset.reference,
          alt: String(asset.filename || 'Ilustracja').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 300)
        };
        if (question) question.image = selected;
        else state.quiz.metadata.cover = selected;
        markChanged('Obraz dodano z Media Managera.');
        render();
      }
    });
  }

  function newQuiz() {
    if (!root.confirm('Utworzyć nowy quiz? Bieżący lokalny draft zostanie zastąpiony.')) return;
    state.quiz = modelApi.createQuiz();
    state.remoteId = '';
    state.remoteSha = '';
    saveLocal();
    render();
    setStatus('Nowy quiz jest gotowy.');
    elements.id.focus();
    elements.id.select();
  }

  async function save(publish) {
    state.quiz.metadata.status = publish ? 'published' : 'draft';
    const validation = modelApi.validate(state.quiz);
    if (!validation.valid) {
      renderValidation();
      setStatus(validation.errors[0].message, true);
      return;
    }
    state.busy = true;
    renderSettings();
    setStatus(publish ? 'Publikowanie quizu…' : 'Zapisywanie draftu…');
    try {
      const result = await library.save('quiz', {
        filename: state.quiz.quizId,
        content: modelApi.serialize(state.quiz),
        expectedSha: state.remoteId === state.quiz.quizId ? state.remoteSha : '',
        repositoryId: state.repositoryId
      });
      state.remoteId = state.quiz.quizId;
      state.remoteSha = result.sha;
      saveLocal();
      setStatus(publish ? 'Quiz opublikowano w prywatnym repozytorium.' : 'Draft quizu zapisano w prywatnym repozytorium.');
      await loadLibrary(true);
      root.document.dispatchEvent(new CustomEvent('chemdisk-content-changed', {
        detail: { kind: 'quiz', repositoryId: state.repositoryId }
      }));
    } catch (error) {
      setStatus(error?.message || 'Nie udało się zapisać quizu.', true);
    } finally {
      state.busy = false;
      renderSettings();
    }
  }

  async function removeCurrent() {
    if (!state.remoteSha || state.remoteId !== state.quiz.quizId) return;
    if (!root.confirm(`Usunąć quiz „${state.quiz.metadata.title}” z GitHuba? Lokalne obrazy pozostaną w folderze photos i można je usunąć w Media Managerze.`)) return;
    state.busy = true;
    renderSettings();
    try {
      await library.remove('quiz', {
        filename: state.remoteId,
        expectedSha: state.remoteSha,
        repositoryId: state.repositoryId
      });
      state.remoteId = '';
      state.remoteSha = '';
      setStatus('Quiz usunięto z GitHuba. Lokalny draft pozostał w Studio.');
      await loadLibrary(true);
      root.document.dispatchEvent(new CustomEvent('chemdisk-content-changed', {
        detail: { kind: 'quiz', repositoryId: state.repositoryId }
      }));
    } catch (error) {
      setStatus(error?.message || 'Nie udało się usunąć quizu.', true);
    } finally {
      state.busy = false;
      renderSettings();
    }
  }

  async function openAsset(asset) {
    setStatus(`Wczytywanie ${asset.title || asset.filename}…`);
    const result = await library.readQuiz(asset.filename, { repositoryId: asset.repositoryId });
    state.quiz = modelApi.parse(result.content, asset.filename);
    state.repositoryId = asset.repositoryId || result.repositoryId || state.repositoryId;
    state.remoteId = asset.filename;
    state.remoteSha = asset.sha || result.sha;
    state.report = null;
    state.attemptReport = null;
    saveLocal();
    render();
    setStatus('Quiz wczytano z GitHuba.');
  }

  function assetDeleted(asset) {
    if (state.remoteId === asset.filename && state.repositoryId === asset.repositoryId) {
      state.remoteId = '';
      state.remoteSha = '';
      renderSettings();
      setStatus('Plik zdalny usunięto. Lokalny draft pozostał w Studio.');
    }
  }

  function bind() {
    [elements.id, elements.title, elements.description, elements.passingScore, elements.tags].forEach((input) => {
      input.addEventListener('input', updateMetadata);
    });
    [elements.shuffle, elements.showFeedback, elements.allowRetry].forEach((input) => {
      input.addEventListener('change', updateMetadata);
    });
    elements.coverSelect.addEventListener('click', () => openMediaManager());
    elements.coverRemove.addEventListener('click', () => {
      state.quiz.metadata.cover = { ref: '', alt: '' };
      markChanged();
      render();
    });
    elements.questions.addEventListener('input', (event) => {
      if (event.target.matches('input[type="checkbox"], input[type="radio"], select')) return;
      updateQuestionControl(event.target, false);
    });
    elements.questions.addEventListener('change', (event) => {
      if (event.target.matches('input[type="checkbox"], input[type="radio"], select')) updateQuestionControl(event.target, true);
    });
    elements.questions.addEventListener('click', (event) => {
      const button = event.target.closest('[data-quiz-action]');
      if (button) handleQuestionAction(button);
    });
    root.document.querySelectorAll('[data-quiz-add]').forEach((button) => {
      button.addEventListener('click', () => addQuestion(button.dataset.quizAdd));
    });
    elements.repository.addEventListener('change', async () => {
      state.repositoryId = elements.repository.value;
      state.assets = [];
      state.remoteId = '';
      state.remoteSha = '';
      pagedListApi.reset(state.libraryPaging);
      renderSettings();
      await loadLibrary();
    });
    elements.search.addEventListener('input', () => {
      pagedListApi.reset(state.libraryPaging);
      renderLibrary();
    });
    elements.newButton.addEventListener('click', newQuiz);
    elements.saveButton.addEventListener('click', () => void save(false));
    elements.publishButton.addEventListener('click', () => void save(true));
    elements.deleteButton.addEventListener('click', () => void removeCurrent());
    elements.reportRefresh?.addEventListener('click', () => void loadReport());
    elements.reportBody?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-quiz-report-action]');
      if (!button) return;
      if (button.dataset.quizReportAction === 'open') void openQuizAttempt(button.dataset.userId, button.dataset.attemptId);
      if (button.dataset.quizReportAction === 'grade') void gradeQuizAttempt();
    });
  }

  async function activate() {
    state.active = true;
    if (!state.quiz) loadDraft();
    render();
    if (!state.loaded) {
      state.loaded = true;
      await loadLibrary();
    }
  }

  bind();
  root.ChemQuizBuilder = Object.freeze({ activate, assetDeleted, flush, openAsset });
})(typeof globalThis !== 'undefined' ? globalThis : window);
