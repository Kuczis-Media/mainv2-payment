(function initializeChemDiskStudio() {
  'use strict';

  const DASHBOARD_DRAFT_KEY = 'chemdisk.studio.dashboard.v1';
  const LESSON_DRAFT_KEY = 'chemdisk.studio.lesson.v1';
  const THEME_KEY = 'chem.theme';
  const HISTORY_LIMIT = 60;
  const MAX_IMPORT_BYTES = 512 * 1024;
  const dashboardModelApi = window.ChemDashboardStudioModel;
  const lessonModelApi = window.ChemLessonStudioModel;

  const byId = (id) => document.getElementById(id);
  const all = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };

  const elements = {
    accessState: byId('access-state'),
    app: byId('studio-app'),
    home: byId('home-view'),
    modeSwitch: byId('mode-switch'),
    saveIndicator: byId('save-indicator'),
    saveIndicatorLabel: byId('save-indicator-label'),
    undo: byId('undo-button'),
    redo: byId('redo-button'),
    themeToggle: byId('theme-toggle'),
    themeColor: byId('theme-color'),
    dashboardWorkspace: byId('dashboard-workspace'),
    dashboardCanvas: byId('dashboard-canvas'),
    dashboardEmpty: byId('dashboard-empty'),
    dashboardInspector: byId('dashboard-inspector'),
    dashboardPreview: byId('dashboard-preview'),
    dashboardTitle: byId('dashboard-title-input'),
    dashboardIntro: byId('dashboard-intro-input'),
    dashboardBlockCount: byId('dashboard-block-count'),
    dashboardPaletteSearch: byId('dashboard-palette-search'),
    dashboardLoad: byId('dashboard-load-button'),
    dashboardPublish: byId('dashboard-publish-button'),
    dashboardSource: byId('dashboard-source-button'),
    dashboardImport: byId('dashboard-import-button'),
    dashboardFile: byId('dashboard-file-input'),
    lessonWorkspace: byId('lesson-workspace'),
    lessonCanvas: byId('lesson-canvas'),
    lessonInspector: byId('lesson-inspector'),
    lessonPreview: byId('lesson-preview'),
    lessonFilename: byId('lesson-filename-input'),
    lessonTitle: byId('lesson-title-input'),
    lessonSlideCount: byId('lesson-slide-count'),
    lessonPaletteSearch: byId('lesson-palette-search'),
    lessonSource: byId('lesson-source-button'),
    lessonCopy: byId('lesson-copy-button'),
    lessonDownload: byId('lesson-download-button'),
    lessonImport: byId('lesson-import-button'),
    lessonFile: byId('lesson-file-input'),
    sourceDialog: byId('source-dialog'),
    sourceDialogEyebrow: byId('source-dialog-eyebrow'),
    sourceDialogTitle: byId('source-dialog-title'),
    sourceDialogHelp: byId('source-dialog-help'),
    sourceTextarea: byId('source-textarea'),
    sourceStatus: byId('source-dialog-status'),
    sourceCopy: byId('source-copy-button'),
    sourceApply: byId('source-apply-button'),
    publishDialog: byId('publish-dialog'),
    publishSummary: byId('publish-summary'),
    publishConfirm: byId('publish-confirm-button'),
    toastRegion: byId('toast-region')
  };

  const history = {
    dashboard: { undo: [], redo: [] },
    lesson: { undo: [], redo: [] }
  };

  const state = {
    mode: 'home',
    currentUser: null,
    editSession: null,
    saveTimers: { dashboard: 0, lesson: 0 },
    previewWindows: { dashboard: null, lesson: null },
    sourceMode: 'dashboard',
    dashboard: {
      model: null,
      selectedUid: '',
      expectedEtag: null,
      remoteLoaded: false,
      remoteSource: 'draft',
      remoteUpdatedAt: null,
      baseline: '',
      loading: false,
      publishing: false
    },
    lesson: {
      model: null,
      selectedId: '',
      previewSlideId: ''
    }
  };

  function isAdmin(user) {
    const metadata = user && user.app_metadata ? user.app_metadata : {};
    return Array.isArray(metadata.roles) && metadata.roles.includes('admin');
  }

  function setAccessState(title, message, denied) {
    elements.accessState.replaceChildren();
    const icon = create('span', 'spinner');
    icon.setAttribute('aria-hidden', 'true');
    const heading = create('h1', '', title);
    const copy = create('p', '', message);
    elements.accessState.append(icon, heading, copy);
    elements.accessState.classList.toggle('is-denied', Boolean(denied));
    if (denied) {
      const back = create('a', 'button button-soft', 'Wróć do dashboardu');
      back.href = '/members/';
      back.style.marginTop = '22px';
      elements.accessState.append(back);
    }
  }

  function toast(title, message, type) {
    const item = create('div', `toast${type === 'error' ? ' is-error' : ''}`);
    const icon = create('span', '', type === 'error' ? '!' : '✓');
    icon.setAttribute('aria-hidden', 'true');
    const copy = create('span');
    copy.append(create('strong', '', title), create('small', '', message || ''));
    item.append(icon, copy);
    elements.toastRegion.append(item);
    window.setTimeout(() => {
      item.style.opacity = '0';
      item.style.transform = 'translateY(8px)';
      window.setTimeout(() => item.remove(), 180);
    }, type === 'error' ? 5200 : 3400);
  }

  function setSaveIndicator(label, status) {
    elements.saveIndicatorLabel.textContent = label;
    elements.saveIndicator.classList.toggle('is-saving', status === 'saving');
    elements.saveIndicator.classList.toggle('is-error', status === 'error');
  }

  function readStorage(key) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (_) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function scheduleDraftSave(mode) {
    if (state.saveTimers[mode]) window.clearTimeout(state.saveTimers[mode]);
    setSaveIndicator('Zapisywanie draftu…', 'saving');
    state.saveTimers[mode] = window.setTimeout(() => {
      state.saveTimers[mode] = 0;
      const ok = mode === 'dashboard'
        ? writeStorage(DASHBOARD_DRAFT_KEY, state.dashboard.model)
        : writeStorage(LESSON_DRAFT_KEY, state.lesson.model);
      let synchronized = false;
      if (ok && mode === 'dashboard' && state.dashboard.remoteLoaded) {
        try {
          synchronized = dashboardModelApi.serialize(
            state.dashboard.model,
            { ensureRequiredHelp: true }
          ).trim() === state.dashboard.baseline;
        } catch (_) {}
      }
      setSaveIndicator(
        ok
          ? synchronized ? 'Zgodny z aktywną wersją' : 'Draft zapisany lokalnie'
          : 'Nie udało się zapisać',
        ok ? 'saved' : 'error'
      );
    }, 260);
  }

  function flushDrafts() {
    finishEdit();
    ['dashboard', 'lesson'].forEach((mode) => {
      if (state.saveTimers[mode]) {
        window.clearTimeout(state.saveTimers[mode]);
        state.saveTimers[mode] = 0;
      }
    });
    if (state.dashboard.model) writeStorage(DASHBOARD_DRAFT_KEY, state.dashboard.model);
    if (state.lesson.model) writeStorage(LESSON_DRAFT_KEY, state.lesson.model);
  }

  function snapshot(mode) {
    const model = mode === 'dashboard' ? state.dashboard.model : state.lesson.model;
    return JSON.stringify(model);
  }

  function restoreSnapshot(mode, value) {
    const parsed = JSON.parse(value);
    if (mode === 'dashboard') {
      state.dashboard.model = dashboardModelApi.normalizeModel(parsed);
      state.dashboard.selectedUid = '';
      renderDashboard();
      updateDashboardDirtyState();
    } else {
      state.lesson.model = lessonModelApi.createLesson(parsed);
      state.lesson.selectedId = '';
      state.lesson.previewSlideId = state.lesson.model.slides[0] ? state.lesson.model.slides[0].id : '';
      renderLesson();
    }
    scheduleDraftSave(mode);
  }

  function pushHistory(mode, value) {
    const stack = history[mode].undo;
    if (stack[stack.length - 1] === value) return;
    stack.push(value);
    if (stack.length > HISTORY_LIMIT) stack.shift();
    history[mode].redo = [];
    updateHistoryButtons();
  }

  function beginEdit(mode) {
    if (state.editSession && state.editSession.mode === mode) return;
    finishEdit();
    state.editSession = { mode, before: snapshot(mode) };
  }

  function finishEdit() {
    const edit = state.editSession;
    state.editSession = null;
    if (!edit) return;
    const after = snapshot(edit.mode);
    if (after !== edit.before) pushHistory(edit.mode, edit.before);
  }

  function commitMutation(mode, mutate) {
    finishEdit();
    const before = snapshot(mode);
    const result = mutate();
    const after = snapshot(mode);
    if (after === before) return result;
    pushHistory(mode, before);
    scheduleDraftSave(mode);
    if (mode === 'dashboard') {
      renderDashboard();
      updateDashboardDirtyState();
    } else {
      renderLesson();
    }
    return result;
  }

  function undo() {
    if (state.mode !== 'dashboard' && state.mode !== 'lesson') return;
    finishEdit();
    const stack = history[state.mode];
    const previous = stack.undo.pop();
    if (!previous) return;
    stack.redo.push(snapshot(state.mode));
    restoreSnapshot(state.mode, previous);
    updateHistoryButtons();
  }

  function redo() {
    if (state.mode !== 'dashboard' && state.mode !== 'lesson') return;
    finishEdit();
    const stack = history[state.mode];
    const next = stack.redo.pop();
    if (!next) return;
    stack.undo.push(snapshot(state.mode));
    restoreSnapshot(state.mode, next);
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    const available = state.mode === 'dashboard' || state.mode === 'lesson';
    elements.undo.disabled = !available || history[state.mode].undo.length === 0;
    elements.redo.disabled = !available || history[state.mode].redo.length === 0;
  }

  function defaultDashboard() {
    return dashboardModelApi.createModel({
      title: 'Twoja przestrzeń do nauki',
      blocks: [
        dashboardModelApi.createText('Wszystkie materiały, ćwiczenia i narzędzia kursu w jednym miejscu.')
      ],
      sections: [{
        title: 'Materiały kursowe',
        blocks: [
          dashboardModelApi.createText('Przeciągnij tutaj prezentację, lekcję, dokument albo inne narzędzie.')
        ]
      }]
    });
  }

  function defaultLesson() {
    return lessonModelApi.createLesson({
      title: 'Nowa lekcja',
      filename: 'nowa-lekcja.md',
      slides: [{
        blocks: [
          lessonModelApi.createBlock('heading', { level: 2, text: 'Wprowadzenie' }),
          lessonModelApi.createBlock('style', {
            font: 'sans',
            size: 'normal',
            align: 'left',
            blocks: [
              lessonModelApi.createBlock('text', { text: 'Wpisz tutaj treść pierwszego slajdu.' })
            ]
          })
        ]
      }]
    });
  }

  function loadDrafts() {
    const dashboardDraft = readStorage(DASHBOARD_DRAFT_KEY);
    const lessonDraft = readStorage(LESSON_DRAFT_KEY);
    try {
      state.dashboard.model = dashboardDraft
        ? dashboardModelApi.normalizeModel(dashboardDraft)
        : defaultDashboard();
    } catch (_) {
      state.dashboard.model = defaultDashboard();
    }
    try {
      state.lesson.model = lessonDraft
        ? lessonModelApi.createLesson(lessonDraft)
        : defaultLesson();
    } catch (_) {
      state.lesson.model = defaultLesson();
    }
    state.lesson.previewSlideId = state.lesson.model.slides[0] ? state.lesson.model.slides[0].id : '';
  }

  function applyTheme(theme, persist) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    if (elements.themeColor) {
      elements.themeColor.setAttribute('content', next === 'dark' ? '#090f18' : '#edf2f7');
    }
    if (persist) {
      try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
    }
  }

  function toggleTheme() {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
  }

  function switchMode(mode) {
    finishEdit();
    const next = ['home', 'dashboard', 'lesson'].includes(mode) ? mode : 'home';
    state.mode = next;
    elements.home.hidden = next !== 'home';
    elements.dashboardWorkspace.hidden = next !== 'dashboard';
    elements.lessonWorkspace.hidden = next !== 'lesson';
    all('[data-switch-mode]').forEach((button) => {
      const active = button.dataset.switchMode === next;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    if (next === 'dashboard') renderDashboard();
    if (next === 'lesson') renderLesson();
    updateHistoryButtons();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function dashboardModuleDefaults(type) {
    const defaults = {
      slides: ['Nowa prezentacja', 'Otwórz prezentację do tego działu.'],
      pdf: ['Dokument PDF', 'Materiał do czytania lub pobrania.'],
      film: ['Nagranie lekcji', 'Obejrzyj nagranie w odtwarzaczu kursowym.'],
      filmv1: ['Film Video.js', 'Nagranie w alternatywnym odtwarzaczu.'],
      yt: ['Film YouTube', 'Nagranie z własnymi kontrolkami ChemDisk.'],
      lesson: ['Lekcja interaktywna', 'Przejdź przez prezentację i zadania.'],
      forms: ['Test wiedzy', 'Sprawdź swoją wiedzę w formularzu.'],
      chat: ['Asystent AI', 'Skorzystaj z przygotowanej pomocy.'],
      kalkulator: ['Kalkulator naukowy', 'Wykonuj obliczenia potrzebne w zadaniach.'],
      classic: ['Kalkulator klasyczny', 'Szybkie podstawowe obliczenia.'],
      whiteboard: ['Biała tablica', 'Szkicuj wzory, reakcje i notatki.'],
      bitpaper: ['Tablica BitPaper', 'Wspólna przestrzeń do rozwiązywania zadań.'],
      atonom: ['ATONOM', 'Buduj modele cząsteczek z polskich nazw.'],
      contact: ['Kontakt', 'Wyślij wiadomość bez opuszczania platformy.'],
      external: ['Materiał zewnętrzny', 'Otwórz materiał w nowej karcie.']
    };
    return defaults[type] || ['Nowy materiał', 'Otwórz materiał kursowy.'];
  }

  function createDashboardNode(type) {
    if (type === 'section') return dashboardModelApi.createSection({ title: 'Nowy dział' });
    if (type === 'group') return dashboardModelApi.createGroup({ title: 'Nowa harmonijka' });
    if (type === 'text') return dashboardModelApi.createText('Nowy opis.');
    if (type === 'notice') return dashboardModelApi.createNotice('Ważna informacja dla kursantów.');
    const [title, description] = dashboardModuleDefaults(type);
    if (type === 'kalkulator' || type === 'classic') {
      return dashboardModelApi.createModule({
        module: 'calculator',
        variant: type,
        title,
        description
      });
    }
    if (type === 'whiteboard' || type === 'bitpaper') {
      return dashboardModelApi.createModule({
        module: 'whiteboard',
        variant: type,
        title,
        description
      });
    }
    if (type === 'external') {
      return dashboardModelApi.createModule({
        module: 'link',
        href: 'https://',
        title,
        description
      });
    }
    return dashboardModelApi.createModule({
      module: type,
      title,
      description,
      source: 'prompt',
      formula: type === 'atonom' ? 'fenol' : ''
    });
  }

  function dashboardDefaultParent() {
    const selected = state.dashboard.selectedUid
      ? dashboardModelApi.findNode(state.dashboard.model, state.dashboard.selectedUid)
      : null;
    if (selected) {
      if (selected.node.kind === 'section' || selected.node.kind === 'group') return selected.node.uid;
      if (selected.parent && ['section', 'group'].includes(selected.parent.kind)) return selected.parent.uid;
    }
    const last = state.dashboard.model.sections[state.dashboard.model.sections.length - 1];
    return last ? last.uid : '';
  }

  function addDashboardNode(type, parentUid, index) {
    commitMutation('dashboard', () => {
      let node = createDashboardNode(type);
      if (node.kind === 'section') {
        const inserted = dashboardModelApi.insertNode(
          state.dashboard.model,
          state.dashboard.model.uid,
          node,
          index
        );
        if (inserted) state.dashboard.selectedUid = inserted.uid;
        return;
      }
      let target = parentUid || dashboardDefaultParent();
      if (!target) {
        const section = dashboardModelApi.insertNode(
          state.dashboard.model,
          state.dashboard.model.uid,
          dashboardModelApi.createSection({ title: 'Materiały kursowe' })
        );
        target = section && section.uid;
      }
      const inserted = target
        ? dashboardModelApi.insertNode(state.dashboard.model, target, node, index)
        : null;
      if (!inserted) {
        toast('Nie można dodać klocka', 'Harmonijki mogą mieć maksymalnie cztery poziomy.', 'error');
        return;
      }
      state.dashboard.selectedUid = inserted.uid;
    });
  }

  function dashboardSymbol(node) {
    if (node.kind === 'section') return '§';
    if (node.kind === 'group') return '⌄';
    if (node.kind === 'text') return 'T';
    if (node.kind === 'notice') return '!';
    const definition = dashboardModelApi.MODULE_DEFINITIONS[node.module];
    return definition ? definition.icon : '↗';
  }

  function dashboardNodeTitle(node) {
    if (node.kind === 'section' || node.kind === 'group' || node.kind === 'module') return node.title;
    return node.text || (node.kind === 'notice' ? 'Komunikat' : 'Pole tekstowe');
  }

  function dashboardNodeSubtitle(node) {
    if (node.kind === 'section') return `${node.blocks.length} elementów`;
    if (node.kind === 'group') return `Poziom ${node.level - 2} · ${node.blocks.length} elementów`;
    if (node.kind === 'text') return 'Pole tekstowe';
    if (node.kind === 'notice') return 'Komunikat';
    const definition = dashboardModelApi.MODULE_DEFINITIONS[node.module];
    return definition ? definition.label : 'Karta materiału';
  }

  function actionButton(action, label, text, danger) {
    const button = create('button', `node-action${danger ? ' is-danger' : ''}`, text);
    button.type = 'button';
    button.dataset.nodeAction = action;
    button.title = label;
    button.setAttribute('aria-label', label);
    return button;
  }

  function nodeHeader(node, containerClass) {
    const header = create('header', containerClass || 'node-header');
    const drag = create('button', 'drag-handle', '⠿');
    drag.type = 'button';
    drag.title = 'Przeciągnij, aby zmienić kolejność';
    drag.setAttribute('aria-label', 'Przeciągnij, aby zmienić kolejność');
    const symbol = create('span', 'node-symbol', dashboardSymbol(node));
    symbol.setAttribute('aria-hidden', 'true');
    const copy = create('span', 'node-copy');
    copy.append(
      create('strong', '', dashboardNodeTitle(node) || 'Bez tytułu'),
      create('small', '', dashboardNodeSubtitle(node))
    );
    const actions = create('span', 'node-actions');
    actions.append(
      actionButton('up', 'Przesuń wyżej', '↑'),
      actionButton('down', 'Przesuń niżej', '↓'),
      actionButton('duplicate', 'Duplikuj', '⧉'),
      actionButton('delete', 'Usuń', '×', true)
    );
    header.append(drag, symbol, copy, actions);
    return header;
  }

  function dashboardDropZone(parentUid, index, label) {
    const zone = create('div', 'drop-zone', label || 'Upuść tutaj');
    zone.dataset.dashboardDropParent = parentUid;
    zone.dataset.dashboardDropIndex = String(index);
    return zone;
  }

  function renderDashboardBlock(node, parentUid, index) {
    if (node.kind === 'group') {
      const group = create('article', 'builder-node group-node');
      group.dataset.nodeUid = node.uid;
      group.dataset.nodeKind = node.kind;
      group.dataset.parentUid = parentUid;
      group.dataset.nodeIndex = String(index);
      group.draggable = true;
      group.classList.toggle('is-selected', state.dashboard.selectedUid === node.uid);
      group.append(nodeHeader(node));
      const body = create('div', 'group-body');
      node.blocks.forEach((block, blockIndex) => {
        body.append(dashboardDropZone(node.uid, blockIndex));
        body.append(renderDashboardBlock(block, node.uid, blockIndex));
      });
      body.append(dashboardDropZone(node.uid, node.blocks.length, 'Dodaj do harmonijki'));
      group.append(body);
      return group;
    }
    const block = create('article', 'block-node');
    block.dataset.nodeUid = node.uid;
    block.dataset.nodeKind = node.kind;
    block.dataset.nodeType = node.kind === 'module' ? node.module : node.kind;
    block.dataset.parentUid = parentUid;
    block.dataset.nodeIndex = String(index);
    block.draggable = true;
    block.classList.toggle('is-selected', state.dashboard.selectedUid === node.uid);
    const drag = create('button', 'drag-handle', '⠿');
    drag.type = 'button';
    drag.setAttribute('aria-label', 'Przeciągnij klocek');
    const symbol = create('span', 'node-symbol', dashboardSymbol(node));
    symbol.setAttribute('aria-hidden', 'true');
    const copy = create('span', 'node-copy');
    copy.append(
      create('strong', '', dashboardNodeTitle(node) || 'Bez treści'),
      create('small', '', dashboardNodeSubtitle(node))
    );
    if (node.kind === 'module') {
      copy.append(create('span', 'module-chip', dashboardModelApi.moduleHref(node)));
    }
    const actions = create('span', 'node-actions');
    actions.append(
      actionButton('up', 'Przesuń wyżej', '↑'),
      actionButton('down', 'Przesuń niżej', '↓'),
      actionButton('duplicate', 'Duplikuj', '⧉'),
      actionButton('delete', 'Usuń', '×', true)
    );
    block.append(drag, symbol, copy, actions);
    return block;
  }

  function renderDashboardSection(section, index) {
    const article = create('article', 'builder-node section-node');
    article.dataset.nodeUid = section.uid;
    article.dataset.nodeKind = 'section';
    article.dataset.parentUid = state.dashboard.model.uid;
    article.dataset.nodeIndex = String(index);
    article.draggable = true;
    article.classList.toggle('is-selected', state.dashboard.selectedUid === section.uid);
    article.append(nodeHeader(section));
    const body = create('div', 'section-body');
    section.blocks.forEach((block, blockIndex) => {
      body.append(dashboardDropZone(section.uid, blockIndex));
      body.append(renderDashboardBlock(block, section.uid, blockIndex));
    });
    body.append(dashboardDropZone(section.uid, section.blocks.length, 'Dodaj do sekcji'));
    article.append(body);
    return article;
  }

  function countDashboardBlocks() {
    let count = state.dashboard.model.sections.length;
    const visit = (blocks) => blocks.forEach((block) => {
      count += 1;
      if (block.kind === 'group') visit(block.blocks);
    });
    state.dashboard.model.sections.forEach((section) => visit(section.blocks));
    return count;
  }

  function renderDashboardCanvas() {
    elements.dashboardCanvas.replaceChildren();
    const sections = state.dashboard.model.sections;
    if (!sections.length) {
      const empty = create('div', 'empty-canvas');
      empty.append(
        create('span', '', '↙'),
        create('strong', '', 'Przeciągnij tutaj pierwszą sekcję'),
        create('p', '', 'Możesz też kliknąć dowolny klocek w bibliotece.')
      );
      empty.dataset.dashboardDropParent = state.dashboard.model.uid;
      empty.dataset.dashboardDropIndex = '0';
      elements.dashboardCanvas.append(empty);
    } else {
      sections.forEach((section, index) => {
        elements.dashboardCanvas.append(
          dashboardDropZone(state.dashboard.model.uid, index, 'Upuść sekcję tutaj'),
          renderDashboardSection(section, index)
        );
      });
      elements.dashboardCanvas.append(
        dashboardDropZone(state.dashboard.model.uid, sections.length, 'Dodaj sekcję na końcu')
      );
    }
    elements.dashboardBlockCount.textContent = String(countDashboardBlocks());
  }

  function field(label, control, help) {
    const wrapper = create('label', 'field');
    wrapper.append(create('span', '', label), control);
    if (help) wrapper.append(create('small', 'field-help', help));
    return wrapper;
  }

  function textInput(value, fieldName, options) {
    const input = document.createElement('input');
    input.type = options && options.type ? options.type : 'text';
    input.value = value == null ? '' : String(value);
    input.dataset.dashboardField = fieldName;
    if (options && options.placeholder) input.placeholder = options.placeholder;
    if (options && options.maxLength) input.maxLength = options.maxLength;
    if (options && options.readOnly) input.readOnly = true;
    return input;
  }

  function textareaInput(value, fieldName, options) {
    const textarea = document.createElement('textarea');
    textarea.value = value == null ? '' : String(value);
    textarea.dataset.dashboardField = fieldName;
    textarea.rows = options && options.rows ? options.rows : 4;
    if (options && options.placeholder) textarea.placeholder = options.placeholder;
    if (options && options.maxLength) textarea.maxLength = options.maxLength;
    return textarea;
  }

  function selectInput(value, fieldName, options) {
    const select = document.createElement('select');
    select.dataset.dashboardField = fieldName;
    (options || []).forEach((option) => {
      const element = document.createElement('option');
      element.value = option.value;
      element.textContent = option.label;
      select.append(element);
    });
    select.value = value == null ? '' : String(value);
    return select;
  }

  function inspectorHeader(symbol, title, description) {
    const header = document.createElement('header');
    header.append(
      create('span', 'node-symbol', symbol),
      create('h2', '', title),
      create('p', '', description)
    );
    return header;
  }

  function inspectorActions() {
    const footer = create('div', 'inspector-actions');
    const duplicate = create('button', 'button button-soft', 'Duplikuj');
    duplicate.type = 'button';
    duplicate.dataset.inspectorAction = 'duplicate';
    const remove = create('button', 'button button-danger', 'Usuń');
    remove.type = 'button';
    remove.dataset.inspectorAction = 'delete';
    footer.append(duplicate, remove);
    return footer;
  }

  function renderDashboardInspector() {
    elements.dashboardInspector.replaceChildren();
    const found = state.dashboard.selectedUid
      ? dashboardModelApi.findNode(state.dashboard.model, state.dashboard.selectedUid)
      : null;
    if (!found) {
      const empty = create('div', 'inspector-empty');
      empty.append(
        create('span', '', '◎'),
        create('strong', '', 'Zaznacz klocek'),
        create('p', '', 'Tutaj zmienisz jego treść, parametry modułu i ochronę.')
      );
      elements.dashboardInspector.append(empty);
      return;
    }
    const node = found.node;
    const form = create('form', 'inspector-form');
    form.addEventListener('submit', (event) => event.preventDefault());
    form.append(inspectorHeader(
      dashboardSymbol(node),
      dashboardNodeSubtitle(node),
      node.kind === 'module'
        ? 'Skonfiguruj kartę dokładnie tak, jak ma otwierać się kursantowi.'
        : 'Zmień nazwę i treść zaznaczonego klocka.'
    ));

    if (node.kind === 'section' || node.kind === 'group') {
      form.append(field(
        node.kind === 'section' ? 'Nazwa działu' : 'Tytuł harmonijki',
        textInput(node.title, 'title', { maxLength: 120 })
      ));
    } else if (node.kind === 'text' || node.kind === 'notice') {
      form.append(field(
        node.kind === 'notice' ? 'Treść komunikatu' : 'Treść pola',
        textareaInput(node.text, 'text', { rows: 5, maxLength: 1000 }),
        'Dashboard wyświetla bezpieczny tekst — kod HTML nie zostanie wykonany.'
      ));
    } else if (node.kind === 'module') {
      form.append(
        field('Tytuł karty', textInput(node.title, 'title', { maxLength: 140 })),
        field('Krótki opis', textareaInput(node.description, 'description', { rows: 3, maxLength: 420 }))
      );
      const definition = dashboardModelApi.MODULE_DEFINITIONS[node.module] || dashboardModelApi.MODULE_DEFINITIONS.link;
      if (['slides', 'pdf', 'film', 'filmv1', 'yt', 'forms'].includes(node.module)) {
        form.append(field(
          definition.idLabel || 'ID materiału',
          textInput(node.id, 'id', { placeholder: 'Wklej ID albo pełny link' }),
          node.module === 'film' || node.module === 'filmv1'
            ? 'Dla type=2 podaj ID lub link Google Drive; pozostałe tryby korzystają z YouTube.'
            : 'Możesz wkleić samo ID lub obsługiwany link udostępniania.'
        ));
      }
      const protection = dashboardModelApi.PROTECTION_OPTIONS[node.module];
      if (protection) {
        form.append(field(
          'Tryb wyświetlania / ochrony',
          selectInput(node.protection, 'protection', protection),
          'Ochrona ogranicza interfejs i typowe pobieranie, ale nie jest zabezpieczeniem DRM.'
        ));
      }
      if (node.module === 'lesson') {
        form.append(field(
          'Plik lekcji',
          textInput(node.file, 'file', { placeholder: 'np. stechiometria.md', maxLength: 80 }),
          'Plik musi znaleźć się w public/members/module/lesson/.'
        ));
      }
      if (node.module === 'chat') {
        form.append(field(
          'Źródło promptu',
          selectInput(node.source, 'source', [
            { value: 'prompt', label: 'Plik JSON' },
            { value: 'file', label: 'Punkt z pliku TXT' }
          ])
        ));
        if (node.source === 'file') {
          const row = create('div', 'field-row');
          row.append(
            field('Plik TXT', textInput(node.file, 'file', { placeholder: 'prompty.txt', maxLength: 80 })),
            field('Numer punktu', textInput(node.point, 'point', { type: 'number', placeholder: '1' }))
          );
          form.append(row);
        } else {
          form.append(field('Plik JSON', textInput(node.prompt, 'prompt', { placeholder: 'pomoc.json', maxLength: 80 })));
        }
      }
      if (node.module === 'calculator' || node.module === 'whiteboard') {
        form.append(field(
          'Wariant narzędzia',
          selectInput(node.variant, 'variant', definition.variants)
        ));
      }
      if (node.module === 'contact') {
        form.append(field(
          'Wstępna treść wiadomości',
          textareaInput(node.internal, 'internal', { rows: 4, maxLength: 240 })
        ));
      }
      if (node.module === 'atonom') {
        form.append(field(
          definition.formulaLabel || 'Nazwa związku',
          textInput(node.formula, 'formula', {
            placeholder: 'np. kwas octowy, etanol, cis-but-2-en',
            maxLength: 140
          }),
          'Nazwa trafi do adresu jako parametr ?formula=… i ATONOM od razu otworzy wybrany model.'
        ));
      }
      if (node.module === 'link') {
        form.append(field(
          'Adres linku',
          textInput(node.href, 'href', { placeholder: 'https://…' }),
          'Dozwolony jest pełny adres HTTPS albo wewnętrzna ścieżka zaczynająca się od /.'
        ));
      }
      const previewUrl = textInput(dashboardModelApi.moduleHref(node), 'hrefPreview', { readOnly: true });
      previewUrl.id = 'dashboard-url-preview';
      form.append(field('Wygenerowany adres', previewUrl));
    }

    form.append(inspectorActions());
    elements.dashboardInspector.append(form);
  }

  function dashboardPreviewGroup(group) {
    const wrapper = create('div', 'preview-group');
    wrapper.append(create('strong', '', group.title));
    const directCards = group.items || [];
    if (directCards.length) {
      const grid = create('div', 'preview-card-grid');
      directCards.forEach((item) => {
        const card = create('div', 'preview-card');
        card.append(create('strong', '', item.title), create('small', '', item.description || item.href));
        grid.append(card);
      });
      wrapper.append(grid);
    }
    (group.groups || []).forEach((child) => wrapper.append(dashboardPreviewGroup(child)));
    return wrapper;
  }

  function previewToolbar(mode) {
    const toolbar = create('div', 'preview-toolbar');
    const copy = create('div');
    copy.append(
      create('strong', '', mode === 'dashboard' ? 'Podgląd dashboardu' : 'Podgląd slajdu'),
      create('small', '', mode === 'dashboard'
        ? 'Cały układ możesz otworzyć w osobnym oknie.'
        : 'Osobne okno pokaże wszystkie slajdy lekcji.')
    );
    const button = create('button', 'button button-soft preview-open-button', 'Otwórz pełny podgląd');
    button.type = 'button';
    button.dataset.fullPreview = mode;
    button.setAttribute('aria-label', mode === 'dashboard'
      ? 'Otwórz pełny podgląd dashboardu w nowym oknie'
      : 'Otwórz pełny podgląd lekcji w nowym oknie');
    toolbar.append(copy, button);
    return toolbar;
  }

  function buildDashboardPreviewShell() {
    const model = dashboardModelApi.toDashboardModel(state.dashboard.model);
    const shell = create('div', 'dashboard-preview-shell');
    const hero = create('div', 'preview-hero');
    hero.append(
      create('small', '', 'Panel kursanta'),
      create('h2', '', model.title),
      create('p', '', model.intro.join(' ') || 'Bez opisu powitalnego.')
    );
    shell.append(hero);
    model.sections.forEach((section) => {
      const card = create('section', 'preview-section');
      const header = document.createElement('header');
      const groupCount = (section.groups || []).length;
      header.append(
        create('h3', '', section.title),
        create('span', '', `${section.items.length} kart · ${groupCount} harmonijek`)
      );
      card.append(header);
      if (section.items.length) {
        const grid = create('div', 'preview-card-grid');
        section.items.forEach((item) => {
          const previewCard = create('div', 'preview-card');
          previewCard.append(
            create('strong', '', item.title),
            create('small', '', item.description || item.href)
          );
          grid.append(previewCard);
        });
        card.append(grid);
      }
      section.groups.forEach((group) => card.append(dashboardPreviewGroup(group)));
      shell.append(card);
    });
    return shell;
  }

  function renderDashboardPreview() {
    elements.dashboardPreview.replaceChildren(
      previewToolbar('dashboard'),
      buildDashboardPreviewShell()
    );
    syncFullPreview('dashboard');
  }

  function updateDashboardNodeSummary() {
    const found = state.dashboard.selectedUid
      ? dashboardModelApi.findNode(state.dashboard.model, state.dashboard.selectedUid)
      : null;
    if (!found) return;
    const target = all('[data-node-uid]', elements.dashboardCanvas)
      .find((node) => node.dataset.nodeUid === found.node.uid);
    if (target) {
      const title = target.querySelector('.node-copy strong');
      const subtitle = target.querySelector('.node-copy small');
      if (title) title.textContent = dashboardNodeTitle(found.node) || 'Bez treści';
      if (subtitle) subtitle.textContent = dashboardNodeSubtitle(found.node);
      const chip = target.querySelector('.module-chip');
      if (chip && found.node.kind === 'module') chip.textContent = dashboardModelApi.moduleHref(found.node);
    }
    const urlPreview = byId('dashboard-url-preview');
    if (urlPreview && found.node.kind === 'module') {
      urlPreview.value = dashboardModelApi.moduleHref(found.node);
    }
  }

  function updateDashboardDirtyState() {
    let current = '';
    try {
      current = dashboardModelApi.serialize(state.dashboard.model, { ensureRequiredHelp: true }).trim();
    } catch (_) {}
    const dirty = !state.dashboard.remoteLoaded || current !== state.dashboard.baseline;
    elements.dashboardPublish.disabled = !state.dashboard.remoteLoaded
      || !dirty
      || state.dashboard.loading
      || state.dashboard.publishing;
    elements.dashboardPublish.title = !state.dashboard.remoteLoaded
      ? 'Najpierw wczytaj aktywną wersję dashboardu'
      : dirty ? 'Opublikuj zmiany w Netlify Blobs' : 'Brak zmian do opublikowania';
    if (state.dashboard.remoteLoaded && !dirty && !state.dashboard.publishing) {
      setSaveIndicator('Zgodny z aktywną wersją', 'saved');
    }
  }

  function renderDashboard() {
    if (!state.dashboard.model) return;
    elements.dashboardTitle.value = state.dashboard.model.title;
    elements.dashboardIntro.value = state.dashboard.model.blocks
      .filter((block) => block.kind === 'text')
      .map((block) => block.text)
      .join('\n');
    renderDashboardCanvas();
    renderDashboardInspector();
    renderDashboardPreview();
    updateDashboardDirtyState();
  }

  function cloneDashboardNode(value) {
    const clone = JSON.parse(JSON.stringify(value));
    const visit = (node) => {
      if (!node || typeof node !== 'object') return;
      delete node.uid;
      if (Array.isArray(node.blocks)) node.blocks.forEach(visit);
    };
    visit(clone);
    return clone;
  }

  function cloneLessonNode(value) {
    const clone = JSON.parse(JSON.stringify(value));
    const visit = (node) => {
      if (!node || typeof node !== 'object') return;
      delete node.id;
      if (Array.isArray(node.blocks)) node.blocks.forEach(visit);
      if (node.task) visit(node.task);
    };
    visit(clone);
    return clone;
  }

  function dashboardNodeAction(action, uid) {
    const found = dashboardModelApi.findNode(state.dashboard.model, uid);
    if (!found || !found.container) return;
    if (action === 'delete') {
      const needsConfirm = (found.node.kind === 'section' || found.node.kind === 'group')
        && Array.isArray(found.node.blocks)
        && found.node.blocks.length > 0;
      if (needsConfirm && !window.confirm(`Usunąć „${dashboardNodeTitle(found.node)}” razem z zawartością?`)) return;
      commitMutation('dashboard', () => {
        dashboardModelApi.removeNode(state.dashboard.model, uid);
        state.dashboard.selectedUid = '';
      });
      return;
    }
    if (action === 'duplicate') {
      commitMutation('dashboard', () => {
        const clone = cloneDashboardNode(found.node);
        const inserted = dashboardModelApi.insertNode(
          state.dashboard.model,
          found.parent.uid,
          clone,
          found.index + 1
        );
        if (inserted) state.dashboard.selectedUid = inserted.uid;
      });
      return;
    }
    if (action === 'up' || action === 'down') {
      const offset = action === 'up' ? -1 : 1;
      const nextIndex = found.index + offset;
      if (nextIndex < 0 || nextIndex >= found.container.length) return;
      commitMutation('dashboard', () => {
        dashboardModelApi.moveNode(state.dashboard.model, uid, found.parent.uid, nextIndex);
        state.dashboard.selectedUid = uid;
      });
    }
  }

  function dashboardDragPayload(event) {
    try {
      const raw = event.dataTransfer.getData('application/x-chemdisk-studio')
        || event.dataTransfer.getData('text/plain');
      return JSON.parse(raw || '');
    } catch (_) {
      return null;
    }
  }

  function setStudioDragPayload(dataTransfer, payload) {
    const raw = JSON.stringify(payload);
    dataTransfer.setData('application/x-chemdisk-studio', raw);
    dataTransfer.setData('text/plain', raw);
  }

  function clearDragClasses() {
    all('.is-dragover').forEach((node) => node.classList.remove('is-dragover'));
    all('.is-dragging').forEach((node) => node.classList.remove('is-dragging'));
  }

  function handleDashboardDrop(event) {
    const zone = event.target.closest('[data-dashboard-drop-parent]');
    if (!zone || !elements.dashboardCanvas.contains(zone)) return;
    event.preventDefault();
    const payload = dashboardDragPayload(event);
    const parentUid = zone.dataset.dashboardDropParent;
    const index = Number(zone.dataset.dashboardDropIndex);
    clearDragClasses();
    if (!payload) return;
    if (payload.source === 'dashboard-palette') {
      addDashboardNode(payload.type, parentUid, index);
      return;
    }
    if (payload.source === 'dashboard-node' && payload.uid) {
      commitMutation('dashboard', () => {
        const moved = dashboardModelApi.moveNode(state.dashboard.model, payload.uid, parentUid, index);
        if (!moved) {
          toast('Nie można przenieść klocka', 'Sprawdź poziom harmonijki i miejsce docelowe.', 'error');
          return;
        }
        state.dashboard.selectedUid = payload.uid;
      });
    }
  }

  async function responseJson(response) {
    try { return await response.json(); } catch (_) { return null; }
  }

  function dashboardServerError(response, payload) {
    const code = payload && payload.error;
    if (response.status === 409 || code === 'DASHBOARD_CONFLICT') {
      return 'Aktywna wersja zmieniła się w innej karcie. Draft został zachowany — wczytaj aktualny dashboard i porównaj zmiany.';
    }
    if (response.status === 401) return 'Sesja administratora wygasła. Zaloguj się ponownie.';
    if (response.status === 403) return 'Bieżące konto nie ma już uprawnień administratora.';
    if (code === 'DASHBOARD_STORAGE_UNAVAILABLE') return 'Netlify Blobs jest chwilowo niedostępne.';
    if (code === 'MARKDOWN_TOO_LARGE') return 'Dashboard przekracza limit 256 KiB.';
    return `Nie udało się wykonać operacji (${response.status}).`;
  }

  async function adminToken() {
    const auth = window.ChemAuth;
    const user = auth && typeof auth.getUser === 'function' ? auth.getUser() : null;
    if (!isAdmin(user)) throw new Error('Ta funkcja jest dostępna tylko dla administratora.');
    if (!auth || typeof auth.getAccessToken !== 'function') throw new Error('Nie udało się odczytać sesji.');
    return auth.getAccessToken({ forceRefresh: true });
  }

  async function loadActiveDashboard() {
    if (state.dashboard.loading || state.dashboard.publishing) return;
    const localMarkdown = dashboardModelApi.serialize(state.dashboard.model, { ensureRequiredHelp: true }).trim();
    const localDirty = state.dashboard.remoteLoaded
      ? localMarkdown !== state.dashboard.baseline
      : Boolean(readStorage(DASHBOARD_DRAFT_KEY))
        || history.dashboard.undo.length > 0
        || Boolean(
          state.editSession
          && state.editSession.mode === 'dashboard'
          && snapshot('dashboard') !== state.editSession.before
        );
    if (localDirty && !window.confirm('Wczytanie aktywnej wersji zastąpi bieżący lokalny draft w builderze. Kontynuować?')) return;
    state.dashboard.loading = true;
    elements.dashboardLoad.disabled = true;
    elements.dashboardPublish.disabled = true;
    setSaveIndicator('Wczytywanie aktywnej wersji…', 'saving');
    try {
      const token = await adminToken();
      const response = await fetch(dashboardModelApi.ADMIN_DASHBOARD_URL, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
      });
      const payload = await responseJson(response);
      if (!response.ok) throw new Error(dashboardServerError(response, payload));
      let content;
      let etag = null;
      let source = payload && payload.source === 'blob' ? 'blob' : 'static';
      let updatedAt = payload && payload.updatedAt ? payload.updatedAt : null;
      if (source === 'blob') {
        if (!payload || typeof payload.content !== 'string') throw new Error('Serwer zwrócił nieprawidłową treść dashboardu.');
        content = payload.content;
        etag = typeof payload.etag === 'string' ? payload.etag : null;
      } else {
        const fallback = payload && typeof payload.fallbackUrl === 'string'
          ? payload.fallbackUrl
          : dashboardModelApi.STATIC_DASHBOARD_URL;
        if (!fallback.startsWith('/members/')) throw new Error('Nieprawidłowa ścieżka wersji statycznej.');
        const staticResponse = await fetch(fallback, { cache: 'no-store', credentials: 'same-origin' });
        if (!staticResponse.ok) throw new Error('Nie udało się pobrać dashboard.md z wdrożenia.');
        content = await staticResponse.text();
      }
      const model = dashboardModelApi.parseMarkdown(content);
      history.dashboard.undo = [];
      history.dashboard.redo = [];
      state.dashboard.model = model;
      state.dashboard.selectedUid = '';
      state.dashboard.expectedEtag = etag;
      state.dashboard.remoteLoaded = true;
      state.dashboard.remoteSource = source;
      state.dashboard.remoteUpdatedAt = updatedAt;
      state.dashboard.baseline = dashboardModelApi.serialize(model, { ensureRequiredHelp: true }).trim();
      scheduleDraftSave('dashboard');
      renderDashboard();
      toast(
        'Dashboard wczytany',
        source === 'blob' ? 'Edytujesz aktywną wersję z Netlify Blobs.' : 'Edytujesz pełny dashboard.md z wdrożenia.'
      );
    } catch (error) {
      setSaveIndicator('Błąd wczytywania', 'error');
      toast('Nie udało się wczytać dashboardu', error && error.message ? error.message : 'Spróbuj ponownie.', 'error');
    } finally {
      state.dashboard.loading = false;
      elements.dashboardLoad.disabled = false;
      updateDashboardDirtyState();
    }
  }

  function prepareDashboardPublish() {
    if (!state.dashboard.remoteLoaded) {
      toast('Najpierw wczytaj dashboard', 'Publikowanie jest dostępne po pobraniu aktualnego ETagu.', 'error');
      return;
    }
    const current = dashboardModelApi.serialize(
      state.dashboard.model,
      { ensureRequiredHelp: true }
    ).trim();
    if (current === state.dashboard.baseline) {
      toast('Brak zmian do publikacji', 'Aktywna wersja dashboardu jest już aktualna.');
      return;
    }
    const validation = dashboardModelApi.validate(state.dashboard.model);
    if (!validation.valid) {
      const first = validation.errors[0];
      if (first && first.uid) {
        state.dashboard.selectedUid = first.uid;
        renderDashboard();
      }
      toast('Uzupełnij konfigurację', first ? first.message : 'Dashboard zawiera błędy.', 'error');
      return;
    }
    elements.publishSummary.textContent = `${validation.sectionCount} sekcji · ${validation.moduleCount} kart · ${Math.round(validation.bytes / 1024)} KiB.`;
    elements.publishDialog.showModal();
  }

  async function publishDashboard() {
    if (state.dashboard.publishing || !state.dashboard.remoteLoaded) return;
    state.dashboard.publishing = true;
    elements.dashboardPublish.disabled = true;
    elements.dashboardLoad.disabled = true;
    setSaveIndicator('Publikowanie w Blobs…', 'saving');
    try {
      const token = await adminToken();
      const payload = dashboardModelApi.createPublishPayload(
        state.dashboard.model,
        state.dashboard.expectedEtag
      );
      const response = await fetch(dashboardModelApi.ADMIN_DASHBOARD_URL, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const result = await responseJson(response);
      if (!response.ok) {
        if (response.status === 409) state.dashboard.remoteLoaded = false;
        throw new Error(dashboardServerError(response, result));
      }
      if (!result || typeof result.content !== 'string' || typeof result.etag !== 'string') {
        throw new Error('Serwer nie potwierdził zapisanej wersji.');
      }
      state.dashboard.model = dashboardModelApi.parseMarkdown(result.content);
      state.dashboard.expectedEtag = result.etag;
      state.dashboard.remoteLoaded = true;
      state.dashboard.remoteSource = 'blob';
      state.dashboard.remoteUpdatedAt = result.updatedAt || null;
      state.dashboard.baseline = dashboardModelApi.serialize(
        state.dashboard.model,
        { ensureRequiredHelp: true }
      ).trim();
      scheduleDraftSave('dashboard');
      renderDashboard();
      toast('Dashboard opublikowany', 'Nowy układ jest już aktywny dla kursantów.');
    } catch (error) {
      setSaveIndicator('Publikacja nieudana', 'error');
      toast('Nie udało się opublikować', error && error.message ? error.message : 'Spróbuj ponownie.', 'error');
    } finally {
      state.dashboard.publishing = false;
      elements.dashboardLoad.disabled = false;
      updateDashboardDirtyState();
    }
  }

  function findLessonNode(id) {
    if (!id || !state.lesson.model) return null;
    const visitBlocks = (blocks, slide, parent) => {
      for (let index = 0; index < blocks.length; index += 1) {
        const block = blocks[index];
        if (block.id === id) {
          return { kind: 'block', node: block, array: blocks, index, slide, parent };
        }
        if (Array.isArray(block.blocks)) {
          const nested = visitBlocks(block.blocks, slide, block);
          if (nested) return nested;
        }
      }
      return null;
    };
    for (let index = 0; index < state.lesson.model.slides.length; index += 1) {
      const slide = state.lesson.model.slides[index];
      if (slide.id === id) {
        return {
          kind: 'slide',
          node: slide,
          array: state.lesson.model.slides,
          index,
          slide,
          parent: state.lesson.model
        };
      }
      if (slide.task && slide.task.id === id) {
        return { kind: 'task', node: slide.task, array: null, index: -1, slide, parent: slide };
      }
      const block = visitBlocks(slide.blocks, slide, slide);
      if (block) return block;
    }
    return null;
  }

  function selectedLessonSlide() {
    const found = findLessonNode(state.lesson.selectedId);
    if (found) return found.slide;
    return state.lesson.model.slides.find((slide) => slide.id === state.lesson.previewSlideId)
      || state.lesson.model.slides[0]
      || null;
  }

  function lessonBlockDefaults(type) {
    if (type === 'heading') return lessonModelApi.createBlock('heading', { level: 2, text: 'Nowy nagłówek' });
    if (type === 'text') return lessonModelApi.createBlock('text', { text: 'Nowy akapit tekstu.' });
    if (type === 'style') {
      return lessonModelApi.createBlock('style', {
        font: 'sans',
        color: '',
        background: '',
        size: 'normal',
        align: 'left',
        blocks: [lessonModelApi.createBlock('text', { text: 'Wpisz tekst i ustaw jego wygląd.' })]
      });
    }
    if (type === 'image') {
      return lessonModelApi.createBlock('image', {
        url: 'https://',
        alt: 'Opis ilustracji'
      });
    }
    if (type === 'list') {
      return lessonModelApi.createBlock('list', {
        ordered: false,
        items: ['Pierwszy punkt', 'Drugi punkt']
      });
    }
    if (type === 'quote') {
      return lessonModelApi.createBlock('quote', {
        text: 'Dodaj ważny cytat, definicję albo regułę do zapamiętania.'
      });
    }
    if (type === 'callout') {
      return lessonModelApi.createBlock('callout', {
        tone: 'tip',
        title: 'Wskazówka',
        text: 'Dodaj krótką, wyróżnioną informację.'
      });
    }
    if (type === 'code') {
      return lessonModelApi.createBlock('code', {
        language: '',
        code: 'Wpisz tutaj kod albo wzór tekstowy.'
      });
    }
    if (type === 'youtube') {
      return lessonModelApi.createBlock('youtube', {
        video: 'M7lc1UVf-VE',
        title: 'Film do lekcji'
      });
    }
    if (type === 'atonom') {
      return lessonModelApi.createBlock('atonom', {
        formula: 'fenol',
        title: 'Model cząsteczki w ATONOM'
      });
    }
    if (type === 'flashcards') {
      return lessonModelApi.createBlock('flashcards', {
        title: 'Fiszki do utrwalenia',
        color: '#7c3aed',
        cards: [
          { front: 'Alkohol', back: 'Związek zawierający grupę hydroksylową –OH.' },
          { front: 'Aldehyd', back: 'Związek zawierający końcową grupę –CHO.' },
          { front: 'Keton', back: 'Związek z grupą karbonylową wewnątrz łańcucha.' }
        ]
      });
    }
    if (type === 'accordion') {
      return lessonModelApi.createBlock('accordion', {
        title: 'Dodatkowe wyjaśnienie',
        open: false,
        blocks: [lessonModelApi.createBlock('text', { text: 'Treść widoczna po rozwinięciu harmonijki.' })]
      });
    }
    return lessonModelApi.createBlock('text', { text: 'Nowa treść.' });
  }

  function lessonTaskDefaults(type) {
    const taskType = type.replace(/^task-/, '');
    if (taskType === 'abcd') {
      return lessonModelApi.createTask({
        type: 'abcd',
        question: 'Wybierz poprawną odpowiedź.',
        label: 'Zaznacz jedną odpowiedź',
        options: ['Odpowiedź A', 'Odpowiedź B', 'Odpowiedź C', 'Odpowiedź D'],
        correctOption: 'A',
        hint: 'Dodaj podpowiedź.',
        feedback: 'Dobrze! Możesz przejść dalej.'
      });
    }
    if (taskType === 'choice') {
      return lessonModelApi.createTask({
        type: 'choice',
        question: 'Wybierz poprawną odpowiedź.',
        options: ['Pierwsza odpowiedź', 'Druga odpowiedź', 'Trzecia odpowiedź'],
        answers: ['Pierwsza odpowiedź'],
        hint: 'Dodaj podpowiedź.'
      });
    }
    if (taskType === 'number') {
      return lessonModelApi.createTask({
        type: 'number',
        question: 'Oblicz i wpisz wynik.',
        label: 'Wynik',
        placeholder: 'Wpisz liczbę',
        answers: ['0'],
        hint: 'Dodaj podpowiedź.'
      });
    }
    if (taskType === 'gaps') {
      return lessonModelApi.createTask({
        type: 'gaps',
        question: 'Uzupełnij zdanie, wybierając właściwe pojęcia.',
        text: 'Etanol należy do {{grupy związków}}, a jego grupą funkcyjną jest {{grupa funkcyjna}}.',
        label: 'Uzupełnij wszystkie luki',
        options: ['alkoholi', 'aldehydów', 'hydroksylowa', 'karboksylowa'],
        answers: ['alkoholi', 'hydroksylowa'],
        hint: 'Sprawdź końcówkę nazwy i wzór grupy funkcyjnej.'
      });
    }
    return lessonModelApi.createTask({
      type: 'text',
      question: 'Wpisz poprawną odpowiedź.',
      label: 'Twoja odpowiedź',
      answers: ['odpowiedź'],
      hint: 'Dodaj podpowiedź.'
    });
  }

  function insertLessonBlock(slideId, parentBlockId, block, index) {
    const slide = state.lesson.model.slides.find((candidate) => candidate.id === slideId);
    if (!slide) return null;
    let target = slide.blocks;
    if (parentBlockId) {
      const parent = findLessonNode(parentBlockId);
      if (
        !parent
        || parent.kind !== 'block'
        || !['style', 'accordion'].includes(parent.node.type)
        || ['style', 'accordion'].includes(block.type)
      ) return null;
      target = parent.node.blocks;
    }
    const position = Number.isInteger(index)
      ? Math.max(0, Math.min(index, target.length))
      : target.length;
    target.splice(position, 0, block);
    return block;
  }

  function lessonDefaultTarget() {
    const selected = findLessonNode(state.lesson.selectedId);
    if (selected) {
      if (
        selected.kind === 'block'
        && ['style', 'accordion'].includes(selected.node.type)
      ) {
        return { slideId: selected.slide.id, parentBlockId: selected.node.id };
      }
      return { slideId: selected.slide.id, parentBlockId: '' };
    }
    const slide = state.lesson.model.slides[state.lesson.model.slides.length - 1];
    return { slideId: slide ? slide.id : '', parentBlockId: '' };
  }

  function addLessonNode(type, target) {
    if (type === 'slide') {
      commitMutation('lesson', () => {
        const slide = lessonModelApi.createSlide({
          blocks: [
            lessonModelApi.createBlock('heading', { level: 2, text: `Krok ${state.lesson.model.slides.length + 1}` }),
            lessonModelApi.createBlock('text', { text: 'Treść nowego slajdu.' })
          ]
        });
        const index = target && Number.isInteger(target.index)
          ? Math.max(0, Math.min(target.index, state.lesson.model.slides.length))
          : state.lesson.model.slides.length;
        state.lesson.model.slides.splice(index, 0, slide);
        state.lesson.selectedId = slide.id;
        state.lesson.previewSlideId = slide.id;
      });
      return;
    }

    const insertion = target || lessonDefaultTarget();
    const slide = state.lesson.model.slides.find((candidate) => candidate.id === insertion.slideId)
      || state.lesson.model.slides[0];
    if (!slide) return;
    if (type.startsWith('task-')) {
      if (slide.task && !window.confirm('Ten slajd ma już pytanie. Zastąpić je nowym?')) return;
      commitMutation('lesson', () => {
        slide.task = lessonTaskDefaults(type);
        state.lesson.selectedId = slide.task.id;
        state.lesson.previewSlideId = slide.id;
      });
      return;
    }

    commitMutation('lesson', () => {
      const block = lessonBlockDefaults(type);
      const inserted = insertLessonBlock(
        slide.id,
        insertion.parentBlockId || '',
        block,
        insertion.index
      );
      if (!inserted) {
        toast('Nie można zagnieździć klocka', 'Harmonijka ani stylowany kontener nie mogą zawierać kolejnego kontenera.', 'error');
        return;
      }
      state.lesson.selectedId = inserted.id;
      state.lesson.previewSlideId = slide.id;
    });
  }

  function lessonBlockSymbol(block) {
    const symbols = {
      heading: 'H',
      text: 'T',
      list: '☷',
      image: '▧',
      quote: '❞',
      callout: '!',
      code: '</>',
      style: 'Aa',
      accordion: '⌄',
      youtube: 'YT',
      atonom: '⚛',
      flashcards: '↻'
    };
    return symbols[block.type] || 'T';
  }

  function lessonBlockTitle(block) {
    if (block.type === 'heading') return block.text || 'Nagłówek';
    if (block.type === 'text') return block.text || 'Pusty akapit';
    if (block.type === 'list') return block.items.join(' · ') || 'Pusta lista';
    if (block.type === 'image') return block.alt || 'Ilustracja';
    if (block.type === 'quote') return block.text || 'Cytat';
    if (block.type === 'callout') return block.title || 'Callout';
    if (block.type === 'code') return block.language ? `Kod: ${block.language}` : 'Blok kodu';
    if (block.type === 'style') return 'Stylowany tekst';
    if (block.type === 'accordion') return block.title || 'Harmonijka';
    if (block.type === 'youtube') return block.title || 'Film YouTube';
    if (block.type === 'atonom') return block.title || `ATONOM: ${block.formula}`;
    if (block.type === 'flashcards') return block.title || 'Fiszki';
    return 'Klocek';
  }

  function lessonBlockSubtitle(block) {
    if (block.type === 'style') {
      return `${block.font} · ${block.size} · ${block.align}${block.color ? ` · tekst ${block.color}` : ''}${block.background ? ` · tło ${block.background}` : ''}`;
    }
    if (block.type === 'accordion') return `${block.blocks.length} elementów · ${block.open ? 'otwarta' : 'zamknięta'}`;
    if (block.type === 'list') return `${block.items.length} punktów`;
    if (block.type === 'image') return block.url || 'Uzupełnij adres HTTPS';
    if (block.type === 'youtube') return block.video || 'Uzupełnij link lub ID filmu';
    if (block.type === 'atonom') return `Związek: ${block.formula || 'nieustawiony'}`;
    if (block.type === 'flashcards') return `${block.cards.length} fiszki · ${block.color}`;
    const labels = {
      heading: `Nagłówek H${block.level}`,
      text: 'Akapit',
      quote: 'Cytat',
      callout: `Callout · ${block.tone}`,
      code: 'Kod'
    };
    return labels[block.type] || block.type;
  }

  function lessonActionButton(action, label, text, danger) {
    const button = create('button', `node-action${danger ? ' is-danger' : ''}`, text);
    button.type = 'button';
    button.dataset.lessonAction = action;
    button.title = label;
    button.setAttribute('aria-label', label);
    return button;
  }

  function lessonDropZone(slideId, parentBlockId, index, label) {
    const zone = create('div', 'drop-zone', label || 'Upuść tutaj');
    zone.dataset.lessonDropKind = 'block';
    zone.dataset.lessonSlideId = slideId;
    zone.dataset.lessonParentBlockId = parentBlockId || '';
    zone.dataset.lessonDropIndex = String(index);
    return zone;
  }

  function renderLessonBlock(block, slide, parentBlock, index) {
    if (block.type === 'style' || block.type === 'accordion') {
      const container = create('article', 'builder-node group-node lesson-container');
      container.dataset.lessonBlockId = block.id;
      container.dataset.lessonSlideId = slide.id;
      container.dataset.lessonParentBlockId = parentBlock ? parentBlock.id : '';
      container.dataset.lessonIndex = String(index);
      container.draggable = true;
      container.classList.toggle('is-selected', state.lesson.selectedId === block.id);
      const header = create('header', 'node-header');
      const drag = create('button', 'drag-handle', '⠿');
      drag.type = 'button';
      drag.setAttribute('aria-label', 'Przeciągnij klocek');
      const symbol = create('span', 'node-symbol', lessonBlockSymbol(block));
      const copy = create('span', 'node-copy');
      copy.append(
        create('strong', '', lessonBlockTitle(block)),
        create('small', '', lessonBlockSubtitle(block))
      );
      const actions = create('span', 'node-actions');
      actions.append(
        lessonActionButton('up', 'Przesuń wyżej', '↑'),
        lessonActionButton('down', 'Przesuń niżej', '↓'),
        lessonActionButton('duplicate', 'Duplikuj', '⧉'),
        lessonActionButton('delete', 'Usuń', '×', true)
      );
      header.append(drag, symbol, copy, actions);
      const body = create('div', 'group-body');
      block.blocks.forEach((child, childIndex) => {
        body.append(lessonDropZone(slide.id, block.id, childIndex));
        body.append(renderLessonBlock(child, slide, block, childIndex));
      });
      body.append(lessonDropZone(slide.id, block.id, block.blocks.length, 'Dodaj do środka'));
      container.append(header, body);
      return container;
    }

    const item = create('article', 'lesson-block');
    item.dataset.lessonBlockId = block.id;
    item.dataset.lessonSlideId = slide.id;
    item.dataset.lessonParentBlockId = parentBlock ? parentBlock.id : '';
    item.dataset.lessonIndex = String(index);
    item.dataset.blockType = block.type;
    item.draggable = true;
    item.classList.toggle('is-selected', state.lesson.selectedId === block.id);
    const drag = create('button', 'drag-handle', '⠿');
    drag.type = 'button';
    drag.setAttribute('aria-label', 'Przeciągnij klocek');
    const symbol = create('span', 'node-symbol', lessonBlockSymbol(block));
    const copy = create('span', 'node-copy');
    copy.append(
      create('strong', '', lessonBlockTitle(block)),
      create('small', '', lessonBlockSubtitle(block))
    );
    const actions = create('span', 'node-actions');
    actions.append(
      lessonActionButton('up', 'Przesuń wyżej', '↑'),
      lessonActionButton('down', 'Przesuń niżej', '↓'),
      lessonActionButton('duplicate', 'Duplikuj', '⧉'),
      lessonActionButton('delete', 'Usuń', '×', true)
    );
    item.append(drag, symbol, copy, actions);
    return item;
  }

  function slideTitle(slide, index) {
    const heading = slide.blocks.find((block) => block.type === 'heading');
    return heading && heading.text ? heading.text : `Slajd ${index + 1}`;
  }

  function renderLessonTask(task, slide) {
    const item = create('article', 'lesson-block task-block');
    item.dataset.lessonTaskId = task.id;
    item.dataset.lessonSlideId = slide.id;
    item.dataset.blockType = `task-${task.type}`;
    item.classList.toggle('is-selected', state.lesson.selectedId === task.id);
    const symbol = create(
      'span',
      'node-symbol',
      task.type === 'abcd' ? 'AB' : task.type === 'number' ? '#' : task.type === 'gaps' ? '□' : '✓'
    );
    const copy = create('span', 'node-copy');
    copy.append(
      create('strong', '', task.question || 'Pytanie bez treści'),
      create('small', '', task.type === 'abcd' ? 'Quiz ABCD' : `Pytanie: ${task.type}`)
    );
    const actions = create('span', 'node-actions');
    actions.append(
      lessonActionButton('duplicate', 'Duplikuj pytanie na nowym slajdzie', '⧉'),
      lessonActionButton('delete', 'Usuń pytanie', '×', true)
    );
    item.append(symbol, copy, actions);
    return item;
  }

  function lessonSlideDropZone(index) {
    const zone = create('div', 'drop-zone', 'Upuść slajd tutaj');
    zone.dataset.lessonDropKind = 'slide';
    zone.dataset.lessonDropIndex = String(index);
    return zone;
  }

  function renderLessonSlide(slide, index) {
    const article = create('article', 'lesson-slide');
    article.dataset.lessonSlideId = slide.id;
    article.dataset.lessonSlideIndex = String(index);
    article.draggable = true;
    article.classList.toggle('is-selected', state.lesson.selectedId === slide.id);
    const header = create('header', 'slide-header');
    const drag = create('button', 'drag-handle', '⠿');
    drag.type = 'button';
    drag.setAttribute('aria-label', 'Przeciągnij slajd');
    const number = create('span', 'slide-index', String(index + 1).padStart(2, '0'));
    const copy = create('span', 'node-copy');
    copy.append(
      create('strong', '', slideTitle(slide, index)),
      create('small', '', `${slide.blocks.length} klocków${slide.task ? ' · 1 pytanie' : ''}`)
    );
    const actions = create('span', 'node-actions');
    actions.append(
      lessonActionButton('up', 'Przesuń slajd wyżej', '↑'),
      lessonActionButton('down', 'Przesuń slajd niżej', '↓'),
      lessonActionButton('duplicate', 'Duplikuj slajd', '⧉'),
      lessonActionButton('delete', 'Usuń slajd', '×', true)
    );
    header.append(drag, number, copy, actions);
    const blocks = create('div', 'slide-blocks');
    slide.blocks.forEach((block, blockIndex) => {
      blocks.append(lessonDropZone(slide.id, '', blockIndex));
      blocks.append(renderLessonBlock(block, slide, null, blockIndex));
    });
    blocks.append(lessonDropZone(slide.id, '', slide.blocks.length, 'Dodaj klocek do slajdu'));
    if (slide.task) blocks.append(renderLessonTask(slide.task, slide));
    article.append(header, blocks);
    return article;
  }

  function renderLessonCanvas() {
    elements.lessonCanvas.replaceChildren();
    state.lesson.model.slides.forEach((slide, index) => {
      elements.lessonCanvas.append(
        lessonSlideDropZone(index),
        renderLessonSlide(slide, index)
      );
    });
    elements.lessonCanvas.append(lessonSlideDropZone(state.lesson.model.slides.length));
    elements.lessonSlideCount.textContent = String(state.lesson.model.slides.length);
  }

  function lessonInput(value, fieldName, options) {
    const input = document.createElement('input');
    input.type = options && options.type ? options.type : 'text';
    input.value = value == null ? '' : String(value);
    input.dataset.lessonField = fieldName;
    if (options && options.placeholder) input.placeholder = options.placeholder;
    if (options && options.maxLength) input.maxLength = options.maxLength;
    if (options && options.min !== undefined) input.min = options.min;
    if (options && options.max !== undefined) input.max = options.max;
    if (options && options.checked !== undefined) input.checked = Boolean(options.checked);
    return input;
  }

  function lessonTextarea(value, fieldName, options) {
    const textarea = document.createElement('textarea');
    textarea.value = value == null ? '' : String(value);
    textarea.dataset.lessonField = fieldName;
    textarea.rows = options && options.rows ? options.rows : 4;
    if (options && options.placeholder) textarea.placeholder = options.placeholder;
    if (options && options.maxLength) textarea.maxLength = options.maxLength;
    return textarea;
  }

  function lessonSelect(value, fieldName, options) {
    const select = document.createElement('select');
    select.dataset.lessonField = fieldName;
    (options || []).forEach((option) => {
      const item = document.createElement('option');
      item.value = typeof option === 'string' ? option : option.value;
      item.textContent = typeof option === 'string' ? option : option.label;
      select.append(item);
    });
    select.value = value == null ? '' : String(value);
    return select;
  }

  function lessonInspectorActions(kind) {
    const footer = create('div', 'inspector-actions');
    const duplicate = create('button', 'button button-soft', 'Duplikuj');
    duplicate.type = 'button';
    duplicate.dataset.lessonInspectorAction = 'duplicate';
    const remove = create('button', 'button button-danger', kind === 'task' ? 'Usuń pytanie' : 'Usuń');
    remove.type = 'button';
    remove.dataset.lessonInspectorAction = 'delete';
    footer.append(duplicate, remove);
    return footer;
  }

  function renderLessonTaskInspector(form, task) {
    form.append(field(
      'Rodzaj pytania',
      lessonSelect(task.type, 'type', [
        { value: 'abcd', label: 'Quiz ABCD' },
        { value: 'choice', label: 'Wybór z listy' },
        { value: 'gaps', label: 'Uzupełnianie luk z listy' },
        { value: 'text', label: 'Odpowiedź tekstowa' },
        { value: 'number', label: 'Odpowiedź liczbowa' }
      ])
    ));
    form.append(
      field('Treść pytania', lessonTextarea(task.question, 'question', { rows: 3, maxLength: 900 })),
      field('Etykieta pola', lessonInput(task.label, 'label', { maxLength: 160 }))
    );
    if (task.type !== 'gaps') {
      form.append(field('Placeholder', lessonInput(task.placeholder, 'placeholder', { maxLength: 160 })));
    }
    if (task.type === 'gaps') {
      form.append(
        field(
          'Tekst z lukami',
          lessonTextarea(task.text, 'text', {
            rows: 6,
            maxLength: 1600,
            placeholder: 'Etanol należy do {{grupy związków}}.'
          }),
          'Każdą lukę oznacz jako {{opis luki}}. Kolejność luk musi odpowiadać kolejności poprawnych odpowiedzi.'
        ),
        field(
          'Opcje wspólne — jedna w wierszu',
          lessonTextarea(task.options.join('\n'), 'options', { rows: 7 }),
          'Uczeń zobaczy tę listę przy każdej luce.'
        ),
        field(
          'Poprawne odpowiedzi — kolejno dla luk',
          lessonTextarea(task.answers.join('\n'), 'answers', { rows: 5 }),
          'Pierwszy wiersz odpowiada pierwszej luce, drugi — drugiej itd.'
        )
      );
    } else if (task.type === 'choice' || task.type === 'abcd') {
      form.append(field(
        'Opcje — jedna w wierszu',
        lessonTextarea(task.options.join('\n'), 'options', {
          rows: task.type === 'abcd' ? 5 : 6,
          placeholder: 'Pierwsza odpowiedź\nDruga odpowiedź'
        }),
        task.type === 'abcd' ? 'Quiz ABCD wymaga dokładnie czterech opcji.' : 'Dodaj od 2 do 8 opcji.'
      ));
      const answerIndex = task.type === 'abcd'
        ? Math.max(0, Math.min(3, String(task.answers[0] || 'A').toUpperCase().charCodeAt(0) - 65))
        : Math.max(0, task.options.indexOf(task.answers[0]));
      form.append(field(
        'Poprawna opcja',
        lessonSelect(String(answerIndex), 'correctOption', task.options.map((option, index) => ({
          value: String(index),
          label: `${String.fromCharCode(65 + index)} — ${option}`
        })))
      ));
    } else {
      form.append(field(
        task.type === 'number' ? 'Poprawny wynik' : 'Poprawne odpowiedzi / aliasy',
        lessonTextarea(task.answers.join('\n'), 'answers', {
          rows: 3,
          placeholder: task.type === 'number' ? '7' : 'atom\nAtom węgla'
        }),
        'Każdą akceptowaną odpowiedź wpisz w osobnym wierszu.'
      ));
      if (task.type === 'text') {
        const check = create('label', 'check-field');
        const input = lessonInput('', 'caseSensitive', { type: 'checkbox', checked: task.caseSensitive });
        check.append(input, create('span', '', 'Rozróżniaj wielkość liter'));
        form.append(check);
      }
    }
    form.append(
      field('Podpowiedź po błędzie', lessonTextarea(task.hint, 'hint', { rows: 3, maxLength: 500 })),
      field('Komunikat po dobrej odpowiedzi', lessonTextarea(task.feedback, 'feedback', { rows: 3, maxLength: 500 }))
    );
  }

  function renderLessonInspector() {
    elements.lessonInspector.replaceChildren();
    const found = findLessonNode(state.lesson.selectedId);
    if (!found) {
      const empty = create('div', 'inspector-empty');
      empty.append(
        create('span', '', '◎'),
        create('strong', '', 'Zaznacz slajd lub klocek'),
        create('p', '', 'Edytuj treść, wygląd, odpowiedzi i komunikaty po rozwiązaniu.')
      );
      elements.lessonInspector.append(empty);
      return;
    }
    const form = create('form', 'inspector-form');
    form.addEventListener('submit', (event) => event.preventDefault());
    if (found.kind === 'slide') {
      form.append(inspectorHeader('▤', 'Ustawienia slajdu', 'Nazwa pochodzi z pierwszego nagłówka tego slajdu.'));
      form.append(field(
        'Nazwa slajdu',
        lessonInput(slideTitle(found.node, found.index), 'slideTitle', { maxLength: 140 })
      ));
      form.append(lessonInspectorActions('slide'));
      elements.lessonInspector.append(form);
      return;
    }
    if (found.kind === 'task') {
      form.append(inspectorHeader('✓', 'Pytanie interaktywne', 'Na jednym slajdzie może znajdować się jedno pytanie.'));
      renderLessonTaskInspector(form, found.node);
      form.append(lessonInspectorActions('task'));
      elements.lessonInspector.append(form);
      return;
    }
    const block = found.node;
    form.append(inspectorHeader(
      lessonBlockSymbol(block),
      lessonBlockSubtitle(block),
      'Zmiany pojawią się od razu w podglądzie lekcji.'
    ));
    if (block.type === 'heading') {
      const row = create('div', 'field-row');
      row.append(
        field('Poziom', lessonSelect(String(block.level), 'level', [
          { value: '1', label: 'H1 — główny' },
          { value: '2', label: 'H2 — slajd' },
          { value: '3', label: 'H3 — śródtytuł' }
        ])),
        field('Tekst nagłówka', lessonInput(block.text, 'text', { maxLength: 180 }))
      );
      form.append(row);
    } else if (block.type === 'text' || block.type === 'quote') {
      form.append(field(
        block.type === 'quote' ? 'Treść cytatu' : 'Treść akapitu',
        lessonTextarea(block.text, 'text', { rows: 7, maxLength: 4000 }),
        'Możesz używać **pogrubienia**, *kursywy*, ^indeksu górnego^ i ~dolnego~.'
      ));
    } else if (block.type === 'list') {
      const check = create('label', 'check-field');
      check.append(
        lessonInput('', 'ordered', { type: 'checkbox', checked: block.ordered }),
        create('span', '', 'Lista numerowana')
      );
      form.append(
        field('Punkty — jeden w wierszu', lessonTextarea(block.items.join('\n'), 'items', { rows: 7 })),
        check
      );
    } else if (block.type === 'image') {
      form.append(
        field('Adres obrazu HTTPS', lessonInput(block.url, 'url', { type: 'url', placeholder: 'https://…' }), 'Obraz pozostaje pod wskazanym adresem — plik nie jest kopiowany do repozytorium.'),
        field('Opis alternatywny ALT', lessonInput(block.alt, 'alt', { maxLength: 220 }))
      );
    } else if (block.type === 'callout') {
      form.append(
        field('Rodzaj', lessonSelect(block.tone, 'tone', [
          { value: 'info', label: 'Informacja' },
          { value: 'tip', label: 'Wskazówka' },
          { value: 'warning', label: 'Uwaga' },
          { value: 'success', label: 'Zapamiętaj' }
        ])),
        field('Tytuł', lessonInput(block.title, 'title', { maxLength: 120 })),
        field('Treść', lessonTextarea(block.text, 'text', { rows: 6, maxLength: 1800 }))
      );
    } else if (block.type === 'code') {
      form.append(
        field('Język / etykieta', lessonInput(block.language, 'language', { placeholder: 'np. text, js', maxLength: 24 })),
        field('Kod albo wzór', lessonTextarea(block.code, 'code', { rows: 9, maxLength: 6000 }))
      );
    } else if (block.type === 'youtube') {
      form.append(
        field(
          'Link lub ID filmu YouTube',
          lessonInput(block.video, 'video', { placeholder: 'https://youtu.be/… lub 11-znakowe ID', maxLength: 300 }),
          'Film zostanie osadzony w bezpiecznym iframe z domeny youtube-nocookie.com.'
        ),
        field('Tytuł filmu', lessonInput(block.title, 'title', { maxLength: 180 }))
      );
    } else if (block.type === 'atonom') {
      form.append(
        field(
          'Nazwa związku chemicznego',
          lessonInput(block.formula, 'formula', {
            placeholder: 'np. kwas octowy, etanol, cis-but-2-en',
            maxLength: 140
          }),
          'Builder utworzy iframe /members/module/atonom/?formula=nazwa-związku.'
        ),
        field('Tytuł modelu', lessonInput(block.title, 'title', { maxLength: 180 }))
      );
    } else if (block.type === 'flashcards') {
      form.append(
        field('Tytuł zestawu', lessonInput(block.title, 'title', { maxLength: 180 })),
        field(
          'Fiszki — jedna w wierszu',
          lessonTextarea(
            block.cards.map((card) => `${card.front} => ${card.back}`).join('\n'),
            'cards',
            { rows: 10, maxLength: 6000, placeholder: 'Pojęcie => Wyjaśnienie' }
          ),
          'Rozdziel przód i tył znakiem =>. Dodaj co najmniej dwie fiszki.'
        ),
        field('Kolor fiszek', lessonInput(block.color, 'flashcardColor', { type: 'color' }))
      );
    } else if (block.type === 'style') {
      const primaryText = block.blocks.find((child) => child.type === 'text');
      form.append(field(
        'Treść tekstu',
        lessonTextarea(primaryText ? primaryText.text : '', 'styledText', {
          rows: 7,
          maxLength: 4000,
          placeholder: 'Wpisz treść akapitu…'
        }),
        'Możesz też przeciągnąć do tego kontenera nagłówek, listę, obraz lub callout.'
      ));
      const row = create('div', 'field-row');
      row.append(
        field('Czcionka', lessonSelect(block.font, 'font', lessonModelApi.STYLE_FONTS.map((value) => ({
          value,
          label: value === 'sans' ? 'Bezszeryfowa' : value === 'serif' ? 'Szeryfowa' : value === 'rounded' ? 'Zaokrąglona' : 'Monospace'
        })))),
        field('Rozmiar', lessonSelect(block.size, 'size', [
          { value: 'small', label: 'Mały' },
          { value: 'normal', label: 'Normalny' },
          { value: 'large', label: 'Duży' },
          { value: 'xlarge', label: 'Bardzo duży' }
        ]))
      );
      const alignRow = create('div', 'field-row');
      alignRow.append(
        field('Wyrównanie', lessonSelect(block.align, 'align', [
          { value: 'left', label: 'Do lewej' },
          { value: 'center', label: 'Wyśrodkowane' },
          { value: 'right', label: 'Do prawej' }
        ])),
        field('Kolor tekstu', lessonInput(block.color || '#0e665a', 'color', { type: 'color' }))
      );
      const backgroundRow = create('div', 'field-row');
      backgroundRow.append(
        field('Kolor tła', lessonInput(block.background || '#e8f5ef', 'background', { type: 'color' }))
      );
      const useColor = create('label', 'check-field');
      useColor.append(
        lessonInput('', 'useColor', { type: 'checkbox', checked: Boolean(block.color) }),
        create('span', '', 'Użyj własnego koloru tekstu')
      );
      const useBackground = create('label', 'check-field');
      useBackground.append(
        lessonInput('', 'useBackground', { type: 'checkbox', checked: Boolean(block.background) }),
        create('span', '', 'Użyj kolorowego tła karty')
      );
      form.append(row, alignRow, useColor, backgroundRow, useBackground);
    } else if (block.type === 'accordion') {
      const open = create('label', 'check-field');
      open.append(
        lessonInput('', 'open', { type: 'checkbox', checked: block.open }),
        create('span', '', 'Domyślnie rozwinięta')
      );
      form.append(
        field('Tytuł harmonijki', lessonInput(block.title, 'title', { maxLength: 180 })),
        open
      );
    }
    form.append(lessonInspectorActions('block'));
    elements.lessonInspector.append(form);
  }

  function lessonPreviewMarkdown(slide) {
    const parts = slide.blocks.map((block) => lessonModelApi.serializeBlock(block)).filter(Boolean);
    if (slide.task && slide.task.question) parts.push(slide.task.question);
    return parts.join('\n\n');
  }

  function bindPreviewFlashcards(root) {
    all('.lesson-flashcard', root).forEach((card) => {
      card.addEventListener('click', () => {
        const flipped = card.getAttribute('aria-pressed') !== 'true';
        card.setAttribute('aria-pressed', String(flipped));
        card.classList.toggle('is-flipped', flipped);
      });
    });
  }

  function buildLessonPreviewShell(slide, index, includeValidation) {
    const shell = create('div', 'lesson-preview-shell');
    const meta = create('div', 'lesson-preview-meta');
    meta.append(
      create('span', '', `Krok ${index + 1} z ${state.lesson.model.slides.length}`),
      create('span', '', state.lesson.model.filename)
    );
    const body = create('div', 'lesson-preview-body');
    try {
      body.innerHTML = window.ChemLesson.renderMarkdown(lessonPreviewMarkdown(slide));
    } catch (_) {
      body.append(create('p', '', 'Nie można teraz utworzyć podglądu tego slajdu.'));
    }
    shell.append(meta, body);
    if (slide.task) {
      const task = create('div', 'preview-task');
      task.append(
        create('strong', '', slide.task.question || slide.task.label || 'Pytanie'),
        create('span', '', slide.task.type === 'abcd'
          ? `Quiz ABCD · ${slide.task.options.length} opcje`
          : slide.task.type === 'choice'
            ? `Wybór · ${slide.task.options.length} opcje`
            : slide.task.type === 'gaps'
              ? `Luki · ${slide.task.answers.length} pola · ${slide.task.options.length} opcji`
            : `Odpowiedź ${slide.task.type === 'number' ? 'liczbowa' : 'tekstowa'}`),
        create('span', '', slide.task.hint ? `Podpowiedź: ${slide.task.hint}` : 'Bez podpowiedzi')
      );
      shell.append(task);
    }
    const validation = includeValidation ? lessonModelApi.validateLesson(state.lesson.model) : null;
    if (validation && !validation.valid) {
      const warning = create('div', 'preview-task');
      warning.style.borderColor = 'var(--chem-danger)';
      warning.append(
        create('strong', '', 'Do poprawy przed eksportem'),
        create('span', '', validation.errors[0].message)
      );
      shell.append(warning);
    }
    return shell;
  }

  function renderLessonPreview() {
    elements.lessonPreview.replaceChildren();
    const slide = selectedLessonSlide();
    if (!slide) return;
    state.lesson.previewSlideId = slide.id;
    const index = state.lesson.model.slides.indexOf(slide);
    elements.lessonPreview.append(
      previewToolbar('lesson'),
      buildLessonPreviewShell(slide, index, true)
    );
    bindPreviewFlashcards(elements.lessonPreview);
    syncFullPreview('lesson');
  }

  function addFullPreviewHead(doc, mode) {
    const charset = doc.createElement('meta');
    charset.setAttribute('charset', 'utf-8');
    const viewport = doc.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1';
    const theme = doc.createElement('meta');
    theme.name = 'theme-color';
    theme.content = '#edf2f7';
    const baseStyles = doc.createElement('link');
    baseStyles.rel = 'stylesheet';
    baseStyles.href = '/members/module/theme.css';
    const studioStyles = doc.createElement('link');
    studioStyles.rel = 'stylesheet';
    studioStyles.href = '/members/module/studio/style.css';
    doc.head.replaceChildren(charset, viewport, theme, baseStyles, studioStyles);
    doc.title = mode === 'dashboard'
      ? 'Pełny podgląd dashboardu — ChemDisk'
      : 'Pełny podgląd lekcji — ChemDisk';
  }

  function renderFullPreviewWindow(mode, popup) {
    if (!popup || popup.closed) return;
    const doc = popup.document;
    const previousScroll = popup.scrollY;
    addFullPreviewHead(doc, mode);
    doc.documentElement.lang = 'pl';
    const activeTheme = document.documentElement.getAttribute('data-theme');
    if (activeTheme) doc.documentElement.setAttribute('data-theme', activeTheme);
    else doc.documentElement.removeAttribute('data-theme');
    doc.body.className = 'studio-preview-window';

    const header = doc.createElement('header');
    header.className = 'full-preview-header';
    const copy = doc.createElement('div');
    const eyebrow = doc.createElement('small');
    eyebrow.textContent = mode === 'dashboard' ? 'Dashboard kursanta' : 'Lekcja kursanta';
    const title = doc.createElement('strong');
    title.textContent = mode === 'dashboard'
      ? (state.dashboard.model.title || 'Podgląd dashboardu')
      : (state.lesson.model.title || state.lesson.model.filename || 'Podgląd lekcji');
    copy.append(eyebrow, title);
    const actions = doc.createElement('div');
    actions.className = 'full-preview-actions';
    const refresh = doc.createElement('button');
    refresh.type = 'button';
    refresh.className = 'button button-soft';
    refresh.textContent = 'Odśwież';
    refresh.addEventListener('click', () => renderFullPreviewWindow(mode, popup));
    const close = doc.createElement('button');
    close.type = 'button';
    close.className = 'button button-primary';
    close.textContent = 'Zamknij';
    close.addEventListener('click', () => popup.close());
    actions.append(refresh, close);
    header.append(copy, actions);

    const main = doc.createElement('main');
    main.className = `full-preview-main full-preview-${mode}`;
    if (mode === 'dashboard') {
      main.append(doc.importNode(buildDashboardPreviewShell(), true));
    } else {
      const validation = lessonModelApi.validateLesson(state.lesson.model);
      if (!validation.valid) {
        const warning = doc.createElement('div');
        warning.className = 'full-preview-warning';
        warning.textContent = `Podgląd roboczy — ${validation.errors[0].message}`;
        main.append(warning);
      }
      const slides = doc.createElement('div');
      slides.className = 'full-lesson-list';
      state.lesson.model.slides.forEach((slide, index) => {
        const article = doc.createElement('article');
        article.className = 'full-lesson-slide';
        article.id = `slide-${index + 1}`;
        article.append(doc.importNode(buildLessonPreviewShell(slide, index, false), true));
        slides.append(article);
      });
      main.append(slides);
    }
    doc.body.replaceChildren(header, main);
    if (mode === 'lesson') bindPreviewFlashcards(main);
    popup.requestAnimationFrame(() => popup.scrollTo(0, previousScroll));
  }

  function syncFullPreview(mode) {
    const popup = state.previewWindows[mode];
    if (!popup || popup.closed) {
      state.previewWindows[mode] = null;
      return;
    }
    renderFullPreviewWindow(mode, popup);
  }

  function openFullPreview(mode) {
    const popup = window.open(
      '',
      `chemdisk-${mode}-preview`,
      'width=1440,height=900,resizable=yes,scrollbars=yes'
    );
    if (!popup) {
      toast(
        'Przeglądarka zablokowała nowe okno',
        'Zezwól tej stronie na wyskakujące okna i spróbuj ponownie.',
        'error'
      );
      return;
    }
    state.previewWindows[mode] = popup;
    renderFullPreviewWindow(mode, popup);
    popup.focus();
  }

  function updateLessonNodeSummary() {
    const found = findLessonNode(state.lesson.selectedId);
    if (!found) return;
    if (found.kind === 'slide') {
      const target = all('[data-lesson-slide-id]', elements.lessonCanvas)
        .find((node) => node.dataset.lessonSlideId === found.node.id && node.classList.contains('lesson-slide'));
      if (target) {
        const title = target.querySelector('.slide-header .node-copy strong');
        if (title) title.textContent = slideTitle(found.node, found.index);
      }
    } else if (found.kind === 'block') {
      const target = all('[data-lesson-block-id]', elements.lessonCanvas)
        .find((node) => node.dataset.lessonBlockId === found.node.id);
      if (target) {
        const title = target.querySelector('.node-copy strong');
        const subtitle = target.querySelector('.node-copy small');
        if (title) title.textContent = lessonBlockTitle(found.node);
        if (subtitle) subtitle.textContent = lessonBlockSubtitle(found.node);
      }
    } else if (found.kind === 'task') {
      const target = all('[data-lesson-task-id]', elements.lessonCanvas)
        .find((node) => node.dataset.lessonTaskId === found.node.id);
      if (target) {
        const title = target.querySelector('.node-copy strong');
        if (title) title.textContent = found.node.question || 'Pytanie bez treści';
      }
    }
    renderLessonPreview();
  }

  function renderLesson() {
    if (!state.lesson.model) return;
    elements.lessonFilename.value = state.lesson.model.filename;
    elements.lessonTitle.value = state.lesson.model.title;
    renderLessonCanvas();
    renderLessonInspector();
    renderLessonPreview();
  }

  function lessonRemoveNode(found) {
    if (found.kind === 'task') {
      found.slide.task = null;
      return;
    }
    if (found.kind === 'slide') {
      found.array.splice(found.index, 1);
      if (!state.lesson.model.slides.length) {
        state.lesson.model.slides.push(lessonModelApi.createSlide({
          blocks: [lessonModelApi.createBlock('heading', { level: 2, text: 'Nowy slajd' })]
        }));
      }
      return;
    }
    found.array.splice(found.index, 1);
  }

  function lessonNodeAction(action, id) {
    const found = findLessonNode(id);
    if (!found) return;
    if (action === 'delete') {
      const hasChildren = found.kind === 'slide'
        ? found.node.blocks.length || found.node.task
        : found.kind === 'block' && Array.isArray(found.node.blocks) && found.node.blocks.length;
      if (hasChildren && !window.confirm('Usunąć ten element razem z jego zawartością?')) return;
      commitMutation('lesson', () => {
        lessonRemoveNode(found);
        state.lesson.selectedId = '';
        const slide = state.lesson.model.slides[Math.min(found.index, state.lesson.model.slides.length - 1)]
          || state.lesson.model.slides[0];
        state.lesson.previewSlideId = slide ? slide.id : '';
      });
      return;
    }
    if (action === 'duplicate') {
      commitMutation('lesson', () => {
        const clone = cloneLessonNode(found.node);
        if (found.kind === 'slide') {
          const slide = lessonModelApi.createSlide(clone);
          state.lesson.model.slides.splice(found.index + 1, 0, slide);
          state.lesson.selectedId = slide.id;
          state.lesson.previewSlideId = slide.id;
        } else if (found.kind === 'task') {
          const slide = lessonModelApi.createSlide({
            blocks: [lessonModelApi.createBlock('heading', { level: 2, text: 'Nowe pytanie' })],
            task: clone
          });
          const slideIndex = state.lesson.model.slides.indexOf(found.slide);
          state.lesson.model.slides.splice(slideIndex + 1, 0, slide);
          state.lesson.selectedId = slide.task.id;
          state.lesson.previewSlideId = slide.id;
        } else {
          const block = lessonModelApi.createBlock(clone);
          found.array.splice(found.index + 1, 0, block);
          state.lesson.selectedId = block.id;
          state.lesson.previewSlideId = found.slide.id;
        }
      });
      return;
    }
    if (action === 'up' || action === 'down') {
      if (!found.array) return;
      const next = found.index + (action === 'up' ? -1 : 1);
      if (next < 0 || next >= found.array.length) return;
      commitMutation('lesson', () => {
        const [node] = found.array.splice(found.index, 1);
        found.array.splice(next, 0, node);
        state.lesson.selectedId = id;
      });
    }
  }

  function moveLessonBlock(blockId, slideId, parentBlockId, index) {
    const found = findLessonNode(blockId);
    if (!found || found.kind !== 'block' || !found.array) return false;
    const movingContainer = ['style', 'accordion'].includes(found.node.type);
    if (parentBlockId && movingContainer) return false;
    if (parentBlockId === blockId) return false;
    const originalArray = found.array;
    const originalIndex = found.index;
    const [block] = originalArray.splice(originalIndex, 1);
    const targetSlide = state.lesson.model.slides.find((slide) => slide.id === slideId);
    let target = targetSlide ? targetSlide.blocks : null;
    if (parentBlockId) {
      const parent = findLessonNode(parentBlockId);
      target = parent && parent.kind === 'block' && Array.isArray(parent.node.blocks)
        ? parent.node.blocks
        : null;
    }
    if (!target) {
      originalArray.splice(originalIndex, 0, block);
      return false;
    }
    let position = Number.isInteger(index) ? Math.max(0, Math.min(index, target.length)) : target.length;
    if (target === originalArray && position > originalIndex) position -= 1;
    target.splice(position, 0, block);
    return true;
  }

  function handleLessonDrop(event) {
    const zone = event.target.closest('[data-lesson-drop-kind]');
    if (!zone || !elements.lessonCanvas.contains(zone)) return;
    event.preventDefault();
    const payload = dashboardDragPayload(event);
    clearDragClasses();
    if (!payload) return;
    const kind = zone.dataset.lessonDropKind;
    const index = Number(zone.dataset.lessonDropIndex);
    if (payload.source === 'lesson-palette') {
      addLessonNode(payload.type, kind === 'slide'
        ? { index }
        : {
            slideId: zone.dataset.lessonSlideId,
            parentBlockId: zone.dataset.lessonParentBlockId || '',
            index
          });
      return;
    }
    if (payload.source === 'lesson-slide' && kind === 'slide') {
      const found = findLessonNode(payload.id);
      if (!found || found.kind !== 'slide') return;
      commitMutation('lesson', () => {
        const [slide] = state.lesson.model.slides.splice(found.index, 1);
        const target = index > found.index ? index - 1 : index;
        state.lesson.model.slides.splice(Math.max(0, Math.min(target, state.lesson.model.slides.length)), 0, slide);
        state.lesson.selectedId = slide.id;
        state.lesson.previewSlideId = slide.id;
      });
      return;
    }
    if (payload.source === 'lesson-block' && kind === 'block') {
      commitMutation('lesson', () => {
        const moved = moveLessonBlock(
          payload.id,
          zone.dataset.lessonSlideId,
          zone.dataset.lessonParentBlockId || '',
          index
        );
        if (!moved) {
          toast('Nie można przenieść klocka', 'Kontenerów stylu i harmonijek nie można zagnieżdżać.', 'error');
          return;
        }
        state.lesson.selectedId = payload.id;
        state.lesson.previewSlideId = zone.dataset.lessonSlideId;
      });
    }
  }

  function normalizeDashboardIntro(value) {
    return String(value || '').replace(/\s*\n+\s*/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function handleDashboardDocumentInput(event) {
    beginEdit('dashboard');
    if (event.target === elements.dashboardTitle) {
      state.dashboard.model.title = event.target.value;
    } else if (event.target === elements.dashboardIntro) {
      const textBlocks = state.dashboard.model.blocks.filter((block) => block.kind === 'text');
      const intro = normalizeDashboardIntro(event.target.value);
      if (textBlocks.length) {
        textBlocks[0].text = intro;
        state.dashboard.model.blocks = state.dashboard.model.blocks.filter(
          (block) => block.kind !== 'text' || block === textBlocks[0]
        );
      } else if (intro) {
        state.dashboard.model.blocks.unshift(dashboardModelApi.createText(intro));
      }
    }
    renderDashboardPreview();
    updateDashboardDirtyState();
    scheduleDraftSave('dashboard');
  }

  function handleDashboardInspectorInput(event) {
    const target = event.target.closest('[data-dashboard-field]');
    if (!target || target.readOnly) return;
    const found = dashboardModelApi.findNode(state.dashboard.model, state.dashboard.selectedUid);
    if (!found) return;
    beginEdit('dashboard');
    const fieldName = target.dataset.dashboardField;
    let value = target.type === 'checkbox' ? target.checked : target.value;
    if (fieldName === 'point') value = String(Math.max(0, Number(value) || 0));
    found.node[fieldName] = value;
    updateDashboardNodeSummary();
    renderDashboardPreview();
    updateDashboardDirtyState();
    scheduleDraftSave('dashboard');
  }

  function normalizeTaskForType(task, nextType) {
    task.type = nextType;
    if (nextType === 'gaps') {
      task.text = task.text || 'Uzupełnij {{pierwszą lukę}} i {{drugą lukę}}.';
      task.options = task.options.length >= 2
        ? task.options
        : ['pierwsza odpowiedź', 'druga odpowiedź', 'inna odpowiedź'];
      task.answers = task.answers.length === 2
        ? task.answers
        : [task.options[0], task.options[1]];
      task.label = 'Uzupełnij wszystkie luki';
    } else if (nextType === 'abcd') {
      const defaults = ['Odpowiedź A', 'Odpowiedź B', 'Odpowiedź C', 'Odpowiedź D'];
      task.options = defaults.map((fallback, index) => task.options[index] || fallback).slice(0, 4);
      task.answers = [/^[A-D]$/i.test(task.answers[0] || '') ? task.answers[0].toUpperCase() : 'A'];
      task.label = task.label || 'Wybierz odpowiedź';
    } else if (nextType === 'choice') {
      if (task.options.length < 2) task.options = ['Pierwsza odpowiedź', 'Druga odpowiedź'];
      const current = task.answers[0];
      task.answers = [task.options.includes(current) ? current : task.options[0]];
      task.label = task.label || 'Wybierz odpowiedź';
    } else {
      if (!task.answers.length || (task.options.length && task.options.includes(task.answers[0]))) {
        task.answers = [nextType === 'number' ? '0' : 'odpowiedź'];
      }
      task.options = [];
      task.label = task.label || (nextType === 'number' ? 'Wynik' : 'Twoja odpowiedź');
    }
  }

  function setSlideTitle(slide, value) {
    const heading = slide.blocks.find((block) => block.type === 'heading');
    if (heading) heading.text = value;
    else slide.blocks.unshift(lessonModelApi.createBlock('heading', { level: 2, text: value }));
  }

  function handleLessonInspectorInput(event) {
    const target = event.target.closest('[data-lesson-field]');
    if (!target) return;
    const found = findLessonNode(state.lesson.selectedId);
    if (!found) return;
    beginEdit('lesson');
    const fieldName = target.dataset.lessonField;
    const checked = target.type === 'checkbox' ? target.checked : null;
    const raw = target.type === 'checkbox' ? checked : target.value;

    if (found.kind === 'slide' && fieldName === 'slideTitle') {
      setSlideTitle(found.node, raw);
    } else if (found.kind === 'task') {
      const task = found.node;
      if (fieldName === 'type') {
        normalizeTaskForType(task, raw);
      } else if (fieldName === 'options') {
        const previousOptions = [...task.options];
        const previousAnswer = task.answers[0] || '';
        task.options = String(raw).split('\n').map((item) => item.trim()).filter(Boolean).slice(0, 8);
        if (task.type === 'choice') {
          const oldIndex = previousOptions.indexOf(previousAnswer);
          task.answers = [task.options[Math.max(0, oldIndex)] || task.options[0] || ''];
        }
      } else if (fieldName === 'correctOption') {
        const index = Math.max(0, Math.min(task.options.length - 1, Number(raw) || 0));
        task.answers = [task.type === 'abcd' ? String.fromCharCode(65 + index) : task.options[index]];
      } else if (fieldName === 'answers') {
        task.answers = String(raw).split('\n').map((item) => item.trim()).filter(Boolean);
      } else {
        task[fieldName] = raw;
      }
    } else if (found.kind === 'block') {
      const block = found.node;
      if (fieldName === 'items') {
        block.items = String(raw).split('\n').map((item) => item.trim()).filter(Boolean);
      } else if (fieldName === 'cards' && block.type === 'flashcards') {
        block.cards = String(raw).split('\n')
          .map((line) => line.split(/\s*=>\s*/, 2))
          .filter((parts) => parts.length === 2)
          .map(([front, back]) => ({ front: front.trim(), back: back.trim() }))
          .filter((card) => card.front || card.back)
          .slice(0, 20);
      } else if (fieldName === 'flashcardColor' && block.type === 'flashcards') {
        block.color = raw;
      } else if (fieldName === 'styledText' && block.type === 'style') {
        let primaryText = block.blocks.find((child) => child.type === 'text');
        if (!primaryText) {
          primaryText = lessonModelApi.createBlock('text', { text: '' });
          block.blocks.unshift(primaryText);
        }
        primaryText.text = raw;
      } else if (fieldName === 'level') {
        block.level = Math.max(1, Math.min(3, Number(raw) || 2));
      } else if (fieldName === 'useColor') {
        block.color = checked ? (block.color || '#0e665a') : '';
      } else if (fieldName === 'color') {
        block.color = raw;
        const colorToggle = elements.lessonInspector.querySelector(
          '[data-lesson-field="useColor"]'
        );
        if (colorToggle) colorToggle.checked = true;
      } else if (fieldName === 'useBackground') {
        block.background = checked ? (block.background || '#e8f5ef') : '';
      } else if (fieldName === 'background') {
        block.background = raw;
        const backgroundToggle = elements.lessonInspector.querySelector(
          '[data-lesson-field="useBackground"]'
        );
        if (backgroundToggle) backgroundToggle.checked = true;
      } else {
        block[fieldName] = raw;
      }
    }
    updateLessonNodeSummary();
    scheduleDraftSave('lesson');
  }

  function handleLessonDocumentInput(event) {
    beginEdit('lesson');
    if (event.target === elements.lessonTitle) {
      state.lesson.model.title = event.target.value;
    } else if (event.target === elements.lessonFilename) {
      state.lesson.model.filename = event.target.value.trim();
    }
    renderLessonPreview();
    scheduleDraftSave('lesson');
  }

  async function copyText(value) {
    const text = String(value || '');
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const fallback = document.createElement('textarea');
    fallback.value = text;
    fallback.setAttribute('readonly', '');
    fallback.style.position = 'fixed';
    fallback.style.opacity = '0';
    document.body.append(fallback);
    fallback.select();
    const copied = document.execCommand('copy');
    fallback.remove();
    if (!copied) throw new Error('Przeglądarka nie pozwoliła skopiować tekstu.');
  }

  function currentSource(mode) {
    if (mode === 'dashboard') {
      return dashboardModelApi.serialize(state.dashboard.model, { ensureRequiredHelp: true });
    }
    return lessonModelApi.serializeLesson(state.lesson.model);
  }

  function openSourceDialog(mode) {
    let source;
    try {
      source = currentSource(mode);
    } catch (error) {
      toast(
        'Nie można wygenerować Markdown',
        error && error.message ? error.message : 'Uzupełnij wymagane pola.',
        'error'
      );
      return;
    }
    state.sourceMode = mode;
    elements.sourceDialogEyebrow.textContent = mode === 'dashboard' ? 'Dashboard Markdown' : 'Lesson Markdown';
    elements.sourceDialogTitle.textContent = mode === 'dashboard'
      ? 'Kod źródłowy dashboardu'
      : 'Kod źródłowy lekcji';
    elements.sourceDialogHelp.textContent = mode === 'dashboard'
      ? 'Możesz skopiować kod albo wkleić dashboard.md i zamienić go na graficzne klocki.'
      : 'Możesz skopiować kod albo wkleić istniejącą lekcję .md i edytować ją graficznie.';
    elements.sourceTextarea.value = source;
    elements.sourceStatus.textContent = '';
    elements.sourceStatus.className = 'dialog-status';
    elements.sourceDialog.showModal();
  }

  function applySourceDialog() {
    const source = elements.sourceTextarea.value;
    try {
      if (state.sourceMode === 'dashboard') {
        const model = dashboardModelApi.parseMarkdown(source);
        commitMutation('dashboard', () => {
          state.dashboard.model = model;
          state.dashboard.selectedUid = '';
        });
      } else {
        const model = lessonModelApi.parseLesson(source, state.lesson.model.filename);
        commitMutation('lesson', () => {
          state.lesson.model = model;
          state.lesson.selectedId = '';
          state.lesson.previewSlideId = model.slides[0] ? model.slides[0].id : '';
        });
      }
      elements.sourceDialog.close();
      toast('Markdown zastosowany', 'Kod został zamieniony na graficzne klocki.');
    } catch (error) {
      elements.sourceStatus.textContent = error && error.message ? error.message : 'Nieprawidłowy Markdown.';
      elements.sourceStatus.className = 'dialog-status is-error';
    }
  }

  function downloadLesson() {
    const validation = lessonModelApi.validateLesson(state.lesson.model);
    if (!validation.valid) {
      toast('Lekcja wymaga poprawek', validation.errors[0].message, 'error');
      return;
    }
    let markdown;
    try {
      markdown = lessonModelApi.serializeLesson(validation.lesson);
    } catch (error) {
      toast('Nie można utworzyć pliku', error.message, 'error');
      return;
    }
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = validation.lesson.filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    toast('Plik lekcji pobrany', validation.lesson.filename);
  }

  async function importMarkdownFile(file, mode) {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      toast('Plik jest zbyt duży', 'Maksymalny rozmiar importu to 512 KiB.', 'error');
      return;
    }
    let source;
    try {
      source = await file.text();
    } catch (_) {
      toast('Nie udało się odczytać pliku', 'Wybierz tekstowy plik .md.', 'error');
      return;
    }
    try {
      if (mode === 'dashboard') {
        const model = dashboardModelApi.parseMarkdown(source);
        commitMutation('dashboard', () => {
          state.dashboard.model = model;
          state.dashboard.selectedUid = '';
        });
      } else {
        const filename = lessonModelApi.validateFilename(file.name)
          ? file.name
          : state.lesson.model.filename;
        const model = lessonModelApi.parseLesson(source, filename);
        commitMutation('lesson', () => {
          state.lesson.model = model;
          state.lesson.selectedId = '';
          state.lesson.previewSlideId = model.slides[0] ? model.slides[0].id : '';
        });
      }
      toast('Plik zaimportowany', `${file.name} jest gotowy do edycji.`);
    } catch (error) {
      toast('Nie udało się zaimportować', error && error.message ? error.message : 'Nieprawidłowy Markdown.', 'error');
    }
  }

  function activateInspectorPanel(mode, panel) {
    const prefix = mode === 'dashboard' ? 'dashboard' : 'lesson';
    const inspector = mode === 'dashboard' ? elements.dashboardInspector : elements.lessonInspector;
    const preview = mode === 'dashboard' ? elements.dashboardPreview : elements.lessonPreview;
    all(`[data-${prefix}-panel]`).forEach((button) => {
      const active = button.dataset[`${prefix}Panel`] === panel;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    inspector.hidden = panel !== 'inspector';
    preview.hidden = panel !== 'preview';
    if (panel === 'preview') {
      if (mode === 'dashboard') renderDashboardPreview();
      else renderLessonPreview();
    }
  }

  function filterPalette(input, attribute) {
    const query = String(input.value || '').trim().toLocaleLowerCase('pl');
    all(`[${attribute}]`, input.closest('.palette-panel')).forEach((button) => {
      const text = `${button.getAttribute(attribute) || ''} ${button.textContent || ''}`.toLocaleLowerCase('pl');
      button.hidden = Boolean(query) && !text.includes(query);
    });
  }

  function handleDashboardCanvasClick(event) {
    const action = event.target.closest('[data-node-action]');
    const nodeElement = event.target.closest('[data-node-uid]');
    if (!nodeElement || !elements.dashboardCanvas.contains(nodeElement)) return;
    const uid = nodeElement.dataset.nodeUid;
    if (action) {
      dashboardNodeAction(action.dataset.nodeAction, uid);
      return;
    }
    state.dashboard.selectedUid = uid;
    renderDashboardCanvas();
    renderDashboardInspector();
    renderDashboardPreview();
  }

  function handleLessonCanvasClick(event) {
    const action = event.target.closest('[data-lesson-action]');
    const task = event.target.closest('[data-lesson-task-id]');
    const block = event.target.closest('[data-lesson-block-id]');
    const slide = event.target.closest('.lesson-slide[data-lesson-slide-id]');
    const id = task
      ? task.dataset.lessonTaskId
      : block ? block.dataset.lessonBlockId : slide ? slide.dataset.lessonSlideId : '';
    if (!id) return;
    if (action) {
      lessonNodeAction(action.dataset.lessonAction, id);
      return;
    }
    state.lesson.selectedId = id;
    const found = findLessonNode(id);
    if (found) state.lesson.previewSlideId = found.slide.id;
    renderLessonCanvas();
    renderLessonInspector();
    renderLessonPreview();
  }

  function handleDashboardDragStart(event) {
    const item = event.target.closest('[data-node-uid]');
    if (!item || !elements.dashboardCanvas.contains(item)) return;
    item.classList.add('is-dragging');
    event.dataTransfer.effectAllowed = 'move';
    setStudioDragPayload(event.dataTransfer, {
      source: 'dashboard-node',
      uid: item.dataset.nodeUid
    });
  }

  function handleLessonDragStart(event) {
    const block = event.target.closest('[data-lesson-block-id]');
    const slide = event.target.closest('.lesson-slide[data-lesson-slide-id]');
    if (block) {
      block.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      setStudioDragPayload(event.dataTransfer, {
        source: 'lesson-block',
        id: block.dataset.lessonBlockId
      });
      event.stopPropagation();
      return;
    }
    if (slide) {
      slide.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      setStudioDragPayload(event.dataTransfer, {
        source: 'lesson-slide',
        id: slide.dataset.lessonSlideId
      });
    }
  }

  function bindPalette() {
    all('[data-dashboard-add]').forEach((button) => {
      button.addEventListener('click', () => addDashboardNode(button.dataset.dashboardAdd));
      if (button.draggable) {
        button.addEventListener('dragstart', (event) => {
          event.dataTransfer.effectAllowed = 'copy';
          setStudioDragPayload(event.dataTransfer, {
            source: 'dashboard-palette',
            type: button.dataset.dashboardAdd
          });
        });
      }
    });
    all('[data-lesson-add]').forEach((button) => {
      button.addEventListener('click', () => addLessonNode(button.dataset.lessonAdd));
      if (button.draggable) {
        button.addEventListener('dragstart', (event) => {
          event.dataTransfer.effectAllowed = 'copy';
          setStudioDragPayload(event.dataTransfer, {
            source: 'lesson-palette',
            type: button.dataset.lessonAdd
          });
        });
      }
    });
  }

  function bindEvents() {
    all('[data-open-mode]').forEach((button) => {
      button.addEventListener('click', () => switchMode(button.dataset.openMode));
    });
    all('[data-switch-mode]').forEach((button) => {
      button.addEventListener('click', () => switchMode(button.dataset.switchMode));
    });
    elements.themeToggle.addEventListener('click', toggleTheme);
    elements.undo.addEventListener('click', undo);
    elements.redo.addEventListener('click', redo);
    bindPalette();

    elements.dashboardPaletteSearch.addEventListener('input', () => {
      filterPalette(elements.dashboardPaletteSearch, 'data-search');
    });
    elements.lessonPaletteSearch.addEventListener('input', () => {
      filterPalette(elements.lessonPaletteSearch, 'data-search');
    });

    elements.dashboardCanvas.addEventListener('click', handleDashboardCanvasClick);
    elements.dashboardCanvas.addEventListener('dragstart', handleDashboardDragStart);
    elements.dashboardCanvas.addEventListener('dragend', clearDragClasses);
    elements.dashboardCanvas.addEventListener('dragover', (event) => {
      const zone = event.target.closest('[data-dashboard-drop-parent]');
      if (!zone) return;
      event.preventDefault();
      clearDragClasses();
      zone.classList.add('is-dragover');
    });
    elements.dashboardCanvas.addEventListener('dragleave', (event) => {
      const zone = event.target.closest('[data-dashboard-drop-parent]');
      if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove('is-dragover');
    });
    elements.dashboardCanvas.addEventListener('drop', handleDashboardDrop);

    elements.lessonCanvas.addEventListener('click', handleLessonCanvasClick);
    elements.lessonCanvas.addEventListener('dragstart', handleLessonDragStart);
    elements.lessonCanvas.addEventListener('dragend', clearDragClasses);
    elements.lessonCanvas.addEventListener('dragover', (event) => {
      const zone = event.target.closest('[data-lesson-drop-kind]');
      if (!zone) return;
      event.preventDefault();
      clearDragClasses();
      zone.classList.add('is-dragover');
    });
    elements.lessonCanvas.addEventListener('dragleave', (event) => {
      const zone = event.target.closest('[data-lesson-drop-kind]');
      if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove('is-dragover');
    });
    elements.lessonCanvas.addEventListener('drop', handleLessonDrop);

    [elements.dashboardTitle, elements.dashboardIntro].forEach((input) => {
      input.addEventListener('focus', () => beginEdit('dashboard'));
      input.addEventListener('input', handleDashboardDocumentInput);
      input.addEventListener('blur', finishEdit);
    });
    [elements.lessonTitle, elements.lessonFilename].forEach((input) => {
      input.addEventListener('focus', () => beginEdit('lesson'));
      input.addEventListener('input', handleLessonDocumentInput);
      input.addEventListener('blur', () => {
        finishEdit();
        if (input === elements.lessonFilename && !lessonModelApi.validateFilename(input.value)) {
          toast('Nieprawidłowa nazwa pliku', 'Użyj liter ASCII, cyfr, kropki, myślnika lub podkreślenia i zakończ nazwę przez .md.', 'error');
        }
      });
    });

    elements.dashboardInspector.addEventListener('focusin', (event) => {
      if (event.target.closest('[data-dashboard-field]')) beginEdit('dashboard');
    });
    elements.dashboardInspector.addEventListener('input', handleDashboardInspectorInput);
    elements.dashboardInspector.addEventListener('change', (event) => {
      handleDashboardInspectorInput(event);
      finishEdit();
      if (['source', 'variant'].includes(event.target.dataset.dashboardField)) renderDashboardInspector();
    });
    elements.dashboardInspector.addEventListener('focusout', (event) => {
      if (event.target.closest('[data-dashboard-field]')) finishEdit();
    });
    elements.dashboardInspector.addEventListener('click', (event) => {
      const action = event.target.closest('[data-inspector-action]');
      if (action && state.dashboard.selectedUid) {
        dashboardNodeAction(action.dataset.inspectorAction, state.dashboard.selectedUid);
      }
    });

    elements.lessonInspector.addEventListener('focusin', (event) => {
      if (event.target.closest('[data-lesson-field]')) beginEdit('lesson');
    });
    elements.lessonInspector.addEventListener('input', handleLessonInspectorInput);
    elements.lessonInspector.addEventListener('change', (event) => {
      handleLessonInspectorInput(event);
      finishEdit();
      if (['type', 'options', 'useColor'].includes(event.target.dataset.lessonField)) renderLessonInspector();
    });
    elements.lessonInspector.addEventListener('focusout', (event) => {
      if (event.target.closest('[data-lesson-field]')) finishEdit();
    });
    elements.lessonInspector.addEventListener('click', (event) => {
      const action = event.target.closest('[data-lesson-inspector-action]');
      if (action && state.lesson.selectedId) {
        lessonNodeAction(action.dataset.lessonInspectorAction, state.lesson.selectedId);
      }
    });

    all('[data-dashboard-panel]').forEach((button) => {
      button.addEventListener('click', () => activateInspectorPanel('dashboard', button.dataset.dashboardPanel));
    });
    all('[data-lesson-panel]').forEach((button) => {
      button.addEventListener('click', () => activateInspectorPanel('lesson', button.dataset.lessonPanel));
    });
    [elements.dashboardPreview, elements.lessonPreview].forEach((preview) => {
      preview.addEventListener('click', (event) => {
        const button = event.target.closest('[data-full-preview]');
        if (button) openFullPreview(button.dataset.fullPreview);
      });
    });

    elements.dashboardLoad.addEventListener('click', loadActiveDashboard);
    elements.dashboardPublish.addEventListener('click', prepareDashboardPublish);
    elements.dashboardSource.addEventListener('click', () => openSourceDialog('dashboard'));
    elements.dashboardImport.addEventListener('click', () => elements.dashboardFile.click());
    elements.dashboardFile.addEventListener('change', () => {
      const file = elements.dashboardFile.files && elements.dashboardFile.files[0];
      importMarkdownFile(file, 'dashboard');
      elements.dashboardFile.value = '';
    });

    elements.lessonSource.addEventListener('click', () => openSourceDialog('lesson'));
    elements.lessonImport.addEventListener('click', () => elements.lessonFile.click());
    elements.lessonFile.addEventListener('change', () => {
      const file = elements.lessonFile.files && elements.lessonFile.files[0];
      importMarkdownFile(file, 'lesson');
      elements.lessonFile.value = '';
    });
    elements.lessonDownload.addEventListener('click', downloadLesson);
    elements.lessonCopy.addEventListener('click', async () => {
      try {
        await copyText(lessonModelApi.serializeLesson(state.lesson.model));
        toast('Markdown skopiowany', 'Możesz wkleić go bezpośrednio do nowego pliku .md.');
      } catch (error) {
        toast('Nie udało się skopiować', error.message, 'error');
      }
    });

    elements.sourceCopy.addEventListener('click', async () => {
      try {
        await copyText(elements.sourceTextarea.value);
        elements.sourceStatus.textContent = 'Skopiowano do schowka.';
        elements.sourceStatus.className = 'dialog-status';
      } catch (error) {
        elements.sourceStatus.textContent = error.message;
        elements.sourceStatus.className = 'dialog-status is-error';
      }
    });
    elements.sourceApply.addEventListener('click', applySourceDialog);
    elements.publishDialog.addEventListener('close', () => {
      if (elements.publishDialog.returnValue === 'default') publishDashboard();
    });

    window.addEventListener('pagehide', flushDrafts);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushDrafts();
    });
    document.addEventListener('dragend', clearDragClasses);
    document.addEventListener('keydown', (event) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier) return;
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      } else if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (state.mode === 'dashboard') prepareDashboardPublish();
        else if (state.mode === 'lesson') downloadLesson();
      }
    });
  }

  async function start() {
    if (!dashboardModelApi || !lessonModelApi || !window.ChemLesson) {
      setAccessState(
        'Studio nie może się uruchomić',
        'Brakuje jednego z lokalnych modułów buildera. Sprawdź pliki wdrożenia.',
        true
      );
      return;
    }
    let authState;
    try {
      authState = window.ChemAuth && window.ChemAuth.ready
        ? await window.ChemAuth.ready
        : null;
    } catch (_) {
      authState = null;
    }
    const user = window.ChemAuth && typeof window.ChemAuth.getUser === 'function'
      ? window.ChemAuth.getUser()
      : null;
    if (!authState || !authState.authenticated || !authState.session?.ok || !user) {
      setAccessState(
        'Sesja nie jest aktywna',
        'Zaloguj się ponownie, aby otworzyć Studio treści.',
        true
      );
      return;
    }
    if (!isAdmin(user)) {
      setAccessState(
        'Studio jest tylko dla administratora',
        'To konto może korzystać z kursu, ale nie może edytować ani publikować jego zawartości.',
        true
      );
      return;
    }
    state.currentUser = user;
    loadDrafts();
    bindEvents();
    elements.accessState.hidden = true;
    elements.app.hidden = false;
    elements.modeSwitch.hidden = false;
    switchMode('home');
    setSaveIndicator('Drafty gotowe', 'saved');
  }

  document.addEventListener('DOMContentLoaded', start);
})();
