(function () {
  'use strict';

  const CONTENT_URL = '/members/dashboard.md';
  const LOGIN_URL = '/login/?loggedout=1';
  const ADMIN_USERS_URL = '/.netlify/functions/admin-users';
  const ADMIN_FORMS_URL = '/.netlify/functions/admin-forms';
  const ADMIN_DASHBOARD_URL = '/.netlify/functions/admin-dashboard';
  const THEME_STORAGE_KEY = 'chem.theme';
  const ACCESS_ROLE_OPTIONS = Object.freeze([
    { value: '', label: 'Brak dostępu' },
    { value: 'active', label: 'Stały dostęp' },
    { value: 'hour', label: '1 godzina' },
    { value: 'day', label: '1 dzień' },
    { value: 'week', label: '1 tydzień' },
    { value: 'month', label: '1 miesiąc' },
    { value: 'halfyear', label: 'Pół roku' },
    { value: 'year', label: '1 rok' }
  ]);
  const COURSE_ROLE_VALUES = new Set(ACCESS_ROLE_OPTIONS.map((role) => role.value).filter(Boolean));
  const ADMIN_ROLE_VALUES = new Set(['admin', ...COURSE_ROLE_VALUES]);
  const ADMIN_ERROR_MESSAGES = Object.freeze({
    ADMIN_REQUIRED: 'Ta operacja jest dostępna tylko dla administratora.',
    ACCESS_EXPIRED: 'Dostęp do kursu wygasł. Zaloguj się ponownie po odnowieniu dostępu.',
    ACCESS_REQUIRED: 'To konto nie ma aktywnego dostępu do kursu.',
    AUTH_EXPIRED: 'Sesja administratora wygasła. Zaloguj się ponownie.',
    AUTH_REQUIRED: 'Zaloguj się ponownie, aby zarządzać kontami.',
    CANNOT_DELETE_SELF: 'Nie możesz usunąć własnego konta administratora.',
    CANNOT_REMOVE_OWN_ADMIN: 'Nie możesz odebrać roli administratora własnemu kontu.',
    DASHBOARD_CONFLICT: 'Dashboard został w międzyczasie zmieniony. Wczytaj najnowszą wersję i ponów edycję.',
    DASHBOARD_INVALID: 'Treść dashboardu jest nieprawidłowa.',
    DASHBOARD_STORAGE_INVALID: 'Zapisana wersja dashboardu jest uszkodzona. Aktywuj wersję z wdrożenia.',
    DASHBOARD_STORAGE_UNAVAILABLE: 'Magazyn dashboardu jest chwilowo niedostępny.',
    DASHBOARD_OVERRIDE_NOT_SET: 'Aktywna jest wersja dashboardu z wdrożenia.',
    DASHBOARD_STORE_UNAVAILABLE: 'Magazyn dashboardu jest chwilowo niedostępny.',
    DELETE_CAPABILITY_EXPIRED: 'Potwierdzenie usunięcia wygasło. Odśwież zgłoszenia i spróbuj ponownie.',
    DELETE_CAPABILITY_INVALID: 'Potwierdzenie usunięcia jest nieprawidłowe. Odśwież zgłoszenia.',
    DELETE_CAPABILITY_REQUIRED: 'Odśwież zgłoszenia przed próbą usunięcia.',
    EXPECTED_ETAG_REQUIRED: 'Wczytaj dashboard ponownie przed zapisaniem zmian.',
    FIRST_AND_LAST_NAME_REQUIRED: 'Uzupełnij poprawne imię i nazwisko użytkownika.',
    FORM_NOT_FOUND: 'Nie znaleziono tego formularza.',
    IDENTITY_ADMIN_UNAVAILABLE: 'Administracja kontami jest chwilowo niedostępna.',
    IDENTITY_DELETE_FAILED: 'Nie udało się usunąć konta z Identity.',
    IDENTITY_INVITE_FAILED: 'Nie udało się wysłać zaproszenia przez Identity.',
    IDENTITY_REQUEST_FAILED: 'Nie udało się pobrać danych konta z Identity.',
    IDENTITY_RESPONSE_INVALID: 'Identity zwróciło nieprawidłowe dane konta.',
    IDENTITY_UNAVAILABLE: 'Nie udało się połączyć z usługą kont.',
    IDENTITY_UPDATE_FAILED: 'Nie udało się zapisać zmian w Identity.',
    INVALID_BODY: 'Dane zmiany konta są nieprawidłowe.',
    INVALID_FIRST_NAME: 'Podaj poprawne imię (od 2 do 80 znaków).',
    INVALID_EMAIL: 'Podaj poprawny adres e-mail.',
    INVALID_ETAG: 'Wersja dashboardu jest nieprawidłowa. Wczytaj ją ponownie.',
    INVALID_FORM_ID: 'Identyfikator formularza jest nieprawidłowy.',
    INVALID_JSON: 'Dane zmiany konta są nieprawidłowe.',
    INVALID_LAST_NAME: 'Podaj poprawne nazwisko (od 2 do 80 znaków).',
    INVALID_MARKDOWN: 'Treść dashboardu jest nieprawidłowa.',
    MARKDOWN_TOO_LARGE: 'Dashboard jest zbyt duży.',
    INVALID_ROLES: 'Wybrano nieprawidłową rolę.',
    INVALID_USER_ID: 'Identyfikator użytkownika jest nieprawidłowy.',
    INVITE_CREATED_PROFILE_UPDATE_FAILED: 'Zaproszenie wysłano, ale nie udało się nadać profilu lub roli. Sprawdź konto w Identity.',
    JSON_REQUIRED: 'Żądanie zmiany konta ma nieprawidłowy format.',
    MULTIPLE_ACCESS_ROLES: 'Wybierz tylko jeden rodzaj dostępu do kursu.',
    NETLIFY_FORMS_DELETE_FAILED: 'Netlify nie usunął zgłoszenia. Spróbuj ponownie.',
    NETLIFY_FORMS_NOT_CONFIGURED: 'Dodaj NETLIFY_API_TOKEN w zmiennych środowiskowych Netlify (zakres Functions).',
    NETLIFY_FORMS_REQUEST_FAILED: 'Netlify Forms odrzucił żądanie.',
    NETLIFY_FORMS_RESOURCE_NOT_FOUND: 'Nie znaleziono formularza lub zgłoszenia w tej witrynie.',
    NETLIFY_FORMS_RESPONSE_INVALID: 'Netlify Forms zwrócił nieprawidłowe dane.',
    NETLIFY_FORMS_TOKEN_REJECTED: 'NETLIFY_API_TOKEN jest nieprawidłowy albo nie ma dostępu do tej witryny.',
    NETLIFY_FORMS_UNAVAILABLE: 'Nie udało się połączyć z Netlify Forms.',
    NO_CHANGES: 'Nie wskazano żadnych zmian do zapisania.',
    REQUEST_TOO_LARGE: 'Przesłano zbyt dużo danych.',
    SAME_ORIGIN_REQUIRED: 'Ze względów bezpieczeństwa odśwież panel i spróbuj ponownie.',
    SESSION_CHECK_UNAVAILABLE: 'Nie udało się potwierdzić bieżącej sesji administratora.',
    SESSION_REPLACED: 'To konto zalogowało się na innym urządzeniu. Zaloguj się ponownie.',
    SUBMISSION_NOT_FOUND: 'Nie znaleziono tego zgłoszenia.',
    USER_ALREADY_EXISTS_OR_INVITE_REJECTED: 'Konto już istnieje albo Identity odrzuciło zaproszenie.',
    USER_NOT_FOUND: 'Nie znaleziono tego użytkownika.'
  });

  const elements = {
    body: document.body,
    content: document.getElementById('markdown-sections'),
    title: document.getElementById('dashboard-title'),
    intro: document.getElementById('dashboard-intro'),
    message: document.getElementById('dashboard-message'),
    resourceCount: document.getElementById('resource-count'),
    nav: document.getElementById('course-nav'),
    search: document.getElementById('resource-search'),
    emptySearch: document.getElementById('empty-search'),
    clearSearch: document.getElementById('clear-search'),
    menuButton: document.getElementById('menu-button'),
    themeToggle: document.getElementById('theme-toggle'),
    sidebarBackdrop: document.getElementById('sidebar-backdrop'),
    logoutButton: document.getElementById('logout-button'),
    profileDialog: document.getElementById('profile-dialog'),
    profileForm: document.getElementById('profile-form'),
    profileFirstName: document.getElementById('profile-first-name'),
    profileLastName: document.getElementById('profile-last-name'),
    profileMessage: document.getElementById('profile-message'),
    profileSave: document.getElementById('profile-save'),
    profileClose: document.getElementById('profile-close'),
    profileCancel: document.getElementById('profile-cancel'),
    adminButton: document.getElementById('admin-panel-button'),
    adminDialog: document.getElementById('admin-dialog'),
    adminClose: document.getElementById('admin-close'),
    adminSearch: document.getElementById('admin-user-search'),
    adminRefresh: document.getElementById('admin-refresh'),
    adminStatus: document.getElementById('admin-status'),
    adminUserList: document.getElementById('admin-user-list'),
    adminEmpty: document.getElementById('admin-empty'),
    adminTabs: Array.from(document.querySelectorAll('[data-admin-tab]')),
    adminPanels: Array.from(document.querySelectorAll('[data-admin-panel]')),
    adminInviteForm: document.getElementById('admin-invite-form'),
    adminInviteEmail: document.getElementById('admin-invite-email'),
    adminInviteFirstName: document.getElementById('admin-invite-first-name'),
    adminInviteLastName: document.getElementById('admin-invite-last-name'),
    adminInviteRole: document.getElementById('admin-invite-role'),
    adminInviteIsAdmin: document.getElementById('admin-invite-is-admin'),
    adminInviteMessage: document.getElementById('admin-invite-message'),
    adminInviteSubmit: document.getElementById('admin-invite-submit'),
    adminFormFilter: document.getElementById('admin-form-filter'),
    adminFormsRefresh: document.getElementById('admin-forms-refresh'),
    adminFormsStatus: document.getElementById('admin-forms-status'),
    adminSubmissionList: document.getElementById('admin-submission-list'),
    adminFormsEmpty: document.getElementById('admin-forms-empty'),
    adminDashboardSource: document.getElementById('admin-dashboard-source'),
    adminDashboardReload: document.getElementById('admin-dashboard-reload'),
    adminDashboardRestore: document.getElementById('admin-dashboard-restore'),
    adminDashboardPreviewButton: document.getElementById('admin-dashboard-preview-button'),
    adminDashboardSave: document.getElementById('admin-dashboard-save'),
    adminDashboardStatus: document.getElementById('admin-dashboard-status'),
    adminDashboardPreview: document.getElementById('admin-dashboard-preview'),
    profileButtons: [
      document.getElementById('sidebar-profile-button'),
      document.getElementById('top-profile-button')
    ].filter(Boolean)
  };

  let currentUser = null;
  let totalResources = 0;
  let lastProfileTrigger = null;
  let lastAdminTrigger = null;
  let sectionObserver = null;
  let adminUsers = [];
  let adminForms = [];
  let adminSubmissions = [];
  let adminFormsLoaded = false;
  let adminFormsRequestId = 0;
  let adminDashboardLoaded = false;
  let adminDashboardEtag = null;
  let adminDashboardSourceKind = 'static';
  let adminDashboardBaseline = '';

  function preferredTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function applyTheme(theme, persist) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    const dark = next === 'dark';
    const label = dark ? 'Włącz jasny motyw' : 'Włącz ciemny motyw';
    const themeColor = document.getElementById('theme-color');
    if (themeColor) themeColor.setAttribute('content', dark ? '#0d121a' : '#f7f9fc');
    if (elements.themeToggle) {
      elements.themeToggle.setAttribute('aria-label', label);
      elements.themeToggle.setAttribute('aria-pressed', String(dark));
      elements.themeToggle.title = label;
    }
    if (persist) {
      try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch (_) {}
    }
  }

  function initializeTheme() {
    let theme = document.documentElement.dataset.theme;
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') theme = saved;
      else theme = preferredTheme();
    } catch (_) {
      theme = preferredTheme();
    }
    applyTheme(theme, false);
  }

  function toggleTheme() {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pl')
      .trim();
  }

  function slugify(value, fallback) {
    const slug = normalizeText(value)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || fallback;
  }

  function parseMarkdown(source) {
    const model = {
      title: 'Panel kursanta',
      intro: [],
      notices: [],
      sections: []
    };
    let currentSection = null;
    let currentGroup = null;
    let insideComment = false;

    String(source || '').replace(/\r\n?/g, '\n').split('\n').forEach((rawLine) => {
      const line = rawLine.trim();

      if (insideComment) {
        if (line.includes('-->')) insideComment = false;
        return;
      }
      if (line.startsWith('<!--')) {
        if (!line.includes('-->')) insideComment = true;
        return;
      }
      if (!line) return;

      const sectionMatch = line.match(/^##\s+(.+)$/);
      if (sectionMatch) {
        currentSection = {
          title: sectionMatch[1].trim(),
          description: [],
          notices: [],
          items: [],
          groups: []
        };
        currentGroup = null;
        model.sections.push(currentSection);
        return;
      }

      const groupMatch = line.match(/^###\s+(.+)$/);
      if (groupMatch && currentSection) {
        currentGroup = {
          title: groupMatch[1].trim(),
          description: [],
          notices: [],
          items: []
        };
        currentSection.groups.push(currentGroup);
        return;
      }

      const titleMatch = line.match(/^#\s+(.+)$/);
      if (titleMatch) {
        model.title = titleMatch[1].trim();
        return;
      }

      const noticeMatch = line.match(/^>\s*(.+)$/);
      if (noticeMatch) {
        const target = currentGroup
          ? currentGroup.notices
          : currentSection ? currentSection.notices : model.notices;
        target.push(noticeMatch[1].trim());
        return;
      }

      const linkMatch = line.match(/^[-*]\s+\[([^\]]+)]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)\s*(?:(?:—|–|-|:)\s*(.*))?$/);
      if (linkMatch && currentSection) {
        const target = currentGroup ? currentGroup.items : currentSection.items;
        target.push({
          title: linkMatch[1].trim(),
          href: linkMatch[2].trim(),
          description: (linkMatch[3] || '').trim()
        });
        return;
      }

      const cleanLine = line.replace(/^#{3,6}\s+/, '');
      if (currentGroup) currentGroup.description.push(cleanLine);
      else if (currentSection) currentSection.description.push(cleanLine);
      else model.intro.push(cleanLine);
    });

    return model;
  }

  function safeUrl(rawHref) {
    try {
      const url = new URL(rawHref, window.location.origin);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      const external = url.origin !== window.location.origin;
      return {
        href: external ? url.href : `${url.pathname}${url.search}${url.hash}`,
        pathname: url.pathname.toLocaleLowerCase('pl'),
        external
      };
    } catch (_) {
      return null;
    }
  }

  function classifyResource(pathname) {
    if (/\/(filmv1?|yt)\//.test(pathname)) return { kind: 'video', icon: '▶' };
    if (/\/slides\//.test(pathname)) return { kind: 'document', icon: '▤' };
    if (/\/pdf\//.test(pathname)) return { kind: 'document', icon: 'PDF' };
    if (/\/(forms|chat)\//.test(pathname)) return { kind: 'exercise', icon: pathname.includes('/chat/') ? '✦' : '✓' };
    if (/\/(kalkulator|classic)\//.test(pathname)) return { kind: 'calculator', icon: '±' };
    if (/\/(bitpaper|whiteboard)\//.test(pathname)) return { kind: 'exercise', icon: '✎' };
    if (/\/contact\//.test(pathname)) return { kind: 'contact', icon: '✉' };
    if (/^\/time\/?$/.test(pathname)) return { kind: 'contact', icon: '◷' };
    return { kind: 'default', icon: '↗' };
  }

  function createResourceCard(item, sectionTitle, groupTitle) {
    const parsedUrl = safeUrl(item.href);
    if (!parsedUrl) return null;

    const resource = classifyResource(parsedUrl.pathname);
    const card = document.createElement('article');
    card.className = 'resource-card';
    card.dataset.kind = resource.kind;
    card.dataset.search = normalizeText(`${sectionTitle} ${groupTitle || ''} ${item.title} ${item.description}`);

    const icon = document.createElement('span');
    icon.className = 'card-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = resource.icon;
    if (resource.icon.length > 1) icon.classList.add('is-text-icon');

    const title = document.createElement('h3');
    title.textContent = item.title;

    const description = document.createElement('p');
    description.textContent = item.description || 'Otwórz materiał kursowy.';

    const openLabel = document.createElement('span');
    openLabel.className = 'card-open';
    openLabel.append(document.createTextNode('Otwórz'));
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    openLabel.append(arrow);

    const link = document.createElement('a');
    link.className = 'card-link';
    link.href = parsedUrl.href;
    link.setAttribute('aria-label', `Otwórz: ${item.title}`);
    if (parsedUrl.external) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const externalMark = document.createElement('span');
      externalMark.className = 'external-mark';
      externalMark.setAttribute('aria-hidden', 'true');
      externalMark.textContent = '↗';
      card.append(externalMark);
    }

    card.append(icon, title, description, openLabel, link);
    return card;
  }

  function createAccordionGroup(group, sectionTitle) {
    const cards = group.items
      .map((item) => createResourceCard(item, sectionTitle, group.title))
      .filter(Boolean);

    const details = document.createElement('details');
    details.className = 'resource-accordion';

    const summary = document.createElement('summary');
    const copy = document.createElement('span');
    copy.className = 'accordion-copy';
    const title = document.createElement('strong');
    title.textContent = group.title;
    copy.append(title);
    if (group.description.length) {
      const description = document.createElement('span');
      description.textContent = group.description.join(' ');
      copy.append(description);
    }

    const meta = document.createElement('span');
    meta.className = 'accordion-meta';
    const total = document.createElement('span');
    total.dataset.accordionTotal = String(cards.length);
    total.textContent = resourceLabel(cards.length);
    const chevron = document.createElement('span');
    chevron.className = 'accordion-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '⌄';
    meta.append(total, chevron);
    summary.append(copy, meta);
    details.append(summary);

    const body = document.createElement('div');
    body.className = 'accordion-body';
    group.notices.forEach((noticeText) => {
      const notice = document.createElement('p');
      notice.className = 'section-notice';
      notice.textContent = noticeText;
      body.append(notice);
    });

    if (cards.length) {
      const grid = document.createElement('div');
      grid.className = 'card-grid';
      cards.forEach((card) => grid.append(card));
      body.append(grid);
    } else {
      const empty = document.createElement('div');
      empty.className = 'empty-section';
      empty.textContent = 'Materiały w tej liście pojawią się wkrótce.';
      body.append(empty);
    }
    details.append(body);
    return { element: details, cardCount: cards.length };
  }

  function createSection(section, index, usedIds) {
    let id = slugify(section.title, `dzial-${index + 1}`);
    let suffix = 2;
    while (usedIds.has(id) || id === 'start') {
      id = `${slugify(section.title, `dzial-${index + 1}`)}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);

    const sectionElement = document.createElement('section');
    sectionElement.className = 'course-section';
    sectionElement.id = id;
    sectionElement.dataset.sectionTitle = normalizeText(section.title);

    const headingRow = document.createElement('div');
    headingRow.className = 'section-heading';
    const headingCopy = document.createElement('div');
    const heading = document.createElement('h2');
    heading.textContent = section.title;
    headingCopy.append(heading);

    if (section.description.length) {
      const description = document.createElement('p');
      description.textContent = section.description.join(' ');
      headingCopy.append(description);
    }

    const validCards = section.items
      .map((item) => createResourceCard(item, section.title))
      .filter(Boolean);
    const groups = (section.groups || []).map((group) => createAccordionGroup(group, section.title));
    const sectionCardCount = validCards.length + groups.reduce((sum, group) => sum + group.cardCount, 0);

    const total = document.createElement('span');
    total.className = 'section-total';
    total.dataset.sectionTotal = String(sectionCardCount);
    total.textContent = resourceLabel(sectionCardCount);
    headingRow.append(headingCopy, total);
    sectionElement.append(headingRow);

    section.notices.forEach((noticeText) => {
      const notice = document.createElement('p');
      notice.className = 'section-notice';
      notice.textContent = noticeText;
      sectionElement.append(notice);
    });

    if (validCards.length) {
      const grid = document.createElement('div');
      grid.className = 'card-grid';
      validCards.forEach((card) => grid.append(card));
      sectionElement.append(grid);
    }

    groups.forEach((group) => sectionElement.append(group.element));

    if (!sectionCardCount && !groups.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-section';
      empty.textContent = 'Materiały w tym dziale pojawią się wkrótce.';
      sectionElement.append(empty);
    }

    return { id, title: section.title, element: sectionElement, cardCount: sectionCardCount };
  }

  function resourceLabel(count) {
    if (count === 1) return '1 materiał';
    const lastTwo = count % 100;
    const last = count % 10;
    if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return `${count} materiały`;
    return `${count} materiałów`;
  }

  function polishCountLabel(count, singular, pluralFew, pluralMany) {
    if (count === 1) return `1 ${singular}`;
    const lastTwo = count % 100;
    const last = count % 10;
    if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return `${count} ${pluralFew}`;
    return `${count} ${pluralMany}`;
  }

  function renderNavigation(sections) {
    elements.nav.querySelectorAll('.nav-skeleton, .nav-item:not([data-static-nav])').forEach((node) => node.remove());
    sections.forEach((section) => {
      const link = document.createElement('a');
      link.className = 'nav-item';
      link.href = `#${section.id}`;
      link.dataset.sectionLink = section.id;
      const dot = document.createElement('span');
      dot.className = 'nav-dot';
      dot.setAttribute('aria-hidden', 'true');
      link.append(dot, document.createTextNode(section.title));
      link.addEventListener('click', closeMenu);
      elements.nav.append(link);
    });
  }

  function renderDashboard(model) {
    elements.title.textContent = model.title;
    elements.intro.textContent = model.intro.length
      ? model.intro.join(' ')
      : 'Wybierz dział i przejdź do nauki.';

    if (model.notices.length) {
      elements.message.textContent = model.notices.join(' ');
      elements.message.className = 'dashboard-message';
      elements.message.hidden = false;
    } else {
      elements.message.hidden = true;
    }

    const fragment = document.createDocumentFragment();
    const usedIds = new Set();
    const renderedSections = model.sections.map((section, index) => createSection(section, index, usedIds));
    renderedSections.forEach(({ element }) => fragment.append(element));

    totalResources = renderedSections.reduce((sum, section) => sum + section.cardCount, 0);
    elements.content.replaceChildren(fragment);
    elements.content.setAttribute('aria-busy', 'false');
    updateResourceCount(totalResources, totalResources, false);
    renderNavigation(renderedSections);
    filterResources();
    setupSectionObserver();
  }

  function showContentError(error) {
    elements.content.hidden = false;
    elements.emptySearch.hidden = true;
    elements.content.replaceChildren();
    elements.content.setAttribute('aria-busy', 'false');
    const errorSection = document.createElement('section');
    errorSection.className = 'empty-section';
    const heading = document.createElement('h2');
    heading.textContent = 'Nie udało się wczytać materiałów';
    const text = document.createElement('p');
    text.textContent = 'Odśwież stronę. Jeśli problem się powtórzy, skorzystaj z formularza pomocy.';
    const retry = document.createElement('button');
    retry.className = 'button button-primary';
    retry.type = 'button';
    retry.textContent = 'Spróbuj ponownie';
    retry.addEventListener('click', loadDashboard);
    errorSection.append(heading, text, retry);
    elements.content.append(errorSection);
    elements.message.className = 'dashboard-message is-error';
    elements.message.textContent = error instanceof Error ? error.message : 'Wystąpił błąd wczytywania.';
    elements.message.hidden = false;
    elements.nav.querySelectorAll('.nav-skeleton').forEach((node) => node.remove());
  }

  async function fetchStaticDashboard() {
    const response = await fetch(CONTENT_URL, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'text/markdown, text/plain;q=0.9' }
    });
    if (!response.ok) throw new Error(`Materiały są chwilowo niedostępne (${response.status}).`);
    if (new URL(response.url, window.location.origin).pathname.startsWith('/login/')) {
      throw new Error('Sesja wygasła. Zaloguj się ponownie.');
    }
    const markdown = await response.text();
    if (/^\s*<!doctype\s+html/i.test(markdown) || /^\s*<html[\s>]/i.test(markdown)) {
      throw new Error('Sesja wygasła. Zaloguj się ponownie.');
    }
    return markdown;
  }

  async function fetchActiveDashboard() {
    let token = '';
    try { token = await getUserToken(false); } catch (_) {}
    if (token) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await fetch(ADMIN_DASHBOARD_URL, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`
          },
          signal: controller.signal
        });
        if (response.ok) {
          const payload = await response.json();
          if (payload && payload.source === 'static') return fetchStaticDashboard();
          if (payload && typeof payload.content === 'string') return payload.content;
          throw new Error('Serwer zwrócił nieprawidłową treść dashboardu.');
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error('Sesja wygasła albo dostęp do kursu został zakończony.');
        }
        // Starsza odpowiedź 404 oraz chwilowa niedostępność Functions/Blobs nie
        // blokują statycznej wersji awaryjnej.
      } catch (error) {
        if (error && /Sesja wygasła|dostęp do kursu/.test(error.message || '')) throw error;
      } finally {
        window.clearTimeout(timeout);
      }
    }
    return fetchStaticDashboard();
  }

  async function loadDashboard() {
    elements.content.setAttribute('aria-busy', 'true');
    try {
      const markdown = await fetchActiveDashboard();
      const model = parseMarkdown(markdown);
      if (!model.sections.length) throw new Error('Plik materiałów nie zawiera jeszcze żadnego działu.');
      renderDashboard(model);
    } catch (error) {
      showContentError(error);
    }
  }

  function updateResourceCount(visible, total, filtering) {
    if (!elements.resourceCount) return;
    elements.resourceCount.textContent = filtering
      ? `${resourceLabel(visible)} z ${total}`
      : `${resourceLabel(total)} w panelu`;
  }

  function filterResources() {
    const query = normalizeText(elements.search.value);
    let visibleCards = 0;

    document.querySelectorAll('.course-section').forEach((section) => {
      let sectionMatches = 0;
      section.querySelectorAll('.resource-card').forEach((card) => {
        const matches = !query || card.dataset.search.includes(query);
        card.hidden = !matches;
        if (matches) sectionMatches += 1;
      });
      section.querySelectorAll('.resource-accordion').forEach((accordion) => {
        const matchingCards = Array.from(accordion.querySelectorAll('.resource-card'))
          .filter((card) => !card.hidden).length;
        accordion.hidden = Boolean(query) && matchingCards === 0;
        if (query && matchingCards > 0) accordion.open = true;
        const total = accordion.querySelector('[data-accordion-total]');
        if (total && query) total.textContent = `${matchingCards} z ${total.dataset.accordionTotal}`;
        else if (total) total.textContent = resourceLabel(Number(total.dataset.accordionTotal));
      });
      section.hidden = Boolean(query) && sectionMatches === 0;
      visibleCards += sectionMatches;
      const total = section.querySelector('[data-section-total]');
      if (total && query) total.textContent = `${sectionMatches} z ${total.dataset.sectionTotal}`;
      else if (total) total.textContent = resourceLabel(Number(total.dataset.sectionTotal));
    });

    elements.emptySearch.hidden = !query || visibleCards > 0;
    elements.content.hidden = Boolean(query) && visibleCards === 0;
    updateResourceCount(visibleCards, totalResources, Boolean(query));
  }

  function setActiveNavigation(id) {
    elements.nav.querySelectorAll('.nav-item').forEach((link) => {
      const active = link.getAttribute('href') === `#${id}`;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function setupSectionObserver() {
    if (sectionObserver) sectionObserver.disconnect();
    if (!('IntersectionObserver' in window)) return;
    sectionObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting && !entry.target.hidden)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible[0]) setActiveNavigation(visible[0].target.id);
    }, { rootMargin: '-18% 0px -64% 0px', threshold: [0, 0.15, 0.5] });
    sectionObserver.observe(document.getElementById('start'));
    document.querySelectorAll('.course-section').forEach((section) => sectionObserver.observe(section));
  }

  function openMenu() {
    elements.body.classList.add('menu-open');
    elements.menuButton.setAttribute('aria-expanded', 'true');
    elements.menuButton.setAttribute('aria-label', 'Zamknij menu');
  }

  function closeMenu() {
    elements.body.classList.remove('menu-open');
    elements.menuButton.setAttribute('aria-expanded', 'false');
    elements.menuButton.setAttribute('aria-label', 'Otwórz menu');
  }

  function displayNameFor(user, profile) {
    if (profile && typeof profile.fullName === 'string' && profile.fullName.trim()) return profile.fullName.trim();
    const metadata = user && user.user_metadata ? user.user_metadata : {};
    const name = metadata.full_name || metadata.name || '';
    if (typeof name === 'string' && name.trim()) return name.trim();
    if (user && typeof user.email === 'string' && user.email.includes('@')) return user.email.split('@')[0];
    return 'Kursant';
  }

  function initialsFor(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'U';
    return (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toLocaleUpperCase('pl');
  }

  function accessLabelFor(user) {
    const appMetadata = user && user.app_metadata ? user.app_metadata : {};
    const roles = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
    if (roles.includes('admin')) return 'Dostęp administratora';

    const timed = appMetadata.timed_access;
    if (timed && timed.expires_at) {
      const expiration = new Date(timed.expires_at);
      if (Number.isFinite(expiration.getTime()) && expiration.getTime() > Date.now()) {
        return `Dostęp do ${new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(expiration)}`;
      }
    }
    if (roles.includes('active')) return 'Konto aktywne';
    return 'Konto kursanta';
  }

  function isAdminUser(user) {
    const appMetadata = user && user.app_metadata ? user.app_metadata : {};
    return Array.isArray(appMetadata.roles) && appMetadata.roles.includes('admin');
  }

  function updateAdminVisibility(user) {
    if (!elements.adminButton) return;
    const visible = isAdminUser(user || currentUser);
    elements.adminButton.hidden = !visible;
    if (!visible && elements.adminDialog && elements.adminDialog.open) closeAdminPanel();
  }

  function updateProfileDisplay(user, profile) {
    if (!user && !profile) return;
    if (user) currentUser = user;
    const activeUser = user || currentUser;
    const metadata = activeUser && activeUser.user_metadata ? activeUser.user_metadata : {};
    const name = displayNameFor(activeUser, profile);
    const email = profile && typeof profile.email === 'string'
      ? profile.email
      : activeUser && typeof activeUser.email === 'string' ? activeUser.email : '';
    const initials = initialsFor(name);
    const accessLabel = accessLabelFor(activeUser);

    let firstName = profile && typeof profile.firstName === 'string' ? profile.firstName.trim() : '';
    let lastName = profile && typeof profile.lastName === 'string' ? profile.lastName.trim() : '';
    if (!firstName) firstName = String(metadata.first_name || metadata.firstName || metadata.given_name || '').trim();
    if (!lastName) lastName = String(metadata.last_name || metadata.lastName || metadata.family_name || '').trim();
    if ((!firstName || !lastName) && name && name !== 'Kursant') {
      const parts = name.split(/\s+/).filter(Boolean);
      if (!firstName) firstName = parts.shift() || '';
      if (!lastName) lastName = parts.join(' ');
    }

    document.querySelectorAll('[data-user-name]').forEach((node) => { node.textContent = name; });
    document.querySelectorAll('[data-user-email]').forEach((node) => { node.textContent = email; });
    document.querySelectorAll('[data-user-initials]').forEach((node) => { node.textContent = initials; });
    document.querySelectorAll('[data-access-label]').forEach((node) => { node.textContent = accessLabel; });
    updateAdminVisibility(activeUser);
    const editingName = document.activeElement === elements.profileFirstName || document.activeElement === elements.profileLastName;
    if (!elements.profileDialog.open || !editingName) {
      elements.profileFirstName.value = firstName;
      elements.profileLastName.value = lastName;
    }
  }

  function openProfile(event) {
    lastProfileTrigger = event && event.currentTarget ? event.currentTarget : null;
    const auth = window.ChemAuth;
    const identity = window.netlifyIdentity;
    const user = currentUser
      || (auth && typeof auth.getUser === 'function' ? auth.getUser() : null)
      || (identity && typeof identity.currentUser === 'function' ? identity.currentUser() : null);
    const profile = auth && typeof auth.getProfile === 'function' ? auth.getProfile() : null;
    if (user || profile) updateProfileDisplay(user, profile);
    elements.profileMessage.textContent = '';
    elements.profileMessage.className = 'form-message';
    if (typeof elements.profileDialog.showModal === 'function') elements.profileDialog.showModal();
    else elements.profileDialog.setAttribute('open', '');
    window.setTimeout(() => elements.profileFirstName.focus(), 0);
  }

  function closeProfile() {
    if (typeof elements.profileDialog.close === 'function') elements.profileDialog.close();
    else elements.profileDialog.removeAttribute('open');
    if (lastProfileTrigger) lastProfileTrigger.focus();
  }

  async function saveProfile(event) {
    event.preventDefault();
    const firstName = elements.profileFirstName.value.replace(/\s+/g, ' ').trim();
    const lastName = elements.profileLastName.value.replace(/\s+/g, ' ').trim();
    if (firstName.length < 2 || lastName.length < 2) {
      elements.profileMessage.textContent = 'Imię i nazwisko muszą mieć co najmniej 2 znaki.';
      elements.profileMessage.className = 'form-message is-error';
      (firstName.length < 2 ? elements.profileFirstName : elements.profileLastName).focus();
      return;
    }

    const auth = window.ChemAuth;
    const identity = window.netlifyIdentity;
    const user = currentUser
      || (auth && typeof auth.getUser === 'function' ? auth.getUser() : null)
      || (identity && typeof identity.currentUser === 'function' ? identity.currentUser() : null);
    if ((!auth || typeof auth.updateProfile !== 'function') && (!user || typeof user.update !== 'function')) {
      elements.profileMessage.textContent = 'Nie udało się odczytać sesji. Odśwież stronę i spróbuj ponownie.';
      elements.profileMessage.className = 'form-message is-error';
      return;
    }

    const oldButtonText = elements.profileSave.textContent;
    elements.profileSave.disabled = true;
    elements.profileSave.textContent = 'Zapisywanie…';
    elements.profileMessage.textContent = '';

    try {
      let profile = null;
      let updatedUser = user;
      if (auth && typeof auth.updateProfile === 'function') {
        profile = await auth.updateProfile({ firstName, lastName });
        updatedUser = (typeof auth.getUser === 'function' && auth.getUser()) || user;
      } else {
        const fullName = `${firstName} ${lastName}`;
        const metadata = Object.assign({}, user.user_metadata || {}, {
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          name: fullName
        });
        updatedUser = await user.update({ data: metadata });
      }
      updateProfileDisplay(updatedUser || (identity && identity.currentUser()) || user, profile);
      elements.profileMessage.className = 'form-message';
      elements.profileMessage.textContent = 'Zapisano zmiany.';
    } catch (error) {
      elements.profileMessage.className = 'form-message is-error';
      elements.profileMessage.textContent = error && error.message
        ? error.message
        : 'Nie udało się zapisać profilu. Sprawdź połączenie i spróbuj ponownie.';
    } finally {
      elements.profileSave.disabled = false;
      elements.profileSave.textContent = oldButtonText;
    }
  }

  function adminProfileFrom(rawUser) {
    const source = rawUser && typeof rawUser === 'object' ? rawUser : {};
    const userMetadata = source.user_metadata && typeof source.user_metadata === 'object' ? source.user_metadata : {};
    const appMetadata = source.app_metadata && typeof source.app_metadata === 'object' ? source.app_metadata : {};
    const fullName = String(source.fullName || source.full_name || userMetadata.full_name || userMetadata.name || '').trim();
    const nameParts = fullName.split(/\s+/).filter(Boolean);
    let firstName = String(source.firstName || source.first_name || userMetadata.first_name || userMetadata.firstName || '').trim();
    let lastName = String(source.lastName || source.last_name || userMetadata.last_name || userMetadata.lastName || '').trim();
    if (!firstName && nameParts.length) firstName = nameParts.shift() || '';
    if (!lastName && nameParts.length) lastName = nameParts.join(' ');
    const rawRoles = Array.isArray(source.roles) ? source.roles : Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
    const rawTimedAccess = source.timedAccess && typeof source.timedAccess === 'object'
      ? source.timedAccess
      : source.timed_access && typeof source.timed_access === 'object'
        ? source.timed_access
        : appMetadata.timed_access && typeof appMetadata.timed_access === 'object' ? appMetadata.timed_access : null;
    const timedRole = rawTimedAccess && String(rawTimedAccess.role || '').trim();
    const timedExpiresAt = rawTimedAccess && String(rawTimedAccess.expiresAt || rawTimedAccess.expires_at || '').trim();

    return {
      id: String(source.id || source.user_id || '').trim(),
      email: String(source.email || '').trim(),
      firstName,
      lastName,
      roles: Array.from(new Set(rawRoles.filter((role) => ADMIN_ROLE_VALUES.has(role)))),
      timedAccess: timedRole && COURSE_ROLE_VALUES.has(timedRole)
        ? {
            role: timedRole,
            assignedAt: String(rawTimedAccess.assignedAt || rawTimedAccess.assigned_at || '').trim(),
            expiresAt: timedExpiresAt,
            active: rawTimedAccess.active !== false
          }
        : null
    };
  }

  function adminDisplayName(user) {
    const fullName = `${user.firstName} ${user.lastName}`.trim();
    return fullName || user.email || 'Użytkownik bez nazwy';
  }

  function setAdminStatus(message, type) {
    setPanelStatus(elements.adminStatus, message, type);
  }

  function setPanelStatus(element, message, type) {
    if (!element) return;
    element.textContent = message || '';
    element.className = `admin-status${type ? ` is-${type}` : ''}`;
  }

  async function getUserToken(requireAdmin) {
    const auth = window.ChemAuth;
    const identity = window.netlifyIdentity;
    const user = currentUser
      || (auth && typeof auth.getUser === 'function' ? auth.getUser() : null)
      || (identity && typeof identity.currentUser === 'function' ? identity.currentUser() : null);
    if (requireAdmin && !isAdminUser(user)) throw new Error('Ta funkcja jest dostępna tylko dla administratora.');
    if (!user || typeof user.jwt !== 'function') throw new Error('Nie udało się odczytać sesji administratora.');
    const token = await user.jwt();
    if (!token) throw new Error('Sesja wygasła. Zaloguj się ponownie.');
    return token;
  }

  async function getAdminToken() {
    return getUserToken(true);
  }

  async function readAdminResponse(response) {
    let payload = null;
    try { payload = await response.json(); } catch (_) {}
    if (!response.ok) {
      const fallback = response.status === 403
        ? 'Nie masz uprawnień do zarządzania kontami.'
        : response.status === 401
          ? 'Sesja administratora wygasła. Zaloguj się ponownie.'
          : `Nie udało się wykonać operacji (${response.status}).`;
      const code = payload && typeof payload.error === 'string' ? payload.error : '';
      const serverMessage = payload && typeof payload.message === 'string' ? payload.message : '';
      throw new Error(ADMIN_ERROR_MESSAGES[code] || serverMessage || fallback);
    }
    return payload;
  }

  function createAccessControls(selected, userId) {
    const controls = document.createElement('div');
    controls.className = 'admin-access-controls';
    const safeId = slugify(userId, 'user');

    const accessLabel = document.createElement('label');
    accessLabel.className = 'admin-access-field';
    accessLabel.htmlFor = `access-${safeId}`;
    const accessCaption = document.createElement('span');
    accessCaption.className = 'field-label';
    accessCaption.textContent = 'Dostęp do kursu';
    const accessSelect = document.createElement('select');
    accessSelect.className = 'text-field admin-access-select';
    accessSelect.id = `access-${safeId}`;
    accessSelect.name = 'accessRole';
    const selectedAccess = ACCESS_ROLE_OPTIONS.find((role) => role.value && selected.includes(role.value));
    ACCESS_ROLE_OPTIONS.forEach((role) => {
      const option = document.createElement('option');
      option.value = role.value;
      option.textContent = role.label;
      option.selected = role.value === (selectedAccess ? selectedAccess.value : '');
      accessSelect.append(option);
    });
    accessLabel.append(accessCaption, accessSelect);

    const adminLabel = document.createElement('label');
    adminLabel.className = 'admin-toggle';
    adminLabel.htmlFor = `admin-${safeId}`;
    const adminInput = document.createElement('input');
    adminInput.id = `admin-${safeId}`;
    adminInput.name = 'isAdmin';
    adminInput.type = 'checkbox';
    adminInput.checked = selected.includes('admin');
    const currentId = currentUser && String(currentUser.id || currentUser.user_id || '').trim();
    const isOwnAdminAccount = Boolean(currentId && currentId === userId && adminInput.checked);
    if (isOwnAdminAccount) adminInput.disabled = true;
    const adminMark = document.createElement('span');
    adminMark.className = 'admin-toggle-mark';
    adminMark.setAttribute('aria-hidden', 'true');
    const adminCopy = document.createElement('span');
    adminCopy.className = 'admin-toggle-copy';
    const adminTitle = document.createElement('strong');
    adminTitle.textContent = 'Administrator';
    const adminHint = document.createElement('small');
    adminHint.textContent = isOwnAdminAccount ? 'Twoja rola jest chroniona' : 'Dostęp do tego panelu';
    adminCopy.append(adminTitle, adminHint);
    adminLabel.append(adminInput, adminMark, adminCopy);

    controls.append(accessLabel, adminLabel);
    return controls;
  }

  function createAdminUserCard(user) {
    const article = document.createElement('article');
    article.className = 'admin-user-card';
    article.dataset.userId = user.id;
    article.dataset.search = normalizeText(`${user.firstName} ${user.lastName} ${user.email}`);

    const header = document.createElement('header');
    header.className = 'admin-user-heading';
    const avatar = document.createElement('span');
    avatar.className = 'avatar admin-user-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = initialsFor(adminDisplayName(user));
    const headingCopy = document.createElement('div');
    const heading = document.createElement('h3');
    heading.textContent = adminDisplayName(user);
    const email = document.createElement('p');
    email.textContent = user.email || 'Brak adresu e-mail';
    headingCopy.append(heading, email);
    const remove = document.createElement('button');
    remove.className = 'admin-delete-button';
    remove.type = 'button';
    remove.textContent = 'Usuń';
    const currentId = currentUser && String(currentUser.id || currentUser.user_id || '').trim();
    const isOwnAccount = Boolean(currentId && currentId === user.id);
    remove.disabled = isOwnAccount;
    remove.title = isOwnAccount ? 'Nie możesz usunąć własnego konta' : `Usuń konto ${adminDisplayName(user)}`;
    remove.setAttribute('aria-label', remove.title);
    remove.addEventListener('click', () => deleteAdminUser(user, remove));
    header.append(avatar, headingCopy, remove);

    const form = document.createElement('form');
    form.className = 'admin-user-form';
    form.dataset.userId = user.id;

    const names = document.createElement('div');
    names.className = 'profile-name-grid';
    const createNameField = (labelText, name, value, autocomplete) => {
      const label = document.createElement('label');
      const labelSpan = document.createElement('span');
      labelSpan.className = 'field-label';
      labelSpan.textContent = labelText;
      const input = document.createElement('input');
      input.className = 'text-field';
      input.name = name;
      input.type = 'text';
      input.value = value;
      input.maxLength = 80;
      input.autocomplete = autocomplete;
      input.required = true;
      label.append(labelSpan, input);
      return label;
    };
    names.append(
      createNameField('Imię', 'firstName', user.firstName, 'off'),
      createNameField('Nazwisko', 'lastName', user.lastName, 'off')
    );

    const roleFieldset = document.createElement('fieldset');
    roleFieldset.className = 'admin-roles';
    const legend = document.createElement('legend');
    legend.textContent = 'Uprawnienia';
    roleFieldset.append(legend, createAccessControls(user.roles, user.id));

    const timedStatus = createTimedAccessStatus(user);

    const footer = document.createElement('footer');
    footer.className = 'admin-user-footer';
    const message = document.createElement('p');
    message.className = 'admin-user-message';
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');
    const save = document.createElement('button');
    save.className = 'button button-primary';
    save.type = 'submit';
    save.textContent = 'Zapisz użytkownika';
    footer.append(message, save);

    form.append(names, roleFieldset);
    if (timedStatus) form.append(timedStatus);
    form.append(footer);
    form.addEventListener('submit', (event) => saveAdminUser(event, user));
    article.append(header, form);
    return article;
  }

  function createTimedAccessStatus(user) {
    const role = user.roles.find((candidate) => !['admin', 'active'].includes(candidate));
    if (!role) return null;
    const container = document.createElement('div');
    container.className = 'admin-timed-status';
    container.dataset.timedStatus = 'true';
    const copy = document.createElement('span');
    const timed = user.timedAccess && user.timedAccess.role === role ? user.timedAccess : null;
    const expiresAt = timed ? new Date(timed.expiresAt) : null;
    const hasDate = Boolean(expiresAt && Number.isFinite(expiresAt.getTime()));
    const expired = Boolean(hasDate && expiresAt.getTime() <= Date.now());
    if (!hasDate) {
      copy.textContent = 'Okres dostępu rozpocznie się przy następnym logowaniu użytkownika.';
    } else if (expired) {
      container.classList.add('is-expired');
      copy.textContent = `Dostęp wygasł ${new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(expiresAt)}.`;
      const renew = document.createElement('button');
      renew.className = 'button button-secondary admin-renew-button';
      renew.type = 'button';
      renew.textContent = 'Odnów ten okres';
      renew.addEventListener('click', () => renewAdminTimedAccess(user, renew));
      container.append(copy, renew);
      return container;
    } else {
      copy.textContent = `Dostęp aktywny do ${new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(expiresAt)}.`;
    }
    container.append(copy);
    return container;
  }

  function refreshTimedAccessStatus(card, user) {
    const existing = card.querySelector('[data-timed-status]');
    const next = createTimedAccessStatus(user);
    if (existing && next) existing.replaceWith(next);
    else if (existing) existing.remove();
    else if (next) {
      const footer = card.querySelector('.admin-user-footer');
      if (footer) footer.before(next);
    }
  }

  function renderAdminUsers() {
    const query = normalizeText(elements.adminSearch.value);
    const filtered = adminUsers.filter((user) => !query || normalizeText(`${user.firstName} ${user.lastName} ${user.email}`).includes(query));
    const fragment = document.createDocumentFragment();
    filtered.forEach((user) => fragment.append(createAdminUserCard(user)));
    elements.adminUserList.replaceChildren(fragment);
    elements.adminEmpty.hidden = filtered.length > 0;
    if (query) setAdminStatus(`${filtered.length} z ${adminUsers.length} kont`, 'info');
    else setAdminStatus(adminUsers.length ? `${adminUsers.length} kont w systemie` : '', 'info');
  }

  async function loadAdminUsers() {
    elements.adminUserList.setAttribute('aria-busy', 'true');
    elements.adminUserList.replaceChildren();
    elements.adminEmpty.hidden = true;
    elements.adminRefresh.disabled = true;
    setAdminStatus('Wczytywanie kont użytkowników…', 'loading');
    try {
      const token = await getAdminToken();
      const collected = [];
      let page = 1;
      let hasMore = false;
      do {
        const response = await fetch(`${ADMIN_USERS_URL}?page=${page}&perPage=100`, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`
          }
        });
        const payload = await readAdminResponse(response);
        const rawUsers = Array.isArray(payload) ? payload : payload && Array.isArray(payload.users) ? payload.users : [];
        collected.push(...rawUsers);
        hasMore = Boolean(payload && payload.pagination && payload.pagination.hasMore);
        page += 1;
        if (hasMore) setAdminStatus(`Wczytywanie kont użytkowników… ${collected.length}`, 'loading');
      } while (hasMore && page <= 100);

      if (hasMore) throw new Error('Lista kont jest zbyt długa, aby wyświetlić ją w całości.');
      const uniqueUsers = new Map();
      collected.map(adminProfileFrom).filter((user) => user.id).forEach((user) => uniqueUsers.set(user.id, user));
      adminUsers = Array.from(uniqueUsers.values());
      renderAdminUsers();
    } catch (error) {
      adminUsers = [];
      elements.adminEmpty.hidden = true;
      setAdminStatus(error && error.message ? error.message : 'Nie udało się wczytać użytkowników.', 'error');
    } finally {
      elements.adminUserList.setAttribute('aria-busy', 'false');
      elements.adminRefresh.disabled = false;
    }
  }

  async function saveAdminUser(event, originalUser) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = form.querySelector('.admin-user-message');
    const save = form.querySelector('button[type="submit"]');
    const firstName = String(form.elements.firstName.value || '').replace(/\s+/g, ' ').trim();
    const lastName = String(form.elements.lastName.value || '').replace(/\s+/g, ' ').trim();
    const roles = [];
    const accessRole = String(form.elements.accessRole.value || '');
    if (COURSE_ROLE_VALUES.has(accessRole)) roles.push(accessRole);
    if (form.elements.isAdmin.checked) roles.unshift('admin');

    if (firstName.length < 2 || lastName.length < 2) {
      message.textContent = 'Imię i nazwisko muszą mieć co najmniej 2 znaki.';
      message.className = 'admin-user-message is-error';
      form.elements[firstName.length < 2 ? 'firstName' : 'lastName'].focus();
      return;
    }

    save.disabled = true;
    save.textContent = 'Zapisywanie…';
    message.textContent = '';
    message.className = 'admin-user-message';
    try {
      const token = await getAdminToken();
      const originalRoles = Array.from(new Set(originalUser.roles)).sort();
      const selectedRoles = Array.from(new Set(roles)).sort();
      const rolesChanged = originalRoles.length !== selectedRoles.length
        || originalRoles.some((role, index) => role !== selectedRoles[index]);
      const body = { id: originalUser.id, firstName, lastName };
      if (rolesChanged) body.roles = roles;
      const response = await fetch(ADMIN_USERS_URL, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      const payload = await readAdminResponse(response);
      const returned = payload && payload.user ? adminProfileFrom(payload.user) : null;
      originalUser.firstName = returned && returned.firstName ? returned.firstName : firstName;
      originalUser.lastName = returned && returned.lastName ? returned.lastName : lastName;
      originalUser.roles = returned ? returned.roles : roles;
      originalUser.timedAccess = returned ? returned.timedAccess : originalUser.timedAccess;
      const card = form.closest('.admin-user-card');
      card.dataset.search = normalizeText(`${originalUser.firstName} ${originalUser.lastName} ${originalUser.email}`);
      card.querySelector('.admin-user-heading h3').textContent = adminDisplayName(originalUser);
      card.querySelector('.admin-user-avatar').textContent = initialsFor(adminDisplayName(originalUser));
      refreshTimedAccessStatus(card, originalUser);
      message.textContent = payload && payload.sessionRefreshRequired
        ? 'Zapisano. Nowe uprawnienia pojawią się po odświeżeniu sesji użytkownika.'
        : 'Zmiany zostały zapisane.';
      message.className = 'admin-user-message is-success';
    } catch (error) {
      message.textContent = error && error.message ? error.message : 'Nie udało się zapisać zmian.';
      message.className = 'admin-user-message is-error';
    } finally {
      save.disabled = false;
      save.textContent = 'Zapisz użytkownika';
    }
  }

  async function renewAdminTimedAccess(user, button) {
    const timedRole = user.roles.find((role) => !['admin', 'active'].includes(role));
    if (!timedRole) return;
    const roleLabel = ACCESS_ROLE_OPTIONS.find((option) => option.value === timedRole)?.label || timedRole;
    if (!window.confirm(`Przygotować nowy okres „${roleLabel}” dla konta ${adminDisplayName(user)}? Rozpocznie się przy następnym logowaniu.`)) return;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Odnawianie…';
    try {
      const token = await getAdminToken();
      const response = await fetch(ADMIN_USERS_URL, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id: user.id, roles: user.roles })
      });
      const payload = await readAdminResponse(response);
      const returned = payload && payload.user ? adminProfileFrom(payload.user) : null;
      if (returned) {
        user.roles = returned.roles;
        user.timedAccess = returned.timedAccess;
      } else {
        user.timedAccess = null;
      }
      const card = button.closest('.admin-user-card');
      refreshTimedAccessStatus(card, user);
      const message = card.querySelector('.admin-user-message');
      message.className = 'admin-user-message is-success';
      message.textContent = 'Odnowienie jest gotowe. Nowy okres rozpocznie się przy następnym logowaniu.';
    } catch (error) {
      const card = button.closest('.admin-user-card');
      const message = card.querySelector('.admin-user-message');
      message.className = 'admin-user-message is-error';
      message.textContent = error && error.message ? error.message : 'Nie udało się odnowić dostępu.';
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  async function inviteAdminUser(event) {
    event.preventDefault();
    const firstName = String(elements.adminInviteFirstName.value || '').replace(/\s+/g, ' ').trim();
    const lastName = String(elements.adminInviteLastName.value || '').replace(/\s+/g, ' ').trim();
    const email = String(elements.adminInviteEmail.value || '').trim().toLocaleLowerCase('pl');
    const roles = [];
    const accessRole = String(elements.adminInviteRole.value || '');
    if (COURSE_ROLE_VALUES.has(accessRole)) roles.push(accessRole);
    if (elements.adminInviteIsAdmin.checked) roles.unshift('admin');

    elements.adminInviteMessage.className = 'admin-user-message';
    elements.adminInviteMessage.textContent = '';
    if (!elements.adminInviteForm.reportValidity()) return;
    if (firstName.length < 2 || lastName.length < 2) {
      elements.adminInviteMessage.className = 'admin-user-message is-error';
      elements.adminInviteMessage.textContent = 'Imię i nazwisko muszą mieć co najmniej 2 znaki.';
      (firstName.length < 2 ? elements.adminInviteFirstName : elements.adminInviteLastName).focus();
      return;
    }

    const originalText = elements.adminInviteSubmit.textContent;
    elements.adminInviteSubmit.disabled = true;
    elements.adminInviteSubmit.textContent = 'Wysyłanie…';
    try {
      const token = await getAdminToken();
      const response = await fetch(ADMIN_USERS_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email, firstName, lastName, roles })
      });
      const payload = await readAdminResponse(response);
      const invited = payload && payload.user ? adminProfileFrom(payload.user) : null;
      if (invited && invited.id) {
        adminUsers = [invited, ...adminUsers.filter((user) => user.id !== invited.id)];
        renderAdminUsers();
      }
      elements.adminInviteForm.reset();
      elements.adminInviteMessage.className = 'admin-user-message is-success';
      elements.adminInviteMessage.textContent = `Zaproszenie wysłano na ${email}.`;
    } catch (error) {
      elements.adminInviteMessage.className = 'admin-user-message is-error';
      elements.adminInviteMessage.textContent = error && error.message ? error.message : 'Nie udało się wysłać zaproszenia.';
    } finally {
      elements.adminInviteSubmit.disabled = false;
      elements.adminInviteSubmit.textContent = originalText;
    }
  }

  async function deleteAdminUser(user, button) {
    const label = adminDisplayName(user);
    if (!window.confirm(`Usunąć konto „${label}” (${user.email})? Tej operacji nie można cofnąć.`)) return;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '…';
    try {
      const token = await getAdminToken();
      const response = await fetch(ADMIN_USERS_URL, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id: user.id })
      });
      await readAdminResponse(response);
      adminUsers = adminUsers.filter((entry) => entry.id !== user.id);
      renderAdminUsers();
      setAdminStatus(`Usunięto konto ${label}.`, 'info');
    } catch (error) {
      setAdminStatus(error && error.message ? error.message : 'Nie udało się usunąć konta.', 'error');
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function normalizeAdminForm(rawForm) {
    const source = rawForm && typeof rawForm === 'object' ? rawForm : {};
    const id = String(source.id || source.formId || source.form_id || '').trim();
    const name = String(source.name || source.title || source.formName || source.form_name || '').trim();
    const countValue = source.submissionCount ?? source.submission_count ?? source.count;
    const submissionCount = Number.isFinite(Number(countValue)) ? Math.max(0, Number(countValue)) : null;
    return { id, name: name || 'Formularz bez nazwy', submissionCount };
  }

  function normalizeAdminSubmission(rawSubmission) {
    const source = rawSubmission && typeof rawSubmission === 'object' ? rawSubmission : {};
    const data = source.data && typeof source.data === 'object' && !Array.isArray(source.data)
      ? source.data
      : source.fields && typeof source.fields === 'object' && !Array.isArray(source.fields) ? source.fields : {};
    const mergedData = { ...data };
    [
      ['name', source.name],
      ['email', source.email],
      ['first_name', source.firstName || source.first_name],
      ['last_name', source.lastName || source.last_name],
      ['company', source.company],
      ['summary', source.summary],
      ['body', source.body]
    ].forEach(([key, value]) => {
      if (value != null && value !== '' && mergedData[key] == null) mergedData[key] = value;
    });
    const selectedForm = adminForms.find((form) => form.id === elements.adminFormFilter.value);
    return {
      id: String(source.id || source.submissionId || source.submission_id || '').trim(),
      number: source.number == null ? null : Number(source.number),
      createdAt: String(source.createdAt || source.created_at || '').trim(),
      formName: String(source.formName || source.form_name || source.title || (selectedForm && selectedForm.name) || '').trim(),
      deleteToken: String(source.deleteToken || source.delete_token || '').trim(),
      data: mergedData
    };
  }

  function submissionDateLabel(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Data niedostępna';
    return new Intl.DateTimeFormat('pl-PL', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }

  function submissionFieldLabel(key) {
    const labels = {
      email: 'E-mail',
      form_name: 'Formularz',
      internal_note: 'Wiadomość wewnętrzna',
      message: 'Wiadomość',
      name: 'Imię i nazwisko'
    };
    return labels[key] || String(key || '').replace(/[_-]+/g, ' ').replace(/^./, (letter) => letter.toLocaleUpperCase('pl'));
  }

  function submissionFieldValue(value) {
    if (value == null) return '—';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try { return JSON.stringify(value, null, 2); } catch (_) { return '[Nie można wyświetlić wartości]'; }
  }

  function createSubmissionCard(submission) {
    const article = document.createElement('article');
    article.className = 'admin-submission-card';
    article.dataset.submissionId = submission.id;

    const heading = document.createElement('header');
    heading.className = 'admin-submission-heading';
    const copy = document.createElement('div');
    const name = String(submission.data.name || submission.data.email || '').trim();
    const title = document.createElement('h3');
    title.textContent = name || (submission.number ? `Zgłoszenie #${submission.number}` : 'Zgłoszenie formularza');
    const meta = document.createElement('p');
    meta.textContent = [submission.formName, submissionDateLabel(submission.createdAt)].filter(Boolean).join(' · ');
    copy.append(title, meta);
    const remove = document.createElement('button');
    remove.className = 'admin-delete-button';
    remove.type = 'button';
    remove.textContent = 'Usuń';
    remove.setAttribute('aria-label', `Usuń: ${title.textContent}`);
    remove.addEventListener('click', () => deleteAdminSubmission(submission, remove));
    heading.append(copy, remove);

    const fields = document.createElement('dl');
    fields.className = 'admin-submission-fields';
    const ignoredFields = new Set(['form-name', 'form_name', 'g-recaptcha-response']);
    Object.entries(submission.data).forEach(([key, value]) => {
      if (ignoredFields.has(key)) return;
      const field = document.createElement('div');
      field.className = 'admin-submission-field';
      const term = document.createElement('dt');
      term.textContent = submissionFieldLabel(key);
      const description = document.createElement('dd');
      description.textContent = submissionFieldValue(value);
      field.append(term, description);
      fields.append(field);
    });
    if (!fields.children.length) {
      const field = document.createElement('div');
      field.className = 'admin-submission-field';
      const term = document.createElement('dt');
      term.textContent = 'Treść';
      const description = document.createElement('dd');
      description.textContent = 'To zgłoszenie nie zawiera pól do wyświetlenia.';
      field.append(term, description);
      fields.append(field);
    }
    article.append(heading, fields);
    return article;
  }

  function renderAdminSubmissions() {
    const fragment = document.createDocumentFragment();
    adminSubmissions.forEach((submission) => fragment.append(createSubmissionCard(submission)));
    elements.adminSubmissionList.replaceChildren(fragment);
    elements.adminFormsEmpty.hidden = adminSubmissions.length > 0;
    setPanelStatus(
      elements.adminFormsStatus,
      adminSubmissions.length ? polishCountLabel(adminSubmissions.length, 'zgłoszenie', 'zgłoszenia', 'zgłoszeń') : '',
      'info'
    );
  }

  function renderAdminFormOptions(selectedId) {
    const previous = selectedId || elements.adminFormFilter.value;
    const fragment = document.createDocumentFragment();
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = adminForms.length ? 'Wybierz formularz' : 'Brak formularzy';
    fragment.append(emptyOption);
    adminForms.forEach((form) => {
      const option = document.createElement('option');
      option.value = form.id;
      option.textContent = form.submissionCount == null ? form.name : `${form.name} (${form.submissionCount})`;
      fragment.append(option);
    });
    elements.adminFormFilter.replaceChildren(fragment);
    const nextId = adminForms.some((form) => form.id === previous) ? previous : (adminForms[0] ? adminForms[0].id : '');
    elements.adminFormFilter.value = nextId;
    return nextId;
  }

  async function loadAdminForms() {
    const requestId = ++adminFormsRequestId;
    elements.adminFormsRefresh.disabled = true;
    elements.adminFormFilter.disabled = true;
    elements.adminSubmissionList.replaceChildren();
    elements.adminFormsEmpty.hidden = true;
    setPanelStatus(elements.adminFormsStatus, 'Wczytywanie formularzy…', 'loading');
    try {
      const token = await getAdminToken();
      const response = await fetch(ADMIN_FORMS_URL, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
      });
      const payload = await readAdminResponse(response);
      if (requestId !== adminFormsRequestId) return;
      adminForms = (payload && Array.isArray(payload.forms) ? payload.forms : [])
        .map(normalizeAdminForm)
        .filter((form) => form.id);
      const selectedId = renderAdminFormOptions();
      adminFormsLoaded = true;
      if (selectedId) await loadAdminSubmissions(selectedId, token, requestId);
      else {
        adminSubmissions = [];
        renderAdminSubmissions();
      }
    } catch (error) {
      if (requestId !== adminFormsRequestId) return;
      adminFormsLoaded = false;
      adminForms = [];
      adminSubmissions = [];
      renderAdminFormOptions('');
      elements.adminFormsEmpty.hidden = true;
      setPanelStatus(elements.adminFormsStatus, error && error.message ? error.message : 'Nie udało się wczytać formularzy.', 'error');
    } finally {
      if (requestId !== adminFormsRequestId) return;
      elements.adminFormsRefresh.disabled = false;
      elements.adminFormFilter.disabled = false;
      elements.adminSubmissionList.setAttribute('aria-busy', 'false');
    }
  }

  async function loadAdminSubmissions(formId, existingToken, inheritedRequestId) {
    const requestId = inheritedRequestId || ++adminFormsRequestId;
    if (!formId) {
      adminSubmissions = [];
      renderAdminSubmissions();
      return;
    }
    elements.adminSubmissionList.setAttribute('aria-busy', 'true');
    elements.adminSubmissionList.replaceChildren();
    elements.adminFormsEmpty.hidden = true;
    setPanelStatus(elements.adminFormsStatus, 'Wczytywanie zgłoszeń…', 'loading');
    try {
      const token = existingToken || await getAdminToken();
      const collected = [];
      let page = 1;
      let hasMore = false;
      do {
        const query = new URLSearchParams({ formId, page: String(page), perPage: '50' });
        const response = await fetch(`${ADMIN_FORMS_URL}?${query}`, {
          method: 'GET',
          cache: 'no-store',
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
        });
        const payload = await readAdminResponse(response);
        if (requestId !== adminFormsRequestId) return;
        const submissions = payload && Array.isArray(payload.submissions) ? payload.submissions : [];
        collected.push(...submissions);
        hasMore = Boolean(payload && payload.pagination && payload.pagination.hasMore);
        page += 1;
        if (hasMore) setPanelStatus(elements.adminFormsStatus, `Wczytywanie zgłoszeń… ${collected.length}`, 'loading');
      } while (hasMore && page <= 100);
      if (hasMore) throw new Error('Lista zgłoszeń jest zbyt długa, aby wyświetlić ją w całości.');
      adminSubmissions = collected.map(normalizeAdminSubmission).filter((submission) => submission.id && submission.deleteToken);
      renderAdminSubmissions();
    } catch (error) {
      if (requestId !== adminFormsRequestId) return;
      adminSubmissions = [];
      elements.adminFormsEmpty.hidden = true;
      setPanelStatus(elements.adminFormsStatus, error && error.message ? error.message : 'Nie udało się wczytać zgłoszeń.', 'error');
    } finally {
      if (requestId !== adminFormsRequestId) return;
      elements.adminSubmissionList.setAttribute('aria-busy', 'false');
    }
  }

  async function deleteAdminSubmission(submission, button) {
    const person = String(submission.data.name || submission.data.email || '').trim();
    const suffix = person ? ` od ${person}` : '';
    if (!window.confirm(`Trwale usunąć to zgłoszenie${suffix}? Tej operacji nie można cofnąć.`)) return;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '…';
    try {
      const token = await getAdminToken();
      const response = await fetch(ADMIN_FORMS_URL, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ submissionId: submission.id, deleteToken: submission.deleteToken })
      });
      await readAdminResponse(response);
      adminSubmissions = adminSubmissions.filter((entry) => entry.id !== submission.id);
      renderAdminSubmissions();
      setPanelStatus(elements.adminFormsStatus, 'Zgłoszenie zostało trwale usunięte.', 'info');
    } catch (error) {
      setPanelStatus(elements.adminFormsStatus, error && error.message ? error.message : 'Nie udało się usunąć zgłoszenia.', 'error');
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function renderAdminDashboardPreview(content) {
    const model = parseMarkdown(content);
    const fragment = document.createDocumentFragment();
    const heading = document.createElement('h3');
    heading.textContent = model.title;
    const summary = document.createElement('p');
    const count = model.sections.reduce((sum, section) => sum + validDashboardItemCount(section), 0);
    summary.textContent = `${polishCountLabel(model.sections.length, 'dział', 'działy', 'działów')} · ${resourceLabel(count)}`;
    const sections = document.createElement('div');
    sections.className = 'admin-preview-sections';
    model.sections.forEach((section) => {
      const validCount = validDashboardItemCount(section);
      const card = document.createElement('div');
      card.className = 'admin-preview-section';
      const title = document.createElement('strong');
      title.textContent = section.title;
      const details = document.createElement('span');
      const groupLabel = section.groups && section.groups.length
        ? ` · ${polishCountLabel(section.groups.length, 'harmonijka', 'harmonijki', 'harmonijek')}`
        : '';
      details.textContent = `${resourceLabel(validCount)}${groupLabel}`;
      card.append(title, details);
      sections.append(card);
    });
    fragment.append(heading, summary, sections);
    elements.adminDashboardPreview.replaceChildren(fragment);
    return model;
  }

  function validDashboardItemCount(section) {
    const direct = (section.items || []).filter((item) => safeUrl(item.href)).length;
    const grouped = (section.groups || []).reduce(
      (sum, group) => sum + (group.items || []).filter((item) => safeUrl(item.href)).length,
      0
    );
    return direct + grouped;
  }

  function validateDashboardEditorContent(content) {
    const text = String(content || '').replace(/\r\n?/g, '\n').trim();
    if (!text) throw new Error('Dashboard nie może być pusty.');
    if (new TextEncoder().encode(text).byteLength > 256 * 1024) throw new Error('Dashboard jest zbyt duży.');
    const model = parseMarkdown(text);
    if (!model.sections.length) throw new Error('Dodaj co najmniej jeden dział rozpoczynający się od ##.');
    const cardCount = model.sections.reduce((sum, section) => sum + validDashboardItemCount(section), 0);
    if (!cardCount) throw new Error('Dodaj co najmniej jedną kartę materiału w wybranym dziale.');
    return { text, model };
  }

  function setAdminDashboardBusy(busy) {
    [
      elements.adminDashboardReload,
      elements.adminDashboardRestore,
      elements.adminDashboardPreviewButton,
      elements.adminDashboardSave
    ].forEach((button) => { if (button) button.disabled = Boolean(busy); });
    if (!busy) {
      elements.adminDashboardPreviewButton.disabled = !adminDashboardLoaded;
      elements.adminDashboardSave.disabled = !adminDashboardLoaded;
      elements.adminDashboardRestore.disabled = !adminDashboardLoaded || adminDashboardSourceKind !== 'blob';
    }
  }

  async function loadAdminDashboardEditor() {
    setAdminDashboardBusy(true);
    setPanelStatus(elements.adminDashboardStatus, 'Wczytywanie dashboardu…', 'loading');
    try {
      const token = await getAdminToken();
      const response = await fetch(ADMIN_DASHBOARD_URL, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
      });
      let content = '';
      if (response.status === 404) {
        content = await fetchStaticDashboard();
        adminDashboardEtag = null;
        adminDashboardSourceKind = 'static';
      } else {
        const payload = await readAdminResponse(response);
        if (payload && payload.source === 'static') {
          content = await fetchStaticDashboard();
          adminDashboardEtag = null;
          adminDashboardSourceKind = 'static';
        } else {
          if (!payload || typeof payload.content !== 'string') throw new Error('Serwer zwrócił nieprawidłową treść dashboardu.');
          content = payload.content;
          adminDashboardEtag = typeof payload.etag === 'string' ? payload.etag : null;
          adminDashboardSourceKind = 'blob';
        }
      }
      elements.adminDashboardSource.value = content;
      adminDashboardBaseline = content;
      adminDashboardLoaded = true;
      renderAdminDashboardPreview(content);
      setPanelStatus(
        elements.adminDashboardStatus,
        adminDashboardSourceKind === 'blob'
          ? 'Wczytano aktywną wersję zapisaną w Netlify.'
          : 'Aktywna jest wersja z pliku dashboard.md we wdrożeniu.',
        'info'
      );
    } catch (error) {
      adminDashboardLoaded = false;
      adminDashboardEtag = null;
      adminDashboardSourceKind = 'static';
      adminDashboardBaseline = '';
      elements.adminDashboardSource.value = '';
      elements.adminDashboardPreview.replaceChildren();
      setPanelStatus(elements.adminDashboardStatus, error && error.message ? error.message : 'Nie udało się wczytać dashboardu.', 'error');
    } finally {
      setAdminDashboardBusy(false);
    }
  }

  function previewAdminDashboard() {
    try {
      const { text } = validateDashboardEditorContent(elements.adminDashboardSource.value);
      renderAdminDashboardPreview(text);
      setPanelStatus(elements.adminDashboardStatus, 'Podgląd został odświeżony. Zmiany nie są jeszcze opublikowane.', 'info');
    } catch (error) {
      setPanelStatus(elements.adminDashboardStatus, error && error.message ? error.message : 'Nie można utworzyć podglądu.', 'error');
    }
  }

  async function saveAdminDashboard() {
    if (!adminDashboardLoaded) {
      setPanelStatus(elements.adminDashboardStatus, 'Najpierw wczytaj aktywny dashboard.', 'error');
      return;
    }
    let text;
    try {
      ({ text } = validateDashboardEditorContent(elements.adminDashboardSource.value));
    } catch (error) {
      setPanelStatus(elements.adminDashboardStatus, error.message, 'error');
      return;
    }
    setAdminDashboardBusy(true);
    setPanelStatus(elements.adminDashboardStatus, 'Publikowanie zmian…', 'loading');
    try {
      const token = await getAdminToken();
      const response = await fetch(ADMIN_DASHBOARD_URL, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: text, expectedEtag: adminDashboardEtag })
      });
      const payload = await readAdminResponse(response);
      adminDashboardEtag = payload && typeof payload.etag === 'string' ? payload.etag : adminDashboardEtag;
      adminDashboardSourceKind = 'blob';
      adminDashboardBaseline = text;
      elements.adminDashboardSource.value = text;
      renderAdminDashboardPreview(text);
      renderDashboard(parseMarkdown(text));
      setPanelStatus(elements.adminDashboardStatus, 'Dashboard został opublikowany i jest już widoczny dla kursantów.', 'info');
    } catch (error) {
      setPanelStatus(elements.adminDashboardStatus, error && error.message ? error.message : 'Nie udało się opublikować dashboardu.', 'error');
    } finally {
      setAdminDashboardBusy(false);
    }
  }

  async function restoreStaticDashboard() {
    if (!adminDashboardLoaded || adminDashboardSourceKind !== 'blob') return;
    if (!window.confirm('Przywrócić dashboard.md z ostatniego wdrożenia? Aktywna wersja zapisana w Netlify zostanie usunięta.')) return;
    setAdminDashboardBusy(true);
    setPanelStatus(elements.adminDashboardStatus, 'Przywracanie wersji z wdrożenia…', 'loading');
    try {
      const token = await getAdminToken();
      const response = await fetch(ADMIN_DASHBOARD_URL, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ expectedEtag: adminDashboardEtag })
      });
      await readAdminResponse(response);
      const content = await fetchStaticDashboard();
      adminDashboardEtag = null;
      adminDashboardSourceKind = 'static';
      adminDashboardBaseline = content;
      elements.adminDashboardSource.value = content;
      renderAdminDashboardPreview(content);
      renderDashboard(parseMarkdown(content));
      setPanelStatus(elements.adminDashboardStatus, 'Przywrócono dashboard.md z wdrożenia.', 'info');
    } catch (error) {
      setPanelStatus(elements.adminDashboardStatus, error && error.message ? error.message : 'Nie udało się przywrócić pliku.', 'error');
    } finally {
      setAdminDashboardBusy(false);
    }
  }

  function activateAdminTab(name, focusTab) {
    const allowed = new Set(['users', 'forms', 'dashboard']);
    const activeName = allowed.has(name) ? name : 'users';
    elements.adminTabs.forEach((tab) => {
      const active = tab.dataset.adminTab === activeName;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
      if (active && focusTab) tab.focus();
    });
    elements.adminPanels.forEach((panel) => { panel.hidden = panel.dataset.adminPanel !== activeName; });
    if (activeName === 'forms' && !adminFormsLoaded) loadAdminForms();
    if (activeName === 'dashboard' && !adminDashboardLoaded) loadAdminDashboardEditor();
  }

  function openAdminPanel(event) {
    const auth = window.ChemAuth;
    const identity = window.netlifyIdentity;
    const user = currentUser
      || (auth && typeof auth.getUser === 'function' ? auth.getUser() : null)
      || (identity && typeof identity.currentUser === 'function' ? identity.currentUser() : null);
    if (!isAdminUser(user)) return;
    lastAdminTrigger = event && event.currentTarget ? event.currentTarget : elements.adminButton;
    elements.adminSearch.value = '';
    if (typeof elements.adminDialog.showModal === 'function') elements.adminDialog.showModal();
    else elements.adminDialog.setAttribute('open', '');
    closeMenu();
    activateAdminTab('users', false);
    loadAdminUsers();
    window.setTimeout(() => elements.adminSearch.focus(), 0);
  }

  function closeAdminPanel() {
    if (typeof elements.adminDialog.close === 'function') elements.adminDialog.close();
    else elements.adminDialog.removeAttribute('open');
  }

  async function logout() {
    const auth = window.ChemAuth;
    const identity = window.netlifyIdentity;
    elements.logoutButton.disabled = true;
    elements.logoutButton.textContent = 'Wylogowywanie…';
    try {
      if (auth && typeof auth.logout === 'function') await auth.logout({ redirect: false });
      else if (identity && typeof identity.logout === 'function') await identity.logout();
    } catch (_) {
      // Przekierowanie poniżej czyści widok także przy chwilowym błędzie widgetu.
    }
    window.location.replace(LOGIN_URL);
  }

  function setupIdentity() {
    const auth = window.ChemAuth;
    const identity = window.netlifyIdentity;

    if (auth) {
      const syncContract = (profile) => {
        const user = typeof auth.getUser === 'function' ? auth.getUser() : null;
        updateProfileDisplay(user, profile || (typeof auth.getProfile === 'function' ? auth.getProfile() : null));
      };
      if (auth.ready && typeof auth.ready.then === 'function') {
        auth.ready.then((detail) => {
          if (detail && detail.authenticated) syncContract(detail.profile);
        }).catch(() => {});
      }
      window.addEventListener('chem-auth-profile-updated', (event) => {
        syncContract(event.detail && event.detail.profile);
      });
      window.addEventListener('chem-auth-user-changed', (event) => {
        if (event.detail && event.detail.authenticated) syncContract(event.detail.profile);
      });
      syncContract();
    }

    if (!identity) return;

    const syncUser = (user) => {
      if (user) updateProfileDisplay(user, auth && typeof auth.getProfile === 'function' ? auth.getProfile() : null);
    };
    try { identity.on('init', syncUser); } catch (_) {}
    try { identity.on('login', syncUser); } catch (_) {}
    try { identity.on('logout', () => window.location.replace(LOGIN_URL)); } catch (_) {}
    try { syncUser(identity.currentUser()); } catch (_) {}
  }

  function bindEvents() {
    if (elements.themeToggle) elements.themeToggle.addEventListener('click', toggleTheme);
    elements.menuButton.addEventListener('click', () => {
      if (elements.body.classList.contains('menu-open')) closeMenu();
      else openMenu();
    });
    elements.sidebarBackdrop.addEventListener('click', closeMenu);
    elements.search.addEventListener('input', filterResources);
    elements.clearSearch.addEventListener('click', () => {
      elements.search.value = '';
      filterResources();
      elements.search.focus();
    });
    elements.profileButtons.forEach((button) => button.addEventListener('click', openProfile));
    elements.profileClose.addEventListener('click', closeProfile);
    elements.profileCancel.addEventListener('click', closeProfile);
    elements.profileForm.addEventListener('submit', saveProfile);
    elements.logoutButton.addEventListener('click', logout);
    elements.adminButton.addEventListener('click', openAdminPanel);
    elements.adminClose.addEventListener('click', closeAdminPanel);
    elements.adminRefresh.addEventListener('click', loadAdminUsers);
    elements.adminSearch.addEventListener('input', renderAdminUsers);
    elements.adminInviteForm.addEventListener('submit', inviteAdminUser);
    elements.adminTabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activateAdminTab(tab.dataset.adminTab, false));
      tab.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        let nextIndex = index;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % elements.adminTabs.length;
        if (event.key === 'ArrowLeft') nextIndex = (index - 1 + elements.adminTabs.length) % elements.adminTabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = elements.adminTabs.length - 1;
        activateAdminTab(elements.adminTabs[nextIndex].dataset.adminTab, true);
      });
    });
    elements.adminFormsRefresh.addEventListener('click', loadAdminForms);
    elements.adminFormFilter.addEventListener('change', () => loadAdminSubmissions(elements.adminFormFilter.value));
    elements.adminDashboardReload.addEventListener('click', () => {
      const changed = adminDashboardLoaded && elements.adminDashboardSource.value !== adminDashboardBaseline;
      if (changed && !window.confirm('Odrzucić niezapisane zmiany i wczytać aktywny dashboard ponownie?')) return;
      loadAdminDashboardEditor();
    });
    elements.adminDashboardRestore.addEventListener('click', restoreStaticDashboard);
    elements.adminDashboardPreviewButton.addEventListener('click', previewAdminDashboard);
    elements.adminDashboardSave.addEventListener('click', saveAdminDashboard);
    elements.adminDashboardSource.addEventListener('input', () => {
      if (!adminDashboardLoaded) return;
      if (elements.adminDashboardSource.value === adminDashboardBaseline) {
        setPanelStatus(elements.adminDashboardStatus, 'Brak niezapisanych zmian.', 'info');
      } else {
        setPanelStatus(elements.adminDashboardStatus, 'Masz niezapisane zmiany.', 'info');
      }
    });

    elements.profileDialog.addEventListener('click', (event) => {
      if (event.target === elements.profileDialog) closeProfile();
    });
    elements.profileDialog.addEventListener('close', () => {
      if (lastProfileTrigger) lastProfileTrigger.focus();
    });
    elements.adminDialog.addEventListener('click', (event) => {
      if (event.target === elements.adminDialog) closeAdminPanel();
    });
    elements.adminDialog.addEventListener('close', () => {
      if (lastAdminTrigger) lastAdminTrigger.focus();
    });

    document.addEventListener('keydown', (event) => {
      const target = event.target;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
      if (event.key === '/' && !isTyping && !elements.profileDialog.open && !elements.adminDialog.open) {
        event.preventDefault();
        elements.search.focus();
      }
      if (event.key === 'Escape' && elements.body.classList.contains('menu-open')) closeMenu();
      if (event.key === 'Escape' && target === elements.search && elements.search.value) {
        elements.search.value = '';
        filterResources();
      }
    });
  }

  async function init() {
    initializeTheme();
    bindEvents();
    setupIdentity();
    const auth = window.ChemAuth;
    if (auth && auth.ready && typeof auth.ready.then === 'function') {
      try {
        const state = await auth.ready;
        if (state && state.available && (!state.authenticated || !state.session || !state.session.ok)) return;
      } catch (_) {
        // Ochrona brzegowa Netlify nadal zabezpiecza plik Markdown.
      }
    }
    loadDashboard();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
