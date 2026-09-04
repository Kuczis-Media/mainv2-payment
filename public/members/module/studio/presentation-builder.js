(function initializePresentationBuilder(root) {
  'use strict';

  const modelApi = root.ChemPresentationStudioModel;
  const library = root.ChemContentLibrary;
  const pagedListApi = root.ChemStudioPagedList;
  if (!modelApi || !library || !pagedListApi) return;

  const byId = (id) => root.document.getElementById(id);
  const elements = {
    workspace: byId('presentation-workspace'),
    title: byId('presentation-title'),
    repository: byId('presentation-repository'),
    search: byId('presentation-search'),
    library: byId('presentation-library'),
    libraryStatus: byId('presentation-library-status'),
    slides: byId('presentation-slide-list'),
    layout: byId('presentation-layout'),
    zoom: byId('presentation-zoom'),
    stageWrap: byId('presentation-stage-wrap'),
    canvas: byId('presentation-canvas'),
    notes: byId('presentation-notes'),
    propertiesTitle: byId('presentation-properties-title'),
    properties: byId('presentation-properties'),
    status: byId('presentation-status')
  };
  if (!elements.workspace) return;

  const DRAFT_KEY = 'chemdisk.studio.presentation.v1';
  const state = {
    presentation: null,
    selectedSlideId: '',
    selectedElementId: '',
    repositoryId: '',
    remoteId: '',
    remoteSha: '',
    repositories: [],
    assets: [],
    active: false,
    loaded: false,
    libraryPaging: pagedListApi.createState(),
    undo: [],
    redo: [],
    clipboard: null,
    objectUrls: new Set(),
    inputSnapshot: '',
    dragSnapshot: ''
  };

  const create = (tag, className, text) => {
    const node = root.document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function snapshot() { return JSON.stringify(state.presentation); }
  function restore(raw) {
    state.presentation = modelApi.parse(raw);
    if (!state.presentation.slides.some((slide) => slide.slideId === state.selectedSlideId)) {
      state.selectedSlideId = state.presentation.slides[0]?.slideId || '';
    }
    if (!selectedSlide()?.elements.some((element) => element.elementId === state.selectedElementId)) state.selectedElementId = '';
  }
  function saveLocal() {
    try { root.localStorage.setItem(DRAFT_KEY, snapshot()); } catch (_) {}
  }
  function setStatus(message, error) {
    elements.status.textContent = message || '';
    elements.status.classList.toggle('is-error', Boolean(error));
  }

  function setLibraryStatus(message, error = false) {
    if (!elements.libraryStatus) return;
    elements.libraryStatus.textContent = message || '';
    elements.libraryStatus.classList.toggle('is-error', Boolean(error));
  }

  function pushHistory(raw = snapshot()) {
    if (state.undo[state.undo.length - 1] !== raw) state.undo.push(raw);
    state.undo = state.undo.slice(-80);
    state.redo = [];
  }

  function mutate(task, label = 'Niezapisane zmiany') {
    pushHistory();
    task();
    saveLocal();
    setStatus(label);
    render();
  }

  function selectedSlide() {
    return state.presentation?.slides.find((slide) => slide.slideId === state.selectedSlideId)
      || state.presentation?.slides[0]
      || null;
  }
  function selectedElement() {
    return selectedSlide()?.elements.find((element) => element.elementId === state.selectedElementId) || null;
  }

  function loadDraft() {
    let draft = null;
    try { draft = root.localStorage.getItem(DRAFT_KEY); } catch (_) {}
    try { state.presentation = draft ? modelApi.parse(draft) : modelApi.createPresentation(); }
    catch (_) { state.presentation = modelApi.createPresentation(); }
    state.selectedSlideId = state.presentation.slides[0].slideId;
  }

  async function loadLibrary(refresh = false) {
    setLibraryStatus('Pobieranie biblioteki prezentacji…');
    try {
      if (!state.repositories.length) state.repositories = await library.repositories();
      if (!state.repositoryId) state.repositoryId = state.repositories.find((entry) => entry.default)?.id || state.repositories[0]?.id || '';
      elements.repository.replaceChildren(...state.repositories.map((entry) => {
        const option = create('option', '', entry.label || entry.repository);
        option.value = entry.id;
        return option;
      }));
      elements.repository.value = state.repositoryId;
      state.assets = await library.list('presentation', { repositoryId: state.repositoryId, refresh });
      renderLibrary();
    } catch (error) {
      setLibraryStatus(error?.message || 'Nie udało się wczytać prezentacji.', true);
      setStatus(error?.message || 'Nie udało się wczytać prezentacji.', true);
    }
  }

  function renderLibrary() {
    const assets = library.search(state.assets, elements.search.value);
    const paged = pagedListApi.page(state.libraryPaging, 'presentation-library', assets);
    elements.library.replaceChildren(...paged.items.map((asset) => {
      const button = create('button', `repository-asset${state.remoteId === asset.filename ? ' is-active' : ''}`);
      button.type = 'button';
      const copy = create('span');
      copy.append(create('strong', '', asset.title || asset.filename), create('small', '', asset.filename));
      button.append(
        create('span', 'repository-asset-kind', 'SLIDE'),
        copy,
        create('span', 'repository-asset-action', 'Otwórz')
      );
      button.addEventListener('click', () => void openAsset(asset));
      return button;
    }));
    if (!assets.length) {
      setLibraryStatus(state.assets.length ? 'Brak prezentacji pasujących do wyszukiwania.' : 'Brak prezentacji w tym repozytorium.');
    } else {
      setLibraryStatus(`${assets.length} pasujących prezentacji.`);
      elements.library.append(pagedListApi.controls(root.document, state.libraryPaging, paged, {
        label: 'prezentacji',
        onMore: renderLibrary
      }));
    }
  }

  function cleanupUrls() {
    state.objectUrls.forEach((url) => root.URL.revokeObjectURL(url));
    state.objectUrls.clear();
  }

  function render() {
    if (!state.presentation) return;
    elements.title.value = state.presentation.metadata.title;
    const slide = selectedSlide();
    if (slide) {
      state.selectedSlideId = slide.slideId;
      elements.layout.value = slide.layout;
      elements.notes.value = slide.notes;
    }
    elements.stageWrap.style.setProperty('--presentation-zoom', elements.zoom.value || '.9');
    elements.canvas.dataset.aspect = state.presentation.settings.aspectRatio;
    renderSlides();
    renderCanvas();
    renderProperties();
    updateToolbar();
  }

  function updateToolbar() {
    const undo = elements.workspace.querySelector('[data-presentation-action="undo"]');
    const redo = elements.workspace.querySelector('[data-presentation-action="redo"]');
    if (undo) undo.disabled = !state.undo.length;
    if (redo) redo.disabled = !state.redo.length;
  }

  function renderSlides() {
    const rows = state.presentation.slides.map((slide, index) => {
      const row = create('article', `presentation-slide-row${slide.slideId === state.selectedSlideId ? ' is-selected' : ''}`);
      row.draggable = true;
      row.dataset.slideId = slide.slideId;
      row.dataset.slideIndex = String(index);
      const number = create('span', 'presentation-slide-number', index + 1);
      const thumb = create('button', 'presentation-slide-thumb');
      thumb.type = 'button';
      thumb.style.background = slide.backgroundType === 'gradient'
        ? `linear-gradient(${slide.gradientAngle}deg, ${slide.gradientFrom}, ${slide.gradientTo})`
        : slide.background;
      thumb.append(create('span', '', slide.title));
      thumb.addEventListener('click', () => {
        state.selectedSlideId = slide.slideId;
        state.selectedElementId = '';
        render();
      });
      const actions = create('div', 'presentation-slide-actions');
      const up = create('button', '', '↑'); up.type = 'button'; up.title = 'Przesuń wyżej'; up.disabled = index === 0;
      up.addEventListener('click', () => mutate(() => { const [moved] = state.presentation.slides.splice(index, 1); state.presentation.slides.splice(index - 1, 0, moved); }));
      const down = create('button', '', '↓'); down.type = 'button'; down.title = 'Przesuń niżej'; down.disabled = index === state.presentation.slides.length - 1;
      down.addEventListener('click', () => mutate(() => { const [moved] = state.presentation.slides.splice(index, 1); state.presentation.slides.splice(index + 1, 0, moved); }));
      const duplicate = create('button', '', '⧉'); duplicate.type = 'button'; duplicate.title = 'Duplikuj';
      duplicate.addEventListener('click', () => mutate(() => {
        const copy = modelApi.duplicateSlide(slide);
        state.presentation.slides.splice(index + 1, 0, copy);
        state.selectedSlideId = copy.slideId;
        state.selectedElementId = '';
      }));
      const remove = create('button', 'is-danger', '×'); remove.type = 'button'; remove.title = 'Usuń';
      remove.disabled = state.presentation.slides.length < 2;
      remove.addEventListener('click', () => {
        if (!root.confirm(`Usunąć slajd „${slide.title}”?`)) return;
        mutate(() => {
          state.presentation.slides.splice(index, 1);
          state.selectedSlideId = state.presentation.slides[Math.min(index, state.presentation.slides.length - 1)].slideId;
          state.selectedElementId = '';
        });
      });
      actions.append(up, down, duplicate, remove);
      row.append(number, thumb, actions);
      row.addEventListener('dragstart', (event) => event.dataTransfer.setData('text/presentation-slide', slide.slideId));
      row.addEventListener('dragover', (event) => event.preventDefault());
      row.addEventListener('drop', (event) => {
        event.preventDefault();
        const sourceId = event.dataTransfer.getData('text/presentation-slide');
        const from = state.presentation.slides.findIndex((entry) => entry.slideId === sourceId);
        if (from < 0 || from === index) return;
        mutate(() => {
          const [moved] = state.presentation.slides.splice(from, 1);
          state.presentation.slides.splice(index, 0, moved);
        });
      });
      return row;
    });
    elements.slides.replaceChildren(...rows);
  }

  function renderCanvas() {
    cleanupUrls();
    const slide = selectedSlide();
    if (!slide) return;
    elements.canvas.style.backgroundImage = 'none';
    elements.canvas.style.background = slide.backgroundType === 'gradient'
      ? `linear-gradient(${slide.gradientAngle}deg, ${slide.gradientFrom}, ${slide.gradientTo})`
      : slide.background;
    elements.canvas.replaceChildren(...slide.elements.slice().sort((a, b) => a.z - b.z).map(renderElement));
    if (slide.backgroundRef && slide.backgroundType === 'image') void loadBackground(slide);
  }

  function renderElement(element) {
    const node = create('div', `presentation-element is-${element.type}${element.elementId === state.selectedElementId ? ' is-selected' : ''}${element.locked ? ' is-locked' : ''}`);
    node.dataset.elementId = element.elementId;
    applyGeometry(node, element);
    if (element.type === 'text' || element.type === 'heading') {
      const content = create('div', 'presentation-text-content', element.content || 'Kliknij, aby wpisać tekst');
      Object.assign(content.style, {
        fontFamily: fontStack(element.fontFamily), fontSize: `${element.fontSize}px`, color: element.color,
        fontWeight: String(element.fontWeight || (element.bold ? 800 : 400)), fontStyle: element.italic ? 'italic' : 'normal',
        textDecoration: element.underline ? 'underline' : 'none', textAlign: element.align,
        justifyContent: element.verticalAlign === 'center' ? 'center' : element.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start',
        lineHeight: String(element.lineHeight || 1.15), letterSpacing: `${element.letterSpacing || 0}px`
      });
      node.append(content);
    } else if (element.type === 'shape') {
      const shape = create('div', `presentation-shape is-${element.shape}`);
      Object.assign(shape.style, { background: element.fill, borderColor: element.border, borderWidth: `${element.borderWidth}px`, opacity: String(element.opacity) });
      node.append(shape);
    } else if (element.type === 'formula') {
      const formula = create('div', 'presentation-formula', element.expression || 'H2O');
      formula.style.color = element.color;
      formula.style.fontSize = `${element.fontSize}px`;
      node.append(formula);
    } else if (element.type === 'image') {
      node.classList.toggle('is-cropping', element.cropMode === true);
      const placeholder = create('div', 'presentation-image-placeholder', 'Wczytywanie obrazu…');
      node.append(placeholder);
      void loadElementImage(node, element);
    } else if (element.type === 'icon') {
      const icon = create('div', 'presentation-icon', element.symbol);
      Object.assign(icon.style, { color: element.color, background: element.background, fontSize: `${element.fontSize}px`, borderRadius: `${element.borderRadius}px` });
      node.append(icon);
    } else if (element.type === 'table') {
      const table = create('table', 'presentation-table');
      table.style.fontSize = `${element.fontSize}px`;
      const head = create('thead'); const headRow = create('tr');
      element.headers.forEach((cell) => { const th = create('th', '', cell); th.style.background = element.headerColor; headRow.append(th); });
      head.append(headRow); const body = create('tbody');
      element.rows.forEach((row, rowIndex) => { const tr = create('tr'); row.forEach((cell) => { const td = create('td', '', cell); if (rowIndex % 2) td.style.background = element.accentColor; tr.append(td); }); body.append(tr); });
      table.append(head, body); node.append(table);
    } else if (element.type === 'button') {
      const link = create('div', 'presentation-button-element', element.label);
      Object.assign(link.style, { color: element.color, background: element.background, borderRadius: `${element.borderRadius}px` });
      node.append(link);
    } else if (element.type === 'code') {
      const code = create('pre', 'presentation-code'); code.textContent = element.code || 'Wpisz kod…';
      Object.assign(code.style, { color: element.color, background: element.background, fontSize: `${element.fontSize}px` }); node.append(code);
    } else if (element.type === 'embed') {
      const embed = create('div', 'presentation-embed-placeholder');
      embed.append(create('span', '', '▣'), create('strong', '', element.title), create('small', '', element.url || 'Wpisz dozwolony URL osadzenia'));
      node.append(embed);
    }
    if (element.elementId === state.selectedElementId && !element.locked) {
      ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach((handle) => {
        const resize = create('span', `presentation-resize-handle is-${handle}`);
        resize.dataset.resizeHandle = handle;
        node.append(resize);
      });
    }
    return node;
  }

  function applyGeometry(node, element) {
    Object.assign(node.style, {
      left: `${element.x}%`, top: `${element.y}%`, width: `${element.width}%`, height: `${element.height}%`,
      transform: `rotate(${element.rotation}deg)`, zIndex: String(element.z)
    });
  }

  function fontStack(font) {
    return ({
      roboto: 'Roboto, Arial, sans-serif', 'open-sans': '"Open Sans", Arial, sans-serif', montserrat: 'Montserrat, Arial, sans-serif',
      poppins: 'Poppins, Arial, sans-serif', lato: 'Lato, Arial, sans-serif', nunito: 'Nunito, Arial, sans-serif',
      lora: 'Lora, Georgia, serif', merriweather: 'Merriweather, Georgia, serif', playfair: '"Playfair Display", Georgia, serif',
      georgia: 'Georgia, serif', times: '"Times New Roman", serif', 'jetbrains-mono': '"JetBrains Mono", ui-monospace, monospace',
      'source-code-pro': '"Source Code Pro", ui-monospace, monospace', mono: 'ui-monospace, monospace', arial: 'Arial, sans-serif', verdana: 'Verdana, sans-serif'
    })[font] || 'Inter, system-ui, sans-serif';
  }

  async function loadElementImage(node, element) {
    try {
      const shared = element.ref.startsWith('assets/shared/');
      const blob = await library.readMediaBlob({
        scope: shared ? 'shared' : 'local', materialKind: shared ? '' : 'presentation',
        materialId: shared ? '' : state.presentation.presentationId, reference: element.ref,
        repositoryId: element.repositoryId || state.repositoryId
      });
      if (!node.isConnected) return;
      const url = root.URL.createObjectURL(blob); state.objectUrls.add(url);
      const image = create('img'); image.src = url; image.alt = element.alt;
      image.style.objectFit = element.fit; image.style.objectPosition = `${element.focalX}% ${element.focalY}%`; image.style.borderRadius = `${element.borderRadius}px`; image.style.opacity = String(element.opacity ?? 1);
      node.replaceChildren(image, ...Array.from(node.querySelectorAll('.presentation-resize-handle')));
    } catch (_) { node.querySelector('.presentation-image-placeholder').textContent = 'Brak obrazu'; }
  }

  async function loadBackground(slide) {
    try {
      const shared = slide.backgroundRef.startsWith('assets/shared/');
      const blob = await library.readMediaBlob({
        scope: shared ? 'shared' : 'local', materialKind: shared ? '' : 'presentation',
        materialId: shared ? '' : state.presentation.presentationId, reference: slide.backgroundRef,
        repositoryId: state.repositoryId
      });
      const url = root.URL.createObjectURL(blob); state.objectUrls.add(url);
      elements.canvas.style.backgroundImage = `url(${url})`;
      elements.canvas.style.backgroundSize = 'cover';
      elements.canvas.style.backgroundPosition = 'center';
    } catch (_) {}
  }

  function field(label, control, help = '') {
    const wrapper = create('label', 'presentation-field');
    wrapper.append(create('span', '', label), control);
    if (help) wrapper.append(create('small', '', help));
    return wrapper;
  }
  function input(value, path, options = {}) {
    const node = create('input'); node.value = value ?? ''; node.dataset.presentationField = path;
    Object.entries(options).forEach(([key, val]) => { if (key in node) node[key] = val; else node.setAttribute(key, val); });
    return node;
  }
  function textarea(value, path) { const node = create('textarea'); node.value = value ?? ''; node.rows = 4; node.dataset.presentationField = path; return node; }
  function select(value, path, entries) {
    const node = create('select'); node.dataset.presentationField = path;
    entries.forEach(([entryValue, label]) => { const option = create('option', '', label); option.value = entryValue; node.append(option); });
    node.value = value; return node;
  }
  function button(label, action, danger = false) { const node = create('button', danger ? 'is-danger' : '', label); node.type = 'button'; node.dataset.presentationPropertyAction = action; return node; }

  function fontOptions() {
    return [
      ['inter', 'Inter'], ['roboto', 'Roboto'], ['open-sans', 'Open Sans'], ['montserrat', 'Montserrat'], ['poppins', 'Poppins'], ['lato', 'Lato'], ['nunito', 'Nunito'],
      ['arial', 'Arial'], ['verdana', 'Verdana'], ['lora', 'Lora'], ['merriweather', 'Merriweather'], ['playfair', 'Playfair Display'], ['georgia', 'Georgia'], ['times', 'Times New Roman'],
      ['jetbrains-mono', 'JetBrains Mono'], ['source-code-pro', 'Source Code Pro'], ['mono', 'Monospace']
    ];
  }

  function check(value, path) {
    const node = input('', path, { type: 'checkbox' }); node.checked = Boolean(value); return node;
  }

  function actionRow(entries) {
    const row = create('div', 'presentation-action-grid');
    entries.forEach(([label, action]) => row.append(button(label, action)));
    return row;
  }

  function renderProperties() {
    const slide = selectedSlide();
    const element = selectedElement();
    const form = create('div', 'presentation-properties-form');
    if (element) {
      const labels = { text: 'Pole tekstowe', heading: 'Nagłówek', image: 'Obraz', shape: 'Kształt / linia', formula: 'Wzór', icon: 'Ikona', table: 'Tabela', button: 'Przycisk', code: 'Blok kodu', embed: 'Bezpieczny embed' };
      elements.propertiesTitle.textContent = labels[element.type] || 'Element';
      form.append(field('elementId', input(element.elementId, 'elementId', { readOnly: true })));
      if (element.type === 'text' || element.type === 'heading') form.append(
        field('Treść', textarea(element.content, 'content')),
        field('Krój pisma', select(element.fontFamily, 'fontFamily', fontOptions())),
        field('Rozmiar', input(element.fontSize, 'fontSize', { type: 'number', min: 8, max: 160 })),
        field('Grubość', select(String(element.fontWeight || 400), 'fontWeight', [['100', '100 — cienka'], ['300', '300 — lekka'], ['400', '400 — normalna'], ['500', '500 — średnia'], ['600', '600 — półgruba'], ['700', '700 — gruba'], ['800', '800 — bardzo gruba'], ['900', '900 — czarna']])),
        field('Interlinia', input(element.lineHeight, 'lineHeight', { type: 'number', min: .8, max: 3, step: .05 })),
        field('Odstępy liter', input(element.letterSpacing, 'letterSpacing', { type: 'number', min: -5, max: 20, step: .1 })),
        field('Kolor', input(element.color, 'color', { type: 'color' })),
        field('Wyrównanie', select(element.align, 'align', [['left', 'Do lewej'], ['center', 'Środek'], ['right', 'Do prawej']])),
        field('Pogrubienie', check(element.bold, 'bold')),
        field('Kursywa', check(element.italic, 'italic')),
        field('Podkreślenie', check(element.underline, 'underline'))
      );
      if (element.type === 'image') form.append(
        field('Plik', input(element.ref, 'ref', { readOnly: true })),
        field('ALT', input(element.alt, 'alt')),
        field('Dopasowanie', select(element.fit, 'fit', [['contain', 'Pokaż cały'], ['cover', 'Wypełnij / przytnij']])),
        field('Zachowaj proporcje przy resize', check(element.aspectLocked, 'aspectLocked')),
        field('Tryb Przytnij', check(element.cropMode, 'cropMode'), 'W trybie Przytnij przeciągnij wewnątrz obrazu, aby ustawić widoczny fragment.'),
        field('Punkt kadrowania X', input(element.focalX, 'focalX', { type: 'range', min: 0, max: 100 })),
        field('Punkt kadrowania Y', input(element.focalY, 'focalY', { type: 'range', min: 0, max: 100 })),
        field('Zaokrąglenie', input(element.borderRadius, 'borderRadius', { type: 'range', min: 0, max: 80 })),
        field('Przezroczystość', input(element.opacity, 'opacity', { type: 'range', min: 0, max: 1, step: .05 })),
        button('Zmień w Media Managerze', 'replace-image')
      );
      if (element.type === 'shape') form.append(
        field('Kształt', select(element.shape, 'shape', [['rectangle', 'Prostokąt'], ['rounded', 'Zaokrąglony'], ['circle', 'Koło'], ['line', 'Linia']])),
        field('Wypełnienie', input(element.fill, 'fill', { type: 'color' })),
        field('Obramowanie', input(element.border, 'border', { type: 'color' }))
      );
      if (element.type === 'formula') form.append(
        field('Zapis', textarea(element.expression, 'expression')),
        field('Tryb', select(element.mode, 'mode', [['chemistry', 'Chemia'], ['math', 'Matematyka']])),
        field('Rozmiar', input(element.fontSize, 'fontSize', { type: 'number', min: 12, max: 140 }))
      );
      if (element.type === 'icon') form.append(
        field('Symbol / ikona', input(element.symbol, 'symbol', { maxLength: 12 })),
        field('Kolor ikony', input(element.color, 'color', { type: 'color' })),
        field('Tło', input(element.background, 'background', { type: 'color' })),
        field('Rozmiar', input(element.fontSize, 'fontSize', { type: 'number', min: 12, max: 180 }))
      );
      if (element.type === 'table') form.append(
        field('Nagłówki — rozdziel |', input(element.headers.join(' | '), 'tableHeaders')),
        field('Wiersze — jeden w linii', textarea(element.rows.map((row) => row.join(' | ')).join('\n'), 'tableRows')),
        field('Kolor nagłówka', input(element.headerColor, 'headerColor', { type: 'color' })),
        field('Kolor naprzemienny', input(element.accentColor, 'accentColor', { type: 'color' })),
        field('Rozmiar tekstu', input(element.fontSize, 'fontSize', { type: 'number', min: 8, max: 48 }))
      );
      if (element.type === 'button') form.append(
        field('Etykieta', input(element.label, 'label')),
        field('Adres HTTPS lub wewnętrzny', input(element.href, 'href', { placeholder: '/members/ albo https://…' })),
        field('Kolor tekstu', input(element.color, 'color', { type: 'color' })),
        field('Tło', input(element.background, 'background', { type: 'color' }))
      );
      if (element.type === 'code') form.append(
        field('Język', input(element.language, 'language', { maxLength: 24 })),
        field('Kod', textarea(element.code, 'code')),
        field('Kolor tekstu', input(element.color, 'color', { type: 'color' })),
        field('Tło', input(element.background, 'background', { type: 'color' })),
        field('Rozmiar', input(element.fontSize, 'fontSize', { type: 'number', min: 8, max: 48 }))
      );
      if (element.type === 'embed') form.append(
        field('Tytuł', input(element.title, 'title')),
        field('Dozwolony URL iframe', input(element.url, 'url', { placeholder: 'https://www.youtube-nocookie.com/embed/…' }), 'YouTube embed, Dokumenty Google albo podgląd pliku Google Drive.')
      );
      form.append(
        field('Pozycja X', input(element.x, 'x', { type: 'number', min: 0, max: 100 })),
        field('Pozycja Y', input(element.y, 'y', { type: 'number', min: 0, max: 100 })),
        field('Szerokość', input(element.width, 'width', { type: 'number', min: 2, max: 100 })),
        field('Wysokość', input(element.height, 'height', { type: 'number', min: 2, max: 100 })),
        field('Obrót', input(element.rotation, 'rotation', { type: 'number', min: -180, max: 180 })),
        actionRow([['←', 'align-left'], ['↔', 'align-center'], ['→', 'align-right'], ['↑', 'align-top'], ['↕', 'align-middle'], ['↓', 'align-bottom']]),
        button(element.locked ? 'Odblokuj element' : 'Zablokuj element', 'toggle-lock'),
        button('Przenieś wyżej', 'layer-up'),
        button('Przenieś niżej', 'layer-down'),
        button('Na sam wierzch', 'layer-front'),
        button('Na sam spód', 'layer-back'),
        button('Duplikuj', 'duplicate-element'),
        button('Usuń element', 'delete-element', true)
      );
    } else {
      elements.propertiesTitle.textContent = 'Slajd i prezentacja';
      form.append(
        field('ID prezentacji', input(state.presentation.presentationId, 'presentation.presentationId'), 'Stabilna nazwa folderu w GitHubie.'),
        field('Opis', textarea(state.presentation.metadata.description, 'presentation.metadata.description')),
        field('Tagi', input(state.presentation.metadata.tags.join(', '), 'presentation.metadata.tags')),
        field('Proporcje', select(state.presentation.settings.aspectRatio, 'presentation.settings.aspectRatio', [['16:9', '16:9 — panoramiczne'], ['4:3', '4:3 — klasyczne']])),
        field('Motyw', select(state.presentation.settings.theme, 'presentation.settings.theme', [['light', 'Jasny'], ['dark', 'Ciemny'], ['chemistry', 'Chemiczny'], ['minimal', 'Minimalny']])),
        field('Czcionka nagłówków', select(state.presentation.settings.headingFont, 'presentation.settings.headingFont', fontOptions())),
        field('Czcionka treści', select(state.presentation.settings.bodyFont, 'presentation.settings.bodyFont', fontOptions())),
        field('Liczenie postępu', select(state.presentation.progress.mode, 'presentation.progress.mode', [['highest', 'Najwyższy slajd'], ['visited', 'Odwiedzone slajdy'], ['all_required', 'Wszystkie wymagane']])),
        create('hr'),
        field('slideId', input(slide.slideId, 'slideId', { readOnly: true })),
        field('Nazwa slajdu', input(slide.title, 'title')),
        field('Rodzaj tła', select(slide.backgroundType, 'backgroundType', [['solid', 'Jednolity kolor'], ['gradient', 'Gradient'], ['image', 'Obraz'], ['theme', 'Z motywu']])),
        field('Kolor tła', input(slide.background, 'background', { type: 'color' })),
        ...(slide.backgroundType === 'gradient' ? [
          field('Gradient — początek', input(slide.gradientFrom, 'gradientFrom', { type: 'color' })),
          field('Gradient — koniec', input(slide.gradientTo, 'gradientTo', { type: 'color' })),
          field('Kąt gradientu', input(slide.gradientAngle, 'gradientAngle', { type: 'range', min: 0, max: 360 }))
        ] : []),
        field('Wymagany w postępie', (() => { const check = input('', 'required', { type: 'checkbox' }); check.checked = slide.required; return check; })()),
        button('Ustaw obraz tła', 'background-image'),
        button('Zastosuj tło do wszystkich slajdów', 'background-all'),
        ...(slide.backgroundRef ? [button('Usuń obraz tła', 'clear-background')] : [])
      );
    }
    elements.properties.replaceChildren(form);
  }

  function updateField(target) {
    const path = target.dataset.presentationField;
    if (!path) return;
    const raw = target.type === 'checkbox' ? target.checked : target.value;
    const element = selectedElement();
    const slide = selectedSlide();
    if (path.startsWith('presentation.')) {
      const clean = path.slice(13);
      if (clean === 'presentationId') state.presentation.presentationId = String(raw).trim().toLowerCase();
      else if (clean === 'metadata.description') state.presentation.metadata.description = raw;
      else if (clean === 'metadata.tags') state.presentation.metadata.tags = String(raw).split(',').map((tag) => tag.trim()).filter(Boolean);
      else if (clean === 'settings.aspectRatio') state.presentation.settings.aspectRatio = raw;
      else if (clean === 'settings.theme') applyTheme(raw);
      else if (clean === 'settings.headingFont') state.presentation.settings.headingFont = raw;
      else if (clean === 'settings.bodyFont') state.presentation.settings.bodyFont = raw;
      else if (clean === 'progress.mode') state.presentation.progress.mode = raw;
    } else if (element) {
      const numeric = new Set(['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'focalX', 'focalY', 'borderRadius', 'opacity', 'x', 'y', 'width', 'height', 'rotation']);
      if (path === 'tableHeaders') element.headers = String(raw).split('|').map((item) => item.trim()).filter(Boolean).slice(0, 8);
      else if (path === 'tableRows') element.rows = String(raw).split('\n').filter((line) => line.trim()).map((line) => line.split('|').map((item) => item.trim()).slice(0, 8)).slice(0, 20);
      else element[path] = numeric.has(path) ? Number(raw) : raw;
      if (path === 'cropMode' && raw) element.fit = 'cover';
    } else if (slide && path !== 'slideId') {
      slide[path] = path === 'gradientAngle' ? Number(raw) : raw;
      if (path === 'backgroundType' && raw !== 'image') slide.backgroundRef = raw === 'theme' ? '' : slide.backgroundRef;
    }
    saveLocal();
    renderCanvas();
    if (!element) renderSlides();
    setStatus('Niezapisane zmiany');
  }

  function applyTheme(theme) {
    state.presentation.settings.theme = theme;
    const preset = {
      light: ['#ffffff', '#17233a', 'inter', 'inter'], dark: ['#101927', '#f4f7fb', 'montserrat', 'inter'],
      chemistry: ['#eaf7f3', '#0d5e53', 'poppins', 'nunito'], minimal: ['#ffffff', '#111111', 'playfair', 'lato']
    }[theme] || ['#ffffff', '#17233a', 'inter', 'inter'];
    state.presentation.settings.headingFont = preset[2]; state.presentation.settings.bodyFont = preset[3];
    state.presentation.slides.forEach((slide) => {
      slide.backgroundType = 'theme'; slide.background = preset[0]; slide.backgroundRef = '';
      slide.elements.filter((item) => item.type === 'text' || item.type === 'heading').forEach((item) => {
        item.color = preset[1]; item.fontFamily = item.type === 'heading' ? preset[2] : preset[3];
      });
    });
  }

  function addElement(type) {
    const slide = selectedSlide();
    if (!slide) return;
    if (type === 'image') { openImageManager('element'); return; }
    mutate(() => {
      const seeds = {
        text: { x: 15, y: 18, width: 70, height: 20, content: 'Nowe pole tekstowe', fontSize: 30 },
        heading: { x: 10, y: 10, width: 80, height: 18, content: 'Nowy nagłówek', fontSize: 44 },
        shape: { x: 25, y: 25, width: 50, height: 35 }, formula: { x: 20, y: 32, width: 60, height: 22, expression: 'H2O' },
        icon: { x: 40, y: 30, width: 20, height: 30 }, table: { x: 10, y: 20, width: 80, height: 60 },
        button: { x: 35, y: 40, width: 30, height: 13 }, code: { x: 12, y: 18, width: 76, height: 64, code: 'H2O + CO2' },
        embed: { x: 10, y: 12, width: 80, height: 72 }
      };
      const element = modelApi.createElement(type, seeds[type] || {});
      element.z = Math.max(0, ...slide.elements.map((item) => item.z)) + 1;
      slide.elements.push(element); state.selectedElementId = element.elementId;
    });
  }

  function openImageManager(target) {
    const canUseLocal = Boolean(state.remoteSha && state.remoteId === state.presentation.presentationId);
    void root.ChemMediaManager?.open({
      scope: canUseLocal ? 'local' : 'shared',
      materialKind: canUseLocal ? 'presentation' : '', materialId: canUseLocal ? state.presentation.presentationId : '',
      repositoryId: state.repositoryId,
      onSelect(asset) {
        mutate(() => {
          if (target === 'background') { selectedSlide().backgroundRef = asset.reference; selectedSlide().backgroundType = 'image'; }
          else if (target === 'replace') {
            const element = selectedElement(); if (element?.type === 'image') { element.ref = asset.reference; element.repositoryId = asset.repositoryId; }
          } else {
            const image = modelApi.createElement('image', { x: 20, y: 20, width: 60, height: 60, ref: asset.reference, repositoryId: asset.repositoryId, alt: asset.filename.replace(/\.[^.]+$/, '') });
            image.z = Math.max(0, ...selectedSlide().elements.map((item) => item.z)) + 1;
            selectedSlide().elements.push(image); state.selectedElementId = image.elementId;
          }
        }, 'Obraz dodany. Zapisz draft, aby utrwalić referencję.');
      }
    });
  }

  function propertyAction(action) {
    const slide = selectedSlide(); const element = selectedElement();
    if (action === 'replace-image') return openImageManager('replace');
    if (action === 'background-image') return openImageManager('background');
    mutate(() => {
      if (action === 'clear-background') { slide.backgroundRef = ''; slide.backgroundType = 'solid'; }
      else if (action === 'background-all') {
        state.presentation.slides.forEach((entry) => {
          entry.backgroundType = slide.backgroundType; entry.background = slide.background; entry.gradientFrom = slide.gradientFrom;
          entry.gradientTo = slide.gradientTo; entry.gradientAngle = slide.gradientAngle; entry.backgroundRef = slide.backgroundRef;
        });
      }
      else if (action === 'toggle-lock' && element) element.locked = !element.locked;
      else if (action === 'layer-up' && element) element.z += 1;
      else if (action === 'layer-down' && element) element.z = Math.max(0, element.z - 1);
      else if (action === 'layer-front' && element) element.z = Math.max(0, ...slide.elements.map((item) => item.z)) + 1;
      else if (action === 'layer-back' && element) { slide.elements.filter((item) => item !== element).forEach((item) => { item.z = Math.min(999, item.z + 1); }); element.z = 0; }
      else if (action === 'align-left' && element) element.x = 0;
      else if (action === 'align-center' && element) element.x = (100 - element.width) / 2;
      else if (action === 'align-right' && element) element.x = 100 - element.width;
      else if (action === 'align-top' && element) element.y = 0;
      else if (action === 'align-middle' && element) element.y = (100 - element.height) / 2;
      else if (action === 'align-bottom' && element) element.y = 100 - element.height;
      else if (action === 'delete-element' && element) { slide.elements = slide.elements.filter((item) => item.elementId !== element.elementId); state.selectedElementId = ''; }
      else if (action === 'duplicate-element' && element) {
        const seed = clone(element); delete seed.elementId;
        const copy = modelApi.createElement(seed); copy.x = Math.min(96, copy.x + 3); copy.y = Math.min(96, copy.y + 3); copy.z += 1;
        slide.elements.push(copy); state.selectedElementId = copy.elementId;
      }
    });
  }

  function newPresentation() {
    if (!root.confirm('Utworzyć nową prezentację? Bieżący lokalny draft zostanie zastąpiony.')) return;
    state.presentation = modelApi.createPresentation(); state.selectedSlideId = state.presentation.slides[0].slideId; state.selectedElementId = '';
    state.remoteId = ''; state.remoteSha = ''; state.undo = []; state.redo = []; saveLocal(); render(); setStatus('Nowa prezentacja jest gotowa.');
  }

  async function save(publish) {
    if (publish) state.presentation.metadata.status = 'published';
    else if (!state.remoteSha) state.presentation.metadata.status = 'draft';
    const validation = modelApi.validate(state.presentation);
    if (!validation.valid) { setStatus(validation.errors[0].message, true); return; }
    setStatus(publish ? 'Publikowanie prezentacji…' : 'Zapisywanie draftu…');
    try {
      const result = await library.save('presentation', {
        filename: state.presentation.presentationId,
        content: modelApi.serialize(state.presentation),
        expectedSha: state.remoteId === state.presentation.presentationId ? state.remoteSha : '',
        repositoryId: state.repositoryId
      });
      state.remoteId = state.presentation.presentationId; state.remoteSha = result.sha; saveLocal();
      setStatus(publish ? 'Prezentacja opublikowana. Uczniowie mogą ją otworzyć.' : 'Draft zapisany w prywatnym repozytorium.');
      await loadLibrary(true);
      root.document.dispatchEvent(new CustomEvent('chemdisk-content-changed', {
        detail: { kind: 'presentation', repositoryId: state.repositoryId }
      }));
    } catch (error) { setStatus(error?.message || 'Nie udało się zapisać prezentacji.', true); }
  }

  async function openAsset(asset) {
    setStatus(`Wczytywanie ${asset.title || asset.filename}…`);
    const result = await library.readPresentation(asset.filename, { repositoryId: asset.repositoryId });
    state.presentation = modelApi.parse(result.content, asset.filename);
    state.repositoryId = asset.repositoryId || result.repositoryId || state.repositoryId;
    state.remoteId = asset.filename; state.remoteSha = asset.sha || result.sha;
    state.selectedSlideId = state.presentation.slides[0].slideId; state.selectedElementId = ''; state.undo = []; state.redo = [];
    saveLocal(); render(); setStatus('Prezentacja wczytana z GitHuba.');
  }

  function preview() {
    if (!state.remoteSha || state.remoteId !== state.presentation.presentationId) { setStatus('Najpierw zapisz draft w GitHubie.', true); return; }
    const url = new URL(library.presentationUrl(state.presentation.presentationId, state.repositoryId), root.location.origin);
    url.searchParams.set('preview', '1');
    root.open(url.toString(), '_blank', 'noopener');
  }

  function undo() {
    if (!state.undo.length) return;
    state.redo.push(snapshot()); restore(state.undo.pop()); saveLocal(); render(); setStatus('Cofnięto zmianę.');
  }
  function redo() {
    if (!state.redo.length) return;
    state.undo.push(snapshot()); restore(state.redo.pop()); saveLocal(); render(); setStatus('Ponowiono zmianę.');
  }

  function pointerDown(event) {
    const node = event.target.closest('[data-element-id]');
    if (!node || !elements.canvas.contains(node)) { state.selectedElementId = ''; renderProperties(); renderCanvas(); return; }
    const element = selectedSlide().elements.find((item) => item.elementId === node.dataset.elementId);
    const handle = event.target.dataset.resizeHandle || '';
    const cropDrag = element.type === 'image' && element.cropMode && !handle && event.target.matches('img');
    state.selectedElementId = element.elementId; renderProperties(); renderCanvas();
    if (element.locked || event.button !== 0) return;
    const rect = elements.canvas.getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY, geometry: clone(element) };
    state.dragSnapshot = snapshot();
    const move = (moveEvent) => {
      const dx = (moveEvent.clientX - start.x) / rect.width * 100;
      const dy = (moveEvent.clientY - start.y) / rect.height * 100;
      if (cropDrag) {
        element.focalX = Math.max(0, Math.min(100, start.geometry.focalX - dx * 1.4));
        element.focalY = Math.max(0, Math.min(100, start.geometry.focalY - dy * 1.4));
        const image = elements.canvas.querySelector(`[data-element-id="${CSS.escape(element.elementId)}"] img`);
        if (image) image.style.objectPosition = `${element.focalX}% ${element.focalY}%`;
      } else if (!handle) {
        element.x = Math.max(0, Math.min(100 - element.width, start.geometry.x + dx));
        element.y = Math.max(0, Math.min(100 - element.height, start.geometry.y + dy));
        const centeredX = Math.abs(element.x + element.width / 2 - 50) < 1;
        const centeredY = Math.abs(element.y + element.height / 2 - 50) < 1;
        if (centeredX) element.x = (100 - element.width) / 2;
        if (centeredY) element.y = (100 - element.height) / 2;
        elements.canvas.classList.toggle('has-guide-x', centeredX);
        elements.canvas.classList.toggle('has-guide-y', centeredY);
      } else resizeGeometry(element, start.geometry, handle, dx, dy);
      const current = elements.canvas.querySelector(`[data-element-id="${CSS.escape(element.elementId)}"]`);
      if (current && !cropDrag) applyGeometry(current, element);
    };
    const up = () => {
      root.removeEventListener('pointermove', move); root.removeEventListener('pointerup', up);
      elements.canvas.classList.remove('has-guide-x', 'has-guide-y');
      if (state.dragSnapshot !== snapshot()) pushHistory(state.dragSnapshot);
      state.dragSnapshot = ''; saveLocal(); render();
    };
    root.addEventListener('pointermove', move); root.addEventListener('pointerup', up, { once: true });
    event.preventDefault();
  }

  function resizeGeometry(element, original, handle, dx, dy) {
    const min = 2;
    if (original.aspectLocked && /^(?:nw|ne|se|sw)$/.test(handle)) {
      const ratio = original.width / original.height;
      let width = handle.includes('e') ? original.width + dx : original.width - dx;
      let height = handle.includes('s') ? original.height + dy : original.height - dy;
      if (Math.abs(dx / Math.max(original.width, 1)) >= Math.abs(dy / Math.max(original.height, 1))) height = width / ratio;
      else width = height * ratio;
      const maxWidth = handle.includes('e') ? 100 - original.x : original.x + original.width;
      const maxHeight = handle.includes('s') ? 100 - original.y : original.y + original.height;
      width = Math.max(min, Math.min(maxWidth, width)); height = width / ratio;
      if (height > maxHeight) { height = maxHeight; width = height * ratio; }
      element.width = width; element.height = Math.max(min, height);
      element.x = handle.includes('w') ? original.x + original.width - element.width : original.x;
      element.y = handle.includes('n') ? original.y + original.height - element.height : original.y;
      return;
    }
    if (handle.includes('e')) element.width = Math.max(min, Math.min(100 - original.x, original.width + dx));
    if (handle.includes('s')) element.height = Math.max(min, Math.min(100 - original.y, original.height + dy));
    if (handle.includes('w')) { const nextX = Math.max(0, Math.min(original.x + original.width - min, original.x + dx)); element.width = original.width + original.x - nextX; element.x = nextX; }
    if (handle.includes('n')) { const nextY = Math.max(0, Math.min(original.y + original.height - min, original.y + dy)); element.height = original.height + original.y - nextY; element.y = nextY; }
  }

  function bind() {
    elements.workspace.addEventListener('click', (event) => {
      const add = event.target.closest('[data-presentation-add]'); if (add) return addElement(add.dataset.presentationAdd);
      const property = event.target.closest('[data-presentation-property-action]'); if (property) return propertyAction(property.dataset.presentationPropertyAction);
      const action = event.target.closest('[data-presentation-action]')?.dataset.presentationAction;
      if (!action) return;
      if (action === 'new') newPresentation(); else if (action === 'undo') undo(); else if (action === 'redo') redo();
      else if (action === 'preview') preview(); else if (action === 'save') void save(false); else if (action === 'publish') void save(true);
      else if (action === 'add-slide') mutate(() => { const slide = modelApi.createSlide({ layout: 'title-content', title: `Slajd ${state.presentation.slides.length + 1}` }); state.presentation.slides.push(slide); state.selectedSlideId = slide.slideId; state.selectedElementId = ''; });
    });
    elements.title.addEventListener('focus', () => { state.inputSnapshot = snapshot(); });
    elements.title.addEventListener('input', () => { state.presentation.metadata.title = elements.title.value; saveLocal(); setStatus('Niezapisane zmiany'); });
    elements.title.addEventListener('change', () => { if (state.inputSnapshot !== snapshot()) pushHistory(state.inputSnapshot); state.inputSnapshot = ''; renderSlides(); });
    elements.properties.addEventListener('focusin', (event) => { if (event.target.dataset.presentationField) state.inputSnapshot = snapshot(); });
    elements.properties.addEventListener('input', (event) => updateField(event.target));
    elements.properties.addEventListener('change', (event) => { updateField(event.target); if (state.inputSnapshot !== snapshot()) pushHistory(state.inputSnapshot); state.inputSnapshot = ''; renderProperties(); });
    elements.notes.addEventListener('focus', () => { state.inputSnapshot = snapshot(); });
    elements.notes.addEventListener('input', () => { selectedSlide().notes = elements.notes.value; saveLocal(); setStatus('Niezapisane notatki.'); });
    elements.notes.addEventListener('change', () => { if (state.inputSnapshot !== snapshot()) pushHistory(state.inputSnapshot); state.inputSnapshot = ''; });
    elements.layout.addEventListener('change', () => {
      const slide = selectedSlide(); const layout = elements.layout.value;
      const replace = !slide.elements.length || root.confirm('Zastosować układ i zastąpić obecne elementy slajdu?');
      if (!replace) { elements.layout.value = slide.layout; return; }
      mutate(() => { const fresh = modelApi.createSlide({ layout, title: slide.title, slideId: slide.slideId, notes: slide.notes, required: slide.required, backgroundType: slide.backgroundType, background: slide.background, gradientFrom: slide.gradientFrom, gradientTo: slide.gradientTo, gradientAngle: slide.gradientAngle, backgroundRef: slide.backgroundRef }); slide.layout = fresh.layout; slide.elements = fresh.elements; state.selectedElementId = ''; });
    });
    elements.zoom.addEventListener('change', render);
    elements.repository.addEventListener('change', async () => {
      state.repositoryId = elements.repository.value;
      state.assets = [];
      pagedListApi.reset(state.libraryPaging);
      await loadLibrary();
    });
    elements.search.addEventListener('input', () => {
      pagedListApi.reset(state.libraryPaging);
      renderLibrary();
    });
    elements.canvas.addEventListener('pointerdown', pointerDown);
    root.document.addEventListener('keydown', (event) => {
      if (!state.active || elements.workspace.hidden || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
      const meta = event.ctrlKey || event.metaKey;
      if (meta && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      else if (meta && event.key.toLowerCase() === 'c' && selectedElement()) { state.clipboard = clone(selectedElement()); }
      else if (meta && event.key.toLowerCase() === 'v' && state.clipboard) { event.preventDefault(); mutate(() => { const seed = clone(state.clipboard); delete seed.elementId; const copy = modelApi.createElement(seed); copy.x = Math.min(96, copy.x + 3); copy.y = Math.min(96, copy.y + 3); selectedSlide().elements.push(copy); state.selectedElementId = copy.elementId; }); }
      else if (['Delete', 'Backspace'].includes(event.key) && selectedElement()) { event.preventDefault(); propertyAction('delete-element'); }
    });
  }

  async function activate() {
    state.active = true;
    if (!state.presentation) loadDraft();
    render();
    if (!state.loaded) { state.loaded = true; await loadLibrary(); }
  }

  function assetDeleted(asset) {
    if (state.remoteId === asset.filename && state.repositoryId === asset.repositoryId) { state.remoteId = ''; state.remoteSha = ''; setStatus('Plik zdalny usunięto. Lokalny draft pozostał w Studio.'); }
  }

  bind();
  root.ChemPresentationBuilder = Object.freeze({ activate, assetDeleted, openAsset });
})(typeof globalThis !== 'undefined' ? globalThis : window);
