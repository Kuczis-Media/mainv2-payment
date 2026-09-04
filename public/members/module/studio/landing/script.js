(function initializeLandingBuilder() {
  'use strict';

  const API_URL = '/.netlify/functions/admin-landing';
  const ASSET_API_URL = '/.netlify/functions/admin-site-assets';
  const LOCAL_DRAFT_KEY = 'chem.landing.builder.recovery.v2';
  const REQUEST_TIMEOUT_MS = 12_000;
  const MAX_ASSET_BYTES = 4 * 1024 * 1024;
  const ACCEPTED_ASSETS = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']);
  const SECTION_LABELS = { home: 'Start / Hero', about: 'O nas', services: 'Kursy i moduły', pricing: 'Cennik', skills: 'Jak zacząć', contact: 'Kontakt' };
  const ids = ['enabled', 'title', 'subtitle', 'body', 'image', 'image-alt', 'cta-label', 'cta-href', 'background', 'text', 'accent'];
  const elements = Object.fromEntries(ids.map((id) => [camel(id), document.getElementById(`section-${id}`)]));
  Object.assign(elements, {
    builder: document.getElementById('builder'), access: document.getElementById('access-state'), list: document.getElementById('section-list'),
    status: document.getElementById('status'), editorTitle: document.getElementById('editor-title'), preview: document.getElementById('landing-preview'),
    previewPanel: document.querySelector('.preview-panel'), previewBrand: document.getElementById('preview-brand'),
    imagePreview: document.getElementById('image-preview'), logoPreview: document.getElementById('logo-preview'),
    logo: document.getElementById('branding-logo'), logoAlt: document.getElementById('branding-logo-alt'), siteTitle: document.getElementById('branding-site-title'),
    siteDescription: document.getElementById('branding-site-description'), copyLogo: document.getElementById('copy-logo-url'),
    save: document.getElementById('save-draft'), publish: document.getElementById('publish'), restore: document.getElementById('restore-published'),
    recover: document.getElementById('recover-local'), assetDialog: document.getElementById('asset-dialog'), assetClose: document.getElementById('asset-close'),
    assetDrop: document.getElementById('asset-drop'), assetFile: document.getElementById('asset-file'), assetFileButton: document.getElementById('asset-file-button'),
    assetSearch: document.getElementById('asset-search'), assetRefresh: document.getElementById('asset-refresh'), assetStatus: document.getElementById('asset-status'),
    assetGrid: document.getElementById('asset-grid')
  });

  let model = null;
  let publishedModel = null;
  let recoveryDraft = null;
  let currentAdminId = '';
  let selectedId = 'home';
  let draggedId = '';
  let assetTarget = 'section';
  let assetItems = [];
  let assetsLoaded = false;
  let assetBusy = false;
  let dirty = false;
  let renderFrame = 0;
  let previewTimer = 0;
  let localSaveTimer = 0;
  let imagePreviewTimer = 0;
  let logoPreviewTimer = 0;
  let imagePreviewRequestId = 0;
  let logoPreviewRequestId = 0;
  const previewSectionNodes = new Map();

  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });

  async function bootstrap() {
    try {
      const authState = await window.ChemAuth.ready;
      const user = window.ChemAuth.getUser?.();
      const roles = user?.app_metadata?.roles || [];
      if (!authState?.authenticated || !authState.session?.ok || !roles.includes('admin')) {
        throw new Error('Landing Builder jest dostępny tylko dla administratora.');
      }
      currentAdminId = String(user.id || '');
      const payload = await requestLanding('GET');
      model = payload.draft;
      publishedModel = payload.published || null;
      recoveryDraft = readRecovery(currentAdminId);
      elements.access.hidden = true;
      elements.builder.hidden = false;
      bindEvents();
      renderAll();
      syncRecoveryButton();
      elements.restore.hidden = !publishedModel;
      setStatus(payload.published
        ? 'Wczytano draft. Opublikowana strona pozostaje aktywna do kolejnej publikacji.'
        : 'Wczytano wersję startową. Zapisz draft lub opublikuj.', 'success');
      if (new URLSearchParams(location.search).get('assets') === '1') void openAssetLibrary('logo');
    } catch (error) {
      elements.access.querySelector('h1').textContent = 'Nie udało się otworzyć buildera';
      elements.access.querySelector('p').textContent = error.message;
    }
  }

  function bindEvents() {
    const mapping = {
      title: 'title', subtitle: 'subtitle', body: 'body', image: 'imageUrl', imageAlt: 'imageAlt',
      ctaLabel: 'ctaLabel', ctaHref: 'ctaHref', background: 'backgroundColor', text: 'textColor', accent: 'accentColor'
    };
    elements.enabled.addEventListener('change', () => updateSelected('enabled', elements.enabled.checked));
    Object.entries(mapping).forEach(([elementName, field]) => {
      elements[elementName].addEventListener('input', () => updateSelected(field, elements[elementName].value));
    });
    [elements.image, elements.logo].forEach((input) => input.addEventListener('blur', () => normalizeUrlInput(input)));
    const brandingMapping = { logo: 'logoUrl', logoAlt: 'logoAlt', siteTitle: 'siteTitle', siteDescription: 'siteDescription' };
    Object.entries(brandingMapping).forEach(([elementName, field]) => {
      elements[elementName].addEventListener('input', () => updateBranding(field, elements[elementName].value));
    });
    document.querySelectorAll('[data-clear-color]').forEach((button) => button.addEventListener('click', () => {
      selectedSection()[button.dataset.clearColor] = '';
      renderEditor();
      schedulePreview();
      markDirty('Kolor wyczyszczony — zapisz draft albo opublikuj.');
    }));
    document.querySelectorAll('[data-open-assets]').forEach((button) => button.addEventListener('click', () => void openAssetLibrary(button.dataset.openAssets)));
    document.querySelectorAll('[data-preview-size]').forEach((button) => button.addEventListener('click', () => setPreviewSize(button.dataset.previewSize)));
    elements.copyLogo.addEventListener('click', () => void copyText(model.branding?.logoUrl || '', 'Skopiowano URL logo.'));
    elements.save.addEventListener('click', saveDraft);
    elements.publish.addEventListener('click', publish);
    elements.restore.addEventListener('click', restorePublished);
    elements.recover.addEventListener('click', recoverLocalDraft);
    window.addEventListener('beforeunload', (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
    document.addEventListener('keydown', (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      if (!elements.save.disabled) void saveDraft();
    });
    bindAssetDialog();
  }

  function bindAssetDialog() {
    elements.assetClose.addEventListener('click', () => elements.assetDialog.close());
    elements.assetDialog.addEventListener('click', (event) => { if (event.target === elements.assetDialog) elements.assetDialog.close(); });
    elements.assetFileButton.addEventListener('click', (event) => { event.stopPropagation(); elements.assetFile.click(); });
    elements.assetDrop.addEventListener('click', (event) => { if (!event.target.closest('button')) elements.assetFile.click(); });
    elements.assetDrop.addEventListener('keydown', (event) => {
      if (!['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      elements.assetFile.click();
    });
    elements.assetFile.addEventListener('change', () => { void uploadAssets(elements.assetFile.files); elements.assetFile.value = ''; });
    ['dragenter', 'dragover'].forEach((name) => elements.assetDrop.addEventListener(name, (event) => {
      event.preventDefault();
      elements.assetDrop.classList.add('is-dragging');
    }));
    ['dragleave', 'drop'].forEach((name) => elements.assetDrop.addEventListener(name, (event) => {
      event.preventDefault();
      elements.assetDrop.classList.remove('is-dragging');
    }));
    elements.assetDrop.addEventListener('drop', (event) => void uploadAssets(event.dataTransfer?.files));
    elements.assetDialog.addEventListener('paste', (event) => {
      const files = Array.from(event.clipboardData?.files || []).filter((file) => file.type.startsWith('image/'));
      if (!files.length) return;
      event.preventDefault();
      void uploadAssets(files);
    });
    elements.assetSearch.addEventListener('input', renderAssets);
    elements.assetRefresh.addEventListener('click', () => void loadAssets(true));
  }

  function selectedSection() {
    return model.sections.find((section) => section.id === selectedId) || model.sections[0];
  }

  function updateSelected(field, value) {
    selectedSection()[field] = value;
    renderList();
    if (field === 'imageUrl') {
      scheduleImagePreview();
      schedulePreview(350);
    } else {
      if (field === 'imageAlt') renderImagePreview();
      schedulePreview();
    }
    markDirty('Masz niezapisane zmiany.');
  }

  function updateBranding(field, value) {
    model.branding = model.branding || {};
    model.branding[field] = value;
    if (field === 'logoUrl') {
      scheduleBrandingPreview();
      schedulePreview(350);
    } else if (field === 'logoAlt') {
      renderBrandingPreview();
      schedulePreview();
    }
    markDirty('Branding zmieniony — zapisz draft albo opublikuj.');
  }

  function markDirty(message) {
    dirty = true;
    scheduleRecoveryWrite();
    setStatus(message, '');
  }

  function renderAll() {
    renderList();
    renderEditor();
    renderPreview();
  }

  function renderList() {
    const items = model.sections.map((section, index) => {
      const item = document.createElement('article');
      item.className = `section-item${section.id === selectedId ? ' is-selected' : ''}${section.enabled ? '' : ' is-disabled'}`;
      item.draggable = true;
      item.dataset.sectionId = section.id;
      item.addEventListener('dragstart', (event) => {
        draggedId = section.id;
        event.dataTransfer?.setData('text/plain', section.id);
      });
      item.addEventListener('dragend', () => { draggedId = ''; });
      item.addEventListener('dragover', (event) => event.preventDefault());
      item.addEventListener('drop', (event) => { event.preventDefault(); reorder(draggedId, section.id); });
      const drag = Object.assign(document.createElement('span'), { className: 'section-drag', textContent: '⠿', title: 'Przeciągnij sekcję' });
      const select = Object.assign(document.createElement('button'), { className: 'section-select', type: 'button' });
      select.append(
        Object.assign(document.createElement('strong'), { textContent: SECTION_LABELS[section.id] || section.id }),
        Object.assign(document.createElement('small'), { textContent: section.title || 'Bez tytułu' })
      );
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
    elements.editorTitle.textContent = SECTION_LABELS[section.id] || section.id;
    elements.enabled.checked = section.enabled !== false;
    elements.title.value = section.title || '';
    elements.subtitle.value = section.subtitle || '';
    elements.body.value = section.body || '';
    elements.image.value = section.imageUrl || '';
    elements.imageAlt.value = section.imageAlt || '';
    elements.ctaLabel.value = section.ctaLabel || '';
    elements.ctaHref.value = section.ctaHref || '';
    elements.background.value = section.backgroundColor || '#ffffff';
    elements.text.value = section.textColor || '#172033';
    elements.accent.value = section.accentColor || '#0e665a';
    model.branding = model.branding || {};
    elements.logo.value = model.branding.logoUrl || '';
    elements.logoAlt.value = model.branding.logoAlt || '';
    elements.siteTitle.value = model.branding.siteTitle || '';
    elements.siteDescription.value = model.branding.siteDescription || '';
    renderImagePreview();
    renderBrandingPreview();
  }

  function scheduleImagePreview() {
    window.clearTimeout(imagePreviewTimer);
    imagePreviewTimer = window.setTimeout(renderImagePreview, 350);
  }

  function scheduleBrandingPreview() {
    window.clearTimeout(logoPreviewTimer);
    logoPreviewTimer = window.setTimeout(renderBrandingPreview, 350);
  }

  function renderImagePreview() {
    const url = safeImageUrl(selectedSection().imageUrl);
    const image = elements.imagePreview.querySelector('img');
    image.alt = selectedSection().imageAlt || 'Podgląd obrazu sekcji';
    elements.imagePreview.hidden = !url;
    if (!url) {
      imagePreviewRequestId += 1;
      elements.imagePreview.dataset.state = '';
      delete image.dataset.previewUrl;
      image.removeAttribute('src');
      return;
    }
    if (image.dataset.previewUrl === url) return;
    const requestId = ++imagePreviewRequestId;
    elements.imagePreview.dataset.state = '';
    image.decoding = 'async';
    image.fetchPriority = 'low';
    image.onload = () => {
      if (requestId === imagePreviewRequestId) elements.imagePreview.dataset.state = 'ready';
    };
    image.onerror = () => {
      if (requestId === imagePreviewRequestId) elements.imagePreview.dataset.state = 'error';
    };
    image.dataset.previewUrl = url;
    image.src = url;
  }

  function renderBrandingPreview() {
    const url = safeImageUrl(model.branding?.logoUrl);
    const image = elements.logoPreview.querySelector('img');
    elements.logoPreview.hidden = !url;
    image.alt = model.branding?.logoAlt || 'Podgląd logo';
    if (!url) {
      logoPreviewRequestId += 1;
      elements.logoPreview.dataset.state = '';
      delete image.dataset.previewUrl;
      image.removeAttribute('src');
      return;
    }
    if (image.dataset.previewUrl === url) return;
    const requestId = ++logoPreviewRequestId;
    elements.logoPreview.dataset.state = '';
    image.decoding = 'async';
    image.fetchPriority = 'low';
    image.onload = () => {
      if (requestId === logoPreviewRequestId) elements.logoPreview.dataset.state = 'ready';
    };
    image.onerror = () => {
      if (requestId === logoPreviewRequestId) elements.logoPreview.dataset.state = 'error';
    };
    image.dataset.previewUrl = url;
    image.src = url;
  }

  function renderPreviewBrand() {
    const url = safeImageUrl(model.branding?.logoUrl);
    if (url) {
      const current = elements.previewBrand.firstElementChild;
      const image = current?.tagName === 'IMG' ? current : document.createElement('img');
      image.alt = model.branding?.logoAlt || 'ChemDisk';
      image.decoding = 'async';
      image.fetchPriority = 'high';
      if (image.dataset.previewUrl !== url) {
        image.dataset.previewUrl = url;
        image.src = url;
      }
      if (current !== image) elements.previewBrand.replaceChildren(image);
      return;
    }
    if (elements.previewBrand.firstElementChild?.tagName === 'STRONG') return;
    const strong = document.createElement('strong');
    const accent = document.createElement('span');
    accent.textContent = 'Disk';
    strong.append(document.createTextNode('Chem'), accent);
    elements.previewBrand.replaceChildren(strong);
  }

  function previewSectionNode(section) {
    let card = previewSectionNodes.get(section.id);
    if (!card) {
      card = document.createElement('article');
      card.className = 'preview-section';
      card.dataset.previewSectionId = section.id;
      ['label', 'title', 'subtitle', 'body'].forEach((field) => {
        const tag = field === 'label' ? 'span' : field === 'title' ? 'h3' : field === 'subtitle' ? 'strong' : 'p';
        const node = document.createElement(tag);
        node.dataset.previewField = field;
        card.append(node);
      });
      previewSectionNodes.set(section.id, card);
    }
    card.style.setProperty('--preview-bg', section.backgroundColor || '#ffffff');
    card.style.setProperty('--preview-accent', section.accentColor || '#0e665a');
    card.style.backgroundColor = section.backgroundColor || '';
    card.style.color = section.textColor || '';

    const imageUrl = safeImageUrl(section.imageUrl);
    let image = card.querySelector('[data-preview-image]');
    if (imageUrl) {
      if (!image) {
        image = document.createElement('img');
        image.dataset.previewImage = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        image.fetchPriority = 'low';
        card.prepend(image);
      }
      image.alt = section.imageAlt || '';
      if (image.dataset.previewUrl !== imageUrl) {
        image.dataset.previewUrl = imageUrl;
        image.src = imageUrl;
      }
    } else if (image) {
      image.remove();
    }

    card.querySelector('[data-preview-field="label"]').textContent = SECTION_LABELS[section.id] || section.id;
    card.querySelector('[data-preview-field="title"]').textContent = section.title || '';
    card.querySelector('[data-preview-field="subtitle"]').textContent = section.subtitle || '';
    card.querySelector('[data-preview-field="body"]').textContent = section.body || '';
    card.querySelectorAll('[data-preview-action]').forEach((node) => node.remove());
    const ctaHref = safePreviewHref(section.ctaHref);
    if (section.ctaLabel && ctaHref) {
      const cta = Object.assign(document.createElement('a'), {
        textContent: section.ctaLabel,
        href: ctaHref
      });
      cta.dataset.previewAction = '';
      cta.title = 'Link jest wyłączony w bezpiecznym podglądzie';
      cta.addEventListener('click', (event) => event.preventDefault());
      card.append(cta);
    } else if (section.ctaLabel) {
      const warning = Object.assign(document.createElement('small'), {
        className: 'preview-cta-warning',
        textContent: 'CTA bez poprawnego linku nie pojawi się na stronie.'
      });
      warning.dataset.previewAction = '';
      card.append(warning);
    }
    return card;
  }

  function renderPreview() {
    renderPreviewBrand();
    const activeIds = new Set(model.sections.map((section) => section.id));
    previewSectionNodes.forEach((_, id) => {
      if (!activeIds.has(id)) previewSectionNodes.delete(id);
    });
    const sections = model.sections
      .filter((section) => section.enabled !== false)
      .map(previewSectionNode);
    elements.preview.replaceChildren(...sections);
  }

  function schedulePreview(delay = 0) {
    window.clearTimeout(previewTimer);
    cancelAnimationFrame(renderFrame);
    const render = () => { renderFrame = requestAnimationFrame(renderPreview); };
    if (delay) previewTimer = window.setTimeout(render, delay);
    else render();
  }

  function setPreviewSize(size) {
    const selected = size === 'mobile' ? 'mobile' : 'desktop';
    elements.previewPanel.dataset.previewSize = selected;
    document.querySelectorAll('[data-preview-size]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.previewSize === selected)));
  }

  function safePreviewHref(value) {
    const raw = String(value || '').trim();
    const hash = /^#([A-Za-z][A-Za-z0-9_-]{0,79})$/.exec(raw);
    if (hash) return model.sections.some((section) => section.id === hash[1] && section.enabled !== false) ? raw : '';
    if (/^\/(?!\/)[^\s]*$/.test(raw)) return raw;
    try {
      const url = new URL(raw);
      return url.protocol === 'https:' && url.hostname ? url.toString() : '';
    } catch { return ''; }
  }
  function safeImageUrl(value) {
    const raw = normalizeGitHubUrl(value);
    if (/^\/(?!\/)[^\s]*$/.test(raw)) return raw;
    try {
      const url = new URL(raw);
      return url.protocol === 'https:' && url.hostname ? url.toString() : '';
    } catch { return ''; }
  }

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
    markDirty('Kolejność zmieniona — zapisz draft albo opublikuj.');
  }

  function normalizeUrlInput(input) {
    const normalized = normalizeGitHubUrl(input.value);
    if (!normalized || normalized === input.value) return;
    input.value = normalized;
    if (input === elements.logo) updateBranding('logoUrl', normalized);
    else updateSelected('imageUrl', normalized);
    setStatus('Link GitHub został zamieniony na szybki adres jsDelivr.', 'success');
  }

  function normalizeGitHubUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw);
      const parts = url.pathname.split('/').filter(Boolean);
      if (url.hostname === 'github.com' && parts.length >= 5 && parts[2] === 'blob') {
        const [owner, repository, , ref, ...path] = parts;
        return `https://cdn.jsdelivr.net/gh/${owner}/${repository}@${ref}/${path.join('/')}`;
      }
      if (url.hostname === 'raw.githubusercontent.com' && parts.length >= 4) {
        const [owner, repository, ref, ...path] = parts;
        return `https://cdn.jsdelivr.net/gh/${owner}/${repository}@${ref}/${path.join('/')}`;
      }
    } catch {}
    return raw;
  }

  async function saveDraft() {
    setBusy(true);
    setStatus('Zapisywanie draftu…', '');
    try {
      const payload = await requestLanding('PUT', { model });
      model = payload.draft;
      dirty = false;
      clearRecovery();
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
      const payload = await requestLanding('POST', { action: 'publish', model });
      model = payload.published;
      publishedModel = clone(payload.published);
      elements.restore.hidden = false;
      dirty = false;
      clearRecovery();
      renderAll();
      setStatus(`Opublikowano ${new Date(model.publishedAt).toLocaleString('pl-PL')}. CDN zwykle rozpoczyna odświeżanie po około minucie; podczas odświeżania może krótko pokazać poprzednią wersję.`, 'success');
    } catch (error) { setStatus(error.message, 'error'); }
    finally { setBusy(false); }
  }

  function restorePublished() {
    if (!publishedModel || !window.confirm('Przywrócić w edytorze ostatnią opublikowaną wersję? Nie zostanie opublikowana ponownie, dopóki nie klikniesz „Opublikuj”.')) return;
    const currentRevision = model.revision;
    model = clone(publishedModel);
    model.revision = currentRevision;
    if (!model.sections.some((section) => section.id === selectedId)) selectedId = model.sections[0]?.id || 'home';
    renderAll();
    markDirty('Przywrócono opublikowaną treść w edytorze. Zapisz lub opublikuj zmianę.');
  }

  function recoverLocalDraft() {
    if (!recoveryDraft?.model || !window.confirm('Odzyskać lokalną kopię niezapisanych zmian? Zastąpi ona bieżący widok edytora.')) return;
    const serverRevision = model.revision;
    const recovered = clone(recoveryDraft.model);
    const revisionChanged = recovered.revision !== serverRevision;
    model = recovered;
    recoveryDraft = null;
    elements.recover.hidden = true;
    if (!model.sections.some((section) => section.id === selectedId)) selectedId = model.sections[0]?.id || 'home';
    renderAll();
    markDirty(revisionChanged
      ? 'Odzyskano kopię opartą na starszej rewizji. Serwer nie pozwoli jej nadpisać bez odświeżenia i świadomego przeniesienia zmian.'
      : 'Odzyskano lokalną kopię. Zapisz draft, aby zachować ją na serwerze.');
  }

  function scheduleRecoveryWrite() {
    window.clearTimeout(localSaveTimer);
    localSaveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify({
          savedAt: new Date().toISOString(),
          userId: currentAdminId,
          origin: location.origin,
          model
        }));
      } catch {}
    }, 350);
  }

  function readRecovery(userId) {
    try {
      const parsed = JSON.parse(localStorage.getItem(LOCAL_DRAFT_KEY) || 'null');
      if (!parsed?.model || !Array.isArray(parsed.model.sections)) return null;
      if (!userId || parsed.userId !== userId || parsed.origin !== location.origin) return null;
      return parsed;
    } catch { return null; }
  }

  function clearRecovery() {
    window.clearTimeout(localSaveTimer);
    recoveryDraft = null;
    elements.recover.hidden = true;
    try { localStorage.removeItem(LOCAL_DRAFT_KEY); } catch {}
  }

  function syncRecoveryButton() {
    elements.recover.hidden = !recoveryDraft;
    if (recoveryDraft?.savedAt) elements.recover.title = `Kopia z ${new Date(recoveryDraft.savedAt).toLocaleString('pl-PL')}`;
  }

  async function openAssetLibrary(target) {
    assetTarget = target === 'logo' ? 'logo' : 'section';
    elements.assetDialog.querySelector('h2').textContent = assetTarget === 'logo' ? 'Wybierz logo strony' : `Wybierz obraz: ${SECTION_LABELS[selectedId] || selectedId}`;
    if (!elements.assetDialog.open) elements.assetDialog.showModal();
    if (!assetsLoaded) await loadAssets(false);
    else renderAssets();
  }

  async function loadAssets(refresh) {
    if (assetBusy) return;
    assetBusy = true;
    setAssetStatus(refresh ? 'Odświeżanie repozytorium…' : 'Łączenie z publicznym repozytorium GitHub…');
    renderAssets(true);
    try {
      const payload = await requestAssets('GET');
      assetItems = Array.isArray(payload.assets) ? payload.assets : [];
      assetsLoaded = true;
      const locationLabel = [payload.configuration?.repository, payload.configuration?.directory].filter(Boolean).join('/');
      setAssetStatus(`${assetItems.length} ${assetItems.length === 1 ? 'plik' : 'plików'} · ${locationLabel || 'publiczne repozytorium'}`);
    } catch (error) {
      setAssetStatus(error.message, 'error');
    } finally {
      assetBusy = false;
      renderAssets();
    }
  }

  function renderAssets(loading = false) {
    if (loading) {
      const placeholder = document.createElement('div');
      placeholder.className = 'asset-empty';
      placeholder.textContent = 'Pobieranie plików…';
      elements.assetGrid.replaceChildren(placeholder);
      return;
    }
    const query = elements.assetSearch.value.trim().toLocaleLowerCase('pl');
    const assets = assetItems.filter((asset) => !query || String(asset.filename || '').toLocaleLowerCase('pl').includes(query));
    if (!assets.length) {
      const empty = document.createElement('div');
      empty.className = 'asset-empty';
      empty.textContent = query ? 'Brak plików pasujących do wyszukiwania.' : 'Repozytorium nie ma jeszcze obrazów. Wgraj pierwszy plik powyżej.';
      elements.assetGrid.replaceChildren(empty);
      return;
    }
    elements.assetGrid.replaceChildren(...assets.map(assetCard));
  }

  function assetCard(asset) {
    const card = document.createElement('article');
    card.className = 'asset-card';
    const image = document.createElement('img');
    image.src = asset.cdnUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.fetchPriority = 'low';
    const copy = document.createElement('div');
    copy.append(
      Object.assign(document.createElement('strong'), { textContent: asset.filename || 'obraz' }),
      Object.assign(document.createElement('small'), { textContent: `${formatSize(asset.size)} · ${(asset.mimeType || 'image').replace('image/', '').toUpperCase()}` })
    );
    const actions = document.createElement('div');
    actions.className = 'asset-card-actions';
    const choose = Object.assign(document.createElement('button'), { type: 'button', textContent: assetTarget === 'logo' ? 'Ustaw logo' : 'Użyj' });
    choose.addEventListener('click', () => chooseAsset(asset));
    const copyButton = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Kopiuj URL' });
    copyButton.addEventListener('click', () => void copyText(asset.cdnUrl, `Skopiowano URL: ${asset.filename}`));
    actions.append(choose, copyButton);
    card.append(image, copy, actions);
    return card;
  }

  function chooseAsset(asset) {
    if (!asset?.cdnUrl) return;
    if (assetTarget === 'logo') {
      model.branding = model.branding || {};
      model.branding.logoUrl = asset.cdnUrl;
      elements.logo.value = asset.cdnUrl;
      renderBrandingPreview();
    } else {
      selectedSection().imageUrl = asset.cdnUrl;
      elements.image.value = asset.cdnUrl;
      renderImagePreview();
    }
    renderPreview();
    markDirty(`Wybrano ${asset.filename}. Zapisz draft albo opublikuj.`);
    elements.assetDialog.close();
  }

  async function uploadAssets(rawFiles) {
    const files = Array.from(rawFiles || []);
    if (!files.length || assetBusy) return;
    const invalid = files.find((file) => !ACCEPTED_ASSETS.has(file.type) || file.size <= 0 || file.size > MAX_ASSET_BYTES);
    if (invalid) {
      setAssetStatus(`„${invalid.name}” ma nieobsługiwany format albo przekracza 4 MB.`, 'error');
      return;
    }
    assetBusy = true;
    elements.assetRefresh.disabled = true;
    try {
      let last = null;
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setAssetStatus(`Zapisywanie ${index + 1}/${files.length}: ${file.name}…`);
        const payload = await requestAssets('PUT', {
          filename: safeFilename(file, assetTarget),
          contentBase64: await fileBase64(file),
          mimeType: file.type
        });
        last = payload.asset;
        if (last) assetItems = [last, ...assetItems.filter((asset) => asset.path !== last.path)];
      }
      assetsLoaded = true;
      renderAssets();
      if (files.length === 1 && last) {
        chooseAsset(last);
        setStatus(`Plik ${last.filename} zapisano w GitHubie i ustawiono w edytorze.`, 'success');
      } else {
        setAssetStatus(`Zapisano ${files.length} plików. Wybierz ten, którego chcesz użyć.`);
      }
    } catch (error) {
      setAssetStatus(error.message, 'error');
    } finally {
      assetBusy = false;
      elements.assetRefresh.disabled = false;
    }
  }

  function safeFilename(file, target) {
    const dot = file.name.lastIndexOf('.');
    const rawStem = dot > 0 ? file.name.slice(0, dot) : target === 'logo' ? 'logo' : 'obraz';
    const fallbackExtension = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' })[file.type] || '';
    const extension = (dot > 0 ? file.name.slice(dot + 1) : fallbackExtension).toLowerCase().replace('jpeg', 'jpg');
    const stem = rawStem.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 62) || (target === 'logo' ? 'logo' : 'obraz');
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    return `${target === 'logo' && !stem.startsWith('logo') ? `logo-${stem}` : stem}-${suffix}.${extension}`;
  }

  function fileBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.onerror = () => reject(new Error('Nie udało się odczytać pliku.'));
      reader.readAsDataURL(file);
    });
  }

  async function copyText(value, successMessage) {
    if (!value) {
      setStatus('Najpierw wybierz albo wklej adres pliku.', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      if (elements.assetDialog.open) setAssetStatus(successMessage);
      else setStatus(successMessage, 'success');
    } catch {
      if (elements.assetDialog.open) setAssetStatus('Nie udało się skopiować automatycznie. Użyj menu przeglądarki.', 'error');
      else setStatus('Nie udało się skopiować automatycznie. Zaznacz adres i skopiuj go ręcznie.', 'error');
    }
  }

  function formatSize(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  }

  async function requestLanding(method, body) {
    return authenticatedRequest(API_URL, method, body, {
      INVALID_LANDING_IMAGE_URL: 'Adres obrazu musi być ścieżką lokalną albo adresem HTTPS.',
      INVALID_LANDING_LINK: 'Link przycisku musi być kotwicą, ścieżką lokalną albo adresem HTTPS.',
      INVALID_LANDING_LINK_TARGET: 'Link CTA prowadzi do wyłączonej lub nieistniejącej sekcji. Włącz sekcję albo zmień link.',
      INVALID_LANDING_COLOR: 'Kolor musi mieć format #RRGGBB.',
      LANDING_CONFLICT: 'Landing został zmieniony w innej karcie. Odśwież stronę, sprawdź treść i spróbuj ponownie.'
    });
  }

  async function requestAssets(method, body) {
    return authenticatedRequest(ASSET_API_URL, method, body, {
      SITE_ASSETS_NOT_CONFIGURED: 'Dodaj w Netlify zmienną GITHUB_SITE_ASSETS_TOKEN dla publicznego repozytorium assetów.',
      SITE_ASSETS_REPOSITORY_NOT_PUBLIC: 'Repozytorium assetów musi być publiczne, aby jsDelivr mógł je odczytać.',
      SITE_ASSETS_REPOSITORY_NOT_FOUND: 'Nie znaleziono skonfigurowanego repozytorium assetów albo gałęzi.',
      SITE_ASSETS_REF_NOT_FOUND: 'Nie znaleziono gałęzi main w repozytorium Kuczis-Media/logo.',
      SITE_ASSETS_RATE_LIMITED: 'GitHub chwilowo ograniczył liczbę zapytań. Odczekaj moment i spróbuj ponownie.',
      SITE_ASSETS_TOKEN_REJECTED: 'Token GitHub nie ma dostępu do repozytorium assetów.',
      SITE_ASSETS_WRITE_REJECTED: 'Token GitHub wymaga uprawnienia Contents: Read and write do repozytorium assetów.',
      SITE_ASSET_ALREADY_EXISTS: 'Plik o tej nazwie już istnieje. Spróbuj przesłać go ponownie.',
      SITE_ASSET_INVALID: 'Plik nie jest poprawnym obrazem albo ma niezgodne rozszerzenie.',
      MEDIA_SVG_UNSAFE: 'SVG zawiera aktywną lub zewnętrzną treść i nie może zostać zapisany.',
      CONTENT_FILE_TOO_LARGE: 'Plik przekracza limit 4 MB.'
    });
  }

  async function authenticatedRequest(url, method, body, messages) {
    const token = await window.ChemAuth.getAccessToken({ forceRefresh: method !== 'GET' });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(url, {
        method,
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Serwer zbyt długo nie odpowiadał. Spróbuj ponownie.');
      throw new Error('Nie udało się połączyć z serwerem. Sprawdź internet i spróbuj ponownie.');
    } finally {
      window.clearTimeout(timeout);
    }
    let payload = null;
    try { payload = await response.json(); } catch {}
    if (!response.ok) {
      const code = payload?.error || '';
      const error = new Error(messages[code] || `Nie udało się wykonać operacji (${response.status}).`);
      error.code = code;
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function setBusy(busy) {
    elements.builder.inert = busy;
    elements.builder.setAttribute('aria-busy', String(busy));
    elements.save.disabled = busy;
    elements.publish.disabled = busy;
    elements.restore.disabled = busy;
    elements.recover.disabled = busy;
  }

  function setStatus(message, state) {
    elements.status.textContent = message;
    elements.status.dataset.state = state;
  }

  function setAssetStatus(message, state = '') {
    elements.assetStatus.textContent = message;
    elements.assetStatus.dataset.state = state;
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function camel(value) { return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); }
})();
