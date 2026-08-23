(function initializeExamBuilder() {
  'use strict';

  const modelApi = window.ChemExamStudioModel;
  const library = window.ChemContentLibrary;
  const pagedListApi = window.ChemStudioPagedList;
  const DRAFT_KEY = 'chemdisk.studio.exam.v1';
  const BANK_KEY = 'chemdisk.studio.question-bank.v1';
  const TYPE_LABELS = {
    single_choice: 'Jedna odpowiedź',
    multiple_choice: 'Wiele odpowiedzi',
    true_false: 'Prawda / fałsz',
    short_text: 'Krótka odpowiedź',
    number: 'Liczba',
    matching: 'Dopasowywanie',
    ordering: 'Ustalanie kolejności',
    fill_blanks: 'Uzupełnianie luk'
  };
  const TAB_LABELS = {
    information: 'Informacje', questions: 'Pytania', bank: 'Bank pytań', display: 'Wyświetlanie',
    navigation: 'Nawigacja', time: 'Czas', randomization: 'Losowanie', scoring: 'Punktacja',
    attempts: 'Próby', access: 'Dostęp', security: 'Bezpieczeństwo', results: 'Wyniki', reports: 'Raporty'
  };
  const byId = (id) => document.getElementById(id);
  const elements = {};
  const state = {
    initialized: false,
    loaded: false,
    activationPromise: null,
    tab: 'information',
    exam: null,
    bank: null,
    selectedQuestionId: '',
    selectedBankQuestionId: '',
    repositories: [],
    repositoryId: '',
    assets: [],
    remoteSha: '',
    remoteExamId: '',
    bankSha: '',
    bankDirty: false,
    saving: false,
    report: null,
    reportLoading: false,
    attemptReport: null,
    users: [],
    usersPage: 0,
    usersHasMore: true,
    usersTotal: null,
    usersLoading: false,
    usersLoadAllRequested: false,
    usersPromise: null,
    usersError: '',
    userQuery: '',
    userSearchTimer: 0,
    libraryPaging: pagedListApi?.createState(),
    mediaUploading: false,
    mediaTarget: 'question',
    mediaObjectUrls: []
  };

  function create(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function readDraft(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; }
    catch { return fallback; }
  }

  function saveDrafts() {
    if (!state.exam || !state.bank) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state.exam));
      localStorage.setItem(BANK_KEY, JSON.stringify(state.bank));
    } catch (_) {}
  }

  function field(label, control, hint) {
    const wrapper = create('label', 'exam-field');
    wrapper.append(create('span', '', label), control);
    if (hint) wrapper.append(create('small', '', hint));
    return wrapper;
  }

  function input(path, value, options = {}) {
    const control = document.createElement('input');
    control.type = options.type || 'text';
    control.value = value == null ? '' : String(value);
    control.dataset.examPath = path;
    if (options.placeholder) control.placeholder = options.placeholder;
    if (options.min != null) control.min = String(options.min);
    if (options.max != null) control.max = String(options.max);
    if (options.step != null) control.step = String(options.step);
    if (options.maxLength) control.maxLength = options.maxLength;
    return control;
  }

  function checkbox(path, checked, label) {
    const wrapper = create('label', 'exam-toggle');
    const control = document.createElement('input');
    control.type = 'checkbox';
    control.checked = Boolean(checked);
    control.dataset.examPath = path;
    wrapper.append(control, create('span', '', label));
    return wrapper;
  }

  function textarea(path, value, options = {}) {
    const control = document.createElement('textarea');
    control.value = value == null ? '' : String(value);
    control.dataset.examPath = path;
    control.rows = options.rows || 5;
    if (options.placeholder) control.placeholder = options.placeholder;
    if (options.maxLength) control.maxLength = options.maxLength;
    return control;
  }

  function select(path, value, options) {
    const control = document.createElement('select');
    control.dataset.examPath = path;
    options.forEach((option) => {
      const node = document.createElement('option');
      node.value = option.value;
      node.textContent = option.label;
      control.append(node);
    });
    control.value = value;
    return control;
  }

  function row(...children) {
    const wrapper = create('div', 'exam-field-row');
    wrapper.append(...children);
    return wrapper;
  }

  function section(title, description) {
    const node = create('section', 'exam-form-section');
    const header = create('header');
    header.append(create('h3', '', title));
    if (description) header.append(create('p', '', description));
    node.append(header);
    return node;
  }

  function initialize() {
    if (state.initialized || !modelApi || !library || !pagedListApi || !byId('exam-workspace')) return;
    state.initialized = true;
    Object.assign(elements, {
      workspace: byId('exam-workspace'), repository: byId('exam-repository-select'), search: byId('exam-library-search'),
      library: byId('exam-library'), tabs: byId('exam-tab-list'), editor: byId('exam-editor'),
      editorTitle: byId('exam-editor-title'), badge: byId('exam-status-badge'), validation: byId('exam-validation'),
      summary: byId('exam-summary'), status: byId('exam-builder-status'), newExam: byId('exam-new-button'),
      preview: byId('exam-preview-button'), remove: byId('exam-delete-button'), saveDraft: byId('exam-save-draft-button'),
      publish: byId('exam-publish-button')
    });
    state.exam = modelApi.createExam(readDraft(DRAFT_KEY, null));
    state.bank = modelApi.createQuestionBank(readDraft(BANK_KEY, null));
    state.selectedQuestionId = state.exam.questions[0]?.questionId || '';
    bind();
    render();
  }

  function bind() {
    elements.tabs.addEventListener('click', (event) => {
      const button = event.target.closest('[data-exam-tab]');
      if (!button) return;
      state.tab = button.dataset.examTab;
      render();
      if (state.tab === 'reports') void loadReport();
      if (state.tab === 'access') void loadIdentityUsers(false);
    });
    elements.editor.addEventListener('input', handleInput);
    elements.editor.addEventListener('change', handleInput);
    elements.editor.addEventListener('change', handleMediaControl);
    elements.editor.addEventListener('click', handleAction);
    elements.editor.addEventListener('dragover', handleMediaDragOver);
    elements.editor.addEventListener('dragleave', handleMediaDragLeave);
    elements.editor.addEventListener('drop', handleMediaDrop);
    elements.editor.addEventListener('paste', handleMediaPaste);
    elements.editor.addEventListener('keydown', handleMediaKeydown);
    elements.repository.addEventListener('change', async () => {
      state.repositoryId = elements.repository.value;
      state.remoteSha = '';
      state.remoteExamId = '';
      state.bankSha = '';
      pagedListApi.reset(state.libraryPaging);
      await loadAssets(true);
    });
    elements.search.addEventListener('input', () => {
      pagedListApi.reset(state.libraryPaging);
      renderLibrary();
    });
    elements.library.addEventListener('click', (event) => {
      const button = event.target.closest('[data-exam-asset]');
      if (button) void loadExam(button.dataset.examAsset);
    });
    elements.newExam.addEventListener('click', newExam);
    elements.saveDraft.addEventListener('click', () => saveExam('draft'));
    elements.publish.addEventListener('click', () => saveExam('published'));
    elements.preview.addEventListener('click', previewExam);
    elements.remove.addEventListener('click', deleteExam);
    window.addEventListener('pagehide', saveDrafts);
  }

  async function activate() {
    initialize();
    if (state.loaded) return true;
    if (state.activationPromise) return state.activationPromise;
    state.activationPromise = (async () => {
      elements.status.textContent = 'Pobieranie egzaminów i banku pytań…';
      try {
        state.repositories = await library.repositories();
        const preferred = state.repositories.find((repository) => repository.default) || state.repositories[0];
        state.repositoryId = state.repositoryId || preferred?.id || '';
        renderRepositorySelector();
        await loadAssets(false);
        state.loaded = true;
        return true;
      } catch (error) {
        elements.status.textContent = error.message || 'Nie udało się pobrać biblioteki egzaminów.';
        elements.status.classList.add('is-error');
        return false;
      } finally {
        state.activationPromise = null;
      }
    })();
    return state.activationPromise;
  }

  function renderRepositorySelector() {
    elements.repository.replaceChildren(...state.repositories.map((repository) => {
      const option = document.createElement('option');
      option.value = repository.id;
      option.textContent = repository.label || repository.repository;
      return option;
    }));
    elements.repository.value = state.repositoryId;
    elements.repository.disabled = state.repositories.length < 2;
  }

  async function loadAssets(force) {
    elements.status.className = 'exam-builder-status';
    elements.status.textContent = 'Pobieranie biblioteki egzaminów…';
    try {
      state.assets = await library.list('exam', { repositoryId: state.repositoryId, refresh: force });
      try {
        const bank = await library.readQuestionBank({ repositoryId: state.repositoryId });
        state.bank = modelApi.createQuestionBank(JSON.parse(bank.content));
        state.bankSha = bank.sha || '';
        state.bankDirty = false;
      } catch (error) {
        if (error.status !== 404) throw error;
        state.bank = modelApi.createQuestionBank(readDraft(BANK_KEY, null));
        state.bankSha = '';
      }
      elements.status.textContent = `${state.assets.length} egzaminów · ${state.bank.questions.length} pytań w banku.`;
      renderLibrary();
      render();
    } catch (error) {
      elements.status.textContent = error.message || 'Nie udało się pobrać egzaminów.';
      elements.status.classList.add('is-error');
    }
  }

  function renderLibrary() {
    const query = String(elements.search.value || '').trim().toLocaleLowerCase('pl');
    const assets = state.assets.filter((asset) => !query || `${asset.title} ${asset.filename} ${asset.tags?.join(' ')}`.toLocaleLowerCase('pl').includes(query));
    const paged = pagedListApi.page(state.libraryPaging, 'exam-library', assets);
    elements.library.replaceChildren(...paged.items.map((asset) => {
      const button = create('button', 'repository-asset');
      button.type = 'button';
      button.dataset.examAsset = asset.filename;
      button.classList.toggle('is-active', asset.filename === state.exam.examId && Boolean(state.remoteSha));
      const copy = create('span');
      copy.append(create('strong', '', asset.title || asset.filename), create('small', '', asset.filename));
      button.append(
        create('span', 'repository-asset-kind', 'EXAM'),
        copy,
        create('span', 'repository-asset-action', 'Otwórz')
      );
      return button;
    }));
    if (!assets.length) {
      elements.library.append(create('p', 'exam-library-empty', query ? 'Brak pasujących egzaminów.' : 'Brak egzaminów w tym repozytorium.'));
    } else {
      elements.library.append(pagedListApi.controls(document, state.libraryPaging, paged, {
        label: 'egzaminów',
        onMore: renderLibrary
      }));
    }
  }

  async function loadExam(examId, options = {}) {
    if (options.confirm !== false && !window.confirm('Wczytać egzamin z GitHuba i zastąpić bieżący lokalny draft?')) return;
    elements.status.textContent = `Pobieranie ${examId}…`;
    try {
      const result = await library.readExam(examId, { repositoryId: state.repositoryId });
      state.exam = modelApi.createExam(JSON.parse(result.content));
      state.remoteSha = result.sha || '';
      state.remoteExamId = state.exam.examId;
      state.selectedQuestionId = state.exam.questions[0]?.questionId || '';
      state.tab = 'information';
      state.report = null;
      state.attemptReport = null;
      saveDrafts();
      render();
      renderLibrary();
      elements.status.textContent = `Wczytano ${examId}.`;
    } catch (error) {
      elements.status.textContent = error.message || 'Nie udało się wczytać egzaminu.';
      if (options.propagate) throw error;
    }
  }

  async function openAsset(asset) {
    if (!asset?.filename) return;
    if (!await activate()) throw new Error('Nie udało się wczytać biblioteki egzaminów.');
    const repositoryId = asset.repositoryId || state.repositoryId;
    if (repositoryId && repositoryId !== state.repositoryId) {
      if (!state.repositories.some((repository) => repository.id === repositoryId)) {
        throw new Error('Repozytorium tego egzaminu nie jest już dostępne.');
      }
      state.repositoryId = repositoryId;
      state.remoteSha = '';
      state.remoteExamId = '';
      state.bankSha = '';
      renderRepositorySelector();
      await loadAssets(false);
    }
    await loadExam(asset.filename, { confirm: false, propagate: true });
  }

  function newExam() {
    if (!window.confirm('Utworzyć nowy egzamin? Bieżący draft pozostanie tylko w historii przeglądarki.')) return;
    state.exam = modelApi.createExam();
    state.remoteSha = '';
    state.remoteExamId = '';
    state.selectedQuestionId = state.exam.questions[0]?.questionId || '';
    state.report = null;
    state.attemptReport = null;
    state.tab = 'information';
    saveDrafts();
    render();
    renderLibrary();
  }

  function render() {
    if (!state.exam || !elements.editor) return;
    state.mediaObjectUrls.splice(0).forEach((url) => URL.revokeObjectURL(url));
    elements.tabs.querySelectorAll('[data-exam-tab]').forEach((button) => {
      const active = button.dataset.examTab === state.tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    elements.editorTitle.textContent = TAB_LABELS[state.tab] || 'Exam Builder';
    elements.badge.textContent = state.remoteSha
      ? state.exam.status === 'published' ? 'Opublikowany' : 'Draft w GitHubie'
      : 'Draft lokalny';
    elements.badge.dataset.status = state.exam.status;
    elements.editor.replaceChildren();
    const renderer = {
      information: renderInformation, questions: renderQuestions, bank: renderBank, display: renderDisplay,
      navigation: renderNavigation, time: renderTime, randomization: renderRandomization, scoring: renderScoring,
      attempts: renderAttempts, access: renderAccess, security: renderSecurity, results: renderResults, reports: renderReports
    }[state.tab] || renderInformation;
    renderer();
    renderSummary();
    elements.remove.disabled = !state.remoteSha || state.saving;
    elements.saveDraft.disabled = state.saving;
    elements.publish.disabled = state.saving;
  }

  function questionMediaTargets(question) {
    const targets = [{ value: 'question', label: 'Treść pytania' }];
    (question.options || []).forEach((option, index) => targets.push({
      value: `answer:${option.answerId}`,
      label: `Odpowiedź ${index + 1}: ${option.text || option.answerId}`
    }));
    (question.pairs || []).forEach((pair, index) => {
      targets.push({ value: `pair-left:${pair.pairId}`, label: `Dopasowanie ${index + 1} — lewa strona` });
      targets.push({ value: `pair-right:${pair.pairId}`, label: `Dopasowanie ${index + 1} — prawa strona` });
    });
    (question.items || []).forEach((item, index) => targets.push({
      value: `item:${item.itemId}`,
      label: `Kolejność ${index + 1}: ${item.text || item.itemId}`
    }));
    return targets;
  }

  function imagesForTarget(question, target) {
    if (!question) return [];
    if (target === 'question') return question.images;
    const separator = target.indexOf(':');
    const type = separator < 0 ? '' : target.slice(0, separator);
    const id = separator < 0 ? '' : target.slice(separator + 1);
    if (type === 'answer') return question.options?.find((option) => option.answerId === id)?.images || null;
    if (type === 'item') return question.items?.find((item) => item.itemId === id)?.images || null;
    const pair = question.pairs?.find((item) => item.pairId === id);
    if (type === 'pair-left') return pair?.leftImages || null;
    if (type === 'pair-right') return pair?.rightImages || null;
    return null;
  }

  function mediaPanel(scope, question = null) {
    const panel = create('div', 'exam-media-panel');
    panel.dataset.examMediaScope = scope;
    if (question) panel.dataset.questionId = question.questionId;
    const targets = scope === 'cover'
      ? [{ value: 'cover', label: 'Okładka egzaminu' }]
      : questionMediaTargets(question);
    if (!targets.some((target) => target.value === state.mediaTarget)) state.mediaTarget = targets[0].value;
    const heading = create('div', 'exam-media-heading');
    const headingCopy = create('div');
    headingCopy.append(
      create('strong', '', scope === 'cover' ? 'Obraz okładki' : 'Obrazy pytania i odpowiedzi'),
      create('small', '', 'PNG, JPG, WEBP, GIF lub bezpieczny SVG · maksymalnie 4 MB')
    );
    const libraryButton = create('button', 'mini-button', 'Media Manager');
    libraryButton.type = 'button';
    libraryButton.dataset.examAction = 'open-media-manager';
    heading.append(headingCopy, libraryButton);
    if (targets.length > 1) {
      const target = document.createElement('select');
      target.dataset.examMediaTarget = '1';
      targets.forEach((entry) => {
        const option = document.createElement('option');
        option.value = entry.value; option.textContent = entry.label; target.append(option);
      });
      target.value = state.mediaTarget;
      heading.append(target);
    }
    const inputNode = document.createElement('input');
    inputNode.type = 'file';
    inputNode.accept = 'image/png,image/jpeg,image/webp,image/gif';
    inputNode.hidden = true;
    inputNode.dataset.examMediaInput = '1';
    inputNode.multiple = scope !== 'cover';
    const dropzone = create('div', 'exam-media-dropzone');
    dropzone.tabIndex = 0;
    dropzone.setAttribute('role', 'button');
    dropzone.dataset.examAction = 'choose-media';
    dropzone.append(
      create('span', 'exam-media-drop-icon', '⇧'),
      create('strong', '', state.mediaUploading ? 'Wysyłanie obrazu…' : 'Przeciągnij obraz tutaj'),
      create('small', '', 'albo kliknij i wybierz plik · możesz też wkleić przez Ctrl/Cmd+V')
    );
    dropzone.setAttribute('aria-disabled', String(state.mediaUploading));
    const list = create('div', 'exam-media-list');
    const entries = scope === 'cover'
      ? (state.exam.metadata.cover?.ref ? [{ target: 'cover', label: 'Okładka', image: state.exam.metadata.cover }] : [])
      : targets.flatMap((target) => (imagesForTarget(question, target.value) || []).map((image) => ({ ...target, target: target.value, image })));
    entries.forEach((entry) => {
      const item = create('div', 'exam-media-item');
      const preview = document.createElement('img');
      preview.alt = ''; preview.hidden = true;
      preview.setAttribute('aria-hidden', 'true');
      if (state.remoteSha) void loadMediaThumbnail(preview, entry.image.ref);
      const copy = create('div', 'exam-media-copy');
      copy.append(create('small', '', entry.label), create('code', '', entry.image.ref));
      const alt = document.createElement('input');
      alt.type = 'text'; alt.value = entry.image.alt || ''; alt.placeholder = 'Opis ALT';
      alt.dataset.examMediaAlt = '1'; alt.dataset.mediaTarget = entry.target; alt.dataset.mediaRef = entry.image.ref;
      copy.append(alt);
      const remove = create('button', 'mini-button is-danger', scope === 'cover' ? 'Usuń okładkę' : 'Usuń z pytania');
      remove.type = 'button'; remove.dataset.examAction = 'remove-media-reference';
      remove.dataset.mediaTarget = entry.target; remove.dataset.mediaRef = entry.image.ref;
      item.append(preview, copy, remove); list.append(item);
    });
    if (!entries.length) list.append(create('p', 'exam-media-empty', 'Nie dodano jeszcze obrazu.'));
    panel.append(heading, inputNode, dropzone, list, create('p', 'exam-media-note', 'Usuń referencję tutaj albo otwórz Media Manager, aby zarządzać plikami w photos i assets/shared.'));
    return panel;
  }

  function openExamMediaManager(panel) {
    if (!panel || !window.ChemMediaManager?.open) {
      elements.status.className = 'exam-builder-status is-error';
      elements.status.textContent = 'Media Manager jest chwilowo niedostępny.';
      return;
    }
    const target = panel.dataset.examMediaScope === 'cover'
      ? 'cover'
      : panel.querySelector('[data-exam-media-target]')?.value || state.mediaTarget || 'question';
    const canUseLocal = Boolean(state.remoteSha && state.remoteExamId === state.exam.examId);
    void window.ChemMediaManager.open({
      scope: canUseLocal ? 'local' : 'shared',
      materialKind: canUseLocal ? 'exam' : '',
      materialId: canUseLocal ? state.exam.examId : '',
      repositoryId: state.repositoryId,
      onSelect(asset) {
        const image = {
          ref: asset.reference,
          alt: String(asset.filename || 'Ilustracja').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 300)
        };
        if (panel.dataset.examMediaScope === 'cover') state.exam.metadata.cover = image;
        else {
          const images = imagesForTarget(mediaQuestion(panel), target) || imagesForTarget(mediaQuestion(panel), 'question');
          if (images && !images.some((entry) => entry.ref === image.ref)) images.push(image);
        }
        saveDrafts();
        render();
        elements.badge.textContent = 'Niezapisane zmiany';
      }
    });
  }

  async function loadMediaThumbnail(image, ref) {
    try {
      const token = await window.ChemAuth.getAccessToken();
      const url = new URL('/.netlify/functions/exam', window.location.origin);
      url.search = new URLSearchParams({ action: 'image', repo: state.repositoryId, exam: state.exam.examId, ref, preview: '1' });
      const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) return;
      const objectUrl = URL.createObjectURL(await response.blob());
      if (!image.isConnected) { URL.revokeObjectURL(objectUrl); return; }
      state.mediaObjectUrls.push(objectUrl);
      image.src = objectUrl; image.hidden = false;
    } catch (_) {}
  }

  function renderInformation() {
    const main = section('Definicja egzaminu', 'Identyfikator jest częścią stabilnej ścieżki w prywatnym repozytorium.');
    main.append(
      row(
        field('ID egzaminu', input('examId', state.exam.examId, { placeholder: 'np. alkohole-proba-1', maxLength: 80 }), 'Małe litery, cyfry i myślniki.'),
        field('Nazwa', input('metadata.name', state.exam.metadata.name, { maxLength: 180 }))
      ),
      field('Opis', textarea('metadata.description', state.exam.metadata.description, { rows: 4 })),
      field('Instrukcja dla ucznia', textarea('metadata.instruction', state.exam.metadata.instruction, { rows: 7 })),
      row(
        field('Próg zaliczenia (%)', input('metadata.passThreshold', state.exam.metadata.passThreshold, { type: 'number', min: 0, max: 100, step: .1 })),
        field('Kategorie', input('metadata.categories', state.exam.metadata.categories.join(', '), { placeholder: 'organiczna, powtórka' }))
      ),
      field('Tagi', input('metadata.tags', state.exam.metadata.tags.join(', '), { placeholder: 'matura, dział 3' }))
    );
    const messages = section('Komunikaty', 'Widoczne przed startem i po bezpiecznym zapisaniu wyniku.');
    messages.append(
      field('Przed rozpoczęciem', textarea('metadata.beforeStartMessage', state.exam.metadata.beforeStartMessage, { rows: 4 })),
      field('Po zakończeniu', textarea('metadata.afterFinishMessage', state.exam.metadata.afterFinishMessage, { rows: 4 })),
      mediaPanel('cover'),
      field('ALT okładki', input('metadata.cover.alt', state.exam.metadata.cover?.alt || '', { placeholder: 'Opis okładki' }))
    );
    elements.editor.append(main, messages);
  }

  function renderQuestions() {
    const header = section('Pytania egzaminu', 'Pytania własne są zapisane w exam.json. Referencje do banku pozostają współdzielone.');
    const actions = create('div', 'exam-inline-actions');
    const add = create('button', 'button button-primary', '＋ Dodaj pytanie');
    add.type = 'button'; add.dataset.examAction = 'add-question';
    actions.append(add, create('span', 'exam-count-copy', `${state.exam.questions.length} własnych · ${state.exam.questionRefs.length} z banku`));
    header.append(actions);
    const list = create('div', 'exam-question-list');
    state.exam.questions.forEach((question, index) => list.append(questionCard(question, index, false)));
    state.exam.questionRefs.forEach((questionId, index) => {
      const question = state.bank.questions.find((candidate) => candidate.questionId === questionId);
      const card = questionCard(question || { questionId, type: 'single_choice', prompt: 'Brak pytania w banku' }, state.exam.questions.length + index, true);
      list.append(card);
    });
    elements.editor.append(header, list);
    const selected = state.exam.questions.find((question) => question.questionId === state.selectedQuestionId);
    if (selected) elements.editor.append(renderQuestionEditor(selected, 'exam'));
  }

  function questionCard(question, index, bankReference) {
    const card = create('article', 'exam-question-card');
    card.classList.toggle('is-selected', question.questionId === state.selectedQuestionId || question.questionId === state.selectedBankQuestionId);
    const copy = create('button', 'exam-question-select');
    copy.type = 'button';
    copy.dataset.examAction = bankReference ? 'select-bank-reference' : 'select-question';
    copy.dataset.questionId = question.questionId;
    copy.append(create('small', '', `${index + 1}. ${TYPE_LABELS[question.type] || question.type}${bankReference ? ' · bank' : ''}`), create('strong', '', question.prompt || question.template || question.questionId));
    const actions = create('span', 'exam-question-actions');
    if (!bankReference) {
      for (const [action, label] of [['duplicate-question', 'Duplikuj'], ['delete-question', 'Usuń']]) {
        const button = create('button', action.includes('delete') ? 'mini-button is-danger' : 'mini-button', label);
        button.type = 'button'; button.dataset.examAction = action; button.dataset.questionId = question.questionId;
        actions.append(button);
      }
    } else {
      const button = create('button', 'mini-button is-danger', 'Usuń odwołanie');
      button.type = 'button'; button.dataset.examAction = 'remove-bank-reference'; button.dataset.questionId = question.questionId;
      actions.append(button);
    }
    card.append(copy, actions);
    return card;
  }

  function renderQuestionEditor(question, scope) {
    const editor = section('Edytuj pytanie', `Stable questionId: ${question.questionId}`);
    editor.classList.add('exam-question-editor');
    editor.dataset.questionScope = scope;
    editor.dataset.questionId = question.questionId;
    editor.append(
      row(
        field('Typ pytania', select('@type', question.type, Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })))),
        field('questionId', input('@questionId', question.questionId, { maxLength: 128 }))
      ),
      field('Treść pytania', textarea('@prompt', question.prompt, { rows: 5 })),
      row(
        field('Kategorie', input('@categories', question.categories.join(', '))),
        field('Tagi', input('@tags', question.tags.join(', ')))
      ),
      row(
        field('Punkty', input('@points', question.points, { type: 'number', min: 0, max: 10000, step: .1 })),
        field('Punkty ujemne', input('@negativePoints', question.negativePoints, { type: 'number', min: 0, max: 10000, step: .1 }))
      ),
      scope === 'exam'
        ? mediaPanel('question', question)
        : field('Obrazy', textarea('@images', imagesToText(question.images), { rows: 3, placeholder: 'photos/schemat.png | Opis ALT' }), 'Jedna stabilna referencja i ALT w wierszu.'),
      ...questionTypeFields(question),
      field('Wyjaśnienie po wyniku', textarea('@explanation', question.explanation, { rows: 4 }))
    );
    return editor;
  }

  function questionTypeFields(question) {
    if (Array.isArray(question.options)) {
      return [
        field(
          'Odpowiedzi',
          textarea('@options', question.options.map((option) => (
            `${option.answerId} | ${option.text} | ${answerImagesToText(option.images)}`
          )).join('\n'), { rows: 7 }),
          'Format: answerId | treść | photos/obraz.png :: ALT; photos/drugi.webp :: ALT. Obrazy są opcjonalne, ID pozostaje stabilne.'
        ),
        field(question.type === 'multiple_choice' ? 'Poprawne answerId' : 'Poprawne answerId', input('@correctAnswerIds', question.correctAnswerIds.join(', ')), 'Dla wielu odpowiedzi rozdziel przecinkami.')
      ];
    }
    if (question.type === 'short_text') return [
      field('Akceptowane odpowiedzi', textarea('@acceptedAnswers', question.acceptedAnswers.join('\n'), { rows: 5 })),
      checkbox('@caseInsensitive', question.caseInsensitive, 'Ignoruj wielkość liter')
    ];
    if (question.type === 'number') return [row(
      field('Poprawna liczba', input('@correctNumber', question.correctNumber, { type: 'number', step: 'any' })),
      field('Tolerancja ±', input('@tolerance', question.tolerance, { type: 'number', min: 0, step: 'any' }))
    )];
    if (question.type === 'matching') return [field('Pary', textarea('@pairs', question.pairs.map((pair) => `${pair.left} => ${pair.right}`).join('\n'), { rows: 8 }), 'Jedna para w wierszu: lewa => prawa.')];
    if (question.type === 'ordering') return [field('Poprawna kolejność', textarea('@items', question.items.map((item) => item.text).join('\n'), { rows: 8 }), 'Kolejność w edytorze jest kluczem; klient otrzymuje pozycje przetasowane.')];
    return [
      field('Tekst z lukami', textarea('@template', question.template, { rows: 5 }), 'Użyj znaczników {{luka}}.'),
      field('Odpowiedzi do luk', textarea('@blanks', question.blanks.map((blank) => `${blank.blankId} | ${blank.acceptedAnswers.join('; ')}`).join('\n'), { rows: 6 }), 'Format: blankId | odpowiedź; alias')
    ];
  }

  function renderBank() {
    const main = section('Wspólny bank pytań', 'Pytania są zapisywane raz w exams/question-bank.json i mogą być używane w wielu egzaminach.');
    const tools = create('div', 'exam-inline-actions');
    const add = create('button', 'button button-primary', '＋ Nowe pytanie w banku');
    add.type = 'button'; add.dataset.examAction = 'add-bank-question';
    const search = input('', '', { placeholder: 'Filtruj po treści, tagu lub kategorii…' });
    search.removeAttribute('data-exam-path'); search.dataset.bankSearch = '1';
    tools.append(add, search);
    main.append(tools);
    const list = create('div', 'exam-question-list');
    list.dataset.bankList = '1';
    state.bank.questions.forEach((question, index) => list.append(bankCard(question, index)));
    main.append(list);
    elements.editor.append(main);
    const selected = state.bank.questions.find((question) => question.questionId === state.selectedBankQuestionId);
    if (selected) elements.editor.append(renderQuestionEditor(selected, 'bank'));
  }

  function bankCard(question, index) {
    const card = questionCard(question, index, false);
    const actions = card.querySelector('.exam-question-actions');
    actions.replaceChildren();
    for (const [action, label, danger] of [
      ['use-bank-question', state.exam.questionRefs.includes(question.questionId) ? 'Dodane' : 'Dodaj do egzaminu', false],
      ['duplicate-bank-question', 'Duplikuj', false],
      ['delete-bank-question', 'Usuń', true]
    ]) {
      const button = create('button', `mini-button${danger ? ' is-danger' : ''}`, label);
      button.type = 'button'; button.dataset.examAction = action; button.dataset.questionId = question.questionId;
      if (action === 'use-bank-question' && state.exam.questionRefs.includes(question.questionId)) button.disabled = true;
      actions.append(button);
    }
    card.querySelector('[data-exam-action]').dataset.examAction = 'select-bank-question';
    return card;
  }

  function renderDisplay() {
    const main = section('Wyświetlanie pytań', 'Układ nie wpływa na klucz odpowiedzi ani punktację.');
    main.append(
      field('Tryb', select('display.mode', state.exam.display.mode, [
        { value: 'one', label: 'Jedno pytanie na ekran' },
        { value: 'page', label: 'X pytań na ekran' },
        { value: 'all', label: 'Wszystkie pytania' }
      ])),
      field('Pytań na ekran', input('display.questionsPerPage', state.exam.display.questionsPerPage, { type: 'number', min: 1, max: 100 }), 'Używane tylko w trybie X pytań.')
    );
    elements.editor.append(main);
  }

  function renderNavigation() {
    const main = section('Nawigacja', 'Każde ograniczenie jest ponownie sprawdzane po stronie serwera.');
    main.append(
      checkbox('navigation.allowBack', state.exam.navigation.allowBack, 'Pozwól cofać się do wcześniejszych pytań'),
      checkbox('navigation.allowFreeNavigation', state.exam.navigation.allowFreeNavigation, 'Pozwól przechodzić dowolnie przez navigator'),
      checkbox('navigation.allowSkip', state.exam.navigation.allowSkip, 'Pozwól pomijać pytania'),
      checkbox('navigation.requireAnswerBeforeNext', state.exam.navigation.requireAnswerBeforeNext, 'Wymagaj odpowiedzi przed przejściem dalej'),
      checkbox('navigation.allowFlagging', state.exam.navigation.allowFlagging, 'Pozwól oznaczyć pytanie do późniejszego sprawdzenia')
    );
    elements.editor.append(main);
  }

  function renderTime() {
    const main = section('Czas', 'Serwer zapisuje startedAt i expiresAt. Zegar przeglądarki ma wyłącznie funkcję informacyjną.');
    main.append(
      field('Limit', select('timing.mode', state.exam.timing.mode, [
        { value: 'none', label: 'Bez limitu' }, { value: 'exam', label: 'Limit całego egzaminu' }, { value: 'question', label: 'Limit każdego pytania' }
      ])),
      row(
        field('Limit egzaminu (sekundy)', input('timing.limitSeconds', state.exam.timing.limitSeconds, { type: 'number', min: 1 })),
        field('Limit pytania (sekundy)', input('timing.questionLimitSeconds', state.exam.timing.questionLimitSeconds, { type: 'number', min: 1 }))
      ),
      field('Wyświetlanie czasu', select('timing.display', state.exam.timing.display, [
        { value: 'countdown', label: 'Odliczanie' }, { value: 'countup', label: 'Czas od startu' }, { value: 'hidden', label: 'Ukryty' }
      ]))
    );
    elements.editor.append(main);
  }

  function renderRandomization() {
    const main = section('Losowanie', 'Dokładny zestaw pytań i kolejność odpowiedzi są utrwalane przy tworzeniu próby.');
    main.append(
      checkbox('randomization.questionOrder', state.exam.randomization.questionOrder, 'Losuj kolejność pytań'),
      checkbox('randomization.answerOrder', state.exam.randomization.answerOrder, 'Losuj kolejność odpowiedzi'),
      field('Liczba pytań z całej puli', input('randomization.totalQuestions', state.exam.randomization.totalQuestions ?? '', { type: 'number', min: 1, max: 500 }), 'Puste pole oznacza wszystkie pytania.'),
      field('Limity kategorii', textarea('randomization.categoryQuotas', state.exam.randomization.categoryQuotas.map((quota) => `${quota.category}: ${quota.count}`).join('\n'), { rows: 6, placeholder: 'organiczna: 5\nnieorganiczna: 5' }))
    );
    elements.editor.append(main);
  }

  function renderScoring() {
    const main = section('Punktacja', 'Klient nie otrzymuje ukrytych reguł ani odpowiedzi. Wynik oblicza Function po zakończeniu.');
    main.append(
      checkbox('scoring.equalPoints', state.exam.scoring.equalPoints, 'Jednakowe punkty dla wszystkich pytań'),
      field('Domyślne punkty', input('scoring.defaultPoints', state.exam.scoring.defaultPoints, { type: 'number', min: 0, step: .1 })),
      checkbox('scoring.partialPoints', state.exam.scoring.partialPoints, 'Przyznawaj punkty częściowe'),
      checkbox('scoring.negativePointsEnabled', state.exam.scoring.negativePointsEnabled, 'Włącz punkty ujemne'),
      field('Domyślna kara', input('scoring.defaultNegativePoints', state.exam.scoring.defaultNegativePoints, { type: 'number', min: 0, step: .1 })),
      field('Strategia multiple choice', select('scoring.multipleChoiceStrategy', state.exam.scoring.multipleChoiceStrategy, [
        { value: 'all_or_nothing', label: 'Wszystko albo nic' },
        { value: 'per_option', label: 'Za każdą prawidłową decyzję' },
        { value: 'correct_minus_incorrect', label: 'Poprawne minus błędne zaznaczenia' }
      ]))
    );
    elements.editor.append(main);
  }

  function renderAttempts() {
    const main = section('Próby', 'Limity i cooldown są egzekwowane atomowo w Netlify Blobs.');
    main.append(
      field('Liczba prób', select('attempts.mode', state.exam.attempts.mode, [
        { value: 'one', label: 'Jedna próba' }, { value: 'limited', label: 'Określona liczba' }, { value: 'unlimited', label: 'Bez limitu' }
      ])),
      row(
        field('Maksymalna liczba', input('attempts.maxAttempts', state.exam.attempts.maxAttempts, { type: 'number', min: 1, max: 1000 })),
        field('Cooldown (sekundy)', input('attempts.cooldownSeconds', state.exam.attempts.cooldownSeconds, { type: 'number', min: 0 }))
      ),
      field('Wynik wielu prób', select('attempts.resultStrategy', state.exam.attempts.resultStrategy, [
        { value: 'best', label: 'Najlepszy' }, { value: 'first', label: 'Pierwszy' }, { value: 'last', label: 'Ostatni' }, { value: 'average', label: 'Średnia' }
      ]))
    );
    elements.editor.append(main);
  }

  function renderAccess() {
    const main = section('Dostępność', 'Dostęp jest weryfikowany przy każdym rozpoczęciu i wznowieniu próby. Użytkownik nadal musi mieć aktywny dostęp do kursu.');
    main.append(
      field('Okno dostępności', select('availability.mode', state.exam.availability.mode, [
        { value: 'always', label: 'Zawsze' }, { value: 'from', label: 'Od daty' }, { value: 'until', label: 'Do daty' }, { value: 'range', label: 'Zakres dat' }
      ])),
      row(
        field('Od', input('availability.from', dateTimeLocal(state.exam.availability.from), { type: 'datetime-local' })),
        field('Do', input('availability.until', dateTimeLocal(state.exam.availability.until), { type: 'datetime-local' }))
      ),
      field('Odbiorcy egzaminu', select('availability.audienceMode', state.exam.availability.audienceMode, [
        { value: 'all', label: 'Wszyscy użytkownicy z dostępem do kursu' },
        { value: 'selected', label: 'Tylko wybrane osoby' }
      ]), state.exam.availability.audienceMode === 'all'
        ? 'Egzamin będzie dostępny wszystkim uprawnionym osobom w ustawionym oknie czasu.'
        : 'Dostęp otrzymają wyłącznie zaznaczone konta.')
    );
    if (state.exam.availability.audienceMode === 'selected') main.append(audiencePicker());
    elements.editor.append(main);
  }

  function audiencePicker() {
    const wrapper = create('div', 'exam-audience-picker');
    const selected = create('div', 'exam-audience-selected');
    if (!state.exam.availability.userIds.length) {
      selected.append(create('p', 'exam-audience-empty', 'Nie wybrano jeszcze żadnej osoby.'));
    } else {
      state.exam.availability.userIds.forEach((userId) => {
        const user = state.users.find((candidate) => candidate.id === userId);
        const chip = create('span', 'exam-audience-chip');
        const copy = create('span');
        copy.append(create('strong', '', userLabel(user, userId)), create('small', '', user?.email || userId));
        const remove = create('button', '', '×');
        remove.type = 'button'; remove.title = `Usuń ${userLabel(user, userId)}`;
        remove.setAttribute('aria-label', remove.title);
        remove.dataset.examAction = 'remove-audience-user'; remove.dataset.userId = userId;
        chip.append(copy, remove); selected.append(chip);
      });
    }
    const search = document.createElement('input');
    search.type = 'search'; search.placeholder = 'Szukaj po imieniu, nazwisku, e-mailu lub ID…';
    search.autocomplete = 'off'; search.value = state.userQuery; search.dataset.audienceSearch = '1';
    const searchField = field('Znajdź użytkownika', search, 'Lista pochodzi z Netlify Identity. W exam.json zapisywane jest wyłącznie stabilne ID konta.');
    const status = create('p', 'exam-audience-status'); status.dataset.audienceStatus = '1';
    status.textContent = audienceStatus();
    const results = create('div', 'exam-audience-results'); results.dataset.audienceResults = '1';
    renderAudienceResults(results);
    wrapper.append(create('strong', 'exam-audience-heading', `Wybrane osoby (${state.exam.availability.userIds.length})`), selected, searchField, status, results);
    if (state.usersHasMore && !state.usersLoading) {
      const all = create('button', 'button button-soft', 'Wczytaj całą listę użytkowników');
      all.type = 'button'; all.dataset.examAction = 'load-audience-users'; wrapper.append(all);
    }
    return wrapper;
  }

  function renderAudienceResults(host) {
    if (!host) return;
    const query = state.userQuery.trim().toLocaleLowerCase('pl');
    const selected = new Set(state.exam.availability.userIds);
    const matches = state.users.filter((user) => {
      if (selected.has(user.id)) return false;
      const haystack = `${user.fullName || ''} ${user.firstName || ''} ${user.lastName || ''} ${user.email || ''} ${user.id}`.toLocaleLowerCase('pl');
      return !query || haystack.includes(query);
    }).slice(0, 50);
    host.replaceChildren(...matches.map((user) => {
      const button = create('button', 'exam-audience-user');
      button.type = 'button'; button.dataset.examAction = 'add-audience-user'; button.dataset.userId = user.id;
      const copy = create('span');
      copy.append(create('strong', '', userLabel(user, user.id)), create('small', '', `${user.email || 'Brak e-maila'} · ${user.id}`));
      const role = create('span', 'exam-audience-role', userAccessLabel(user));
      button.append(copy, role); return button;
    }));
    if (!matches.length) {
      host.append(create('p', 'exam-audience-empty', state.usersLoading
        ? 'Wczytuję użytkowników…'
        : query ? 'Brak pasujących, niewybranych użytkowników.' : 'Brak kolejnych użytkowników do wybrania.'));
    }
  }

  function userLabel(user, fallback) {
    return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || fallback;
  }

  function userAccessLabel(user) {
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    if (roles.includes('admin')) return 'Administrator';
    if (roles.includes('active') || user?.timedAccess?.active) return 'Dostęp aktywny';
    return 'Brak aktywnego dostępu';
  }

  function audienceStatus() {
    if (state.usersError) return state.usersError;
    if (state.usersLoading) return `Wczytuję konta… obecnie ${state.users.length}.`;
    if (!state.users.length) return 'Lista użytkowników nie została jeszcze pobrana.';
    const total = state.usersTotal == null ? '' : ` z ${state.usersTotal}`;
    return state.usersHasMore
      ? `Wczytano ${state.users.length}${total}. Wpisz frazę, aby automatycznie przeszukać całą listę.`
      : `Przeszukiwana jest pełna lista ${state.users.length} kont.`;
  }

  function renderSecurity() {
    const main = section('Opuszczenie egzaminu', 'Zdarzenia karty są pomocnicze i nie są przedstawiane jako pełny proctoring.');
    main.append(field('Zasada opuszczenia', select('security.leavePolicy', state.exam.security.leavePolicy, [
      { value: 'allow_resume', label: 'Pozwól wrócić' },
      { value: 'end_attempt', label: 'Zakończ próbę po zgłoszeniu opuszczenia' },
      { value: 'warn', label: 'Ostrzeż i loguj' },
      { value: 'log', label: 'Tylko loguj zdarzenie' }
    ])));
    const note = create('div', 'exam-security-note');
    note.append(create('strong', '', 'Granica techniczna'), create('p', '', 'Przeglądarka nie gwarantuje wykrycia zamknięcia karty. Serwer zawsze zachowuje stan próby i wymusza własny timer.'));
    main.append(note);
    elements.editor.append(main);
  }

  function renderResults() {
    const main = section('Odpowiedzi i wynik', 'Klucz odpowiedzi jest zwracany przez serwer wyłącznie zgodnie z wybranym trybem. Aktywna próba nie otrzymuje klucza do niezatwierdzonych pytań.');
    main.append(field('Kiedy uczeń może zobaczyć prawidłową odpowiedź?', select('resultVisibility.feedbackMode', state.exam.resultVisibility.feedbackMode, [
      { value: 'immediate', label: 'Od razu po zatwierdzeniu odpowiedzi' },
      { value: 'after_submit', label: 'Dopiero po zakończeniu całego testu' },
      { value: 'never', label: 'Nigdy — pełny wynik tylko dla administratora' }
    ]), state.exam.resultVisibility.feedbackMode === 'immediate'
      ? 'Uczeń zatwierdza pytanie osobnym przyciskiem. Po ujawnieniu odpowiedzi nie może już jej zmienić.'
      : state.exam.resultVisibility.feedbackMode === 'after_submit'
        ? 'Prawidłowe odpowiedzi pojawią się dopiero po bezpiecznym zakończeniu próby.'
        : 'Uczeń otrzyma tylko potwierdzenie zapisania próby. Wynik pozostanie w raporcie administratora.'));
    if (state.exam.resultVisibility.feedbackMode === 'never') {
      const note = create('div', 'exam-security-note');
      if (state.exam.resultVisibility.studentResultVisible) {
        note.append(create('strong', '', 'Ustawienie zgodności starszego egzaminu'), create('p', '', 'Prawidłowe odpowiedzi są ukryte, ale starsza konfiguracja nadal pozwala pokazać część podsumowania. Wyłącz poniższy przełącznik, aby pełny wynik widział tylko administrator.'));
        main.append(note, checkbox('resultVisibility.studentResultVisible', true, 'Pokaż uczniowi podsumowanie bez prawidłowych odpowiedzi'));
      } else {
        note.append(create('strong', '', 'Tryb poufny'), create('p', '', 'Uczeń nie zobaczy procentu, punktów, zaliczenia, prawidłowych odpowiedzi ani wyjaśnień. Administrator nadal ma pełny raport i klucz odpowiedzi.'));
        main.append(note);
      }
      elements.editor.append(main); return;
    }
    const labels = {
      scorePercent: 'Procent wyniku', points: 'Punkty', passFail: 'Zaliczono / nie zaliczono', ownAnswers: 'Własne odpowiedzi',
      explanations: state.exam.resultVisibility.feedbackMode === 'immediate' ? 'Wyjaśnienie od razu po zatwierdzeniu' : 'Wyjaśnienia po zakończeniu', time: 'Czas próby'
    };
    Object.entries(labels).forEach(([key, label]) => main.append(checkbox(`resultVisibility.${key}`, state.exam.resultVisibility[key], label)));
    elements.editor.append(main);
  }

  function renderReports() {
    const main = section('Raport egzaminu', 'Dane są liczone z indeksu prób — bez skanowania całego magazynu Blobs.');
    const refresh = create('button', 'button button-soft', state.reportLoading ? 'Pobieranie…' : '↻ Odśwież raport');
    refresh.type = 'button'; refresh.dataset.examAction = 'refresh-report'; refresh.disabled = state.reportLoading || !state.remoteSha;
    main.append(refresh);
    if (!state.remoteSha) main.append(create('p', 'exam-report-empty', 'Najpierw zapisz egzamin w GitHubie.'));
    else if (!state.report) main.append(create('p', 'exam-report-empty', state.reportLoading ? 'Pobieram próby i analizę pytań…' : 'Kliknij „Odśwież raport”.'));
    else main.append(reportView(state.report));
    elements.editor.append(main);
  }

  function reportView(report) {
    const wrapper = create('div', 'exam-report-view');
    const metrics = create('div', 'exam-report-metrics');
    const values = [
      ['Uczestnicy', report.metrics.participants], ['Próby', report.metrics.attempts], ['Średnia', `${report.metrics.average}%`],
      ['Mediana', `${report.metrics.median}%`], ['Min / max', `${report.metrics.minimum}% / ${report.metrics.maximum}%`],
      ['Zdawalność', `${report.metrics.passRate}%`], ['Średni czas', formatDuration(report.metrics.averageTimeSeconds)]
    ];
    values.forEach(([label, value]) => {
      const card = create('article'); card.append(create('small', '', label), create('strong', '', value)); metrics.append(card);
    });
    const attempts = create('div', 'exam-report-table');
    attempts.append(create('h4', '', 'Próby uczestników'));
    report.attempts.slice(0, 100).forEach((attempt) => {
      const line = create('button'); line.type = 'button'; line.dataset.examAction = 'open-attempt-report'; line.dataset.attemptId = attempt.attemptId; line.dataset.userId = attempt.userId;
      const outcome = attempt.status === 'active' ? 'w trakcie'
        : attempt.passed == null ? 'brak statusu' : attempt.passed ? 'zaliczona' : 'niezaliczona';
      const score = attempt.scorePercent == null ? 'wynik —' : `${attempt.scorePercent}%`;
      line.append(create('span', '', attempt.profile?.name || attempt.profile?.email || attempt.userId), create('span', '', `Próba ${attempt.number} · ${score} · ${outcome}`));
      attempts.append(line);
    });
    const distribution = create('section', 'exam-score-distribution');
    distribution.append(create('h4', '', 'Rozkład wyników'));
    const maximumBucket = Math.max(1, ...Object.values(report.metrics.distribution || {}).map(Number));
    Object.entries(report.metrics.distribution || {}).forEach(([label, count]) => {
      const line = create('div');
      const track = create('span', 'exam-score-track');
      const bar = create('i'); bar.style.width = `${Math.max(3, Number(count) / maximumBucket * 100)}%`; track.append(bar);
      line.append(create('small', '', `${label}%`), track, create('strong', '', count)); distribution.append(line);
    });
    const analysis = create('div', 'exam-question-analysis');
    for (const [title, questions] of [
      ['Najtrudniejsze pytania', report.questionAnalysis?.hardest || []],
      ['Najłatwiejsze pytania', report.questionAnalysis?.easiest || []]
    ]) {
      const group = create('section'); group.append(create('h4', '', title));
      questions.slice(0, 6).forEach((question) => {
        const item = create('div');
        item.append(
          create('span', '', question.prompt || question.questionId),
          create('strong', '', `${question.correctPercent}% poprawnych · ${question.answerCount} odpowiedzi`)
        );
        if (question.commonDistractor) item.title = `Najczęstsza błędna odpowiedź: ${question.commonDistractor.answer}`;
        group.append(item);
      });
      analysis.append(group);
    }
    wrapper.append(metrics, distribution, attempts, analysis);
    if (state.attemptReport) wrapper.append(attemptReportView(state.attemptReport));
    return wrapper;
  }

  function attemptReportView(attempt) {
    const report = create('section', 'exam-attempt-report');
    const heading = create('header');
    const copy = create('div');
    copy.append(
      create('small', '', 'Raport szczegółowy próby'),
      create('h3', '', `${attempt.profile?.name || attempt.profile?.email || attempt.userId} · próba ${attempt.number}`),
      create('p', '', attempt.status === 'active'
        ? `W trakcie · odpowiedzi ${Object.keys(attempt.answers || {}).length}/${attempt.questions?.length || 0}`
        : `${attempt.result?.scorePercent ?? '—'}% · ${attempt.result?.passed == null ? 'brak statusu' : attempt.result.passed ? 'zaliczona' : 'niezaliczona'} · ${formatDuration(attempt.durationSeconds)}`)
    );
    const reset = create('button', 'button button-danger', 'Resetuj próbę');
    reset.type = 'button'; reset.dataset.examAction = 'reset-attempt'; reset.dataset.userId = attempt.userId; reset.dataset.attemptId = attempt.attemptId;
    heading.append(copy, reset); report.append(heading);
    const signalTypes = new Set(['cursor_leave', 'copy', 'paste', 'context_menu']);
    const signals = (attempt.events || []).filter((entry) => signalTypes.has(entry.type));
    const signalBox = document.createElement('details');
    signalBox.className = `exam-attempt-alerts${signals.length ? ' has-alerts' : ''}`;
    const signalSummary = document.createElement('summary');
    signalSummary.append(
      create('span', '', signals.length ? `Sygnały wymagające uwagi — ${signals.length}` : 'Sygnały wymagające uwagi — brak'),
      create('strong', '', signals.length ? 'Sprawdź' : 'OK')
    );
    signalBox.append(
      signalSummary,
      create('p', 'exam-attempt-alert-note', 'Są to pomocnicze sygnały z przeglądarki, a nie dowód niesamodzielnej pracy. Wyjście kursorem może oznaczać także użycie paska przeglądarki.')
    );
    signals.forEach((entry) => signalBox.append(attemptEventRow(entry, true)));
    report.append(signalBox);
    (attempt.questions || []).forEach((question, index) => {
      const graded = attempt.result?.questionResults?.find((entry) => entry.questionId === question.questionId);
      const details = document.createElement('details'); details.className = 'exam-attempt-question';
      const summary = document.createElement('summary');
      summary.append(
        create('span', '', `${index + 1}. ${question.prompt || question.template}`),
        create('strong', '', `${graded?.points ?? 0}/${graded?.maxPoints ?? question.points} pkt`)
      );
      const answer = create('pre', '', `Odpowiedź ucznia:\n${JSON.stringify(attempt.answers?.[question.questionId] ?? null, null, 2)}\n\nKlucz odpowiedzi:\n${JSON.stringify(answerKey(question), null, 2)}`);
      details.append(summary, answer);
      if (question.explanation) details.append(create('p', '', question.explanation));
      report.append(details);
    });
    const ordinaryEvents = (attempt.events || []).filter((entry) => !signalTypes.has(entry.type));
    const events = document.createElement('details'); events.className = 'exam-attempt-events';
    const eventSummary = document.createElement('summary'); eventSummary.textContent = `Pozostałe zdarzenia próby (${ordinaryEvents.length})`;
    events.append(eventSummary);
    ordinaryEvents.forEach((entry) => events.append(attemptEventRow(entry, false)));
    report.append(events);
    return report;
  }

  function attemptEventRow(entry, alert) {
    const labels = {
      start: 'Rozpoczęcie próby', resume: 'Wznowienie próby', refresh: 'Odświeżenie strony',
      leave: 'Opuszczenie strony', timeout: 'Upłynięcie czasu', submit: 'Zakończenie próby',
      visibility_hidden: 'Ukrycie karty', visibility_visible: 'Powrót do karty',
      cursor_leave: 'Kursor opuścił obszar strony', copy: 'Kopiowanie', paste: 'Wklejanie',
      context_menu: 'Otwarcie menu prawego przycisku', save_answer: 'Zapis odpowiedzi',
      change_question: 'Zmiana pytania', confirm_answer: 'Zatwierdzenie odpowiedzi'
    };
    const question = entry.index != null && Number.isSafeInteger(Number(entry.index)) && Number(entry.index) >= 0
      ? ` · pytanie ${Number(entry.index) + 1}` : '';
    return create(
      'p',
      alert ? 'exam-attempt-alert-row' : '',
      `${new Date(entry.timestamp).toLocaleString('pl-PL')} · ${labels[entry.type] || entry.type}${question}`
    );
  }

  function answerKey(question) {
    if (question.correctAnswerIds) return question.correctAnswerIds;
    if (question.acceptedAnswers) return question.acceptedAnswers;
    if (question.type === 'number') return { value: question.correctNumber, tolerance: question.tolerance };
    if (question.correctOrder) return question.correctOrder;
    if (question.pairs) return question.pairs.map((pair) => ({ left: pair.left, right: pair.right }));
    if (question.blanks) return question.blanks.map((blank) => ({ blankId: blank.blankId, acceptedAnswers: blank.acceptedAnswers }));
    return null;
  }

  function renderSummary() {
    const validation = modelApi.validateExam(state.exam);
    elements.validation.className = `exam-validation${validation.valid ? ' is-valid' : ' is-error'}`;
    elements.validation.textContent = validation.valid ? 'Definicja jest gotowa do zapisu.' : validation.errors[0].message;
    const inlineQuestions = state.exam.questions.length;
    const refs = state.exam.questionRefs.length;
    const maxPoints = state.exam.questions.reduce((sum, question) => sum + (state.exam.scoring.equalPoints ? state.exam.scoring.defaultPoints : question.points), 0);
    elements.summary.replaceChildren();
    [
      ['Status', state.exam.status === 'published' ? 'Opublikowany' : 'Draft'],
      ['Pytania', `${inlineQuestions + refs} (${refs} z banku)`],
      ['Punkty własnych pytań', maxPoints],
      ['Próg', `${state.exam.metadata.passThreshold}%`],
      ['Timer', state.exam.timing.mode === 'none' ? 'Bez limitu' : state.exam.timing.mode === 'exam' ? 'Cały egzamin' : 'Na pytanie'],
      ['Próby', state.exam.attempts.mode === 'unlimited' ? 'Bez limitu' : state.exam.attempts.mode === 'one' ? '1' : state.exam.attempts.maxAttempts]
    ].forEach(([label, value]) => {
      const item = create('div'); item.append(create('small', '', label), create('strong', '', value)); elements.summary.append(item);
    });
  }

  function handleInput(event) {
    const control = event.target.closest('[data-exam-path]');
    if (!control || !control.dataset.examPath) {
      if (event.target.dataset.bankSearch) filterBank(event.target.value);
      if (event.target.dataset.audienceSearch) {
        state.userQuery = event.target.value;
        renderAudienceResults(elements.editor.querySelector('[data-audience-results]'));
        const status = elements.editor.querySelector('[data-audience-status]');
        if (status) status.textContent = audienceStatus();
        window.clearTimeout(state.userSearchTimer);
        if (state.userQuery.trim().length >= 2 && state.usersHasMore) {
          state.userSearchTimer = window.setTimeout(() => void loadIdentityUsers(true), 250);
        }
      }
      return;
    }
    const value = control.type === 'checkbox' ? control.checked : control.value;
    if (control.dataset.examPath.startsWith('@')) updateQuestion(control, value);
    else updatePath(control.dataset.examPath, value, control.type);
    saveDrafts();
    renderSummary();
    elements.badge.textContent = 'Niezapisane zmiany';
  }

  function updatePath(path, raw, type) {
    const parts = path.split('.');
    let target = state.exam;
    while (parts.length > 1) target = target[parts.shift()];
    const key = parts[0];
    let value = raw;
    if (type === 'number') value = raw === '' ? null : Number(raw);
    if (['metadata.tags', 'metadata.categories', 'availability.userIds'].includes(path)) value = splitList(raw);
    if (path === 'availability.from' || path === 'availability.until') value = raw ? new Date(raw).toISOString() : null;
    if (path === 'randomization.categoryQuotas') value = String(raw).split('\n').map((line) => {
      const match = /^\s*(.+?):\s*(\d+)\s*$/.exec(line);
      return match ? { category: match[1].trim(), count: Number(match[2]) } : null;
    }).filter(Boolean);
    if (path === 'randomization.totalQuestions' && raw === '') value = null;
    if (path === 'resultVisibility.feedbackMode') {
      state.exam.resultVisibility.feedbackMode = value;
      state.exam.resultVisibility.studentResultVisible = value !== 'never';
      state.exam.resultVisibility.correctAnswers = value !== 'never';
      state.exam.resultVisibility.errors = value !== 'never';
      render();
      return;
    }
    if (path === 'availability.audienceMode') {
      target[key] = value;
      if (value === 'all') state.exam.availability.userIds = [];
      render();
      return;
    }
    if (path === 'resultVisibility.studentResultVisible') {
      target[key] = value;
      render();
      return;
    }
    if (path === 'examId') value = String(raw).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 80);
    if (path === 'metadata.cover.ref' || path === 'metadata.cover.alt') {
      state.exam.metadata.cover = state.exam.metadata.cover || { ref: '', alt: '' };
      state.exam.metadata.cover[key] = value;
      return;
    }
    target[key] = value;
  }

  function updateQuestion(control, raw) {
    const editor = control.closest('[data-question-id]');
    if (!editor) return;
    const collection = editor.dataset.questionScope === 'bank' ? state.bank.questions : state.exam.questions;
    const question = collection.find((candidate) => candidate.questionId === editor.dataset.questionId);
    if (!question) return;
    const fieldName = control.dataset.examPath.slice(1);
    if (fieldName === 'type') {
      const replacement = modelApi.createQuestion({ ...question, type: raw, questionId: question.questionId });
      collection.splice(collection.indexOf(question), 1, replacement);
      if (editor.dataset.questionScope === 'bank') state.bankDirty = true;
      render();
      return;
    }
    if (fieldName === 'questionId') {
      const nextId = String(raw).trim();
      if (modelApi.createQuestion({ questionId: nextId }).questionId !== nextId) return;
      const previous = question.questionId;
      question.questionId = nextId;
      if (editor.dataset.questionScope === 'bank') {
        state.exam.questionRefs = state.exam.questionRefs.map((id) => id === previous ? nextId : id);
        state.selectedBankQuestionId = nextId;
        state.bankDirty = true;
      } else state.selectedQuestionId = nextId;
    } else if (['points', 'negativePoints', 'correctNumber', 'tolerance'].includes(fieldName)) question[fieldName] = Number(raw) || 0;
    else if (['categories', 'tags', 'acceptedAnswers', 'correctAnswerIds'].includes(fieldName)) question[fieldName] = splitList(raw, fieldName === 'acceptedAnswers' ? /\n/ : /[,\n]/);
    else if (fieldName === 'images') question.images = parseImages(raw);
    else if (fieldName === 'options') {
      question.options = String(raw).split('\n').map((line, index) => {
        const [requestedId, copy, ...imageParts] = line.split('|');
        const answerId = requestedId.trim() || `${question.questionId}-answer-${index + 1}`;
        return {
          answerId,
          text: String(copy || '').trim() || requestedId.trim(),
          images: parseAnswerImages(imageParts.join('|'))
        };
      }).filter((option) => option.text);
      question.correctAnswerIds = question.correctAnswerIds.filter((id) => question.options.some((option) => option.answerId === id));
      if (!question.correctAnswerIds.length && question.options[0]) question.correctAnswerIds = [question.options[0].answerId];
    } else if (fieldName === 'pairs') {
      question.pairs = String(raw).split('\n').map((line, index) => {
        const parts = line.split(/\s*=>\s*/, 2);
        const previous = question.pairs[index];
        return {
          pairId: previous?.pairId || `${question.questionId}-pair-${index + 1}`,
          left: parts[0]?.trim() || '',
          right: parts[1]?.trim() || '',
          leftImages: previous?.leftImages || [],
          rightImages: previous?.rightImages || []
        };
      }).filter((pair) => pair.left || pair.right);
    } else if (fieldName === 'items') {
      question.items = String(raw).split('\n').map((entry, index) => ({
        itemId: question.items[index]?.itemId || `${question.questionId}-item-${index + 1}`,
        text: entry.trim(),
        images: question.items[index]?.images || []
      })).filter((item) => item.text);
      question.correctOrder = question.items.map((item) => item.itemId);
    } else if (fieldName === 'blanks') {
      question.blanks = String(raw).split('\n').map((line, index) => {
        const [requestedId, answers] = line.split('|', 2);
        return { blankId: requestedId.trim() || `${question.questionId}-blank-${index + 1}`, acceptedAnswers: String(answers || '').split(';').map((item) => item.trim()).filter(Boolean), caseInsensitive: true };
      }).filter((blank) => blank.acceptedAnswers.length);
    } else question[fieldName] = raw;
    if (editor.dataset.questionScope === 'bank') state.bankDirty = true;
  }

  function mediaQuestion(panel) {
    if (!panel || panel.dataset.examMediaScope !== 'question') return null;
    return state.exam.questions.find((question) => question.questionId === panel.dataset.questionId) || null;
  }

  function handleMediaControl(event) {
    const targetSelect = event.target.closest('[data-exam-media-target]');
    if (targetSelect) {
      state.mediaTarget = targetSelect.value;
      return;
    }
    const alt = event.target.closest('[data-exam-media-alt]');
    if (alt) {
      const panel = alt.closest('[data-exam-media-scope]');
      const value = String(alt.value || '').trim().slice(0, 300) || 'Ilustracja do pytania';
      if (panel?.dataset.examMediaScope === 'cover') {
        if (state.exam.metadata.cover?.ref === alt.dataset.mediaRef) state.exam.metadata.cover.alt = value;
      } else {
        const images = imagesForTarget(mediaQuestion(panel), alt.dataset.mediaTarget);
        const image = images?.find((entry) => entry.ref === alt.dataset.mediaRef);
        if (image) image.alt = value;
      }
      saveDrafts(); elements.badge.textContent = 'Niezapisane zmiany';
      return;
    }
    const fileInput = event.target.closest('[data-exam-media-input]');
    if (fileInput?.files?.length) {
      void uploadExamMediaFiles(Array.from(fileInput.files), fileInput.closest('[data-exam-media-scope]'));
      fileInput.value = '';
    }
  }

  function handleMediaDragOver(event) {
    const dropzone = event.target.closest('.exam-media-dropzone');
    if (!dropzone) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    dropzone.classList.add('is-dragover');
  }

  function handleMediaDragLeave(event) {
    const dropzone = event.target.closest('.exam-media-dropzone');
    if (dropzone && !dropzone.contains(event.relatedTarget)) dropzone.classList.remove('is-dragover');
  }

  function handleMediaDrop(event) {
    const dropzone = event.target.closest('.exam-media-dropzone');
    if (!dropzone) return;
    event.preventDefault();
    dropzone.classList.remove('is-dragover');
    const files = Array.from(event.dataTransfer?.files || []).filter((file) => file.type.startsWith('image/'));
    if (files.length) void uploadExamMediaFiles(files, dropzone.closest('[data-exam-media-scope]'));
  }

  function handleMediaPaste(event) {
    const files = Array.from(event.clipboardData?.items || [])
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter(Boolean);
    if (!files.length) return;
    const panel = event.target.closest('[data-exam-media-scope]') || elements.editor.querySelector('[data-exam-media-scope]');
    if (!panel) return;
    event.preventDefault();
    void uploadExamMediaFiles(files, panel);
  }

  function handleMediaKeydown(event) {
    const dropzone = event.target.closest('.exam-media-dropzone');
    if (!dropzone || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    if (!state.mediaUploading) {
      dropzone.closest('[data-exam-media-scope]')?.querySelector('[data-exam-media-input]')?.click();
    }
  }

  function mediaFilename(file) {
    const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
    const extension = extensions[file.type] || '';
    const original = String(file.name || 'obraz').replace(/\.[^.]+$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const stem = original.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 55) || 'obraz';
    const suffix = cryptoId().replace(/[^a-z0-9]/gi, '').toLowerCase().slice(-10);
    return `${stem}-${suffix}.${extension}`;
  }

  function fileBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Nie udało się odczytać obrazu.'));
      reader.onload = () => resolve(String(reader.result || '').split(',', 2)[1] || '');
      reader.readAsDataURL(file);
    });
  }

  function defaultImageAlt(file) {
    return String(file.name || 'Ilustracja').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim().slice(0, 300) || 'Ilustracja';
  }

  function addUploadedMedia(panel, target, media, file) {
    const image = { ref: media.ref, alt: defaultImageAlt(file) };
    if (panel.dataset.examMediaScope === 'cover') {
      state.exam.metadata.cover = image;
      return;
    }
    const question = mediaQuestion(panel);
    const images = imagesForTarget(question, target) || imagesForTarget(question, 'question');
    if (images && !images.some((entry) => entry.ref === image.ref)) images.push(image);
  }

  async function uploadExamMediaFiles(files, panel) {
    if (!panel || state.mediaUploading) return;
    if (!state.remoteSha || state.remoteExamId !== state.exam.examId) {
      elements.status.className = 'exam-builder-status is-error';
      elements.status.textContent = 'Najpierw zapisz draft egzaminu. Dzięki temu obraz trafi do właściwego folderu photos.';
      return;
    }
    const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
    const selected = files.slice(0, panel.dataset.examMediaScope === 'cover' ? 1 : 8);
    const invalid = selected.find((file) => !allowed.has(file.type) || file.size <= 0 || file.size > 4 * 1024 * 1024);
    if (invalid) {
      elements.status.className = 'exam-builder-status is-error';
      elements.status.textContent = 'Wybierz prawidłowy obraz PNG, JPG, WEBP lub GIF o rozmiarze do 4 MB.';
      return;
    }
    const target = panel.dataset.examMediaScope === 'cover'
      ? 'cover'
      : panel.querySelector('[data-exam-media-target]')?.value || state.mediaTarget || 'question';
    state.mediaUploading = true;
    elements.status.className = 'exam-builder-status';
    let uploadedCount = 0;
    try {
      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index];
        elements.status.textContent = `Wysyłanie obrazu ${index + 1}/${selected.length}: ${file.name || 'obraz'}…`;
        const media = await library.uploadExamMedia({
          examId: state.exam.examId,
          filename: mediaFilename(file),
          contentBase64: await fileBase64(file),
          mimeType: file.type,
          repositoryId: state.repositoryId
        });
        addUploadedMedia(panel, target, media, file);
        uploadedCount += 1;
      }
      elements.status.textContent = selected.length === 1
        ? 'Obraz zapisano w GitHubie i dodano do egzaminu. Zapisz draft, aby utrwalić referencję.'
        : `${selected.length} obrazów zapisano w GitHubie. Zapisz draft, aby utrwalić referencje.`;
    } catch (error) {
      elements.status.classList.add('is-error');
      elements.status.textContent = error.message || 'Nie udało się wysłać obrazu.';
    } finally {
      if (uploadedCount) saveDrafts();
      state.mediaUploading = false;
      render();
      elements.badge.textContent = 'Niezapisane zmiany';
    }
  }

  function handleAction(event) {
    const button = event.target.closest('[data-exam-action]');
    if (!button) return;
    const action = button.dataset.examAction;
    const questionId = button.dataset.questionId;
    if (action === 'open-media-manager') {
      openExamMediaManager(button.closest('[data-exam-media-scope]'));
    } else if (action === 'choose-media') {
      if (!state.mediaUploading) button.closest('[data-exam-media-scope]')?.querySelector('[data-exam-media-input]')?.click();
    } else if (action === 'remove-media-reference') {
      const panel = button.closest('[data-exam-media-scope]');
      if (panel?.dataset.examMediaScope === 'cover') state.exam.metadata.cover = null;
      else {
        const images = imagesForTarget(mediaQuestion(panel), button.dataset.mediaTarget);
        if (images) images.splice(0, images.length, ...images.filter((image) => image.ref !== button.dataset.mediaRef));
      }
      render();
    } else if (action === 'add-question') {
      const question = modelApi.createQuestion(); state.exam.questions.push(question); state.selectedQuestionId = question.questionId; render();
    } else if (action === 'select-question') { state.selectedQuestionId = questionId; render(); }
    else if (action === 'duplicate-question') duplicateQuestion(state.exam.questions, questionId, false);
    else if (action === 'delete-question') deleteQuestion(state.exam.questions, questionId, false);
    else if (action === 'remove-bank-reference') { state.exam.questionRefs = state.exam.questionRefs.filter((id) => id !== questionId); render(); }
    else if (action === 'add-bank-question') {
      const question = modelApi.createQuestion(); state.bank.questions.push(question); state.selectedBankQuestionId = question.questionId; state.bankDirty = true; render();
    } else if (action === 'select-bank-question' || action === 'select-bank-reference') { state.selectedBankQuestionId = questionId; if (action === 'select-bank-question') render(); }
    else if (action === 'duplicate-bank-question') duplicateQuestion(state.bank.questions, questionId, true);
    else if (action === 'delete-bank-question') deleteQuestion(state.bank.questions, questionId, true);
    else if (action === 'use-bank-question') { if (!state.exam.questionRefs.includes(questionId)) state.exam.questionRefs.push(questionId); render(); }
    else if (action === 'refresh-report') void loadReport();
    else if (action === 'open-attempt-report') void openAttemptReport(button.dataset.userId, button.dataset.attemptId);
    else if (action === 'reset-attempt') void resetAttempt(button.dataset.userId, button.dataset.attemptId);
    else if (action === 'add-audience-user') {
      if (!state.exam.availability.userIds.includes(button.dataset.userId)) state.exam.availability.userIds.push(button.dataset.userId);
      state.exam.availability.audienceMode = 'selected'; render();
    } else if (action === 'remove-audience-user') {
      state.exam.availability.userIds = state.exam.availability.userIds.filter((userId) => userId !== button.dataset.userId); render();
    } else if (action === 'load-audience-users') void loadIdentityUsers(true);
    saveDrafts();
  }

  async function loadIdentityUsers(loadAll) {
    state.usersLoadAllRequested = state.usersLoadAllRequested || Boolean(loadAll);
    if (state.usersPromise || !state.usersHasMore) return state.usersPromise;
    state.usersLoading = true; state.usersError = '';
    const status = elements.editor.querySelector('[data-audience-status]');
    if (status) status.textContent = audienceStatus();
    state.usersPromise = (async () => {
      try {
        do {
          const page = state.usersPage + 1;
          const payload = await identityUsersPage(page);
          const known = new Map(state.users.map((user) => [user.id, user]));
          (payload.users || []).forEach((user) => { if (user?.id) known.set(user.id, user); });
          state.users = [...known.values()].sort((left, right) => userLabel(left, left.id).localeCompare(userLabel(right, right.id), 'pl'));
          state.usersPage = page;
          state.usersHasMore = Boolean(payload.pagination?.hasMore);
          state.usersTotal = Number.isFinite(Number(payload.pagination?.total)) ? Number(payload.pagination.total) : state.usersTotal;
        } while (state.usersHasMore && state.usersLoadAllRequested);
      } catch (error) {
        state.usersError = error.message || 'Nie udało się pobrać użytkowników z Netlify Identity.';
      } finally {
        state.usersLoading = false; state.usersPromise = null;
        if (!state.usersHasMore) state.usersLoadAllRequested = false;
        if (state.tab === 'access') render();
      }
    })();
    return state.usersPromise;
  }

  async function identityUsersPage(page) {
    const token = await window.ChemAuth.getAccessToken();
    const url = new URL('/.netlify/functions/admin-users', window.location.origin);
    url.searchParams.set('page', String(page)); url.searchParams.set('perPage', '100');
    const response = await fetch(url, {
      credentials: 'same-origin', cache: 'no-store',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Nie udało się pobrać użytkowników.');
    return payload;
  }

  function duplicateQuestion(collection, questionId, bank) {
    const source = collection.find((question) => question.questionId === questionId);
    if (!source) return;
    const clone = modelApi.createQuestion({ ...structuredClone(source), questionId: '' });
    clone.prompt = `${clone.prompt} — kopia`;
    collection.splice(collection.indexOf(source) + 1, 0, clone);
    if (bank) { state.selectedBankQuestionId = clone.questionId; state.bankDirty = true; }
    else state.selectedQuestionId = clone.questionId;
    render();
  }

  function deleteQuestion(collection, questionId, bank) {
    if (!window.confirm('Usunąć to pytanie? Operacja zostanie zapisana dopiero po zapisie w GitHubie.')) return;
    const index = collection.findIndex((question) => question.questionId === questionId);
    if (index < 0) return;
    collection.splice(index, 1);
    if (bank) {
      state.exam.questionRefs = state.exam.questionRefs.filter((id) => id !== questionId);
      state.selectedBankQuestionId = collection[0]?.questionId || '';
      state.bankDirty = true;
    } else state.selectedQuestionId = collection[0]?.questionId || '';
    render();
  }

  function filterBank(query) {
    const normalized = String(query || '').trim().toLocaleLowerCase('pl');
    elements.editor.querySelectorAll('[data-bank-list] .exam-question-card').forEach((card, index) => {
      const question = state.bank.questions[index];
      card.hidden = Boolean(normalized) && !`${question.prompt} ${question.tags.join(' ')} ${question.categories.join(' ')}`.toLocaleLowerCase('pl').includes(normalized);
    });
  }

  async function saveExam(status) {
    if (state.saving) return;
    state.exam.status = status;
    const validation = modelApi.validateExam(state.exam);
    if (!validation.valid) { render(); elements.status.textContent = validation.errors[0].message; return; }
    const renamed = state.remoteSha && state.remoteExamId !== state.exam.examId;
    if (renamed && !window.confirm('ID wskazuje nową ścieżkę. Utworzyć nowy egzamin i pozostawić poprzedni bez zmian?')) return;
    state.saving = true; render();
    try {
      if (state.bankDirty || (!state.bankSha && state.bank.questions.length)) {
        const bankSaved = await library.save('question_bank', {
          filename: 'question-bank.json',
          content: modelApi.serializeQuestionBank(state.bank),
          expectedSha: state.bankSha,
          repositoryId: state.repositoryId
        });
        state.bankSha = bankSaved.sha || '';
        state.bankDirty = false;
      }
      const saved = await library.save('exam', {
        filename: state.exam.examId,
        content: modelApi.serializeExam(state.exam),
        expectedSha: renamed ? '' : state.remoteSha,
        repositoryId: state.repositoryId
      });
      state.remoteSha = saved.sha || '';
      state.remoteExamId = state.exam.examId;
      saveDrafts();
      elements.status.textContent = status === 'published' ? 'Egzamin został opublikowany.' : 'Draft został zapisany w GitHubie.';
      await loadAssets(true);
    } catch (error) {
      elements.status.textContent = error.message || 'Nie udało się zapisać egzaminu.';
      elements.status.classList.add('is-error');
    } finally { state.saving = false; render(); }
  }

  function previewExam() {
    const validation = modelApi.validateExam(state.exam);
    if (!validation.valid || !state.remoteSha || state.remoteExamId !== state.exam.examId) {
      elements.status.textContent = validation.valid ? 'Zapisz egzamin przed podglądem.' : validation.errors[0].message;
      return;
    }
    const url = new URL(library.examUrl(state.exam.examId, state.repositoryId, modelApi.canonicalMaterialId(state.repositoryId, state.exam.examId)), window.location.origin);
    url.searchParams.set('preview', '1');
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  }

  async function deleteExam() {
    if (!state.remoteSha) return;
    try {
      const warning = await examDeletionWarning(state.exam.examId, state.repositoryId);
      if (!window.confirm(`${warning}Usunąć exam.json z GitHuba? Commit będzie możliwy do odzyskania z historii.`)) return;
      await library.remove('exam', { filename: state.exam.examId, expectedSha: state.remoteSha, repositoryId: state.repositoryId });
      state.remoteSha = '';
      state.remoteExamId = '';
      elements.status.textContent = 'Egzamin usunięto z GitHuba. Lokalny draft pozostał w Builderze.';
      await loadAssets(true);
    } catch (error) { elements.status.textContent = error.message || 'Nie udało się usunąć egzaminu.'; }
  }

  async function examDeletionWarning(examId, repositoryId) {
    const references = await adminRequest({ view: 'references', repo: repositoryId, exam: examId });
    const places = (references.references || []).slice(0, 12).map((entry) => (
      `• ${entry.source === 'lesson' ? 'Lekcja' : 'Dashboard'}: ${entry.title || entry.filename || entry.materialId}`
    ));
    return references.count
      ? `Egzamin jest używany w ${references.count} miejscu/miejscach. Usunięcie pozostawi niedziałające odwołania:\n${places.join('\n')}${references.count > places.length ? `\n• …i ${references.count - places.length} kolejnych` : ''}\n\n${references.note || ''}\n\n`
      : `${references.note || 'Nie znaleziono odwołań w Dashboardzie ani lekcjach.'}\n\n`;
  }

  async function deletionWarning(asset) {
    if (!asset?.filename) throw new Error('Nie wybrano egzaminu do usunięcia.');
    return examDeletionWarning(asset.filename, asset.repositoryId || state.repositoryId);
  }

  function assetDeleted(asset) {
    if (!asset?.filename) return;
    const repositoryId = asset.repositoryId || state.repositoryId;
    if (repositoryId !== state.repositoryId) return;
    state.assets = state.assets.filter((entry) => entry.filename !== asset.filename);
    if (state.remoteExamId === asset.filename) {
      state.remoteSha = '';
      state.remoteExamId = '';
      state.report = null;
      state.attemptReport = null;
      elements.status.textContent = 'Egzamin usunięto z GitHuba. Lokalny draft pozostał w Builderze.';
    }
    renderLibrary();
    render();
  }

  async function loadReport() {
    if (!state.remoteSha || state.reportLoading) return;
    state.reportLoading = true; render();
    try {
      state.report = await adminRequest({ view: 'overview', repo: state.repositoryId, exam: state.exam.examId });
    } catch (error) { elements.status.textContent = error.message || 'Nie udało się pobrać raportu.'; }
    finally { state.reportLoading = false; render(); }
  }

  async function openAttemptReport(userId, attemptId) {
    try {
      const payload = await adminRequest({ view: 'attempt', repo: state.repositoryId, exam: state.exam.examId, userId, attemptId });
      state.attemptReport = payload.attempt;
      render();
    } catch (error) { elements.status.textContent = error.message || 'Nie udało się pobrać próby.'; }
  }

  async function resetAttempt(userId, attemptId) {
    if (!window.confirm('Zresetować tę próbę? Pozostałe próby ucznia zostaną zachowane, a postęp egzaminu przeliczony ponownie.')) return;
    try {
      await adminMutation({ repositoryId: state.repositoryId, examId: state.exam.examId, targetUserId: userId, attemptId, operationId: `admin-reset:${cryptoId()}` });
      state.attemptReport = null;
      await loadReport();
    } catch (error) { elements.status.textContent = error.message || 'Nie udało się zresetować próby.'; }
  }

  async function adminRequest(params) {
    const token = await window.ChemAuth.getAccessToken();
    const url = new URL('/.netlify/functions/admin-exams', window.location.origin);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, credentials: 'same-origin', cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Błąd raportu egzaminu.');
    return payload;
  }

  async function adminMutation(body) {
    const token = await window.ChemAuth.getAccessToken();
    const response = await fetch('/.netlify/functions/admin-exams', {
      method: 'DELETE', credentials: 'same-origin', cache: 'no-store',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Błąd resetowania próby.');
    return payload;
  }

  function cryptoId() {
    return window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function splitList(value, separator = /[,\n]/) {
    return [...new Set(String(value || '').split(separator).map((item) => item.trim()).filter(Boolean))];
  }

  function parseImages(value) {
    return String(value || '').split('\n').map((line) => {
      const [ref, ...alt] = line.split('|');
      return { ref: ref.trim(), alt: alt.join('|').trim() || 'Ilustracja do pytania' };
    }).filter((image) => image.ref);
  }

  function imagesToText(images) {
    return (images || []).map((image) => `${image.ref} | ${image.alt}`).join('\n');
  }

  function answerImagesToText(images) {
    return (images || []).map((image) => `${image.ref} :: ${image.alt}`).join('; ');
  }

  function parseAnswerImages(value) {
    return String(value || '').split(';').map((item) => {
      const [ref, ...alt] = item.split('::');
      return { ref: String(ref || '').trim(), alt: alt.join('::').trim() || 'Ilustracja przy odpowiedzi' };
    }).filter((image) => image.ref);
  }

  function dateTimeLocal(value) {
    const timestamp = Date.parse(value || '');
    if (!Number.isFinite(timestamp)) return '';
    const date = new Date(timestamp - new Date(timestamp).getTimezoneOffset() * 60_000);
    return date.toISOString().slice(0, 16);
  }

  function formatDuration(seconds) {
    const value = Math.max(0, Math.round(Number(seconds) || 0));
    const minutes = Math.floor(value / 60);
    return minutes ? `${minutes} min ${value % 60} s` : `${value} s`;
  }

  window.ChemExamBuilder = { activate, assetDeleted, deletionWarning, flush: saveDrafts, openAsset };
  document.addEventListener('DOMContentLoaded', initialize);
})();
