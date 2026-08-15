(function initializeChemDiskStudio() {
  'use strict';

  const DASHBOARD_DRAFT_KEY = 'chemdisk.studio.dashboard.v1';
  const LESSON_DRAFT_KEY = 'chemdisk.studio.lesson.v1';
  const PROMPT_DRAFT_KEY = 'chemdisk.studio.prompt.v1';
  const STUDIO_LAYOUT_KEY = 'chemdisk.studio.layout.v1';
  const THEME_KEY = 'chem.theme';
  const HISTORY_LIMIT = 60;
  const MAX_IMPORT_BYTES = 512 * 1024;
  const ADMIN_PROGRESS_URL = '/.netlify/functions/admin-progress';
  const dashboardModelApi = window.ChemDashboardStudioModel;
  const lessonModelApi = window.ChemLessonStudioModel;
  const promptModelApi = window.ChemPromptStudioModel;

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
    contentExplorerRepository: byId('content-explorer-repository'),
    contentExplorerSearch: byId('content-explorer-search'),
    contentExplorerRefresh: byId('content-explorer-refresh'),
    contentExplorerStatus: byId('content-explorer-status'),
    contentExplorerFolders: byId('content-explorer-folders'),
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
    dashboardRepository: byId('dashboard-repository-select'),
    dashboardAssetSearch: byId('dashboard-asset-search'),
    dashboardAssetStatus: byId('dashboard-asset-status'),
    dashboardAssetList: byId('dashboard-asset-list'),
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
    lessonRepository: byId('lesson-repository-select'),
    lessonAssetSearch: byId('lesson-asset-search'),
    lessonAssetStatus: byId('lesson-asset-status'),
    lessonAssetList: byId('lesson-asset-list'),
    lessonSource: byId('lesson-source-button'),
    lessonCopy: byId('lesson-copy-button'),
    lessonDownload: byId('lesson-download-button'),
    lessonNew: byId('lesson-new-button'),
    lessonImport: byId('lesson-import-button'),
    lessonFile: byId('lesson-file-input'),
    lessonRepositorySave: byId('lesson-repository-save-button'),
    lessonRepositoryDelete: byId('lesson-repository-delete-button'),
    promptWorkspace: byId('prompt-workspace'),
    examWorkspace: byId('exam-workspace'),
    promptFilename: byId('prompt-filename-input'),
    promptFormat: byId('prompt-format-select'),
    promptInstruction: byId('prompt-instruction-input'),
    promptJsonEditor: byId('prompt-json-editor'),
    promptPointsEditor: byId('prompt-points-editor'),
    promptPointsList: byId('prompt-points-list'),
    promptPointCount: byId('prompt-point-count'),
    promptAddPoint: byId('prompt-add-point-button'),
    promptRepository: byId('prompt-repository-select'),
    promptAssetSearch: byId('prompt-asset-search'),
    promptAssetStatus: byId('prompt-asset-status'),
    promptAssetList: byId('prompt-asset-list'),
    promptValidationStatus: byId('prompt-validation-status'),
    promptSourcePreview: byId('prompt-source-preview'),
    promptSource: byId('prompt-source-button'),
    promptCopy: byId('prompt-copy-button'),
    promptDownload: byId('prompt-download-button'),
    promptImport: byId('prompt-import-button'),
    promptFile: byId('prompt-file-input'),
    promptRepositorySave: byId('prompt-repository-save-button'),
    promptRepositoryDelete: byId('prompt-repository-delete-button'),
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
    lesson: { undo: [], redo: [] },
    prompt: { undo: [], redo: [] }
  };

  const state = {
    mode: 'home',
    currentUser: null,
    editSession: null,
    saveTimers: { dashboard: 0, lesson: 0, prompt: 0 },
    previewWindows: { dashboard: null, lesson: null },
    contentLibrary: {
      repositories: [],
      selectedRepositoryId: '',
      lessons: [],
      prompts: [],
      exams: [],
      loaded: false,
      loading: false,
      error: '',
      requestId: 0
    },
    sourceMode: 'dashboard',
    dashboard: {
      model: null,
      selectedUid: '',
      collapsedNodes: new Set(),
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
      previewSlideId: '',
      previewTransitionKey: '',
      formulaField: 'left',
      remoteFilename: '',
      remoteSha: '',
      remoteRepositoryId: '',
      saving: false
    },
    prompt: {
      model: null,
      remoteFilename: '',
      remoteSha: '',
      remoteRepositoryId: '',
      saving: false
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

  const STUDIO_LAYOUT_LABELS = {
    palette: ['Zwiń bibliotekę', 'Rozwiń bibliotekę'],
    inspector: ['Zwiń panel narzędzi i podglądu', 'Rozwiń panel narzędzi i podglądu'],
    toolbar: ['Zwiń narzędzia', 'Rozwiń narzędzia']
  };

  function applyStudioLayoutPart(workspace, part, collapsed) {
    if (!workspace || !STUDIO_LAYOUT_LABELS[part]) return;
    workspace.classList.toggle(`is-${part}-collapsed`, Boolean(collapsed));
    const button = workspace.querySelector(`[data-studio-toggle="${part}"]`);
    if (!button) return;
    const label = STUDIO_LAYOUT_LABELS[part][collapsed ? 1 : 0];
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  function saveStudioLayout() {
    const preferences = {};
    all('.workspace-view[data-workspace]').forEach((workspace) => {
      preferences[workspace.dataset.workspace] = {
        palette: workspace.classList.contains('is-palette-collapsed'),
        inspector: workspace.classList.contains('is-inspector-collapsed'),
        toolbar: workspace.classList.contains('is-toolbar-collapsed')
      };
    });
    writeStorage(STUDIO_LAYOUT_KEY, preferences);
  }

  function loadStudioLayout() {
    const preferences = readStorage(STUDIO_LAYOUT_KEY) || {};
    all('.workspace-view[data-workspace]').forEach((workspace) => {
      const saved = preferences[workspace.dataset.workspace] || {};
      ['palette', 'inspector', 'toolbar'].forEach((part) => {
        applyStudioLayoutPart(workspace, part, saved[part] === true);
      });
    });
  }

  function toggleStudioLayout(event) {
    const button = event.currentTarget;
    const workspace = button.closest('.workspace-view[data-workspace]');
    const part = button.dataset.studioToggle;
    if (!workspace || !STUDIO_LAYOUT_LABELS[part]) return;
    const collapsed = !workspace.classList.contains(`is-${part}-collapsed`);
    applyStudioLayoutPart(workspace, part, collapsed);
    saveStudioLayout();
  }

  function scheduleDraftSave(mode) {
    if (state.saveTimers[mode]) window.clearTimeout(state.saveTimers[mode]);
    setSaveIndicator('Zapisywanie draftu…', 'saving');
    state.saveTimers[mode] = window.setTimeout(() => {
      state.saveTimers[mode] = 0;
      const ok = mode === 'dashboard'
        ? writeStorage(DASHBOARD_DRAFT_KEY, state.dashboard.model)
        : mode === 'lesson'
          ? writeStorage(LESSON_DRAFT_KEY, state.lesson.model)
          : writeStorage(PROMPT_DRAFT_KEY, state.prompt.model);
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
    ['dashboard', 'lesson', 'prompt'].forEach((mode) => {
      if (state.saveTimers[mode]) {
        window.clearTimeout(state.saveTimers[mode]);
        state.saveTimers[mode] = 0;
      }
    });
    if (state.dashboard.model) writeStorage(DASHBOARD_DRAFT_KEY, state.dashboard.model);
    if (state.lesson.model) writeStorage(LESSON_DRAFT_KEY, state.lesson.model);
    if (state.prompt.model) writeStorage(PROMPT_DRAFT_KEY, state.prompt.model);
    window.ChemExamBuilder?.flush?.();
  }

  function snapshot(mode) {
    const model = mode === 'dashboard'
      ? state.dashboard.model
      : mode === 'lesson'
        ? state.lesson.model
        : state.prompt.model;
    return JSON.stringify(model);
  }

  function restoreSnapshot(mode, value) {
    const parsed = JSON.parse(value);
    if (mode === 'dashboard') {
      state.dashboard.model = dashboardModelApi.normalizeModel(parsed);
      state.dashboard.selectedUid = '';
      renderDashboard();
      updateDashboardDirtyState();
    } else if (mode === 'lesson') {
      state.lesson.model = lessonModelApi.createLesson(parsed);
      state.lesson.selectedId = '';
      state.lesson.previewSlideId = state.lesson.model.slides[0] ? state.lesson.model.slides[0].id : '';
      renderLesson();
    } else {
      state.prompt.model = promptModelApi.createPrompt(parsed);
      renderPrompt();
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
    } else if (mode === 'lesson') {
      renderLesson();
    } else {
      renderPrompt();
    }
    return result;
  }

  function undo() {
    if (!['dashboard', 'lesson', 'prompt'].includes(state.mode)) return;
    finishEdit();
    const stack = history[state.mode];
    const previous = stack.undo.pop();
    if (!previous) return;
    stack.redo.push(snapshot(state.mode));
    restoreSnapshot(state.mode, previous);
    updateHistoryButtons();
  }

  function redo() {
    if (!['dashboard', 'lesson', 'prompt'].includes(state.mode)) return;
    finishEdit();
    const stack = history[state.mode];
    const next = stack.redo.pop();
    if (!next) return;
    stack.undo.push(snapshot(state.mode));
    restoreSnapshot(state.mode, next);
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    const available = ['dashboard', 'lesson', 'prompt'].includes(state.mode);
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
    return lessonModelApi.createStarterLesson('nowa-lekcja.md');
  }

  function lessonModelFromSource(source, filename) {
    return lessonModelApi.parseEditableLesson(source, filename);
  }

  function createNewLessonDraft() {
    if (!window.confirm('Rozpocząć nową lekcję? Bieżący szkic w builderze zostanie zastąpiony.')) {
      return;
    }
    finishEdit();
    const model = defaultLesson();
    state.lesson.model = model;
    state.lesson.selectedId = model.slides[0] ? model.slides[0].id : '';
    state.lesson.previewSlideId = model.slides[0] ? model.slides[0].id : '';
    state.lesson.remoteFilename = '';
    state.lesson.remoteSha = '';
    state.lesson.remoteRepositoryId = '';
    history.lesson.undo = [];
    history.lesson.redo = [];
    scheduleDraftSave('lesson');
    renderLesson();
    updateHistoryButtons();
    toast(
      'Nowa lekcja jest gotowa',
      'Nadaj nazwę pliku i kliknij „Utwórz plik w GitHubie”.'
    );
    window.requestAnimationFrame(() => {
      elements.lessonFilename.focus();
      elements.lessonFilename.select();
    });
  }

  function defaultPrompt() {
    return promptModelApi.createPrompt({
      filename: 'nowy-prompt.json',
      format: 'json',
      instruction: [
        'Jesteś cierpliwym korepetytorem chemii przygotowującym ucznia do matury.',
        'Najpierw zadaj krótkie pytanie naprowadzające, a pełne rozwiązanie pokaż dopiero na prośbę.',
        'Odpowiadaj po polsku i sprawdzaj jednostki oraz zapis równań reakcji.'
      ].join('\n')
    });
  }

  function loadDrafts() {
    const dashboardDraft = readStorage(DASHBOARD_DRAFT_KEY);
    const lessonDraft = readStorage(LESSON_DRAFT_KEY);
    const promptDraft = readStorage(PROMPT_DRAFT_KEY);
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
    try {
      state.prompt.model = promptDraft
        ? promptModelApi.createPrompt(promptDraft)
        : defaultPrompt();
    } catch (_) {
      state.prompt.model = defaultPrompt();
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
    const next = ['home', 'dashboard', 'lesson', 'exam', 'prompt'].includes(mode) ? mode : 'home';
    state.mode = next;
    elements.home.hidden = next !== 'home';
    elements.dashboardWorkspace.hidden = next !== 'dashboard';
    elements.lessonWorkspace.hidden = next !== 'lesson';
    elements.promptWorkspace.hidden = next !== 'prompt';
    elements.examWorkspace.hidden = next !== 'exam';
    all('[data-switch-mode]').forEach((button) => {
      const active = button.dataset.switchMode === next;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    if (next === 'dashboard') renderDashboard();
    if (next === 'lesson') renderLesson();
    if (next === 'prompt') renderPrompt();
    if (next === 'exam') void window.ChemExamBuilder?.activate?.();
    updateHistoryButtons();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function dashboardModuleDefaults(type) {
    const defaults = {
      slides: ['Nowa prezentacja', 'Otwórz prezentację do tego działu.'],
      pdf: ['Dokument PDF', 'Materiał do czytania lub pobrania.'],
      film: ['Nagranie lekcji', 'Obejrzyj nagranie w odtwarzaczu kursowym.'],
      yt: ['Film YouTube', 'Nagranie z własnymi kontrolkami ChemDisk.'],
      lesson: ['Lekcja interaktywna', 'Przejdź przez prezentację i zadania.'],
      forms: ['Test wiedzy', 'Sprawdź swoją wiedzę w formularzu.'],
      exam: ['Egzamin', 'Rozwiąż egzamin i zapisz wynik w ChemDisk.'],
      chat: ['Asystent AI', 'Skorzystaj z przygotowanej pomocy.'],
      kalkulator: ['Kalkulator naukowy', 'Wykonuj obliczenia potrzebne w zadaniach.'],
      classic: ['Kalkulator klasyczny', 'Szybkie podstawowe obliczenia.'],
      whiteboard: ['Biała tablica', 'Szkicuj wzory, reakcje i notatki.'],
      bitpaper: ['Tablica BitPaper', 'Wspólna przestrzeń do rozwiązywania zadań.'],
      atonom: ['ATONOM', 'Buduj modele cząsteczek z polskich nazw.'],
      contact: ['Formularz kontaktowy', 'Wyślij wiadomość do prowadzącego bez opuszczania platformy.'],
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
      repositoryId: ['lesson', 'chat', 'exam'].includes(type)
        ? state.contentLibrary.selectedRepositoryId
        : '',
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

  function addDashboardNode(type, parentUid, index, preparedNode) {
    commitMutation('dashboard', () => {
      let node = preparedNode || createDashboardNode(type);
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

  function insertDashboardAsset(asset) {
    if (!asset || !asset.filename) return;
    let node;
    if (asset.kind === 'lesson') {
      node = dashboardModelApi.createModule({
        module: 'lesson',
        repositoryId: asset.repositoryId,
        file: asset.filename,
        title: asset.title || asset.filename,
        description: asset.description || 'Interaktywna lekcja z prywatnej biblioteki kursu.'
      });
    } else if (asset.kind === 'exam') {
      node = dashboardModelApi.createModule({
        module: 'exam',
        repositoryId: asset.repositoryId,
        examId: asset.filename,
        title: asset.title || asset.filename,
        description: asset.description || 'Egzamin z bezpiecznym zapisem próby i wyniku.'
      });
    } else {
      const isText = /\.txt$/i.test(asset.filename);
      node = dashboardModelApi.createModule({
        module: 'chat',
        repositoryId: asset.repositoryId,
        source: isText ? 'file' : 'prompt',
        file: isText ? asset.filename : '',
        point: isText ? 1 : null,
        prompt: isText ? '' : asset.filename,
        title: asset.title || asset.filename,
        description: asset.description || 'Asystent korzystający z instrukcji z prywatnego repozytorium.'
      });
    }
    addDashboardNode(node.module, null, undefined, node);
    toast(
      'Materiał dodany',
      asset.kind === 'lesson'
        ? 'Karta lekcji jest gotowa w dashboardzie.'
        : asset.kind === 'exam'
          ? 'Karta egzaminu jest gotowa w dashboardzie.'
        : 'Karta AI jest gotowa; dla pliku TXT sprawdź numer punktu.'
    );
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
    if (node.kind === 'section' || node.kind === 'group') {
      const collapsed = state.dashboard.collapsedNodes.has(node.uid);
      const noun = node.kind === 'section' ? 'sekcję' : 'harmonijkę';
      const collapse = actionButton(
        'toggle-collapse',
        collapsed ? `Rozwiń ${noun} w edytorze` : `Zwiń ${noun} w edytorze`,
        collapsed ? '⌄' : '⌃'
      );
      collapse.classList.add('dashboard-collapse-action');
      collapse.setAttribute('aria-expanded', String(!collapsed));
      actions.append(collapse);
    }
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
      const collapsed = state.dashboard.collapsedNodes.has(node.uid);
      group.classList.toggle('is-selected', state.dashboard.selectedUid === node.uid);
      group.classList.toggle('is-editor-collapsed', collapsed);
      group.append(nodeHeader(node));
      const body = create('div', 'group-body');
      node.blocks.forEach((block, blockIndex) => {
        body.append(dashboardDropZone(node.uid, blockIndex));
        body.append(renderDashboardBlock(block, node.uid, blockIndex));
      });
      body.append(dashboardDropZone(node.uid, node.blocks.length, 'Dodaj do harmonijki'));
      body.hidden = collapsed;
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
    const collapsed = state.dashboard.collapsedNodes.has(section.uid);
    article.classList.toggle('is-selected', state.dashboard.selectedUid === section.uid);
    article.classList.toggle('is-editor-collapsed', collapsed);
    article.append(nodeHeader(section));
    const body = create('div', 'section-body');
    section.blocks.forEach((block, blockIndex) => {
      body.append(dashboardDropZone(section.uid, blockIndex));
      body.append(renderDashboardBlock(block, section.uid, blockIndex));
    });
    body.append(dashboardDropZone(section.uid, section.blocks.length, 'Dodaj do sekcji'));
    body.hidden = collapsed;
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

  function repositoryOptions(includeDefault) {
    const repositories = state.contentLibrary.repositories;
    const options = repositories.map((repository) => ({
      value: repository.id,
      label: repository.label || repository.repository
    }));
    if (includeDefault) {
      const fallback = repositories.find((repository) => repository.default) || repositories[0];
      options.unshift({
        value: '',
        label: fallback
          ? `Domyślne — ${fallback.label || fallback.repository}`
          : 'Domyślne repozytorium'
      });
    }
    return options;
  }

  function defaultContentRepositoryId() {
    const repository = state.contentLibrary.repositories.find((item) => item.default)
      || state.contentLibrary.repositories[0];
    return repository ? repository.id : '';
  }

  function syncInspectorRepository(repositoryId) {
    const requestedId = repositoryId || defaultContentRepositoryId();
    if (
      requestedId
      && requestedId !== state.contentLibrary.selectedRepositoryId
      && state.contentLibrary.repositories.some((repository) => repository.id === requestedId)
    ) {
      void selectContentRepository(requestedId);
    }
  }

  function repositoryFilenameInput(value, fieldName, kind, extension, repositoryId) {
    const wrapper = create('div', 'repository-filename-control');
    const input = textInput(value, fieldName, {
      placeholder: kind === 'lesson' ? 'np. stechiometria.md' : `np. pomoc.${extension}`,
      maxLength: 80
    });
    const list = document.createElement('datalist');
    list.id = `repository-options-${fieldName}-${extension}`;
    const selectedRepositoryId = repositoryId || (
      state.contentLibrary.repositories.find((repository) => repository.default) || {}
    ).id || state.contentLibrary.selectedRepositoryId;
    const assets = (kind === 'lesson'
      ? state.contentLibrary.lessons
      : state.contentLibrary.prompts.filter((asset) => asset.filename.toLowerCase().endsWith(`.${extension}`)))
      .filter((asset) => !selectedRepositoryId || asset.repositoryId === selectedRepositoryId);
    assets.forEach((asset) => {
      const option = document.createElement('option');
      option.value = asset.filename;
      option.label = asset.title || asset.filename;
      list.append(option);
    });
    input.setAttribute('list', list.id);
    wrapper.append(input, list);
    return wrapper;
  }

  function lessonRepositoryFilenameInput(value, fieldName, extensions, repositoryId) {
    const wrapper = create('div', 'repository-filename-control');
    const allowedExtensions = (Array.isArray(extensions) ? extensions : [extensions])
      .map((extension) => String(extension || '').toLowerCase())
      .filter(Boolean);
    const input = lessonInput(value, fieldName, {
      placeholder: allowedExtensions.length > 1
        ? 'Wybierz plik JSON lub TXT'
        : `Wybierz plik .${allowedExtensions[0] || 'txt'}`,
      maxLength: 80
    });
    const list = document.createElement('datalist');
    list.id = `lesson-repository-options-${fieldName}-${allowedExtensions.join('-')}`;
    const selectedRepositoryId = repositoryId || (
      state.contentLibrary.repositories.find((repository) => repository.default) || {}
    ).id || state.contentLibrary.selectedRepositoryId;
    state.contentLibrary.prompts
      .filter((asset) => (
        (!selectedRepositoryId || asset.repositoryId === selectedRepositoryId)
        && allowedExtensions.some((extension) => asset.filename.toLowerCase().endsWith(`.${extension}`))
      ))
      .forEach((asset) => {
        const option = document.createElement('option');
        option.value = asset.filename;
        option.label = asset.title || asset.filename;
        list.append(option);
      });
    input.setAttribute('list', list.id);
    wrapper.append(input, list);
    return wrapper;
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

  function effectiveDashboardProgress(found, key) {
    let current = found && found.node;
    while (current) {
      const value = current.progress && current.progress[key];
      if (value === 'ON' || value === 'OFF') return value;
      const parent = current.uid === state.dashboard.model.uid
        ? null
        : dashboardModelApi.findNode(state.dashboard.model, current.uid)?.parent;
      current = parent;
    }
    return 'ON';
  }

  function dashboardProgressFields(form, found) {
    const node = found.node;
    const progress = node.progress || {};
    const isRoot = node.kind === 'dashboard';
    const group = create('section', 'inspector-progress-settings');
    group.append(create('h3', '', 'Postęp ucznia'));
    group.append(field(
      'Śledzenie postępu',
      selectInput(progress.tracking || (isRoot ? 'ON' : 'INHERIT'), 'progressTracking', [
        ...(!isRoot ? [{ value: 'INHERIT', label: 'Dziedzicz' }] : []),
        { value: 'ON', label: 'Włączone' },
        { value: 'OFF', label: 'Wyłączone' }
      ]),
      `Efektywnie: ${effectiveDashboardProgress(found, 'tracking') === 'ON' ? 'włączone' : 'wyłączone'}. Wyłączenie nie usuwa historii.`
    ));
    group.append(field(
      'Pokazuj pasek uczniowi',
      selectInput(progress.showProgress || (isRoot ? 'ON' : 'INHERIT'), 'progressShowProgress', [
        ...(!isRoot ? [{ value: 'INHERIT', label: 'Dziedzicz' }] : []),
        { value: 'ON', label: 'Tak' },
        { value: 'OFF', label: 'Nie' }
      ]),
      `Efektywnie: ${effectiveDashboardProgress(found, 'showProgress') === 'ON' ? 'widoczny' : 'ukryty'}. Ukrycie nie wyłącza raportowania.`
    ));
    if (isRoot) {
      const opens = create('label', 'check-field');
      const input = textInput('', 'progressRecordOpens', { type: 'checkbox' });
      input.checked = node.recordOpens !== false;
      opens.append(input, create('span', '', 'Rejestruj otwarcia materiałów'));
      group.append(opens);
      form.append(group);
      return;
    }
    group.append(field(
      'Waga',
      textInput(String(progress.weight || 1), 'progressWeight', { type: 'number' }),
      'Domyślna waga to 1. Element z włączonym śledzeniem automatycznie wpływa na postęp wszystkich swoich rodziców.'
    ));
    form.append(group);
  }

  function renderDashboardInspector() {
    elements.dashboardInspector.replaceChildren();
    const found = state.dashboard.selectedUid
      ? dashboardModelApi.findNode(state.dashboard.model, state.dashboard.selectedUid)
      : { node: state.dashboard.model, parent: null, container: null, index: -1 };
    const node = found.node;
    if (node.kind === 'module' && ['lesson', 'chat', 'exam'].includes(node.module)) {
      syncInspectorRepository(node.repositoryId);
    }
    const form = create('form', 'inspector-form');
    form.addEventListener('submit', (event) => event.preventDefault());
    form.append(inspectorHeader(
      dashboardSymbol(node),
      dashboardNodeSubtitle(node),
      node.kind === 'module'
        ? 'Skonfiguruj kartę dokładnie tak, jak ma otwierać się kursantowi.'
        : 'Zmień nazwę i treść zaznaczonego klocka.'
    ));

    if (node.kind === 'dashboard') {
      form.append(create('p', 'field-help', 'Ustawienia całej platformy. Wyłączenie postępu nie usuwa wcześniejszej historii.'));
    } else if (node.kind === 'section' || node.kind === 'group') {
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
      if (['slides', 'pdf', 'film', 'yt', 'forms'].includes(node.module)) {
        const directWebMode = ['slides', 'pdf'].includes(node.module)
          && ['4', '5'].includes(String(node.protection));
        form.append(field(
          definition.idLabel || 'ID materiału',
          textInput(node.id, 'id', {
            placeholder: directWebMode ? 'https://…' : 'Wklej ID albo pełny link'
          }),
          node.module === 'film'
            ? 'Dla type=2 podaj ID lub link Google Drive; pozostałe tryby korzystają z YouTube.'
            : directWebMode
              ? node.protection === '4'
                ? 'Wklej pełny adres HTTPS. Strona zostanie osadzona w iframe, jeśli jej właściciel na to pozwala.'
                : 'Wklej pełny adres HTTPS. Po sprawdzeniu dostępu moduł otworzy go bezpośrednio w zwykłym widoku przeglądarki.'
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
          'Repozytorium',
          selectInput(node.repositoryId, 'repositoryId', repositoryOptions(true))
        ));
        form.append(field(
          'Plik lekcji',
          repositoryFilenameInput(node.file, 'file', 'lesson', 'md', node.repositoryId),
          'Wybierz plik z prywatnego repozytorium albo wpisz jego nazwę.'
        ));
      }
      if (node.module === 'exam') {
        form.append(field(
          'Repozytorium',
          selectInput(node.repositoryId, 'repositoryId', repositoryOptions(true))
        ));
        const examOptions = state.contentLibrary.exams
          .filter((asset) => !node.repositoryId || asset.repositoryId === node.repositoryId)
          .map((asset) => ({ value: asset.filename, label: asset.title || asset.filename }));
        if (node.examId && !examOptions.some((option) => option.value === node.examId)) {
          examOptions.unshift({ value: node.examId, label: `${node.examId} — poza bieżącą listą` });
        }
        form.append(field(
          'Egzamin',
          selectInput(node.examId, 'examId', examOptions.length ? examOptions : [{ value: '', label: 'Brak egzaminów w repozytorium' }]),
          'Karta przechowuje tylko repositoryId i examId. Definicja pozostaje w jednym pliku exam.json.'
        ));
      }
      if (node.module === 'chat') {
        form.append(field(
          'Repozytorium',
          selectInput(node.repositoryId, 'repositoryId', repositoryOptions(true))
        ));
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
            field('Plik TXT', repositoryFilenameInput(node.file, 'file', 'prompt', 'txt', node.repositoryId)),
            field('Numer punktu', textInput(node.point, 'point', { type: 'number', placeholder: '1' }))
          );
          form.append(row);
        } else {
          form.append(field(
            'Plik JSON',
            repositoryFilenameInput(node.prompt, 'prompt', 'prompt', 'json', node.repositoryId),
            'Lista pochodzi z prywatnego repozytorium materiałów.'
          ));
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
      if (node.module === 'slides') {
        form.append(field(
          'Sposób liczenia prezentacji',
          selectInput(node.presentationMode || 'highest', 'presentationMode', [
            { value: 'highest', label: 'Najwyższy osiągnięty slajd' },
            { value: 'visited', label: 'Odwiedzone slajdy' },
            { value: 'required', label: 'Wszystkie wymagane slajdy' }
          ]),
          'Dokładne dane wymagają playera przekazującego zdarzenia slajdów; osadzony Google Slides raportuje samo otwarcie.'
        ));
      }
      if (node.module === 'film' || node.module === 'yt') {
        form.append(field(
          'Próg ukończenia filmu (%)',
          textInput(String(node.videoCompletionThreshold || 90), 'videoCompletionThreshold', { type: 'number' }),
          'Zakres 1–100%. Przewinięcie bez odtworzenia nie zwiększa rzeczywiście obejrzanego zakresu.'
        ));
      }
    }

    if (['dashboard', 'section', 'group', 'module'].includes(node.kind)) dashboardProgressFields(form, found);

    if (node.kind !== 'dashboard') form.append(inspectorActions());
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
    if (
      action === 'toggle-collapse'
      && (found.node.kind === 'section' || found.node.kind === 'group')
    ) {
      if (state.dashboard.collapsedNodes.has(uid)) state.dashboard.collapsedNodes.delete(uid);
      else state.dashboard.collapsedNodes.add(uid);
      renderDashboardCanvas();
      return;
    }
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
      const progressResponse = await fetch(ADMIN_PROGRESS_URL, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'catalog',
          catalog: dashboardModelApi.toProgressCatalog(state.dashboard.model)
        })
      });
      if (!progressResponse.ok) {
        const progressError = await responseJson(progressResponse);
        throw new Error(`Dashboard zapisano, ale konfiguracja postępu wymaga ponowienia (${progressError?.error || progressResponse.status}).`);
      }
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
        bold: false,
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
    if (type === 'table') {
      return lessonModelApi.createBlock('table', {
        caption: 'Porównanie właściwości',
        align: 'left',
        headers: ['Substancja', 'Wzór', 'Właściwość'],
        rows: [
          ['Woda', 'H2O', 'ciecz'],
          ['Tlen', 'O2', 'gaz'],
          ['Chlorek sodu', 'NaCl', 'ciało stałe']
        ]
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
    if (type === 'exam') {
      const firstExam = state.contentLibrary.exams[0];
      return lessonModelApi.createBlock('exam', {
        title: firstExam?.title || 'Egzamin do lekcji',
        description: 'Ukończ egzamin, aby kontynuować naukę zgodnie z warunkiem tego kroku.',
        button: 'Otwórz egzamin',
        repositoryId: state.contentLibrary.selectedRepositoryId,
        examId: firstExam?.filename || '',
        requirement: 'optional',
        minimumScore: 75
      });
    }
    if (type === 'atonom') {
      return lessonModelApi.createBlock('atonom', {
        formula: 'fenol',
        title: 'Model cząsteczki w ATONOM'
      });
    }
    if (type === 'formula') {
      return lessonModelApi.createBlock('formula', {
        mode: 'chemistry',
        title: 'Spalanie wodoru',
        left: '2 H2 + O2',
        arrow: '->',
        above: '450 °C',
        below: 'kat. Pt',
        right: '2 H2O'
      });
    }
    if (type === 'ai') {
      return lessonModelApi.createBlock('ai', {
        title: 'Masz pytanie do tego slajdu?',
        description: 'Otwórz ChemDisk AI — treść slajdu zostanie dołączona jako kontekst.',
        button: 'Zapytaj AI',
        repositoryId: state.contentLibrary.selectedRepositoryId,
        promptFile: '',
        promptPoint: 1
      });
    }
    if (type === 'board') {
      return lessonModelApi.createBlock('board', {
        title: 'Otwórz białą tablicę',
        description: 'Rozpisz rozwiązanie, równanie albo schemat na interaktywnej tablicy.',
        button: 'Otwórz tablicę',
        variant: 'whiteboard',
        path: '',
        newTab: true
      });
    }
    if (type === 'contact') {
      return lessonModelApi.createBlock('contact', {
        title: 'Masz pytanie do prowadzącego?',
        description: 'Wyślij wiadomość przez formularz kontaktowy platformy.',
        button: 'Otwórz formularz',
        internal: 'Pytanie dotyczące bieżącej lekcji',
        newTab: false
      });
    }
    if (type === 'link') {
      return lessonModelApi.createBlock('link', {
        title: 'Otwórz materiał dodatkowy',
        description: 'Kliknij kafelek, aby przejść do wybranej strony lub modułu.',
        url: '/members/',
        icon: 'link',
        color: '#0e665a',
        newTab: false
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
    if (taskType === 'gaps-text') {
      return lessonModelApi.createTask({
        type: 'gaps-text',
        question: 'Uzupełnij zdanie własnymi odpowiedziami.',
        text: 'Woda ma wzór {{wzór sumaryczny}}, a jej masa molowa wynosi około {{masa molowa}} g/mol.',
        label: 'Wpisz odpowiedzi w luki',
        answers: ['H2O', '18'],
        checkMode: 'each',
        hint: 'Sprawdź symbole pierwiastków i obliczenie masy molowej.'
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

  function revealFeaturedLessonTool(type) {
    const labels = {
      formula: 'Kreator równań',
      ai: 'Ustawienia pomocy AI',
      board: 'Ustawienia tablicy'
    };
    if (!labels[type]) return;

    applyStudioLayoutPart(elements.lessonWorkspace, 'inspector', false);
    activateInspectorPanel('lesson', 'inspector');
    saveStudioLayout();
    toast(`${labels[type]} — otwarte`, 'Ustawienia klocka znajdziesz w panelu Narzędzia i podgląd.');

    if (window.matchMedia?.('(max-width: 760px)').matches) {
      const panel = elements.lessonInspector.closest('.inspector-panel');
      window.requestAnimationFrame(() => {
        panel?.scrollIntoView({
          behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start'
        });
      });
    }
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
    revealFeaturedLessonTool(type);
  }

  function lessonBlockSymbol(block) {
    const symbols = {
      heading: 'H',
      text: 'T',
      list: '☷',
      table: '▦',
      image: '▧',
      quote: '❞',
      callout: '!',
      code: '</>',
      style: 'Aa',
      accordion: '⌄',
      youtube: 'YT',
      exam: 'E',
      atonom: '⚛',
      formula: '∑',
      ai: '✦',
      board: '✎',
      contact: '✉',
      link: '↗',
      flashcards: '↻'
    };
    return symbols[block.type] || 'T';
  }

  function lessonBlockTitle(block) {
    if (block.type === 'heading') return block.text || 'Nagłówek';
    if (block.type === 'text') return block.text || 'Pusty akapit';
    if (block.type === 'list') return block.items.join(' · ') || 'Pusta lista';
    if (block.type === 'table') return block.caption || 'Tabela';
    if (block.type === 'image') return block.alt || 'Ilustracja';
    if (block.type === 'quote') return block.text || 'Cytat';
    if (block.type === 'callout') return block.title || 'Callout';
    if (block.type === 'code') return block.language ? `Kod: ${block.language}` : 'Blok kodu';
    if (block.type === 'style') return 'Stylowany tekst';
    if (block.type === 'accordion') return block.title || 'Harmonijka';
    if (block.type === 'youtube') return block.title || 'Film YouTube';
    if (block.type === 'exam') return block.title || 'Egzamin';
    if (block.type === 'atonom') return block.title || `ATONOM: ${block.formula}`;
    if (block.type === 'formula') return block.title || (block.mode === 'math' ? 'Wzór matematyczny' : 'Równanie reakcji');
    if (block.type === 'ai') return block.title || 'Zapytaj AI o slajd';
    if (block.type === 'board') return block.title || 'Tablica interaktywna';
    if (block.type === 'contact') return block.title || 'Formularz kontaktowy';
    if (block.type === 'link') return block.title || 'Kafelek z linkiem';
    if (block.type === 'flashcards') return block.title || 'Fiszki';
    return 'Klocek';
  }

  function lessonBlockSubtitle(block) {
    if (block.type === 'style') {
      return `${block.font} · ${block.size} · ${block.align}${block.bold ? ' · pogrubiony' : ''}${block.color ? ` · tekst ${block.color}` : ''}${block.background ? ` · tło ${block.background}` : ''}`;
    }
    if (block.type === 'accordion') return `${block.blocks.length} elementów · ${block.open ? 'otwarta' : 'zamknięta'}`;
    if (block.type === 'list') return `${block.items.length} punktów`;
    if (block.type === 'table') return `${block.headers.length} kolumn · ${block.rows.length} wierszy · ${block.align}`;
    if (block.type === 'image') return block.url || 'Uzupełnij adres HTTPS';
    if (block.type === 'youtube') return block.video || 'Uzupełnij link lub ID filmu';
    if (block.type === 'exam') {
      const requirements = {
        optional: 'opcjonalny',
        completed: 'wymagane ukończenie',
        passed: 'wymagane zaliczenie',
        minimum_score: `minimum ${Math.max(0, Math.min(100, Number(block.minimumScore) || 0))}%`
      };
      return `${block.examId || 'wybierz egzamin'} · ${requirements[block.requirement] || requirements.optional}`;
    }
    if (block.type === 'atonom') return `Związek: ${block.formula || 'nieustawiony'}`;
    if (block.type === 'formula') {
      return block.mode === 'math'
        ? (block.expression || 'Uzupełnij wzór matematyczny')
        : `${block.left || '…'}${block.arrow ? ` ${block.arrow} ${block.right || '…'}` : ''}`;
    }
    if (block.type === 'ai') {
      return block.promptFile
        ? `AI · ${block.promptFile}${/\.txt$/i.test(block.promptFile) ? ` · punkt ${block.promptPoint}` : ''}`
        : 'AI · ogólny asystent';
    }
    if (block.type === 'board') {
      return block.variant === 'bitpaper'
        ? `BitPaper${block.path ? ` · ${block.path}` : ''}`
        : 'Biała tablica';
    }
    if (block.type === 'contact') {
      return block.newTab ? 'Formularz · nowa karta' : 'Formularz · w module lekcji';
    }
    if (block.type === 'link') return block.url || 'Uzupełnij adres linku';
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

  function slideTransitionLabel(value) {
    const labels = {
      none: 'bez przejścia',
      fade: 'łagodne zanikanie',
      rise: 'subtelnie w górę',
      slide: 'delikatnie z boku',
      zoom: 'miękkie przybliżenie'
    };
    return labels[value] || labels.fade;
  }

  function slideSummary(slide) {
    return `${slide.blocks.length} klocków${slide.task ? ' · 1 pytanie' : ''} · ${slideTransitionLabel(slide.transition)}`;
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
      task.type === 'abcd'
        ? 'AB'
        : task.type === 'number'
          ? '#'
          : task.type === 'gaps'
            ? '□'
            : task.type === 'gaps-text' ? 'Aa' : '✓'
    );
    const copy = create('span', 'node-copy');
    copy.append(
      create('strong', '', task.question || 'Pytanie bez treści'),
      create(
        'small',
        '',
        task.type === 'abcd'
          ? 'Quiz ABCD'
          : task.type === 'gaps-text' ? 'Luki wpisywane ręcznie' : `Pytanie: ${task.type}`
      )
    );
    const actions = create('span', 'node-actions');
    actions.append(
      lessonActionButton('duplicate', 'Duplikuj pytanie na nowym slajdzie', '⧉'),
      lessonActionButton('delete', 'Usuń pytanie', '×', true)
    );
    item.append(symbol, copy, actions);
    return item;
  }

  function renderQuestionStarter(slide) {
    const starter = create('section', 'question-starter');
    starter.dataset.lessonSlideId = slide.id;
    const copy = create('div', 'question-starter-copy');
    copy.append(
      create('strong', '', 'Dodaj pytanie do tego slajdu'),
      create('small', '', 'Wybierz gotowy typ — odpowiedzi ustawisz w prostym formularzu.')
    );
    const actions = create('div', 'question-starter-actions');
    [
      ['task-abcd', 'Quiz ABCD'],
      ['task-choice', 'Wybór'],
      ['task-gaps', 'Luki z listy'],
      ['task-gaps-text', 'Luki tekstowe'],
      ['task-text', 'Krótka odpowiedź']
    ].forEach(([type, title]) => {
      const button = create('button', 'mini-button', title);
      button.type = 'button';
      button.dataset.lessonQuickTask = type;
      button.dataset.lessonSlideId = slide.id;
      actions.append(button);
    });
    starter.append(copy, actions);
    return starter;
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
      create('small', '', slideSummary(slide))
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
    else blocks.append(renderQuestionStarter(slide));
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

  function taskCorrectOptionIndex(task) {
    if (task.type === 'abcd') {
      const answer = String(task.answers[0] || 'A').trim();
      const letter = answer.toUpperCase();
      if (/^[A-D]$/.test(letter)) return letter.charCodeAt(0) - 65;
      return Math.max(0, task.options.indexOf(answer));
    }
    return Math.max(0, task.options.indexOf(task.answers[0]));
  }

  function taskOptionsEditor(task, withCorrectAnswer) {
    const editor = create('section', 'task-answer-editor');
    const header = create('header', 'task-answer-editor-header');
    const heading = create('div');
    heading.append(
      create('strong', '', withCorrectAnswer ? 'Odpowiedzi' : 'Lista odpowiedzi do wyboru'),
      create(
        'small',
        '',
        withCorrectAnswer
          ? 'Wpisz treść i zaznacz ptaszkiem jedną poprawną odpowiedź.'
          : 'Te odpowiedzi pojawią się przy każdej luce.'
      )
    );
    header.append(heading);
    const list = create('div', 'task-option-editor-list');
    const correctIndex = taskCorrectOptionIndex(task);
    task.options.forEach((option, index) => {
      const row = create('div', 'task-option-editor-row');
      row.dataset.optionIndex = String(index);
      if (withCorrectAnswer) {
        const correct = create('label', 'task-correct-toggle');
        correct.title = 'Oznacz jako poprawną odpowiedź';
        const radio = lessonInput(String(index), 'correctOption', {
          type: 'radio',
          checked: index === correctIndex
        });
        radio.name = `task-correct-${task.id}`;
        radio.setAttribute('aria-label', `Odpowiedź ${String.fromCharCode(65 + index)} jest poprawna`);
        const mark = create('span', 'task-correct-mark', '✓');
        mark.setAttribute('aria-hidden', 'true');
        correct.append(radio, mark);
        row.append(correct);
      } else {
        row.append(create('span', 'task-option-letter', String.fromCharCode(65 + index)));
      }
      const input = lessonInput(option, 'optionItem', {
        maxLength: 240,
        placeholder: `Odpowiedź ${String.fromCharCode(65 + index)}`
      });
      input.dataset.optionIndex = String(index);
      row.append(input);
      const remove = create('button', 'task-row-remove', '×');
      remove.type = 'button';
      remove.dataset.lessonTaskEditorAction = 'remove-option';
      remove.dataset.optionIndex = String(index);
      remove.setAttribute('aria-label', `Usuń odpowiedź ${String.fromCharCode(65 + index)}`);
      remove.disabled = task.type === 'abcd' || task.options.length <= 2;
      row.append(remove);
      list.append(row);
    });
    const add = create('button', 'button button-soft task-editor-add', '＋ Dodaj odpowiedź');
    add.type = 'button';
    add.dataset.lessonTaskEditorAction = 'add-option';
    add.disabled = task.type === 'abcd' || task.options.length >= 8;
    editor.append(header, list, add);
    return editor;
  }

  function taskGapLabels(task) {
    return taskGapStructure(task).labels;
  }

  function taskGapStructure(task) {
    const text = String(task.text || '');
    const labels = [];
    const segments = [];
    const pattern = /\{\{([^{}]*)\}\}/g;
    let match;
    let offset = 0;
    while ((match = pattern.exec(text))) {
      segments.push(text.slice(offset, match.index));
      labels.push(match[1].trim() || `luka ${labels.length + 1}`);
      offset = match.index + match[0].length;
    }
    segments.push(text.slice(offset));
    return { labels, segments };
  }

  function applyTaskGapStructure(task, structure) {
    const labels = Array.isArray(structure && structure.labels) ? structure.labels : [];
    const segments = Array.isArray(structure && structure.segments) ? structure.segments : [''];
    task.text = labels.map((label, index) => (
      `${String(segments[index] || '')}{{${String(label || `luka ${index + 1}`).replace(/[{}|]/g, '').trim() || `luka ${index + 1}`}}}`
    )).join('') + String(segments[labels.length] || '');
  }

  function replaceTaskGapLabel(task, targetIndex, value) {
    let current = 0;
    const label = String(value || '').replace(/[{}|]/g, '').trim() || `luka ${targetIndex + 1}`;
    task.text = String(task.text || '').replace(/\{\{([^{}]*)\}\}/g, (match) => {
      const replacement = current === targetIndex ? `{{${label}}}` : match;
      current += 1;
      return replacement;
    });
  }

  function taskGapEditor(task) {
    const editor = create('section', 'task-answer-editor task-gap-editor');
    const header = create('header', 'task-answer-editor-header');
    const heading = create('div');
    heading.append(
      create('strong', '', 'Wizualny edytor zdania z lukami'),
      create('small', '', 'Wpisuj zwykły tekst. Przyciskiem dodasz lukę dokładnie w wybranym miejscu.')
    );
    header.append(heading);
    const structure = taskGapStructure(task);
    const sentence = create('div', 'task-gap-sentence-editor');
    structure.segments.forEach((segment, index) => {
      const row = create('div', 'task-gap-segment-row');
      const text = lessonTextarea(segment, 'gapSegment', {
        rows: 2,
        maxLength: 1600,
        placeholder: index === 0 ? 'Wpisz początek zdania…' : 'Wpisz dalszą część zdania…'
      });
      text.dataset.gapSegmentIndex = String(index);
      const insert = create('button', 'mini-button task-gap-insert', '＋ Dodaj lukę tutaj');
      insert.type = 'button';
      insert.dataset.lessonTaskEditorAction = 'insert-gap';
      insert.dataset.gapSegmentIndex = String(index);
      row.append(
        field(
          index < structure.labels.length ? `Tekst przed luką ${index + 1}` : 'Tekst po ostatniej luce',
          text
        ),
        insert
      );
      sentence.append(row);
      if (index < structure.labels.length) {
        const token = create('div', 'task-gap-token');
        token.append(
          create('span', 'task-gap-number', String(index + 1)),
          create('span', '', `Luka: ${structure.labels[index]}`)
        );
        sentence.append(token);
      }
    });

    const answersHeading = create('div', 'task-gap-answers-heading');
    answersHeading.append(
      create('strong', '', 'Ustawienia luk'),
      create('small', '', 'Nazwij każdą lukę i wybierz albo wpisz poprawną odpowiedź.')
    );
    const list = create('div', 'task-gap-editor-list');
    const labels = structure.labels;
    labels.forEach((gapLabel, index) => {
      const row = create('div', 'task-gap-editor-row');
      const number = create('span', 'task-gap-number', String(index + 1));
      const labelInput = lessonInput(gapLabel, 'gapLabel', {
        maxLength: 100,
        placeholder: `Opis luki ${index + 1}`
      });
      labelInput.dataset.gapIndex = String(index);
      let answerInput;
      if (task.type === 'gaps') {
        answerInput = lessonSelect(task.answers[index] || '', 'gapAnswer', task.options.map((option) => ({
          value: option,
          label: option
        })));
      } else {
        answerInput = lessonInput(task.answers[index] || '', 'gapAnswer', {
          maxLength: 160,
          placeholder: 'Poprawna odpowiedź'
        });
      }
      answerInput.dataset.gapIndex = String(index);
      const remove = create('button', 'task-row-remove', '×');
      remove.type = 'button';
      remove.dataset.lessonTaskEditorAction = 'remove-gap';
      remove.dataset.gapIndex = String(index);
      remove.setAttribute('aria-label', `Usuń lukę ${index + 1}`);
      row.append(
        number,
        field('Opis widoczny w luce', labelInput),
        field('Poprawna odpowiedź', answerInput),
        remove
      );
      list.append(row);
    });
    if (!labels.length) {
      list.append(create('p', 'task-editor-empty', 'Nie ma jeszcze żadnej luki. Kliknij „Dodaj lukę tutaj” przy wybranym fragmencie zdania.'));
    }
    editor.append(header, sentence, answersHeading, list);
    return editor;
  }

  function lessonTaskEditorAction(button) {
    const found = findLessonNode(state.lesson.selectedId);
    if (!found || found.kind !== 'task') return;
    const task = found.node;
    const action = button.dataset.lessonTaskEditorAction;
    if (action === 'add-option') {
      if (task.options.length >= 8 || task.type === 'abcd') return;
      commitMutation('lesson', () => {
        task.options.push(`Nowa odpowiedź ${task.options.length + 1}`);
      });
      return;
    }
    if (action === 'remove-option') {
      const index = Number(button.dataset.optionIndex);
      if (!Number.isSafeInteger(index) || task.options.length <= 2 || task.type === 'abcd') return;
      commitMutation('lesson', () => {
        const [removed] = task.options.splice(index, 1);
        const fallback = task.options[0] || '';
        if (task.type === 'choice') {
          task.answers = [task.answers[0] === removed ? fallback : task.answers[0]];
        } else if (task.type === 'gaps') {
          task.answers = task.answers.map((answer) => answer === removed ? fallback : answer);
        }
      });
      return;
    }
    if (action === 'insert-gap') {
      const structure = taskGapStructure(task);
      const requestedIndex = Number(button.dataset.gapSegmentIndex);
      const gapIndex = Number.isSafeInteger(requestedIndex)
        ? Math.max(0, Math.min(requestedIndex, structure.labels.length))
        : structure.labels.length;
      commitMutation('lesson', () => {
        structure.labels.splice(gapIndex, 0, `luka ${gapIndex + 1}`);
        structure.segments.splice(gapIndex + 1, 0, '');
        applyTaskGapStructure(task, structure);
        const answer = task.type === 'gaps' ? task.options[0] || '' : 'odpowiedź';
        task.answers.splice(gapIndex, 0, answer);
      });
      return;
    }
    if (action === 'remove-gap') {
      const targetIndex = Number(button.dataset.gapIndex);
      if (!Number.isSafeInteger(targetIndex)) return;
      commitMutation('lesson', () => {
        const structure = taskGapStructure(task);
        if (targetIndex < 0 || targetIndex >= structure.labels.length) return;
        const merged = `${structure.segments[targetIndex] || ''}${structure.labels[targetIndex] || ''}${structure.segments[targetIndex + 1] || ''}`;
        structure.labels.splice(targetIndex, 1);
        structure.segments.splice(targetIndex, 2, merged);
        applyTaskGapStructure(task, structure);
        task.answers.splice(targetIndex, 1);
      });
    }
  }

  function renderLessonTaskInspector(form, task) {
    form.append(field(
      'Rodzaj pytania',
      lessonSelect(task.type, 'type', [
        { value: 'abcd', label: 'Quiz ABCD' },
        { value: 'choice', label: 'Jedna odpowiedź z listy' },
        { value: 'gaps', label: 'Uzupełnianie luk z listy' },
        { value: 'gaps-text', label: 'Luki wpisywane ręcznie' },
        { value: 'text', label: 'Odpowiedź tekstowa' },
        { value: 'number', label: 'Odpowiedź liczbowa' }
      ])
    ));
    form.append(
      field('Treść pytania', lessonTextarea(task.question, 'question', { rows: 3, maxLength: 900 })),
      field('Etykieta pola', lessonInput(task.label, 'label', { maxLength: 160 }))
    );
    if (task.type !== 'gaps' && task.type !== 'gaps-text') {
      form.append(field('Placeholder', lessonInput(task.placeholder, 'placeholder', { maxLength: 160 })));
    }
    if (task.type === 'gaps' || task.type === 'gaps-text') {
      if (task.type === 'gaps') form.append(taskOptionsEditor(task, false));
      form.append(taskGapEditor(task));
      if (task.type === 'gaps-text') {
        form.append(field(
          'Sposób sprawdzania',
          lessonSelect(task.checkMode, 'checkMode', [
            { value: 'each', label: 'Każda luka osobno' },
            { value: 'all', label: 'Wszystkie luki naraz' }
          ]),
          'Uczeń może otrzymywać wynik po każdej luce albo dopiero po sprawdzeniu całego zadania.'
        ));
        const check = create('label', 'check-field');
        const input = lessonInput('', 'caseSensitive', {
          type: 'checkbox',
          checked: task.caseSensitive
        });
        check.append(input, create('span', '', 'Rozróżniaj wielkość liter w odpowiedziach'));
        form.append(check);
      }
    } else if (task.type === 'choice' || task.type === 'abcd') {
      form.append(taskOptionsEditor(task, true));
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

  const LESSON_FORMULA_PRESETS = Object.freeze({
    'chem-water': {
      mode: 'chemistry',
      title: 'Wzór wody',
      left: 'H2O',
      arrow: '',
      above: '',
      below: '',
      right: ''
    },
    'chem-combustion': {
      mode: 'chemistry',
      title: 'Spalanie wodoru',
      left: '2 H2 + O2',
      arrow: '->',
      above: 'Δ',
      below: '',
      right: '2 H2O'
    },
    'chem-equilibrium': {
      mode: 'chemistry',
      title: 'Synteza amoniaku',
      left: 'N2 + 3 H2',
      arrow: '<=>',
      above: '450 °C',
      below: 'kat. Fe',
      right: '2 NH3'
    },
    'chem-dissociation': {
      mode: 'chemistry',
      title: 'Dysocjacja kwasu siarkowego(VI)',
      left: 'H2SO4',
      arrow: '->',
      above: 'H2O',
      below: '',
      right: '2 H+ + SO4^2-'
    },
    'chem-precipitate': {
      mode: 'chemistry',
      title: 'Reakcja strąceniowa',
      left: 'Ag+ + Cl-',
      arrow: '->',
      above: '',
      below: '',
      right: 'AgCl v'
    },
    'chem-isotope': {
      mode: 'chemistry',
      title: 'Izotop węgla',
      left: '^14C',
      arrow: '',
      above: '',
      below: '',
      right: ''
    },
    'math-energy': {
      mode: 'math',
      title: 'Równoważność masy i energii',
      expression: 'E = mc^{2}'
    },
    'math-quadratic': {
      mode: 'math',
      title: 'Wzór kwadratowy',
      expression: 'x_{1,2} = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}'
    },
    'math-concentration': {
      mode: 'math',
      title: 'Stężenie molowe',
      expression: 'c = \\frac{n}{V}'
    },
    'math-sum': {
      mode: 'math',
      title: 'Suma ciągu',
      expression: '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}'
    },
    'math-integral': {
      mode: 'math',
      title: 'Całka oznaczona',
      expression: '\\int_{a}^{b} x^{2}'
    }
  });

  function formulaPresetPicker(mode) {
    const section = create('section', 'formula-builder-section formula-preset-section');
    const header = create('header');
    header.append(
      create('strong', '', 'Gotowe szablony'),
      create('small', '', 'Kliknij, aby wstawić kompletny wzór i dalej go edytować.')
    );
    const presets = mode === 'math'
      ? [
          ['math-energy', 'E = mc²'],
          ['math-quadratic', 'Wzór kwadratowy'],
          ['math-concentration', 'c = n/V'],
          ['math-sum', 'Suma Σ'],
          ['math-integral', 'Całka ∫']
        ]
      : [
          ['chem-water', 'H₂O'],
          ['chem-combustion', 'Spalanie'],
          ['chem-equilibrium', 'Równowaga'],
          ['chem-dissociation', 'Dysocjacja'],
          ['chem-precipitate', 'Osad ↓'],
          ['chem-isotope', 'Izotop ¹⁴C']
        ];
    const list = create('div', 'formula-preset-list');
    presets.forEach(([value, label]) => {
      const button = create('button', 'formula-preset-button', label);
      button.type = 'button';
      button.dataset.formulaPreset = value;
      list.append(button);
    });
    section.append(header, list);
    return section;
  }

  function formulaSymbolGroup(title, symbols) {
    const group = create('section', 'formula-symbol-group');
    group.append(create('strong', '', title));
    const toolbar = create('div', 'formula-symbol-toolbar');
    symbols.forEach(([label, snippet, target, help]) => {
      const button = create('button', 'formula-symbol-button', label);
      button.type = 'button';
      button.dataset.formulaSnippet = snippet;
      if (target) button.dataset.formulaTarget = target;
      button.title = help || `Wstaw ${snippet}`;
      toolbar.append(button);
    });
    group.append(toolbar);
    return group;
  }

  function formulaArrowPicker(value) {
    const section = create('section', 'formula-symbol-group formula-arrow-group');
    section.append(create('strong', '', 'Strzałka reakcji'));
    const list = create('div', 'formula-arrow-list');
    [
      ['', '∅', 'Bez strzałki — pojedynczy wzór'],
      ['->', '→', 'Reakcja w prawo'],
      ['<-', '←', 'Reakcja w lewo'],
      ['<->', '↔', 'Reakcja odwracalna'],
      ['<=>', '⇌', 'Równowaga'],
      ['<=>>', '⇌→', 'Równowaga przesunięta w prawo'],
      ['<<=>', '←⇌', 'Równowaga przesunięta w lewo']
    ].forEach(([arrow, symbol, label]) => {
      const button = create('button', 'formula-arrow-button');
      button.type = 'button';
      button.dataset.formulaArrow = arrow;
      button.classList.toggle('is-active', value === arrow);
      button.setAttribute('aria-pressed', String(value === arrow));
      button.title = label;
      button.append(create('strong', '', symbol), create('small', '', label));
      list.append(button);
    });
    section.append(list);
    return section;
  }

  function formulaComposerPreview() {
    const section = create('section', 'formula-builder-preview');
    const header = create('header');
    header.append(
      create('strong', '', 'Podgląd równania'),
      create('small', '', 'Tak wzór będzie wyglądał w lekcji.')
    );
    const canvas = create('div', 'formula-builder-preview-canvas');
    canvas.dataset.formulaComposerPreview = 'true';
    canvas.setAttribute('aria-live', 'polite');
    section.append(header, canvas);
    return section;
  }

  function updateFormulaComposerPreview(block) {
    const canvas = elements.lessonInspector.querySelector('[data-formula-composer-preview]');
    if (!canvas || !block || block.type !== 'formula') return;
    clearTypesetMath(canvas);
    try {
      canvas.innerHTML = window.ChemLesson.renderMarkdown(lessonModelApi.serializeBlock(block));
      canvas.dataset.state = canvas.querySelector('.lesson-interactive-error') ? 'error' : 'ready';
    } catch (_) {
      canvas.replaceChildren(create('p', 'lesson-interactive-error', 'Uzupełnij wzór, aby zobaczyć podgląd.'));
      canvas.dataset.state = 'error';
    }
    typesetMath(canvas);
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
        'Nawigacja całej lekcji',
        lessonSelect(state.lesson.model.navigation || 'sequential', 'lessonNavigation', [
          { value: 'sequential', label: 'Sekwencyjna — kroki po kolei' },
          { value: 'free', label: 'Swobodna — można pomijać' }
        ]),
        'To ustawienie jest wspólne dla lekcji. Indywidualny wyjątek ucznia ustawia administrator w raporcie postępów.'
      ));
      form.append(field(
        'Nazwa slajdu',
        lessonInput(slideTitle(found.node, found.index), 'slideTitle', { maxLength: 140 })
      ));
      form.append(field(
        'Uwzględniaj krok w procencie lekcji',
        lessonSelect(found.node.includeInLesson || 'INHERIT', 'includeInLesson', [
          { value: 'INHERIT', label: 'Dziedzicz (domyślnie: tak)' },
          { value: 'ON', label: 'Tak' },
          { value: 'OFF', label: 'Nie — materiał dodatkowy' }
        ]),
        'Wpływ na procent i wymóg przejścia dalej są niezależnymi ustawieniami.'
      ));
      const required = create('label', 'check-field');
      required.append(
        lessonInput('', 'requiredToAdvance', { type: 'checkbox', checked: found.node.requiredToAdvance !== false }),
        create('span', '', 'Krok wymagany do przejścia dalej')
      );
      form.append(required);
      form.append(field(
        'Warunek przejścia',
        lessonSelect(found.node.condition?.type || 'next_click', 'conditionType', [
          { value: 'next_click', label: 'Kliknięcie Dalej' },
          { value: 'previous_completed', label: 'Ukończenie poprzedniego kroku' },
          { value: 'material_completed', label: 'Obejrzenie / ukończenie materiału' },
          { value: 'quiz_completed', label: 'Ukończenie quizu' },
          { value: 'correct_answer', label: 'Poprawna odpowiedź' },
          { value: 'exam_completed', label: 'Ukończenie egzaminu' },
          { value: 'exam_passed', label: 'Zaliczenie egzaminu' },
          { value: 'minimum_score', label: 'Minimalny wynik' }
        ])
      ));
      if (found.node.condition?.type === 'minimum_score') {
        form.append(field(
          'Minimalny wynik (%)',
          lessonInput(String(found.node.condition.minimumScore || 0), 'minimumScore', { type: 'number', min: 0, max: 100 })
        ));
      }
      form.append(field(
        'Stabilny stepId',
        lessonInput(found.node.id, 'stepId', { maxLength: 128 }),
        'Identyfikator pozostaje z krokiem po zmianie kolejności. Zmieniaj go tylko przed publikacją.'
      ));
      form.append(field(
        'Przejście przy otwieraniu slajdu',
        lessonSelect(found.node.transition, 'transition', [
          { value: 'none', label: 'Brak przejścia' },
          { value: 'fade', label: 'Łagodne zanikanie' },
          { value: 'rise', label: 'Subtelnie w górę' },
          { value: 'slide', label: 'Delikatnie z boku' },
          { value: 'zoom', label: 'Miękkie przybliżenie' }
        ]),
        'Ustawienie dotyczy tylko tego slajdu. Systemowe ograniczenie animacji ma zawsze pierwszeństwo.'
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
    if (block.type === 'ai') syncInspectorRepository(block.repositoryId);
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
    } else if (block.type === 'table') {
      form.append(
        field(
          'Podpis tabeli — opcjonalnie',
          lessonInput(block.caption, 'caption', { maxLength: 180, placeholder: 'np. Porównanie właściwości' })
        ),
        field(
          'Nagłówki kolumn',
          lessonInput(block.headers.join(' | '), 'tableHeaders', {
            maxLength: 2000,
            placeholder: 'Substancja | Wzór | Właściwość'
          }),
          'Rozdziel nagłówki pionową kreską |. Tabela może mieć od 2 do 8 kolumn.'
        ),
        field(
          'Wiersze tabeli',
          lessonTextarea(
            block.rows.map((row) => row.join(' | ')).join('\n'),
            'tableRows',
            { rows: 10, maxLength: 12000, placeholder: 'Woda | H2O | ciecz\nTlen | O2 | gaz' }
          ),
          'Każdy wiersz wpisz w nowej linii, a komórki rozdziel znakiem |. Każdy wiersz musi mieć tyle komórek, ile jest nagłówków.'
        ),
        field('Wyrównanie zawartości', lessonSelect(block.align, 'align', [
          { value: 'left', label: 'Do lewej' },
          { value: 'center', label: 'Wyśrodkowane' },
          { value: 'right', label: 'Do prawej' }
        ]))
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
    } else if (block.type === 'exam') {
      syncInspectorRepository(block.repositoryId);
      const exams = state.contentLibrary.exams || [];
      const examOptions = exams.map((asset) => ({
        value: asset.filename,
        label: asset.title ? `${asset.title} · ${asset.filename}` : asset.filename
      }));
      if (block.examId && !examOptions.some((option) => option.value === block.examId)) {
        examOptions.unshift({ value: block.examId, label: `${block.examId} (spoza bieżącej listy)` });
      }
      if (!examOptions.length) examOptions.push({ value: '', label: 'Brak egzaminów w repozytorium' });
      form.append(
        field(
          'Repozytorium egzaminu',
          lessonSelect(block.repositoryId, 'repositoryId', repositoryOptions(true)),
          'Lekcja przechowuje wyłącznie stabilną referencję do egzaminu, nie kopiuje jego pytań.'
        ),
        field('Egzamin z biblioteki', lessonSelect(block.examId, 'examId', examOptions)),
        field('Tytuł kafelka', lessonInput(block.title, 'title', { maxLength: 180 })),
        field('Opis dla ucznia', lessonTextarea(block.description, 'description', { rows: 4, maxLength: 500 })),
        field('Tekst przycisku', lessonInput(block.button, 'button', { maxLength: 80 })),
        field('Warunek tego użycia', lessonSelect(block.requirement, 'requirement', [
          { value: 'optional', label: 'Opcjonalny' },
          { value: 'completed', label: 'Wymagane ukończenie' },
          { value: 'passed', label: 'Wymagane zaliczenie' },
          { value: 'minimum_score', label: 'Wymagany minimalny wynik' }
        ]), 'Warunek dotyczy tylko tego kroku lekcji. Nie zmienia progu w globalnej definicji egzaminu.')
      );
      if (block.requirement === 'minimum_score') {
        form.append(field(
          'Minimalny wynik w tej lekcji (%)',
          lessonInput(String(block.minimumScore), 'minimumScore', { type: 'number', min: 0, max: 100 }),
          'Możesz wymagać tu np. 75%, nawet jeśli globalny próg egzaminu wynosi 60%.'
        ));
      }
      form.append(create(
        'p',
        'formula-builder-tip',
        'W trybie sekwencyjnym wynik jest ponownie sprawdzany po stronie serwera przed odblokowaniem kolejnego kroku.'
      ));
    } else if (block.type === 'atonom') {
      form.append(
        field(
          'Nazwa związku chemicznego',
          lessonInput(block.formula, 'formula', {
            placeholder: 'np. kwas octowy, etanol, cis-but-2-en',
            maxLength: 140
          }),
          'W lekcji pojawi się kafelek. Model /members/module/atonom/?formula=nazwa-związku zostanie załadowany dopiero po kliknięciu.'
        ),
        field('Tytuł modelu', lessonInput(block.title, 'title', { maxLength: 180 }))
      );
    } else if (block.type === 'formula') {
      form.append(
        field('Rodzaj zapisu', lessonSelect(block.mode, 'mode', [
          { value: 'chemistry', label: 'Chemia — wzór lub reakcja' },
          { value: 'math', label: 'Matematyka — równanie i symbole' }
        ])),
        formulaComposerPreview(),
        formulaPresetPicker(block.mode),
        field('Podpis pod wzorem', lessonInput(block.title, 'title', { maxLength: 180 }))
      );
      if (block.mode === 'math') {
        form.append(
          field(
            'Edytowane równanie',
            lessonTextarea(block.expression, 'expression', {
              rows: 6,
              maxLength: 500,
              placeholder: 'np. E = mc^{2} albo \\frac{n}{V}'
            }),
            'Kliknij miejsce w równaniu, a następnie wybierz strukturę lub symbol z palety.'
          ),
          formulaSymbolGroup('Struktury', [
            ['x²', '^{2}', 'expression', 'Potęga'],
            ['xₙ', '_{n}', 'expression', 'Indeks dolny'],
            ['a⁄b', '\\frac{a}{b}', 'expression', 'Ułamek'],
            ['√x', '\\sqrt{x}', 'expression', 'Pierwiastek'],
            ['Σ', '\\sum_{i=1}^{n}', 'expression', 'Suma'],
            ['∏', '\\prod_{i=1}^{n}', 'expression', 'Iloczyn'],
            ['∫', '\\int_{a}^{b}', 'expression', 'Całka'],
            ['lim', '\\lim_{x \\rightarrow 0}', 'expression', 'Granica'],
            ['v⃗', '\\vec{v}', 'expression', 'Wektor']
          ]),
          formulaSymbolGroup('Działania i relacje', [
            ['×', '\\times', 'expression'],
            ['÷', '\\div', 'expression'],
            ['±', '\\pm', 'expression'],
            ['≈', '\\approx', 'expression'],
            ['≠', '\\neq', 'expression'],
            ['≤', '\\le', 'expression'],
            ['≥', '\\ge', 'expression'],
            ['→', '\\rightarrow', 'expression'],
            ['↔', '\\leftrightarrow', 'expression'],
            ['∞', '\\infty', 'expression']
          ]),
          formulaSymbolGroup('Litery greckie i funkcje', [
            ['α', '\\alpha', 'expression'],
            ['β', '\\beta', 'expression'],
            ['γ', '\\gamma', 'expression'],
            ['Δ', '\\Delta', 'expression'],
            ['θ', '\\theta', 'expression'],
            ['λ', '\\lambda', 'expression'],
            ['μ', '\\mu', 'expression'],
            ['π', '\\pi', 'expression'],
            ['σ', '\\sigma', 'expression'],
            ['Ω', '\\Omega', 'expression'],
            ['∂', '\\partial', 'expression'],
            ['ln', '\\ln', 'expression']
          ])
        );
      } else {
        const composer = create('section', 'formula-chemistry-composer');
        const composerHeader = create('header');
        composerHeader.append(
          create('strong', '', 'Wizualny układ reakcji'),
          create('small', '', 'Edytuj równanie od lewej do prawej — jak w edytorze równań.')
        );
        const equation = create('div', 'formula-chemistry-equation');
        const arrowColumn = create('div', 'formula-chemistry-arrow-fields');
        arrowColumn.append(
          field(
            'Nad strzałką',
            lessonInput(block.above, 'above', { placeholder: '450 °C, Δ, hν', maxLength: 120 })
          ),
          field('Strzałka', lessonSelect(block.arrow, 'arrow', [
            { value: '', label: '∅' },
            { value: '->', label: '→' },
            { value: '<-', label: '←' },
            { value: '<->', label: '↔' },
            { value: '<=>', label: '⇌' },
            { value: '<=>>', label: '⇌→' },
            { value: '<<=>', label: '←⇌' }
          ])),
          field(
            'Pod strzałką',
            lessonInput(block.below, 'below', { placeholder: 'kat. Pt, 2 atm', maxLength: 120 })
          )
        );
        equation.append(
          field(
            'Substraty / wzór',
            lessonInput(block.left, 'left', { placeholder: '2 H2 + O2', maxLength: 300 }),
            'Kliknij to pole, a symbole z palety trafią tutaj.'
          ),
          arrowColumn,
          field(
            'Produkty',
            lessonInput(block.right, 'right', { placeholder: '2 H2O', maxLength: 300 }),
            'Kliknij to pole, aby wstawiać symbole po prawej stronie.'
          )
        );
        composer.append(composerHeader, equation);
        form.append(
          composer,
          formulaArrowPicker(block.arrow),
          formulaSymbolGroup('Wstaw do ostatnio wybranego pola substratów lub produktów', [
            ['＋', ' + ', 'active', 'Znak plus'],
            ['H₂O', 'H2O', 'active', 'Wzór wody'],
            ['CO₂', 'CO2', 'active', 'Tlenek węgla(IV)'],
            ['SO₄²⁻', 'SO4^2-', 'active', 'Jon siarczanowy(VI)'],
            ['NH₄⁺', 'NH4+', 'active', 'Jon amonowy'],
            ['¹⁴C', '^14C', 'active', 'Izotop'],
            ['Feᴵᴵᴵ', 'Fe^{III}', 'active', 'Stopień utlenienia'],
            ['(s)', '(s)', 'active', 'Ciało stałe'],
            ['(l)', '(l)', 'active', 'Ciecz'],
            ['(g)', '(g)', 'active', 'Gaz'],
            ['(aq)', '(aq)', 'active', 'Roztwór wodny'],
            ['↓ osad', ' v', 'active', 'Osad']
          ]),
          formulaSymbolGroup('Warunki reakcji', [
            ['Δ', 'Δ', 'above', 'Ogrzewanie nad strzałką'],
            ['hν', 'hν', 'above', 'Światło nad strzałką'],
            ['25 °C', '25 °C', 'above', 'Temperatura nad strzałką'],
            ['450 °C', '450 °C', 'above', 'Temperatura nad strzałką'],
            ['kat. Pt', 'kat. Pt', 'below', 'Katalizator pod strzałką'],
            ['kat. Fe', 'kat. Fe', 'below', 'Katalizator pod strzałką'],
            ['2 atm', '2 atm', 'below', 'Ciśnienie pod strzałką']
          ]),
          create(
            'p',
            'formula-builder-tip',
            'Cyfry są zamieniane na indeksy automatycznie. Ładunek zapisuj np. SO4^2-, izotop jako ^14C, a stopień utlenienia jako Fe^{III}.'
          )
        );
      }
    } else if (block.type === 'ai') {
      form.append(
        field('Tytuł kafelka AI', lessonInput(block.title, 'title', { maxLength: 180 })),
        field('Opis dla ucznia', lessonTextarea(block.description, 'description', { rows: 4, maxLength: 500 })),
        field('Tekst przycisku', lessonInput(block.button, 'button', { maxLength: 80 })),
        field(
          'Repozytorium promptu',
          lessonSelect(block.repositoryId, 'repositoryId', repositoryOptions(true)),
          'Pozostaw domyślne, jeśli AI ma korzystać ze zwykłego trybu lub prompt znajduje się w głównym repozytorium.'
        ),
        field(
          'Plik promptu — opcjonalnie',
          lessonRepositoryFilenameInput(
            block.promptFile,
            'promptFile',
            ['json', 'txt'],
            block.repositoryId
          ),
          'Kliknij pole, aby wybrać plik JSON lub TXT z repozytorium. Nadal możesz wpisać nazwę ręcznie. Bez pliku otworzy się ogólny asystent.'
        )
      );
      if (/\.txt$/i.test(block.promptFile)) {
        form.append(field(
          'Numer punktu w pliku TXT',
          lessonInput(block.promptPoint, 'promptPoint', { type: 'number', min: 1, max: 9999 }),
          'Dla pliku JSON numer punktu nie jest używany.'
        ));
      }
      form.append(create(
        'p',
        'formula-builder-tip',
        'Po kliknięciu uczeń przejdzie do ChemDisk AI w nowej karcie. Treść bieżącego slajdu zostanie przekazana jako kontekst pierwszego pytania.'
      ));
    } else if (block.type === 'board') {
      const newTab = create('label', 'check-field');
      newTab.append(
        lessonInput('', 'newTab', { type: 'checkbox', checked: block.newTab }),
        create('span', '', 'Otwieraj tablicę w nowej karcie')
      );
      form.append(
        field('Rodzaj tablicy', lessonSelect(block.variant, 'variant', [
          { value: 'whiteboard', label: 'Biała tablica — szybkie szkicowanie' },
          { value: 'bitpaper', label: 'BitPaper — rozbudowana plansza' }
        ])),
        field('Tytuł kafelka', lessonInput(block.title, 'title', { maxLength: 180 })),
        field('Krótki opis', lessonTextarea(block.description, 'description', { rows: 4, maxLength: 500 })),
        field('Tekst przycisku', lessonInput(block.button, 'button', { maxLength: 80 }))
      );
      if (block.variant === 'bitpaper') {
        form.append(field(
          'Plik gotowej planszy — opcjonalnie',
          lessonInput(block.path, 'path', { placeholder: 'np. stechiometria.json', maxLength: 100 }),
          'Pusta wartość otwiera nową tablicę. Nazwa pliku musi kończyć się .json i nie może zawierać ścieżki.'
        ));
      }
      form.append(newTab);
    } else if (block.type === 'contact') {
      const newTab = create('label', 'check-field');
      newTab.append(
        lessonInput('', 'newTab', { type: 'checkbox', checked: block.newTab }),
        create('span', '', 'Otwieraj formularz w nowej karcie')
      );
      form.append(
        field('Tytuł kafelka', lessonInput(block.title, 'title', { maxLength: 180 })),
        field('Krótki opis', lessonTextarea(block.description, 'description', { rows: 4, maxLength: 500 })),
        field('Tekst przycisku', lessonInput(block.button, 'button', { maxLength: 80 })),
        field(
          'Wstępna treść wiadomości — opcjonalnie',
          lessonTextarea(block.internal, 'internal', { rows: 4, maxLength: 240 }),
          'Ta treść pojawi się w formularzu jako podpowiedź dla ucznia. Adres e-mail oraz imię zostaną uzupełnione z zalogowanego konta.'
        ),
        newTab,
        create(
          'p',
          'formula-builder-tip',
          'Wiadomości trafiają do Netlify Forms. Administrator może je przeglądać, usuwać i pobrać wszystkie w panelu administratora.'
        )
      );
    } else if (block.type === 'link') {
      const newTab = create('label', 'check-field');
      newTab.append(
        lessonInput('', 'newTab', { type: 'checkbox', checked: block.newTab }),
        create('span', '', 'Otwieraj w nowej karcie')
      );
      form.append(
        field('Tytuł kafelka', lessonInput(block.title, 'title', { maxLength: 180 })),
        field('Krótki opis', lessonTextarea(block.description, 'description', { rows: 4, maxLength: 500 })),
        field(
          'Adres linku',
          lessonInput(block.url, 'url', {
            placeholder: 'https://… albo /members/module/…',
            maxLength: 500
          }),
          'Dozwolone są adresy http/https, mailto:, kotwice # oraz wewnętrzne ścieżki zaczynające się od /.'
        ),
        field('Ikona', lessonSelect(block.icon, 'icon', [
          { value: 'link', label: '↗ Link' },
          { value: 'book', label: '▤ Książka / lekcja' },
          { value: 'video', label: '▶ Film' },
          { value: 'chemistry', label: '⚗ Chemia' },
          { value: 'math', label: '∑ Matematyka' },
          { value: 'file', label: '▧ Plik' },
          { value: 'external', label: '⤴ Strona zewnętrzna' }
        ])),
        field('Kolor akcentu', lessonInput(block.color, 'color', { type: 'color' })),
        newTab
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
      const fontLabels = {
        sans: 'Systemowa (Inter)',
        arial: 'Arial',
        verdana: 'Verdana',
        serif: 'Szeryfowa',
        georgia: 'Georgia',
        times: 'Times New Roman',
        rounded: 'Zaokrąglona',
        mono: 'Monospace',
        courier: 'Courier New'
      };
      row.append(
        field('Czcionka', lessonSelect(block.font, 'font', lessonModelApi.STYLE_FONTS.map((value) => ({
          value,
          label: fontLabels[value] || value
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
      const useBold = create('label', 'check-field');
      useBold.append(
        lessonInput('', 'bold', { type: 'checkbox', checked: Boolean(block.bold) }),
        create('span', '', 'Pogrub cały tekst w tym bloku')
      );
      const useBackground = create('label', 'check-field');
      useBackground.append(
        lessonInput('', 'useBackground', { type: 'checkbox', checked: Boolean(block.background) }),
        create('span', '', 'Użyj kolorowego tła karty')
      );
      form.append(row, useBold, alignRow, useColor, backgroundRow, useBackground);
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
    if (block.type === 'formula') updateFormulaComposerPreview(block);
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

  function bindPreviewAtonom(root) {
    all('.lesson-atonom-open', root).forEach((button) => {
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
  }

  function previewAiContext(root) {
    const clone = root.cloneNode(true);
    all(
      '.lesson-ai-help, .lesson-preview-meta, .preview-task, button, input, select, textarea, iframe, script, style',
      clone
    ).forEach((node) => node.remove());
    return String(clone.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 6000);
  }

  function openPreviewAiHelp(button, root) {
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
      const context = previewAiContext(root);
      if (context) {
        localStorage.setItem(`chem.lesson-ai-context.${contextId}`, JSON.stringify({
          context,
          title: state.lesson.model.title,
          createdAt: Date.now()
        }));
        url.searchParams.set('lesson_context', contextId);
      }
    } catch (_) {
      // Czat nadal może zostać otwarty bez automatycznego kontekstu.
    }
    window.open(url.toString(), '_blank', 'noopener');
  }

  function bindPreviewAiHelp(root) {
    all('[data-lesson-ai-open]', root).forEach((button) => {
      button.addEventListener('click', () => openPreviewAiHelp(button, root));
    });
  }

  function clearTypesetMath(root, scope) {
    const targetWindow = scope || window;
    const formulas = root
      ? Array.from(root.querySelectorAll('.lesson-formula-display'))
      : [];
    if (!formulas.length) return;
    try {
      targetWindow.MathJax?.typesetClear?.(formulas);
    } catch (_) {
      // Brak MathJax nie może blokować podglądu pozostałej treści.
    }
  }

  function typesetMath(root, scope) {
    const targetWindow = scope || window;
    const mathJax = targetWindow.MathJax;
    const formulas = root
      ? Array.from(root.querySelectorAll('.lesson-formula-display'))
      : [];
    if (!formulas.length || !mathJax || typeof mathJax.typesetPromise !== 'function') return;
    const startup = mathJax.startup?.promise || Promise.resolve();
    const previous = targetWindow.__chemDiskMathPromise || startup;
    targetWindow.__chemDiskMathPromise = previous
      .catch(() => undefined)
      .then(() => mathJax.typesetPromise(formulas))
      .catch(() => undefined);
  }

  function preparePreviewYouTube(root) {
    if (!root) return;
    all('.lesson-youtube iframe', root).forEach((frame) => {
      try {
        const source = new URL(frame.getAttribute('src') || '', window.location.origin);
        source.searchParams.set('playsinline', '1');
        source.searchParams.set('rel', '0');
        source.searchParams.set('origin', window.location.origin);
        source.searchParams.set('widget_referrer', window.location.href);
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        frame.removeAttribute('sandbox');
        frame.src = source.toString();
      } catch (_) {
        // Nieprawidłowe źródło jest już odrzucane przez parser lekcji.
      }
    });
  }

  function previewTaskById(taskId) {
    for (const slide of state.lesson.model.slides) {
      if (slide.task && slide.task.id === taskId) return slide.task;
    }
    return null;
  }

  function appendPreviewGapExercise(container, task, fieldId) {
    let gapIndex = 0;
    String(task.text || '').split(/(\{\{[^{}]*\}\})/).forEach((part) => {
      const gap = /^\{\{([^{}]*)\}\}$/.exec(part);
      if (!gap) {
        container.append(document.createTextNode(part));
        return;
      }
      const currentIndex = gapIndex;
      const gapLabel = gap[1].trim() || `luka ${currentIndex + 1}`;
      gapIndex += 1;
      if (task.type === 'gaps') {
        const select = create('select', 'preview-gap-field');
        select.name = `${fieldId}-${currentIndex}`;
        select.dataset.previewGapIndex = String(currentIndex);
        select.setAttribute('aria-label', `Luka ${currentIndex + 1}: ${gapLabel}`);
        const blank = create('option', '', gapLabel);
        blank.value = '';
        select.append(blank);
        task.options.forEach((option) => {
          const item = create('option', '', option);
          item.value = option;
          select.append(item);
        });
        container.append(select);
        return;
      }

      const wrapper = create('span', 'preview-text-gap');
      const input = create('input', 'preview-gap-field');
      input.type = 'text';
      input.name = `${fieldId}-${currentIndex}`;
      input.dataset.previewGapIndex = String(currentIndex);
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.placeholder = gapLabel;
      input.setAttribute('aria-label', `Luka ${currentIndex + 1}: ${gapLabel}`);
      wrapper.append(input);
      if (task.checkMode === 'each') {
        const check = create('button', 'preview-gap-check', '✓');
        check.type = 'button';
        check.dataset.previewGapCheck = String(currentIndex);
        check.setAttribute('aria-label', `Sprawdź lukę ${currentIndex + 1}`);
        wrapper.append(check);
      }
      container.append(wrapper);
    });
  }

  function buildPreviewTask(task) {
    const form = create('form', 'preview-task preview-quiz');
    const fieldId = `preview-answer-${task.id}`;
    form.dataset.previewTaskId = task.id;
    form.noValidate = true;

    const eyebrow = create('span', 'preview-quiz-eyebrow', 'Sprawdź, czy rozumiesz');
    const heading = create('strong', 'preview-quiz-title', task.label || task.question || 'Odpowiedz na pytanie');
    const controls = create('div', 'preview-quiz-controls');
    if (task.type === 'choice' || task.type === 'abcd') {
      const fieldset = create('fieldset', `preview-choice-grid${task.type === 'abcd' ? ' is-abcd' : ''}`);
      const legend = create('legend', '', task.label || 'Wybierz odpowiedź');
      task.options.forEach((option, optionIndex) => {
        const optionLabel = create('label', 'preview-choice-option');
        const input = create('input');
        const marker = create('span', 'preview-choice-marker', String.fromCharCode(65 + optionIndex));
        const copy = create('span', 'preview-choice-copy', option);
        input.type = 'radio';
        input.name = fieldId;
        input.value = task.type === 'abcd' ? String.fromCharCode(65 + optionIndex) : option;
        optionLabel.append(input);
        if (task.type === 'abcd') optionLabel.append(marker);
        optionLabel.append(copy);
        fieldset.append(optionLabel);
      });
      fieldset.prepend(legend);
      controls.append(fieldset);
    } else if (task.type === 'gaps' || task.type === 'gaps-text') {
      const exercise = create('p', 'preview-gap-exercise');
      appendPreviewGapExercise(exercise, task, fieldId);
      controls.append(exercise);
    } else {
      const input = create('input', 'preview-answer-field');
      input.type = 'text';
      input.name = fieldId;
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.placeholder = task.placeholder || (task.type === 'number' ? 'Wpisz wynik' : 'Wpisz odpowiedź');
      input.inputMode = task.type === 'number' ? 'decimal' : 'text';
      input.setAttribute('aria-label', task.label || 'Twoja odpowiedź');
      controls.append(input);
    }

    const submit = create('button', 'button button-primary preview-quiz-submit', 'Sprawdź odpowiedź');
    submit.type = 'submit';
    submit.hidden = task.type === 'gaps-text' && task.checkMode === 'each';
    const feedback = create('p', 'preview-quiz-feedback');
    feedback.dataset.previewFeedback = '';
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');
    form.append(eyebrow, heading, controls, submit, feedback);
    return form;
  }

  function bindPreviewTasks(root) {
    all('.preview-quiz[data-preview-task-id]', root).forEach((form) => {
      const task = previewTaskById(form.dataset.previewTaskId);
      if (!task || !window.ChemLesson) return;
      const feedback = form.querySelector('[data-preview-feedback]');
      const submit = form.querySelector('.preview-quiz-submit');
      const gapFields = Array.from(form.querySelectorAll('[data-preview-gap-index]'));
      const checkedGaps = new Set();
      const perGapMode = task.type === 'gaps-text' && task.checkMode === 'each';

      const showFeedback = (stateName, message) => {
        feedback.dataset.state = stateName;
        feedback.textContent = message;
      };
      const finish = () => {
        form.dataset.state = 'success';
        showFeedback('success', task.feedback || 'Dobrze! Odpowiedź jest poprawna.');
        all('input, select, button', form).forEach((control) => {
          control.disabled = true;
        });
        submit.textContent = 'Odpowiedź poprawna ✓';
      };
      const showError = (field, prefix = 'Jeszcze nie') => {
        form.dataset.state = 'error';
        field?.setAttribute('aria-invalid', 'true');
        showFeedback(
          'error',
          task.hint ? `${prefix}. Podpowiedź: ${task.hint}` : `${prefix} — popraw odpowiedź i spróbuj ponownie.`
        );
        field?.focus();
      };
      const readValue = () => {
        if (task.type === 'gaps' || task.type === 'gaps-text') {
          return gapFields.map((field) => field.value);
        }
        if (task.type === 'choice' || task.type === 'abcd') {
          return form.querySelector('input[type="radio"]:checked')?.value || '';
        }
        return form.querySelector('.preview-answer-field')?.value || '';
      };

      all('input, select', form).forEach((field) => {
        field.addEventListener('input', () => {
          field.removeAttribute('aria-invalid');
          field.closest('.preview-text-gap')?.removeAttribute('data-state');
          if (form.dataset.state !== 'success') {
            form.removeAttribute('data-state');
            showFeedback('', '');
          }
        });
      });

      all('[data-preview-gap-check]', form).forEach((button) => {
        button.addEventListener('click', () => {
          const gapIndex = Number(button.dataset.previewGapCheck);
          const input = gapFields[gapIndex];
          const wrapper = button.closest('.preview-text-gap');
          if (window.ChemLesson.checkGapAnswer(task, input.value, gapIndex)) {
            checkedGaps.add(gapIndex);
            input.removeAttribute('aria-invalid');
            input.disabled = true;
            button.disabled = true;
            wrapper.dataset.state = 'success';
            showFeedback('success', `Luka ${gapIndex + 1} jest poprawna.`);
            if (checkedGaps.size === gapFields.length) finish();
            else gapFields.find((field, index) => !checkedGaps.has(index))?.focus();
          } else {
            wrapper.dataset.state = 'error';
            showError(input, `Luka ${gapIndex + 1} jest niepoprawna`);
          }
        });
      });

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (form.dataset.state === 'success' || perGapMode) return;
        if (window.ChemLesson.checkAnswer(task, readValue())) {
          finish();
          return;
        }
        const firstField = form.querySelector(
          'select:not([disabled]), input:not([type="radio"]):not([disabled]), input[type="radio"]:checked, input[type="radio"]'
        );
        showError(firstField);
      });
    });
  }

  function buildLessonPreviewShell(slide, index, includeValidation, animateTransition) {
    const shell = create('div', 'lesson-preview-shell');
    const transition = lessonModelApi.SLIDE_TRANSITIONS.includes(slide.transition)
      ? slide.transition
      : 'fade';
    shell.dataset.transition = transition;
    shell.classList.toggle('is-entering', Boolean(animateTransition) && transition !== 'none');
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
      shell.append(buildPreviewTask(slide.task));
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
    clearTypesetMath(elements.lessonPreview);
    elements.lessonPreview.replaceChildren();
    const slide = selectedLessonSlide();
    if (!slide) return;
    state.lesson.previewSlideId = slide.id;
    const index = state.lesson.model.slides.indexOf(slide);
    const transitionKey = `${slide.id}:${slide.transition || 'fade'}`;
    const animateTransition = state.lesson.previewTransitionKey !== transitionKey;
    state.lesson.previewTransitionKey = transitionKey;
    elements.lessonPreview.append(
      previewToolbar('lesson'),
      buildLessonPreviewShell(slide, index, true, animateTransition)
    );
    preparePreviewYouTube(elements.lessonPreview);
    bindPreviewFlashcards(elements.lessonPreview);
    bindPreviewAtonom(elements.lessonPreview);
    bindPreviewAiHelp(elements.lessonPreview);
    bindPreviewTasks(elements.lessonPreview);
    typesetMath(elements.lessonPreview);
    syncFullPreview('lesson');
  }

  function addFullPreviewHead(doc, mode) {
    const existingMathJax = doc.getElementById('studio-preview-mathjax');
    const existingMathJaxStyles = mode === 'lesson'
      ? Array.from(doc.head.querySelectorAll('#MJX-CHTML-styles, style[id^="MJX-"]'))
      : [];
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
    doc.head.replaceChildren(
      charset,
      viewport,
      theme,
      baseStyles,
      studioStyles,
      ...existingMathJaxStyles,
      ...(mode === 'lesson' && existingMathJax ? [existingMathJax] : [])
    );
    if (
      mode === 'lesson'
      && !existingMathJax
      && typeof doc.defaultView.MathJax?.typesetPromise !== 'function'
    ) {
      doc.defaultView.MathJax = {
        loader: { load: ['[tex]/mhchem'] },
        tex: { packages: { '[+]': ['mhchem'] } },
        startup: { typeset: false }
      };
      const mathJax = doc.createElement('script');
      mathJax.id = 'studio-preview-mathjax';
      mathJax.src = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-mml-chtml.js';
      mathJax.addEventListener('load', () => typesetMath(doc.body, doc.defaultView), { once: true });
      doc.head.append(mathJax);
    }
    doc.title = mode === 'dashboard'
      ? 'Pełny podgląd dashboardu — ChemDisk'
      : 'Pełny podgląd lekcji — ChemDisk';
  }

  function renderFullPreviewWindow(mode, popup) {
    if (!popup || popup.closed) return;
    const doc = popup.document;
    const previousScroll = popup.scrollY;
    clearTypesetMath(doc.body, popup);
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
        article.append(doc.importNode(buildLessonPreviewShell(slide, index, false, true), true));
        slides.append(article);
      });
      main.append(slides);
    }
    doc.body.replaceChildren(header, main);
    if (mode === 'lesson') {
      preparePreviewYouTube(main);
      bindPreviewFlashcards(main);
      bindPreviewAtonom(main);
      bindPreviewAiHelp(main);
      bindPreviewTasks(main);
      typesetMath(main, popup);
    }
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
    if (!['dashboard', 'lesson'].includes(mode)) return;
    flushDrafts();
    const previewUrl = new URL('/members/module/studio/', window.location.origin);
    previewUrl.searchParams.set('preview', mode);
    previewUrl.searchParams.set('draft', String(Date.now()));
    const popup = window.open(
      previewUrl.toString(),
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
    popup.focus();
  }

  function requestedFullPreviewMode() {
    try {
      const mode = new URL(window.location.href).searchParams.get('preview');
      return ['dashboard', 'lesson'].includes(mode) ? mode : '';
    } catch (_) {
      return '';
    }
  }

  function startStandalonePreview(mode) {
    renderFullPreviewWindow(mode, window);
    window.addEventListener('storage', (event) => {
      const expectedKey = mode === 'dashboard' ? DASHBOARD_DRAFT_KEY : LESSON_DRAFT_KEY;
      if (event.key !== expectedKey || !event.newValue) return;
      loadDrafts();
      renderFullPreviewWindow(mode, window);
    });
  }

  function updateLessonNodeSummary() {
    const found = findLessonNode(state.lesson.selectedId);
    if (!found) return;
    if (found.kind === 'slide') {
      const target = all('[data-lesson-slide-id]', elements.lessonCanvas)
        .find((node) => node.dataset.lessonSlideId === found.node.id && node.classList.contains('lesson-slide'));
      if (target) {
        const title = target.querySelector('.slide-header .node-copy strong');
        const subtitle = target.querySelector('.slide-header .node-copy small');
        if (title) title.textContent = slideTitle(found.node, found.index);
        if (subtitle) subtitle.textContent = slideSummary(found.node);
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
    updateRepositoryButtons();
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
    const found = state.dashboard.selectedUid
      ? dashboardModelApi.findNode(state.dashboard.model, state.dashboard.selectedUid)
      : { node: state.dashboard.model, parent: null, container: null, index: -1 };
    if (!found) return;
    beginEdit('dashboard');
    const fieldName = target.dataset.dashboardField;
    let value = target.type === 'checkbox' ? target.checked : target.value;
    if (fieldName.startsWith('progress')) {
      if (fieldName === 'progressRecordOpens') {
        found.node.recordOpens = Boolean(value);
        found.node.progressConfigured = true;
      } else {
      found.node.progress = found.node.progress || {};
      const mapping = {
        progressTracking: 'tracking',
        progressShowProgress: 'showProgress',
        progressWeight: 'weight'
      };
      const key = mapping[fieldName];
      if (key === 'weight') value = Math.max(.01, Math.min(10000, Number(value) || 1));
      if (found.node.kind === 'dashboard' && ['tracking', 'showProgress'].includes(key)) {
        value = value === 'OFF' ? 'OFF' : 'ON';
      }
      found.node.progress[key] = value;
      found.node.progressConfigured = true;
      }
    } else {
    if (fieldName === 'videoCompletionThreshold') value = Math.max(1, Math.min(100, Number(value) || 90));
    if (['presentationMode', 'videoCompletionThreshold'].includes(fieldName)) found.node.progressConfigured = true;
    if (fieldName === 'point') value = String(Math.max(0, Number(value) || 0));
    found.node[fieldName] = value;
    }
    if (fieldName === 'repositoryId') {
      const fallback = state.contentLibrary.repositories.find((repository) => repository.default)
        || state.contentLibrary.repositories[0];
      const repositoryId = value || (fallback && fallback.id) || '';
      if (repositoryId) void selectContentRepository(repositoryId);
    }
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
      const gapCount = (task.text.match(/\{\{[^{}]*\}\}/g) || []).length;
      task.answers = task.answers.length === gapCount
        ? task.answers.map((answer) => task.options.includes(answer) ? answer : task.options[0])
        : Array.from({ length: gapCount }, (_, index) => task.options[index] || task.options[0]);
      task.label = 'Uzupełnij wszystkie luki';
    } else if (nextType === 'gaps-text') {
      task.text = task.text || 'Uzupełnij {{pierwszą lukę}} i {{drugą lukę}}.';
      const gapCount = (task.text.match(/\{\{[^{}]*\}\}/g) || []).length;
      task.answers = task.answers.length === gapCount
        ? task.answers
        : Array.from({ length: gapCount }, (_, index) => task.answers[index] || `odpowiedź ${index + 1}`);
      task.options = [];
      task.checkMode = task.checkMode === 'all' ? 'all' : 'each';
      task.label = 'Wpisz odpowiedzi w luki';
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

  function applyLessonFormulaPreset(button) {
    const preset = LESSON_FORMULA_PRESETS[button.dataset.formulaPreset];
    const found = findLessonNode(state.lesson.selectedId);
    if (!preset || !found || found.kind !== 'block' || found.node.type !== 'formula') return;
    commitMutation('lesson', () => {
      found.node.mode = preset.mode;
      found.node.title = preset.title;
      if (preset.mode === 'math') {
        found.node.expression = preset.expression;
      } else {
        found.node.left = preset.left;
        found.node.arrow = preset.arrow;
        found.node.above = preset.above;
        found.node.below = preset.below;
        found.node.right = preset.right;
        state.lesson.formulaField = 'left';
      }
    });
  }

  function applyLessonFormulaArrow(button) {
    const found = findLessonNode(state.lesson.selectedId);
    if (!found || found.kind !== 'block' || found.node.type !== 'formula') return;
    const arrow = button.dataset.formulaArrow || '';
    commitMutation('lesson', () => {
      found.node.arrow = lessonModelApi.FORMULA_ARROWS.includes(arrow) ? arrow : '';
      if (found.node.arrow && !found.node.right) found.node.right = 'H2O';
    });
  }

  function insertLessonFormulaSnippet(button) {
    const requestedTarget = button.dataset.formulaTarget || 'expression';
    const targetName = requestedTarget === 'active'
      ? (['left', 'right'].includes(state.lesson.formulaField) ? state.lesson.formulaField : 'left')
      : requestedTarget;
    const input = elements.lessonInspector.querySelector(`[data-lesson-field="${targetName}"]`);
    if (!input || typeof input.setRangeText !== 'function') return;
    const snippet = button.dataset.formulaSnippet || '';
    const start = Number.isSafeInteger(input.selectionStart) ? input.selectionStart : input.value.length;
    const end = Number.isSafeInteger(input.selectionEnd) ? input.selectionEnd : start;
    input.setRangeText(snippet, start, end, 'end');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
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

    if (found.kind === 'slide' && fieldName === 'lessonNavigation') {
      state.lesson.model.navigation = raw === 'free' ? 'free' : 'sequential';
      state.lesson.model.navigationConfigured = true;
    } else if (found.kind === 'slide' && fieldName === 'slideTitle') {
      setSlideTitle(found.node, raw);
    } else if (found.kind === 'slide' && fieldName === 'transition') {
      found.node.transition = lessonModelApi.SLIDE_TRANSITIONS.includes(raw) ? raw : 'fade';
    } else if (found.kind === 'slide' && fieldName === 'stepId') {
      if (/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(raw)) {
        found.node.id = raw;
        state.lesson.selectedId = raw;
      }
      found.node.progressConfigured = true;
    } else if (found.kind === 'slide' && fieldName === 'includeInLesson') {
      found.node.includeInLesson = ['ON', 'OFF', 'INHERIT'].includes(raw) ? raw : 'INHERIT';
      found.node.progressConfigured = true;
    } else if (found.kind === 'slide' && fieldName === 'requiredToAdvance') {
      found.node.requiredToAdvance = Boolean(raw);
      found.node.progressConfigured = true;
    } else if (found.kind === 'slide' && fieldName === 'conditionType') {
      found.node.condition = { ...(found.node.condition || {}), type: raw };
      found.node.progressConfigured = true;
    } else if (found.kind === 'slide' && fieldName === 'minimumScore') {
      found.node.condition = {
        ...(found.node.condition || {}),
        minimumScore: Math.max(0, Math.min(100, Number(raw) || 0))
      };
      found.node.progressConfigured = true;
    } else if (found.kind === 'task') {
      const task = found.node;
      if (fieldName === 'type') {
        normalizeTaskForType(task, raw);
      } else if (fieldName === 'optionItem') {
        const index = Number(target.dataset.optionIndex);
        if (!Number.isSafeInteger(index) || index < 0 || index >= task.options.length) return;
        const previous = task.options[index];
        task.options[index] = raw;
        if (task.type === 'choice' && task.answers[0] === previous) {
          task.answers[0] = raw;
        } else if (task.type === 'gaps') {
          task.answers = task.answers.map((answer) => answer === previous ? raw : answer);
        }
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
      } else if (fieldName === 'gapLabel') {
        const index = Number(target.dataset.gapIndex);
        if (Number.isSafeInteger(index)) replaceTaskGapLabel(task, index, raw);
      } else if (fieldName === 'gapSegment') {
        const index = Number(target.dataset.gapSegmentIndex);
        const structure = taskGapStructure(task);
        if (Number.isSafeInteger(index) && index >= 0 && index < structure.segments.length) {
          structure.segments[index] = String(raw).replace(/\{\{|\}\}/g, '');
          applyTaskGapStructure(task, structure);
        }
      } else if (fieldName === 'gapAnswer') {
        const index = Number(target.dataset.gapIndex);
        if (Number.isSafeInteger(index) && index >= 0 && index < task.answers.length) {
          task.answers[index] = raw;
        }
      } else if (fieldName === 'answers') {
        task.answers = String(raw).split('\n').map((item) => item.trim()).filter(Boolean);
      } else {
        task[fieldName] = raw;
      }
    } else if (found.kind === 'block') {
      const block = found.node;
      if (fieldName === 'mode' && block.type === 'formula') {
        const previousMode = block.mode;
        block.mode = raw === 'math' ? 'math' : 'chemistry';
        if (block.mode === 'math' && !block.expression) block.expression = 'E = mc^{2}';
        if (block.mode === 'chemistry' && !block.left) {
          block.left = '2 H2 + O2';
          block.arrow = '->';
          block.right = '2 H2O';
        }
        if (
          !block.title
          || (previousMode === 'chemistry' && block.title === 'Spalanie wodoru')
          || block.title === (previousMode === 'math' ? 'Wzór matematyczny' : 'Równanie reakcji')
        ) {
          block.title = block.mode === 'math' ? 'Wzór matematyczny' : 'Równanie reakcji';
        }
      } else if (fieldName === 'tableHeaders' && block.type === 'table') {
        block.headers = String(raw)
          .split('|')
          .map((cell) => cell.trim().replace(/:::/g, '').slice(0, 240))
          .slice(0, 8);
        block.rows = block.rows.map((row) => (
          block.headers.map((_, index) => row[index] || '')
        ));
      } else if (fieldName === 'tableRows' && block.type === 'table') {
        block.rows = String(raw)
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => line
            .split('|')
            .map((cell) => cell.trim().replace(/:::/g, '').slice(0, 240))
            .slice(0, 8))
          .slice(0, 30);
      } else if (fieldName === 'items') {
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
      if (fieldName === 'repositoryId') {
        const fallback = state.contentLibrary.repositories.find((repository) => repository.default)
          || state.contentLibrary.repositories[0];
        const repositoryId = raw || (fallback && fallback.id) || '';
        if (repositoryId) void selectContentRepository(repositoryId);
      }
    }
    if (found.kind === 'block' && found.node.type === 'formula') {
      updateFormulaComposerPreview(found.node);
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
    updateRepositoryButtons();
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
    if (mode === 'lesson') return lessonModelApi.serializeLesson(state.lesson.model);
    return promptModelApi.serializePrompt(state.prompt.model);
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
    elements.sourceDialogEyebrow.textContent = mode === 'dashboard'
      ? 'Dashboard Markdown'
      : mode === 'lesson'
        ? 'Lesson Markdown'
        : 'Prompt JSON/TXT';
    elements.sourceDialogTitle.textContent = mode === 'dashboard'
      ? 'Kod źródłowy dashboardu'
      : mode === 'lesson'
        ? 'Kod źródłowy lekcji'
        : 'Kod źródłowy promptu';
    elements.sourceDialogHelp.textContent = mode === 'dashboard'
      ? 'Możesz skopiować kod albo wkleić dashboard.md i zamienić go na graficzne klocki.'
      : mode === 'lesson'
        ? 'Możesz skopiować kod albo wkleić istniejącą lekcję .md i edytować ją graficznie.'
        : 'Możesz skopiować kod albo wkleić prompt zgodny z rozszerzeniem wybranej nazwy pliku.';
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
      } else if (state.sourceMode === 'lesson') {
        const model = lessonModelFromSource(source, state.lesson.model.filename);
        commitMutation('lesson', () => {
          state.lesson.model = model;
          state.lesson.selectedId = '';
          state.lesson.previewSlideId = model.slides[0] ? model.slides[0].id : '';
        });
      } else {
        const model = promptModelApi.parsePrompt(source, state.prompt.model.filename);
        commitMutation('prompt', () => {
          state.prompt.model = model;
        });
      }
      elements.sourceDialog.close();
      toast(
        state.sourceMode === 'prompt' ? 'Prompt zastosowany' : 'Markdown zastosowany',
        state.sourceMode === 'prompt'
          ? 'Kod został zamieniony na edytowalny model promptu.'
          : 'Kod został zamieniony na graficzne klocki.'
      );
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
    const maxBytes = mode === 'prompt' ? promptModelApi.MAX_FILE_BYTES : MAX_IMPORT_BYTES;
    if (file.size > maxBytes) {
      toast(
        'Plik jest zbyt duży',
        mode === 'prompt' ? 'Maksymalny rozmiar promptu to 256 KiB.' : 'Maksymalny rozmiar importu to 512 KiB.',
        'error'
      );
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
      } else if (mode === 'lesson') {
        const filename = lessonModelApi.validateFilename(file.name)
          ? file.name
          : state.lesson.model.filename;
        const model = lessonModelFromSource(source, filename);
        commitMutation('lesson', () => {
          state.lesson.model = model;
          state.lesson.selectedId = '';
          state.lesson.previewSlideId = model.slides[0] ? model.slides[0].id : '';
        });
        state.lesson.remoteFilename = '';
        state.lesson.remoteSha = '';
        state.lesson.remoteRepositoryId = '';
        updateRepositoryButtons();
      } else {
        const filename = promptModelApi.validateFilename(file.name)
          ? file.name
          : state.prompt.model.filename;
        const model = promptModelApi.parsePrompt(source, filename);
        commitMutation('prompt', () => {
          state.prompt.model = model;
        });
        state.prompt.remoteFilename = '';
        state.prompt.remoteSha = '';
        state.prompt.remoteRepositoryId = '';
        updateRepositoryButtons();
      }
      toast('Plik zaimportowany', `${file.name} jest gotowy do edycji.`);
    } catch (error) {
      toast('Nie udało się zaimportować', error && error.message ? error.message : 'Nieprawidłowy Markdown.', 'error');
    }
  }

  function renderPromptPoints() {
    const fragment = document.createDocumentFragment();
    state.prompt.model.points.forEach((point, index) => {
      const card = create('article', 'prompt-point');
      card.dataset.promptPointId = point.id;
      const header = create('div', 'prompt-point-header');
      const numberLabel = create('label', 'prompt-point-number');
      numberLabel.append(document.createTextNode('Numer punktu'));
      const number = document.createElement('input');
      number.type = 'number';
      number.min = '1';
      number.max = '9999';
      number.value = String(point.number);
      number.dataset.promptPointField = 'number';
      numberLabel.append(number);
      const actions = create('div', 'prompt-point-actions');
      [
        ['up', '↑', 'Przenieś wyżej'],
        ['down', '↓', 'Przenieś niżej'],
        ['duplicate', '⧉', 'Duplikuj punkt'],
        ['delete', '×', 'Usuń punkt']
      ].forEach(([action, symbol, label]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.promptPointAction = action;
        button.textContent = symbol;
        button.title = label;
        button.setAttribute('aria-label', label);
        button.disabled = (action === 'up' && index === 0)
          || (action === 'down' && index === state.prompt.model.points.length - 1);
        actions.append(button);
      });
      header.append(numberLabel, actions);
      const textarea = document.createElement('textarea');
      textarea.value = point.content;
      textarea.maxLength = promptModelApi.MAX_PROMPT_CHARS;
      textarea.dataset.promptPointField = 'content';
      textarea.placeholder = 'Instrukcja dla tego trybu pracy asystenta…';
      textarea.setAttribute('aria-label', `Treść punktu ${point.number}`);
      card.append(header, textarea);
      fragment.append(card);
    });
    elements.promptPointsList.replaceChildren(fragment);
  }

  function renderPromptPreview() {
    const validation = promptModelApi.validatePrompt(state.prompt.model);
    elements.promptValidationStatus.classList.toggle('is-error', !validation.valid);
    if (validation.valid) {
      const source = promptModelApi.serializePrompt(validation.prompt);
      const remote = state.prompt.remoteSha
        ? ` · repo: ${state.prompt.remoteFilename}`
        : ' · draft lokalny';
      elements.promptValidationStatus.textContent =
        `Plik poprawny · ${source.length.toLocaleString('pl-PL')} znaków${remote}`;
      elements.promptSourcePreview.textContent = source;
    } else {
      elements.promptValidationStatus.textContent = validation.errors[0].message;
      elements.promptSourcePreview.textContent = state.prompt.model.format === 'json'
        ? JSON.stringify({ prompt: state.prompt.model.instruction }, null, 2)
        : state.prompt.model.points
          .map((point) => `::punkt ${point.number}\n${point.content}`)
          .join('\n\n');
    }
  }

  function renderPrompt() {
    if (!state.prompt.model) return;
    elements.promptFilename.value = state.prompt.model.filename;
    elements.promptFormat.value = state.prompt.model.format;
    elements.promptInstruction.value = state.prompt.model.instruction;
    elements.promptJsonEditor.hidden = state.prompt.model.format !== 'json';
    elements.promptPointsEditor.hidden = state.prompt.model.format !== 'txt';
    elements.promptPointCount.textContent = state.prompt.model.format === 'txt'
      ? String(state.prompt.model.points.length)
      : '1';
    if (state.prompt.model.format === 'txt') renderPromptPoints();
    renderPromptPreview();
    updateRepositoryButtons();
  }

  function nextPromptPointNumber() {
    return state.prompt.model.points.reduce(
      (maximum, point) => Math.max(maximum, Number(point.number) || 0),
      0
    ) + 1;
  }

  function addPromptPoint() {
    commitMutation('prompt', () => {
      state.prompt.model.points.push(promptModelApi.createPoint({
        number: nextPromptPointNumber(),
        content: ''
      }, state.prompt.model.points.length));
    });
  }

  function promptPointAction(action, pointId) {
    const index = state.prompt.model.points.findIndex((point) => point.id === pointId);
    if (index < 0) return;
    const point = state.prompt.model.points[index];
    if (action === 'delete') {
      if (point.content.trim() && !window.confirm(`Usunąć punkt ${point.number}?`)) return;
      commitMutation('prompt', () => {
        state.prompt.model.points.splice(index, 1);
        if (!state.prompt.model.points.length) {
          state.prompt.model.points.push(promptModelApi.createPoint({ number: 1, content: '' }));
        }
      });
      return;
    }
    if (action === 'duplicate') {
      commitMutation('prompt', () => {
        state.prompt.model.points.splice(index + 1, 0, promptModelApi.createPoint({
          number: nextPromptPointNumber(),
          content: point.content
        }, index + 1));
      });
      return;
    }
    const next = index + (action === 'up' ? -1 : action === 'down' ? 1 : 0);
    if (next < 0 || next >= state.prompt.model.points.length || next === index) return;
    commitMutation('prompt', () => {
      const [moving] = state.prompt.model.points.splice(index, 1);
      state.prompt.model.points.splice(next, 0, moving);
    });
  }

  function changePromptFormat(nextFormat) {
    const format = nextFormat === 'txt' ? 'txt' : 'json';
    if (state.prompt.model.format === format) return;
    commitMutation('prompt', () => {
      if (format === 'txt' && !state.prompt.model.points.length) {
        state.prompt.model.points = [promptModelApi.createPoint({
          number: 1,
          content: state.prompt.model.instruction
        })];
      }
      if (format === 'json' && !state.prompt.model.instruction.trim()) {
        state.prompt.model.instruction = state.prompt.model.points
          .map((point) => point.content.trim())
          .filter(Boolean)
          .join('\n\n');
      }
      state.prompt.model.format = format;
      state.prompt.model.filename = promptModelApi.filenameForFormat(
        state.prompt.model.filename,
        format
      );
    });
  }

  function handlePromptInput(event) {
    if (event.target === elements.promptFilename) {
      beginEdit('prompt');
      state.prompt.model.filename = event.target.value.trim();
    } else if (event.target === elements.promptInstruction) {
      beginEdit('prompt');
      state.prompt.model.instruction = event.target.value;
    } else {
      const card = event.target.closest('[data-prompt-point-id]');
      const field = event.target.dataset.promptPointField;
      if (!card || !field) return;
      const point = state.prompt.model.points.find((item) => item.id === card.dataset.promptPointId);
      if (!point) return;
      beginEdit('prompt');
      point[field] = field === 'number' ? Number(event.target.value) : event.target.value;
    }
    renderPromptPreview();
    scheduleDraftSave('prompt');
  }

  function downloadPrompt() {
    const validation = promptModelApi.validatePrompt(state.prompt.model);
    if (!validation.valid) {
      toast('Prompt wymaga poprawek', validation.errors[0].message, 'error');
      return;
    }
    const source = promptModelApi.serializePrompt(validation.prompt);
    const type = validation.prompt.format === 'json'
      ? 'application/json;charset=utf-8'
      : 'text/plain;charset=utf-8';
    const href = URL.createObjectURL(new Blob([source], { type }));
    const link = document.createElement('a');
    link.href = href;
    link.download = validation.prompt.filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    toast('Plik promptu pobrany', validation.prompt.filename);
  }

  function updateRepositoryButtons() {
    const selectedRepositoryId = state.contentLibrary.selectedRepositoryId;
    if (elements.lessonRepositorySave) {
      elements.lessonRepositorySave.disabled = state.lesson.saving;
      const updatesCurrentFile = Boolean(
        state.lesson.remoteFilename
        && state.lesson.remoteSha
        && state.lesson.remoteFilename === state.lesson.model.filename
        && state.lesson.remoteRepositoryId === selectedRepositoryId
      );
      elements.lessonRepositorySave.textContent = updatesCurrentFile
        ? 'Zapisz zmiany w GitHubie'
        : 'Utwórz plik w GitHubie';
      elements.lessonRepositorySave.title = updatesCurrentFile
        ? `Zaktualizuj ${state.lesson.remoteFilename}`
        : 'Utwórz nowy plik .md w wybranym repozytorium';
      elements.lessonRepositoryDelete.disabled = state.lesson.saving
        || !state.lesson.remoteFilename
        || !state.lesson.remoteSha
        || state.lesson.remoteRepositoryId !== selectedRepositoryId;
      elements.lessonRepositoryDelete.title = state.lesson.remoteFilename
        ? state.lesson.remoteRepositoryId === selectedRepositoryId
          ? `Usuń ${state.lesson.remoteFilename} z wybranego repozytorium`
          : 'Wybierz repozytorium, z którego wczytano lekcję, aby ją usunąć'
        : 'Najpierw wczytaj albo zapisz lekcję w repozytorium';
    }
    if (elements.promptRepositorySave) {
      elements.promptRepositorySave.disabled = state.prompt.saving;
      elements.promptRepositoryDelete.disabled = state.prompt.saving
        || !state.prompt.remoteFilename
        || !state.prompt.remoteSha
        || state.prompt.remoteRepositoryId !== selectedRepositoryId;
      elements.promptRepositoryDelete.title = state.prompt.remoteFilename
        ? state.prompt.remoteRepositoryId === selectedRepositoryId
          ? `Usuń ${state.prompt.remoteFilename} z wybranego repozytorium`
          : 'Wybierz repozytorium, z którego wczytano prompt, aby go usunąć'
        : 'Najpierw wczytaj albo zapisz prompt w repozytorium';
    }
  }

  async function saveLessonToRepository() {
    const validation = lessonModelApi.validateLesson(state.lesson.model);
    if (!validation.valid) {
      toast('Lekcja wymaga poprawek', validation.errors[0].message, 'error');
      return;
    }
    const filename = validation.lesson.filename;
    const repositoryId = state.contentLibrary.selectedRepositoryId;
    if (!repositoryId) {
      toast('Wybierz repozytorium', 'Najpierw wybierz docelowe repozytorium materiałów.', 'error');
      return;
    }
    const renamed = state.lesson.remoteFilename && state.lesson.remoteFilename !== filename;
    const moved = state.lesson.remoteRepositoryId && state.lesson.remoteRepositoryId !== repositoryId;
    if (
      (renamed || moved) &&
      !window.confirm(
        moved
          ? 'Wybrano inne repozytorium. Utworzyć w nim nowy plik i pozostawić oryginał bez zmian?'
          : `Nazwa zmieniła się z „${state.lesson.remoteFilename}” na „${filename}”. Utworzyć nowy plik i pozostawić stary w repozytorium?`
      )
    ) return;
    state.lesson.saving = true;
    updateRepositoryButtons();
    try {
      validation.lesson.navigationConfigured = true;
      validation.lesson.slides.forEach((slide) => { slide.progressConfigured = true; });
      const result = await window.ChemContentLibrary.save('lesson', {
        filename,
        content: lessonModelApi.serializeLesson(validation.lesson),
        expectedSha: renamed || moved ? '' : state.lesson.remoteSha,
        repositoryId
      });
      state.lesson.remoteFilename = filename;
      state.lesson.remoteSha = result.sha;
      state.lesson.remoteRepositoryId = result.repositoryId || repositoryId;
      state.lesson.model = lessonModelApi.createLesson(validation.lesson);
      const progressToken = await adminToken();
      const manifestResponse = await fetch(ADMIN_PROGRESS_URL, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${progressToken}`
        },
        body: JSON.stringify({
          action: 'lesson_manifest',
          filename,
          manifest: {
            navigation: validation.lesson.navigation,
            steps: validation.lesson.slides.map((slide, index) => ({
              id: slide.id,
              title: slideTitle(slide, index),
              includeInLesson: slide.includeInLesson !== 'OFF',
              requiredToAdvance: slide.requiredToAdvance !== false,
              condition: slide.condition
            }))
          }
        })
      });
      if (!manifestResponse.ok) {
        const progressError = await responseJson(manifestResponse);
        throw new Error(`Lekcja została zapisana, ale manifest postępu wymaga ponowienia (${progressError?.error || manifestResponse.status}).`);
      }
      toast(
        result.created ? 'Lekcja dodana do GitHuba' : 'Lekcja zaktualizowana',
        result.commitSha ? `Commit ${result.commitSha.slice(0, 7)} został zapisany.` : filename
      );
      await loadRepositoryAssets(true);
    } catch (error) {
      toast('Nie udało się zapisać lekcji', error && error.message ? error.message : 'Błąd repozytorium.', 'error');
    } finally {
      state.lesson.saving = false;
      updateRepositoryButtons();
    }
  }

  async function savePromptToRepository() {
    const validation = promptModelApi.validatePrompt(state.prompt.model);
    if (!validation.valid) {
      toast('Prompt wymaga poprawek', validation.errors[0].message, 'error');
      return;
    }
    const filename = validation.prompt.filename;
    const repositoryId = state.contentLibrary.selectedRepositoryId;
    if (!repositoryId) {
      toast('Wybierz repozytorium', 'Najpierw wybierz docelowe repozytorium materiałów.', 'error');
      return;
    }
    const renamed = state.prompt.remoteFilename && state.prompt.remoteFilename !== filename;
    const moved = state.prompt.remoteRepositoryId && state.prompt.remoteRepositoryId !== repositoryId;
    if (
      (renamed || moved) &&
      !window.confirm(
        moved
          ? 'Wybrano inne repozytorium. Utworzyć w nim nowy plik i pozostawić oryginał bez zmian?'
          : `Nazwa zmieniła się z „${state.prompt.remoteFilename}” na „${filename}”. Utworzyć nowy plik i pozostawić stary w repozytorium?`
      )
    ) return;
    state.prompt.saving = true;
    updateRepositoryButtons();
    try {
      const result = await window.ChemContentLibrary.save('prompt', {
        filename,
        content: promptModelApi.serializePrompt(validation.prompt),
        expectedSha: renamed || moved ? '' : state.prompt.remoteSha,
        repositoryId
      });
      state.prompt.remoteFilename = filename;
      state.prompt.remoteSha = result.sha;
      state.prompt.remoteRepositoryId = result.repositoryId || repositoryId;
      toast(
        result.created ? 'Prompt dodany do GitHuba' : 'Prompt zaktualizowany',
        result.commitSha ? `Commit ${result.commitSha.slice(0, 7)} został zapisany.` : filename
      );
      renderPromptPreview();
      await loadRepositoryAssets(true);
    } catch (error) {
      toast('Nie udało się zapisać promptu', error && error.message ? error.message : 'Błąd repozytorium.', 'error');
    } finally {
      state.prompt.saving = false;
      updateRepositoryButtons();
    }
  }

  async function deleteRepositoryAsset(kind) {
    const target = kind === 'lesson' ? state.lesson : state.prompt;
    if (
      !target.remoteFilename ||
      !target.remoteSha ||
      target.remoteRepositoryId !== state.contentLibrary.selectedRepositoryId
    ) {
      toast('Brak wersji repozytorium', 'Wczytaj plik z GitHuba przed próbą usunięcia.', 'error');
      return;
    }
    if (!window.confirm(
      `Usunąć „${target.remoteFilename}” z repozytorium? GitHub utworzy commit usuwający plik, więc będzie można odzyskać go z historii.`
    )) return;
    target.saving = true;
    updateRepositoryButtons();
    try {
      const deletedFilename = target.remoteFilename;
      const result = await window.ChemContentLibrary.remove(kind, {
        filename: target.remoteFilename,
        expectedSha: target.remoteSha,
        repositoryId: target.remoteRepositoryId
      });
      target.remoteFilename = '';
      target.remoteSha = '';
      target.remoteRepositoryId = '';
      toast(
        kind === 'lesson' ? 'Lekcja usunięta z GitHuba' : 'Prompt usunięty z GitHuba',
        result.commitSha ? `Commit ${result.commitSha.slice(0, 7)} został zapisany. Lokalny draft pozostaje w builderze.` : deletedFilename
      );
      await loadRepositoryAssets(true);
      if (kind === 'prompt') renderPromptPreview();
    } catch (error) {
      toast('Nie udało się usunąć pliku', error && error.message ? error.message : 'Błąd repozytorium.', 'error');
    } finally {
      target.saving = false;
      updateRepositoryButtons();
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
    const quickTask = event.target.closest('[data-lesson-quick-task]');
    if (quickTask) {
      addLessonNode(quickTask.dataset.lessonQuickTask, {
        slideId: quickTask.dataset.lessonSlideId,
        parentBlockId: ''
      });
      return;
    }
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

  function repositoryAssetButton(asset, actionLabel, onClick) {
    const button = create('button', 'repository-asset');
    button.type = 'button';
    button.dataset.assetFilename = asset.filename;
    const kind = create(
      'span',
      'repository-asset-kind',
      asset.kind === 'lesson' ? 'MD' : asset.kind === 'exam' ? 'EXAM' : /\.txt$/i.test(asset.filename) ? 'TXT' : 'JSON'
    );
    const copy = create('span');
    copy.append(
      create('strong', '', asset.title || asset.filename),
      create('small', '', asset.description || asset.filename)
    );
    const action = create('span', 'repository-asset-action', actionLabel);
    button.append(kind, copy, action);
    button.addEventListener('click', () => onClick(asset));
    return button;
  }

  function renderRepositoryAssets() {
    const library = window.ChemContentLibrary;
    if (!library) return;
    const dashboardAssets = library.search(
      [...state.contentLibrary.lessons, ...state.contentLibrary.prompts, ...state.contentLibrary.exams],
      elements.dashboardAssetSearch.value
    );
    elements.dashboardAssetList.replaceChildren(
      ...dashboardAssets.map((asset) => repositoryAssetButton(asset, 'Dodaj', insertDashboardAsset))
    );
    const lessonAssets = library.search(
      state.contentLibrary.lessons,
      elements.lessonAssetSearch.value
    );
    elements.lessonAssetList.replaceChildren(
      ...lessonAssets.map((asset) => repositoryAssetButton(asset, 'Wczytaj', importRepositoryLesson))
    );
    const promptAssets = library.search(
      state.contentLibrary.prompts,
      elements.promptAssetSearch.value
    );
    elements.promptAssetList.replaceChildren(
      ...promptAssets.map((asset) => repositoryAssetButton(asset, 'Wczytaj', importRepositoryPrompt))
    );
    if (state.contentLibrary.loaded) {
      elements.dashboardAssetStatus.textContent = dashboardAssets.length
        ? `${dashboardAssets.length} pasujących plików.`
        : 'Brak plików pasujących do wyszukiwania.';
      elements.lessonAssetStatus.textContent = lessonAssets.length
        ? `${lessonAssets.length} pasujących lekcji.`
        : 'Brak lekcji pasujących do wyszukiwania.';
      elements.promptAssetStatus.textContent = promptAssets.length
        ? `${promptAssets.length} pasujących promptów.`
        : 'Brak promptów pasujących do wyszukiwania.';
    }
    renderContentExplorer();
  }

  function renderContentExplorer() {
    if (!elements.contentExplorerFolders) return;
    const library = window.ChemContentLibrary;
    const query = elements.contentExplorerSearch?.value || '';
    const groups = [
      { kind: 'lesson', title: 'Lekcje', icon: 'L', assets: state.contentLibrary.lessons },
      { kind: 'exam', title: 'Egzaminy', icon: 'E', assets: state.contentLibrary.exams },
      { kind: 'prompt', title: 'Prompty', icon: 'P', assets: state.contentLibrary.prompts }
    ];
    elements.contentExplorerFolders.replaceChildren(...groups.map((group) => {
      const visible = library?.search ? library.search(group.assets, query) : group.assets;
      const folder = document.createElement('details');
      folder.className = 'content-explorer-folder';
      folder.open = true;
      const summary = document.createElement('summary');
      summary.append(
        create('span', 'content-explorer-folder-icon', group.icon),
        create('strong', '', group.title),
        create('small', '', `${visible.length}/${group.assets.length}`),
        create('span', 'content-explorer-chevron', '⌄')
      );
      const files = create('div', 'content-explorer-files');
      visible.forEach((asset) => {
        const button = create('button', 'content-explorer-file');
        button.type = 'button';
        button.dataset.explorerKind = group.kind;
        button.dataset.explorerFilename = asset.filename;
        button.dataset.explorerRepository = asset.repositoryId || state.contentLibrary.selectedRepositoryId;
        const copy = create('span', 'content-explorer-file-copy');
        copy.append(
          create('strong', '', asset.title || asset.filename),
          create('small', '', asset.path || asset.filename)
        );
        button.append(
          create('span', `content-explorer-file-type is-${group.kind}`, group.kind === 'lesson' ? 'MD' : group.kind === 'exam' ? 'EXAM' : /\.txt$/i.test(asset.filename) ? 'TXT' : 'JSON'),
          copy,
          create('span', 'content-explorer-open', 'Otwórz →')
        );
        files.append(button);
      });
      if (!visible.length) files.append(create('p', 'content-explorer-empty', query ? 'Brak pasujących plików.' : 'Ten folder jest pusty.'));
      folder.append(summary, files);
      return folder;
    }));
    if (elements.contentExplorerStatus) {
      const total = groups.reduce((sum, group) => sum + group.assets.length, 0);
      const selected = selectedRepository();
      elements.contentExplorerStatus.classList.toggle('is-error', Boolean(state.contentLibrary.error));
      elements.contentExplorerStatus.textContent = state.contentLibrary.loading
        ? 'Pobieranie plików z prywatnego repozytorium…'
        : state.contentLibrary.error
          ? state.contentLibrary.error
          : state.contentLibrary.loaded
            ? `${total} plików · ${selected?.label || selected?.repository || 'repozytorium'}`
            : 'Biblioteka nie została jeszcze wczytana.';
    }
  }

  function selectedRepository() {
    return state.contentLibrary.repositories.find(
      (repository) => repository.id === state.contentLibrary.selectedRepositoryId
    ) || null;
  }

  function renderRepositorySelectors() {
    const repositories = state.contentLibrary.repositories;
    const selectedId = state.contentLibrary.selectedRepositoryId;
    [elements.dashboardRepository, elements.lessonRepository, elements.promptRepository, elements.contentExplorerRepository].forEach((select) => {
      if (!select) return;
      select.replaceChildren(...repositories.map((repository) => {
        const option = document.createElement('option');
        option.value = repository.id;
        option.textContent = repository.label || repository.repository;
        return option;
      }));
      select.value = selectedId;
      select.disabled = repositories.length < 2;
    });
  }

  async function selectContentRepository(repositoryId) {
    if (
      !state.contentLibrary.repositories.some((repository) => repository.id === repositoryId) ||
      repositoryId === state.contentLibrary.selectedRepositoryId
    ) return;
    state.contentLibrary.selectedRepositoryId = repositoryId;
    state.contentLibrary.lessons = [];
    state.contentLibrary.prompts = [];
    state.contentLibrary.exams = [];
    state.contentLibrary.loaded = false;
    state.contentLibrary.error = '';
    renderRepositorySelectors();
    renderRepositoryAssets();
    updateRepositoryButtons();
    await loadRepositoryAssets(false);
    if (state.mode === 'dashboard') renderDashboardInspector();
    if (state.mode === 'lesson') renderLessonInspector();
  }

  async function loadRepositoryAssets(force) {
    const library = window.ChemContentLibrary;
    if (
      !library ||
      typeof library.list !== 'function' ||
      typeof library.repositories !== 'function'
    ) {
      elements.dashboardAssetStatus.textContent = 'Brakuje klienta biblioteki materiałów.';
      elements.lessonAssetStatus.textContent = 'Brakuje klienta biblioteki materiałów.';
      elements.promptAssetStatus.textContent = 'Brakuje klienta biblioteki materiałów.';
      if (elements.contentExplorerStatus) elements.contentExplorerStatus.textContent = 'Brakuje klienta biblioteki materiałów.';
      return;
    }
    const requestId = ++state.contentLibrary.requestId;
    state.contentLibrary.loading = true;
    state.contentLibrary.error = '';
    [elements.dashboardAssetStatus, elements.lessonAssetStatus, elements.promptAssetStatus].forEach((status) => {
      status.classList.remove('is-error');
      status.textContent = 'Pobieranie listy z prywatnego repozytorium…';
    });
    if (elements.contentExplorerStatus) {
      elements.contentExplorerStatus.classList.remove('is-error');
      elements.contentExplorerStatus.textContent = 'Pobieranie plików z prywatnego repozytorium…';
    }
    renderContentExplorer();
    try {
      if (!state.contentLibrary.repositories.length) {
        state.contentLibrary.repositories = await library.repositories();
      }
      if (!state.contentLibrary.repositories.length) {
        throw new Error('Nie skonfigurowano żadnego repozytorium materiałów.');
      }
      if (!selectedRepository()) {
        const fallback = state.contentLibrary.repositories.find((repository) => repository.default)
          || state.contentLibrary.repositories[0];
        state.contentLibrary.selectedRepositoryId = fallback.id;
      }
      renderRepositorySelectors();
      const repositoryId = state.contentLibrary.selectedRepositoryId;
      const [lessons, prompts, exams] = await Promise.all([
        library.list('lesson', { refresh: Boolean(force), repositoryId }),
        library.list('prompt', { refresh: Boolean(force), repositoryId }),
        library.list('exam', { refresh: Boolean(force), repositoryId })
      ]);
      if (requestId !== state.contentLibrary.requestId) return;
      state.contentLibrary.lessons = lessons;
      state.contentLibrary.prompts = prompts;
      state.contentLibrary.exams = exams;
      state.contentLibrary.loaded = true;
      renderRepositoryAssets();
      if (state.mode === 'dashboard') renderDashboardInspector();
      if (state.mode === 'lesson') renderLessonInspector();
    } catch (error) {
      if (requestId !== state.contentLibrary.requestId) return;
      state.contentLibrary.loaded = false;
      state.contentLibrary.error = error && error.message
        ? error.message
        : 'Nie udało się pobrać listy materiałów.';
      [elements.dashboardAssetStatus, elements.lessonAssetStatus, elements.promptAssetStatus].forEach((status) => {
        status.classList.add('is-error');
        status.textContent = state.contentLibrary.error;
      });
      if (elements.contentExplorerStatus) {
        elements.contentExplorerStatus.classList.add('is-error');
        elements.contentExplorerStatus.textContent = state.contentLibrary.error;
      }
    } finally {
      if (requestId === state.contentLibrary.requestId) {
        state.contentLibrary.loading = false;
        renderContentExplorer();
      }
    }
  }

  async function importRepositoryLesson(asset, options = {}) {
    if (!asset || !asset.filename) return;
    if (options.confirm !== false && !window.confirm(`Wczytać „${asset.title || asset.filename}” i zastąpić bieżącą lekcję w builderze?`)) {
      return;
    }
    elements.lessonAssetStatus.className = '';
    elements.lessonAssetStatus.textContent = `Pobieranie ${asset.filename}…`;
    try {
      const result = await window.ChemContentLibrary.readLesson(asset.filename, {
        repositoryId: asset.repositoryId
      });
      const sourceWasEmpty = !String(result.content || '').trim();
      const model = lessonModelFromSource(result.content, asset.filename);
      finishEdit();
      state.lesson.model = model;
      state.lesson.selectedId = sourceWasEmpty && model.slides[0] ? model.slides[0].id : '';
      state.lesson.previewSlideId = model.slides[0] ? model.slides[0].id : '';
      history.lesson.undo = [];
      history.lesson.redo = [];
      state.lesson.remoteFilename = asset.filename;
      state.lesson.remoteSha = asset.sha || result.sha || '';
      state.lesson.remoteRepositoryId = asset.repositoryId || result.repositoryId || '';
      scheduleDraftSave('lesson');
      renderLesson();
      updateHistoryButtons();
      updateRepositoryButtons();
      elements.lessonAssetStatus.textContent = sourceWasEmpty
        ? `${asset.filename} był pusty — dodano edytowalny szablon.`
        : `Wczytano ${asset.filename}.`;
      toast(
        sourceWasEmpty ? 'Pusty plik jest gotowy do edycji' : 'Lekcja wczytana z GitHuba',
        sourceWasEmpty
          ? 'Uzupełnij szablon i kliknij „Zapisz zmiany w GitHubie”.'
          : 'Możesz ją edytować, podejrzeć i pobrać jako Markdown.'
      );
      switchMode('lesson');
    } catch (error) {
      elements.lessonAssetStatus.className = 'is-error';
      elements.lessonAssetStatus.textContent = error && error.message
        ? error.message
        : 'Nie udało się wczytać lekcji.';
    }
  }

  async function importRepositoryPrompt(asset, options = {}) {
    if (!asset || !asset.filename) return;
    if (options.confirm !== false && !window.confirm(`Wczytać „${asset.title || asset.filename}” i zastąpić bieżący prompt w builderze?`)) {
      return;
    }
    elements.promptAssetStatus.className = 'prompt-repository-status';
    elements.promptAssetStatus.textContent = `Pobieranie ${asset.filename}…`;
    try {
      const result = await window.ChemContentLibrary.readPrompt(asset.filename, {
        repositoryId: asset.repositoryId
      });
      const model = promptModelApi.parsePrompt(result.content, asset.filename);
      finishEdit();
      state.prompt.model = model;
      history.prompt.undo = [];
      history.prompt.redo = [];
      state.prompt.remoteFilename = asset.filename;
      state.prompt.remoteSha = asset.sha || result.sha || '';
      state.prompt.remoteRepositoryId = asset.repositoryId || result.repositoryId || '';
      scheduleDraftSave('prompt');
      renderPrompt();
      updateHistoryButtons();
      updateRepositoryButtons();
      elements.promptAssetStatus.textContent = `Wczytano ${asset.filename}.`;
      toast('Prompt wczytany z GitHuba', 'Możesz go edytować, pobrać ręcznie albo zapisać jako kolejny commit.');
      switchMode('prompt');
    } catch (error) {
      elements.promptAssetStatus.className = 'prompt-repository-status is-error';
      elements.promptAssetStatus.textContent = error && error.message
        ? error.message
        : 'Nie udało się wczytać promptu.';
    }
  }

  async function openContentExplorerAsset(event) {
    const button = event.target.closest('[data-explorer-kind][data-explorer-filename]');
    if (!button || button.disabled) return;
    const kind = button.dataset.explorerKind;
    const collection = kind === 'lesson'
      ? state.contentLibrary.lessons
      : kind === 'exam' ? state.contentLibrary.exams : state.contentLibrary.prompts;
    const asset = collection.find((entry) => (
      entry.filename === button.dataset.explorerFilename
      && (entry.repositoryId || state.contentLibrary.selectedRepositoryId) === button.dataset.explorerRepository
    ));
    if (!asset) return;
    button.disabled = true;
    elements.contentExplorerStatus.classList.remove('is-error');
    elements.contentExplorerStatus.textContent = `Otwieranie ${asset.title || asset.filename}…`;
    try {
      if (kind === 'lesson') await importRepositoryLesson(asset, { confirm: false });
      else if (kind === 'prompt') await importRepositoryPrompt(asset, { confirm: false });
      else {
        switchMode('exam');
        await window.ChemExamBuilder?.openAsset?.(asset);
      }
    } catch (error) {
      elements.contentExplorerStatus.classList.add('is-error');
      elements.contentExplorerStatus.textContent = error?.message || 'Nie udało się otworzyć pliku.';
    } finally {
      button.disabled = false;
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
    document.addEventListener('chemdisk-mathjax-ready', () => typesetMath(elements.lessonPreview));
    elements.undo.addEventListener('click', undo);
    elements.redo.addEventListener('click', redo);
    bindPalette();
    all('[data-studio-toggle]').forEach((button) => {
      button.addEventListener('click', toggleStudioLayout);
    });

    elements.dashboardPaletteSearch.addEventListener('input', () => {
      filterPalette(elements.dashboardPaletteSearch, 'data-search');
    });
    elements.lessonPaletteSearch.addEventListener('input', () => {
      filterPalette(elements.lessonPaletteSearch, 'data-search');
    });
    elements.dashboardAssetSearch.addEventListener('input', renderRepositoryAssets);
    elements.lessonAssetSearch.addEventListener('input', renderRepositoryAssets);
    elements.promptAssetSearch.addEventListener('input', renderRepositoryAssets);
    elements.contentExplorerSearch?.addEventListener('input', renderContentExplorer);
    elements.contentExplorerFolders?.addEventListener('click', openContentExplorerAsset);
    elements.contentExplorerRefresh?.addEventListener('click', () => loadRepositoryAssets(true));
    [elements.dashboardRepository, elements.lessonRepository, elements.promptRepository, elements.contentExplorerRepository].forEach((select) => {
      if (!select) return;
      select.addEventListener('change', () => selectContentRepository(select.value));
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
        updateRepositoryButtons();
      });
    });
    [elements.promptFilename, elements.promptInstruction].forEach((input) => {
      input.addEventListener('focus', () => beginEdit('prompt'));
      input.addEventListener('input', handlePromptInput);
      input.addEventListener('blur', () => {
        finishEdit();
        renderPromptPreview();
      });
    });
    elements.promptFormat.addEventListener('change', () => changePromptFormat(elements.promptFormat.value));
    elements.promptAddPoint.addEventListener('click', addPromptPoint);
    elements.promptPointsList.addEventListener('focusin', (event) => {
      if (event.target.dataset.promptPointField) beginEdit('prompt');
    });
    elements.promptPointsList.addEventListener('input', handlePromptInput);
    elements.promptPointsList.addEventListener('focusout', (event) => {
      if (event.target.dataset.promptPointField) finishEdit();
    });
    elements.promptPointsList.addEventListener('click', (event) => {
      const action = event.target.closest('[data-prompt-point-action]');
      const card = event.target.closest('[data-prompt-point-id]');
      if (action && card) promptPointAction(action.dataset.promptPointAction, card.dataset.promptPointId);
    });

    elements.dashboardInspector.addEventListener('focusin', (event) => {
      if (event.target.closest('[data-dashboard-field]')) beginEdit('dashboard');
    });
    elements.dashboardInspector.addEventListener('input', handleDashboardInspectorInput);
    elements.dashboardInspector.addEventListener('change', (event) => {
      handleDashboardInspectorInput(event);
      finishEdit();
      if (['source', 'variant', 'repositoryId', 'protection'].includes(event.target.dataset.dashboardField)) {
        renderDashboardInspector();
      }
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
      const target = event.target.closest('[data-lesson-field]');
      if (!target) return;
      beginEdit('lesson');
      if (['left', 'right'].includes(target.dataset.lessonField)) {
        state.lesson.formulaField = target.dataset.lessonField;
      }
    });
    elements.lessonInspector.addEventListener('input', handleLessonInspectorInput);
    elements.lessonInspector.addEventListener('change', (event) => {
      handleLessonInspectorInput(event);
      finishEdit();
      if (
        ['type', 'mode', 'arrow', 'variant', 'repositoryId', 'promptFile', 'examId', 'requirement', 'options', 'optionItem', 'gapLabel', 'gapSegment', 'useColor', 'conditionType']
          .includes(event.target.dataset.lessonField)
      ) {
        renderLessonInspector();
      }
    });
    elements.lessonInspector.addEventListener('focusout', (event) => {
      if (event.target.closest('[data-lesson-field]')) finishEdit();
    });
    elements.lessonInspector.addEventListener('click', (event) => {
      const formulaPreset = event.target.closest('[data-formula-preset]');
      if (formulaPreset) {
        applyLessonFormulaPreset(formulaPreset);
        return;
      }
      const formulaArrow = event.target.closest('[data-formula-arrow]');
      if (formulaArrow) {
        applyLessonFormulaArrow(formulaArrow);
        return;
      }
      const formulaSnippet = event.target.closest('[data-formula-snippet]');
      if (formulaSnippet) {
        insertLessonFormulaSnippet(formulaSnippet);
        return;
      }
      const taskEditorAction = event.target.closest('[data-lesson-task-editor-action]');
      if (taskEditorAction) {
        lessonTaskEditorAction(taskEditorAction);
        return;
      }
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

    elements.lessonNew.addEventListener('click', createNewLessonDraft);
    elements.lessonSource.addEventListener('click', () => openSourceDialog('lesson'));
    elements.lessonImport.addEventListener('click', () => elements.lessonFile.click());
    elements.lessonFile.addEventListener('change', () => {
      const file = elements.lessonFile.files && elements.lessonFile.files[0];
      importMarkdownFile(file, 'lesson');
      elements.lessonFile.value = '';
    });
    elements.lessonDownload.addEventListener('click', downloadLesson);
    elements.lessonRepositorySave.addEventListener('click', saveLessonToRepository);
    elements.lessonRepositoryDelete.addEventListener('click', () => deleteRepositoryAsset('lesson'));
    elements.lessonCopy.addEventListener('click', async () => {
      try {
        await copyText(lessonModelApi.serializeLesson(state.lesson.model));
        toast('Markdown skopiowany', 'Możesz wkleić go bezpośrednio do nowego pliku .md.');
      } catch (error) {
        toast('Nie udało się skopiować', error.message, 'error');
      }
    });
    elements.promptSource.addEventListener('click', () => openSourceDialog('prompt'));
    elements.promptImport.addEventListener('click', () => elements.promptFile.click());
    elements.promptFile.addEventListener('change', () => {
      const file = elements.promptFile.files && elements.promptFile.files[0];
      importMarkdownFile(file, 'prompt');
      elements.promptFile.value = '';
    });
    elements.promptDownload.addEventListener('click', downloadPrompt);
    elements.promptRepositorySave.addEventListener('click', savePromptToRepository);
    elements.promptRepositoryDelete.addEventListener('click', () => deleteRepositoryAsset('prompt'));
    elements.promptCopy.addEventListener('click', async () => {
      try {
        await copyText(promptModelApi.serializePrompt(state.prompt.model));
        toast('Prompt skopiowany', 'Możesz wkleić go do pliku albo innego repozytorium.');
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
        else if (state.mode === 'prompt') downloadPrompt();
      }
    });
  }

  async function start() {
    if (!dashboardModelApi || !lessonModelApi || !promptModelApi || !window.ChemExamStudioModel || !window.ChemLesson) {
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
    const previewMode = requestedFullPreviewMode();
    if (previewMode) {
      startStandalonePreview(previewMode);
      return;
    }
    loadStudioLayout();
    bindEvents();
    elements.accessState.hidden = true;
    elements.app.hidden = false;
    elements.modeSwitch.hidden = false;
    switchMode('home');
    setSaveIndicator('Drafty gotowe', 'saved');
    loadRepositoryAssets(false);
  }

  document.addEventListener('DOMContentLoaded', start);
})();
