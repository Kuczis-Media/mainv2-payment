(function initializeLandingBuilder() {
  'use strict';

  const API_URL = '/.netlify/functions/admin-landing';
  const SECTION_LABELS = { home: 'Start / Hero', about: 'O nas', services: 'Kursy i moduły', pricing: 'Cennik', skills: 'Jak zacząć', contact: 'Kontakt' };
  const ids = ['enabled', 'title', 'subtitle', 'body', 'image', 'cta-label', 'cta-href', 'background', 'text', 'accent'];
  const elements = Object.fromEntries(ids.map((id) => [id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), document.getElementById(`section-${id}`)]));
  Object.assign(elements, {
    builder: document.getElementById('builder'), access: document.getElementById('access-state'), list: document.getElementById('section-list'),
    status: document.getElementById('status'), editorTitle: document.getElementById('editor-title'), preview: document.getElementById('landing-preview'),
    imagePreview: document.getElementById('image-preview'), save: document.getElementById('save-draft'), publish: document.getElementById('publish')
  });
  let model = null;
  let selectedId = 'home';
  let draggedId = '';
  let renderFrame = 0;

  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });

  async function bootstrap() {
    try {
      const authState = await window.ChemAuth.ready;
      const user = window.ChemAuth.getUser?.();
      const roles = user?.app_metadata?.roles || [];
      if (!authState?.authenticated || !authState.session?.ok || !roles.includes('admin')) throw new Error('Landing Builder jest dostępny tylko dla administratora.');
      const payload = await request('GET');
      model = payload.draft;
      elements.access.hidden = true;
      elements.builder.hidden = false;
      bindEvents();
      renderAll();
      setStatus(payload.published ? 'Wczytano draft. Opublikowana wersja strony pozostaje aktywna do kolejnej publikacji.' : 'Wczytano wersję startową. Zapisz draft lub opublikuj.', 'success');
    } catch (error) {
      elements.access.querySelector('h1').textContent = 'Nie udało się otworzyć buildera';
      elements.access.querySelector('p').textContent = error.message;
    }
  }

  function bindEvents() {
    const mapping = { title: 'title', subtitle: 'subtitle', body: 'body', image: 'imageUrl', ctaLabel: 'ctaLabel', ctaHref: 'ctaHref', background: 'backgroundColor', text: 'textColor', accent: 'accentColor' };
    elements.enabled.addEventListener('change', () => updateSelected('enabled', elements.enabled.checked));
    Object.entries(mapping).forEach(([elementName, field]) => elements[elementName].addEventListener('input', () => updateSelected(field, elements[elementName].value)));
    document.querySelectorAll('[data-clear-color]').forEach((button) => button.addEventListener('click', () => {
      const section = selectedSection();
      section[button.dataset.clearColor] = '';
      renderEditor();
      schedulePreview();
    }));
    elements.save.addEventListener('click', saveDraft);
    elements.publish.addEventListener('click', publish);
  }

  function selectedSection() { return model.sections.find((section) => section.id === selectedId) || model.sections[0]; }

  function updateSelected(field, value) {
    selectedSection()[field] = value;
    renderList();
    renderImagePreview();
    schedulePreview();
    setStatus('Masz niezapisane zmiany.', '');
  }

  function renderAll() { renderList(); renderEditor(); renderPreview(); }

  function renderList() {
    const items = model.sections.map((section, index) => {
      const item = document.createElement('article');
      item.className = `section-item${section.id === selectedId ? ' is-selected' : ''}${section.enabled ? '' : ' is-disabled'}`;
      item.draggable = true;
      item.dataset.sectionId = section.id;
      item.addEventListener('dragstart', () => { draggedId = section.id; });
      item.addEventListener('dragover', (event) => event.preventDefault());
      item.addEventListener('drop', (event) => { event.preventDefault(); reorder(draggedId, section.id); });
      const drag = Object.assign(document.createElement('span'), { className: 'section-drag', textContent: '⠿', title: 'Przeciągnij sekcję' });
      const select = Object.assign(document.createElement('button'), { className: 'section-select', type: 'button' });
      select.append(Object.assign(document.createElement('strong'), { textContent: SECTION_LABELS[section.id] }), Object.assign(document.createElement('small'), { textContent: section.title || 'Bez tytułu' }));
      select.addEventListener('click', () => { selectedId = section.id; renderAll(); });
      const controls = document.createElement('span');
      controls.className = 'section-order';
      [['↑', index - 1], ['↓', index + 1]].forEach(([label, target]) => {
        const button = Object.assign(document.createElement('button'), { type: 'button', textContent: label, disabled: target < 0 || target >= model.sections.length });
        button.setAttribute('aria-label', label === '↑' ? 'Przenieś wyżej' : 'Przenieś niżej');
        button.addEventListener('click', () => moveTo(index, target));
        controls.append(button);
      });
      item.append(drag, select, controls);
      return item;
    });
    elements.list.replaceChildren(...items);
  }

  function renderEditor() {
    const section = selectedSection();
    elements.editorTitle.textContent = SECTION_LABELS[section.id];
    elements.enabled.checked = section.enabled !== false;
    elements.title.value = section.title || '';
    elements.subtitle.value = section.subtitle || '';
    elements.body.value = section.body || '';
    elements.image.value = section.imageUrl || '';
    elements.ctaLabel.value = section.ctaLabel || '';
    elements.ctaHref.value = section.ctaHref || '';
    elements.background.value = section.backgroundColor || '#ffffff';
    elements.text.value = section.textColor || '#172033';
    elements.accent.value = section.accentColor || '#0e665a';
    renderImagePreview();
  }

  function renderImagePreview() {
    const url = selectedSection().imageUrl || '';
    const valid = /^(?:https:\/\/|\/(?!\/))/.test(url);
    elements.imagePreview.hidden = !valid;
    const image = elements.imagePreview.querySelector('img');
    if (valid) image.src = url;
    else image.removeAttribute('src');
  }

  function renderPreview() {
    const sections = model.sections.filter((section) => section.enabled !== false).map((section) => {
      const card = document.createElement('article');
      card.className = 'preview-section';
      card.style.setProperty('--preview-bg', section.backgroundColor || '#ffffff');
      card.style.setProperty('--preview-accent', section.accentColor || '#0e665a');
      card.style.backgroundColor = section.backgroundColor || '';
      card.style.color = section.textColor || '';
      if (/^(?:https:\/\/|\/(?!\/))/.test(section.imageUrl || '')) card.append(Object.assign(document.createElement('img'), { src: section.imageUrl, alt: '' }));
      card.append(
        Object.assign(document.createElement('span'), { textContent: SECTION_LABELS[section.id] }),
        Object.assign(document.createElement('h3'), { textContent: section.title || '' }),
        Object.assign(document.createElement('strong'), { textContent: section.subtitle || '' }),
        Object.assign(document.createElement('p'), { textContent: section.body || '' })
      );
      if (section.ctaLabel) card.append(Object.assign(document.createElement('a'), { textContent: section.ctaLabel, href: safePreviewHref(section.ctaHref) }));
      return card;
    });
    elements.preview.replaceChildren(...sections);
  }

  function schedulePreview() {
    cancelAnimationFrame(renderFrame);
    renderFrame = requestAnimationFrame(renderPreview);
  }

  function safePreviewHref(value) { return /^(?:https:\/\/|\/(?!\/)|#[A-Za-z])/.test(value || '') ? value : '#'; }

  function moveTo(from, to) {
    if (from === to || to < 0 || to >= model.sections.length) return;
    const [section] = model.sections.splice(from, 1);
    model.sections.splice(to, 0, section);
    normalizeOrder();
  }

  function reorder(sourceId, targetId) {
    const from = model.sections.findIndex((section) => section.id === sourceId);
    const to = model.sections.findIndex((section) => section.id === targetId);
    if (from >= 0 && to >= 0) moveTo(from, to);
  }

  function normalizeOrder() {
    model.sections.forEach((section, index) => { section.order = index; });
    renderList();
    renderPreview();
    setStatus('Kolejność zmieniona — zapisz draft albo opublikuj.', '');
  }

  async function saveDraft() {
    setBusy(true);
    setStatus('Zapisywanie draftu…', '');
    try {
      const payload = await request('PUT', { model });
      model = payload.draft;
      renderAll();
      setStatus('Draft zapisany po stronie serwera.', 'success');
    } catch (error) { setStatus(error.message, 'error'); }
    finally { setBusy(false); }
  }

  async function publish() {
    if (!window.confirm('Opublikować ten układ i treść na stronie głównej?')) return;
    setBusy(true);
    setStatus('Publikowanie strony…', '');
    try {
      const payload = await request('POST', { action: 'publish', model });
      model = payload.published;
      renderAll();
      setStatus(`Opublikowano ${new Date(model.publishedAt).toLocaleString('pl-PL')}.`, 'success');
    } catch (error) { setStatus(error.message, 'error'); }
    finally { setBusy(false); }
  }

  async function request(method, body) {
    const token = await window.ChemAuth.getAccessToken({ forceRefresh: method !== 'GET' });
    const response = await fetch(API_URL, {
      method, cache: 'no-store', credentials: 'same-origin',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    let payload = null;
    try { payload = await response.json(); } catch {}
    if (!response.ok) throw new Error({
      INVALID_LANDING_IMAGE_URL: 'Adres obrazu musi być ścieżką lokalną albo adresem HTTPS.',
      INVALID_LANDING_LINK: 'Link przycisku musi być kotwicą, ścieżką lokalną albo adresem HTTPS.',
      INVALID_LANDING_COLOR: 'Kolor musi mieć format #RRGGBB.',
      LANDING_CONFLICT: 'Landing został równocześnie zmieniony. Odśwież i spróbuj ponownie.'
    }[payload?.error] || `Nie udało się wykonać operacji (${response.status}).`);
    return payload;
  }

  function setBusy(busy) { elements.save.disabled = busy; elements.publish.disabled = busy; }
  function setStatus(message, state) { elements.status.textContent = message; elements.status.dataset.state = state; }
})();
