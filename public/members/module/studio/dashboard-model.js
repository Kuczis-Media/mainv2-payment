(function exposeDashboardStudioModel(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChemDashboardStudioModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createDashboardStudioModel() {
  'use strict';

  const ADMIN_DASHBOARD_URL = '/.netlify/functions/admin-dashboard';
  const STATIC_DASHBOARD_URL = '/members/dashboard.md';
  const MAX_MARKDOWN_BYTES = 256 * 1024;
  const ZERO_WIDTH_GUARD = '\u200b';
  const REQUIRED_HELP_SECTION = [
    '## Pomoc i konto',
    '',
    'Zarządzaj dostępem albo skontaktuj się z prowadzącym.',
    '',
    '> Imię i nazwisko zmienisz po kliknięciu swojej karty konta w menu.',
    '',
    '- [Status dostępu](/time) — Sprawdź rolę i czas pozostały do końca dostępu.',
    '- [Napisz do nas](/members/module/contact/?internal=Wiadomo%C5%9B%C4%87%20z%20panelu%20kursanta) — Wyślij wiadomość bez opuszczania platformy.'
  ].join('\n');

  const PROTECTION_OPTIONS = deepFreeze({
    slides: [
      { value: '1', label: '1 — zwykły podgląd' },
      { value: '2', label: '2 — ograniczony interfejs' }
    ],
    pdf: [
      { value: '1', label: '1 — podgląd chroniony' },
      { value: '2', label: '2 — wymuszone pobranie' },
      { value: '3', label: '3 — zwykły podgląd' }
    ],
    film: [
      { value: '1', label: '1 — YouTube chroniony' },
      { value: '2', label: '2 — Google Drive' },
      { value: '3', label: '3 — YouTube, pełny odtwarzacz' }
    ]
  });

  const MODULE_ORDER = Object.freeze([
    'slides',
    'pdf',
    'film',
    'yt',
    'forms',
    'chat',
    'lesson',
    'calculator',
    'whiteboard',
    'contact',
    'atonom'
  ]);

  const MODULE_DEFINITIONS = deepFreeze({
    slides: {
      label: 'Prezentacja',
      icon: '▤',
      path: 'slides',
      idLabel: 'ID lub link prezentacji Google',
      protection: PROTECTION_OPTIONS.slides,
      defaultProtection: '1'
    },
    pdf: {
      label: 'Dokument PDF',
      icon: 'PDF',
      path: 'pdf',
      idLabel: 'ID lub link pliku Google Drive',
      protection: PROTECTION_OPTIONS.pdf,
      defaultProtection: '1'
    },
    film: {
      label: 'Film',
      icon: '▶',
      path: 'film',
      idLabel: 'ID lub link YouTube / Google Drive',
      protection: PROTECTION_OPTIONS.film,
      defaultProtection: '1'
    },
    yt: {
      label: 'Odtwarzacz YouTube',
      icon: '▶',
      path: 'yt',
      idLabel: 'ID lub link YouTube'
    },
    forms: {
      label: 'Formularz Google',
      icon: '✓',
      path: 'forms',
      idLabel: 'ID formularza Google'
    },
    chat: {
      label: 'Asystent AI',
      icon: '✦',
      path: 'chat',
      sourceOptions: [
        { value: 'prompt', label: 'Plik promptu JSON' },
        { value: 'file', label: 'Punkt z pliku TXT' }
      ]
    },
    lesson: {
      label: 'Lekcja interaktywna',
      icon: '◆',
      path: 'lesson',
      fileLabel: 'Nazwa pliku lekcji .md'
    },
    calculator: {
      label: 'Kalkulator',
      icon: '±',
      variants: [
        { value: 'kalkulator', label: 'Kalkulator naukowy' },
        { value: 'classic', label: 'Kalkulator klasyczny' }
      ],
      defaultVariant: 'kalkulator'
    },
    whiteboard: {
      label: 'Tablica',
      icon: '✎',
      variants: [
        { value: 'bitpaper', label: 'Tablica BitPaper' },
        { value: 'whiteboard', label: 'Biała tablica' }
      ],
      defaultVariant: 'whiteboard'
    },
    contact: {
      label: 'Kontakt',
      icon: '✉',
      path: 'contact',
      internalLabel: 'Wewnętrzna treść wiadomości'
    },
    atonom: {
      label: 'ATONOM',
      icon: '⚛',
      path: 'atonom',
      formulaLabel: 'Nazwa związku chemicznego'
    },
    link: {
      label: 'Własny link',
      icon: '↗'
    }
  });

  let uidSequence = 0;

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach((key) => deepFreeze(value[key]));
    return Object.freeze(value);
  }

  function hasOwn(value, key) {
    return Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
  }

  function stringValue(value) {
    return value == null ? '' : String(value);
  }

  function singleLine(value) {
    return stringValue(value)
      .replace(/\r\n?/g, '\n')
      .replace(/\s*\n+\s*/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  function cleanParsedText(value) {
    const text = singleLine(value);
    return text.startsWith(ZERO_WIDTH_GUARD) ? text.slice(1) : text;
  }

  function safeUid(value, prefix) {
    const candidate = singleLine(value);
    if (/^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/.test(candidate)) return candidate;
    uidSequence += 1;
    return `${prefix || 'node'}-${Date.now().toString(36)}-${uidSequence.toString(36)}`;
  }

  function clampLevel(value, fallback) {
    const number = Number(value);
    return Number.isInteger(number) && number >= 3 && number <= 6 ? number : fallback;
  }

  function createText(text, options) {
    return {
      kind: 'text',
      uid: safeUid(options && options.uid, 'text'),
      text: singleLine(text)
    };
  }

  function createNotice(text, options) {
    return {
      kind: 'notice',
      uid: safeUid(options && options.uid, 'notice'),
      text: singleLine(text)
    };
  }

  function canonicalModuleName(value, variant) {
    const name = singleLine(value).toLowerCase();
    if (name === 'filmv1') {
      return { module: 'film', variant: '' };
    }
    if (['calculator', 'calculators', 'kalkulator', 'classic'].includes(name)) {
      return {
        module: 'calculator',
        variant: ['kalkulator', 'classic'].includes(name) ? name : variant
      };
    }
    if (['whiteboard', 'whiteboards', 'bitpaper'].includes(name)) {
      return {
        module: 'whiteboard',
        variant: name === 'bitpaper'
          ? 'bitpaper'
          : name === 'whiteboard' && !variant ? 'whiteboard' : variant
      };
    }
    return {
      module: MODULE_DEFINITIONS[name] ? name : 'link',
      variant
    };
  }

  function allowedVariant(definition, value) {
    const variant = singleLine(value);
    const options = definition && Array.isArray(definition.variants) ? definition.variants : [];
    return options.some((option) => option.value === variant)
      ? variant
      : definition && definition.defaultVariant || '';
  }

  function allowedProtection(moduleName, value) {
    if (value == null || value === '') return null;
    const candidate = singleLine(value);
    const options = PROTECTION_OPTIONS[moduleName] || [];
    return options.some((option) => option.value === candidate) ? candidate : null;
  }

  function copyParams(value) {
    const result = {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
    Object.keys(value).forEach((key) => {
      const safeKey = singleLine(key);
      if (!safeKey) return;
      const entry = value[key];
      if (Array.isArray(entry)) {
        result[safeKey] = entry.map(singleLine).filter(Boolean);
      } else if (entry != null) {
        result[safeKey] = singleLine(entry);
      }
    });
    return result;
  }

  function createModule(input) {
    const source = input && typeof input === 'object' ? input : {};
    const canonical = canonicalModuleName(source.module || source.moduleType || 'link', source.variant);
    const definition = MODULE_DEFINITIONS[canonical.module];
    const hasProtection = hasOwn(source, 'protection') || hasOwn(source, 'type');
    const rawProtection = hasOwn(source, 'protection') ? source.protection : source.type;
    const protection = hasProtection
      ? allowedProtection(canonical.module, rawProtection)
      : definition.defaultProtection || null;
    const variant = definition.variants
      ? allowedVariant(definition, canonical.variant || source.variant)
      : '';
    const prompt = singleLine(source.prompt);
    const file = singleLine(source.file || source.plik);
    const point = singleLine(source.point || source.punkt);
    const repositoryId = singleLine(source.repositoryId || source.repo).toLowerCase();
    const sourceMode = source.source === 'file' || (!source.source && file)
      ? 'file'
      : 'prompt';

    return {
      kind: 'module',
      uid: safeUid(source.uid, 'module'),
      module: canonical.module,
      variant,
      title: singleLine(source.title) || definition.label,
      description: singleLine(source.description),
      id: singleLine(source.id || source.resourceId),
      protection,
      source: sourceMode,
      prompt,
      file,
      point,
      repositoryId,
      internal: singleLine(source.internal),
      formula: canonical.module === 'atonom' ? singleLine(source.formula) : '',
      href: singleLine(source.href),
      hash: singleLine(source.hash),
      params: copyParams(source.params)
    };
  }

  function canonicalBlockOrder(blocks) {
    const direct = [];
    const groups = [];
    blocks.forEach((block) => {
      (block && block.kind === 'group' ? groups : direct).push(block);
    });
    return direct.concat(groups);
  }

  function createGroup(input, parentLevel) {
    const source = typeof input === 'string' ? { title: input } : input || {};
    const fallbackLevel = Math.min(6, Math.max(3, Number(parentLevel || 2) + 1));
    const requestedLevel = clampLevel(source.level, fallbackLevel);
    const group = {
      kind: 'group',
      uid: safeUid(source.uid, 'group'),
      level: requestedLevel > Number(parentLevel || 2) ? requestedLevel : fallbackLevel,
      title: singleLine(source.title) || 'Nowa harmonijka',
      blocks: []
    };
    const sourceBlocks = Array.isArray(source.blocks)
      ? source.blocks
      : legacyContainerBlocks(source, group.level);
    group.blocks = canonicalBlockOrder(
      sourceBlocks
        .map((block) => normalizeBlock(block, group.level))
        .filter(Boolean)
    );
    return group;
  }

  function createSection(input) {
    const source = typeof input === 'string' ? { title: input } : input || {};
    const section = {
      kind: 'section',
      uid: safeUid(source.uid, 'section'),
      title: singleLine(source.title) || 'Nowy dział',
      blocks: []
    };
    const sourceBlocks = Array.isArray(source.blocks)
      ? source.blocks
      : legacyContainerBlocks(source, 2);
    section.blocks = canonicalBlockOrder(
      sourceBlocks
        .map((block) => normalizeBlock(block, 2))
        .filter(Boolean)
    );
    return section;
  }

  function createModel(input) {
    const source = input && typeof input === 'object' ? input : {};
    const rootBlocks = Array.isArray(source.blocks)
      ? source.blocks
      : [
          ...(Array.isArray(source.intro) ? source.intro.map((text) => ({ kind: 'text', text })) : []),
          ...(Array.isArray(source.notices) ? source.notices.map((text) => ({ kind: 'notice', text })) : [])
        ];
    return {
      kind: 'dashboard',
      version: 1,
      uid: safeUid(source.uid, 'dashboard'),
      title: singleLine(source.title) || 'Panel kursanta',
      blocks: rootBlocks
        .map((block) => normalizeBlock(block, 1))
        .filter((block) => block && (block.kind === 'text' || block.kind === 'notice')),
      sections: (Array.isArray(source.sections) ? source.sections : []).map(createSection)
    };
  }

  function legacyContainerBlocks(source, parentLevel) {
    const blocks = [];
    (Array.isArray(source.description) ? source.description : []).forEach((text) => {
      blocks.push({ kind: 'text', text });
    });
    (Array.isArray(source.notices) ? source.notices : []).forEach((text) => {
      blocks.push({ kind: 'notice', text });
    });
    (Array.isArray(source.items) ? source.items : []).forEach((item) => {
      const parsed = parseModuleHref(item && item.href);
      blocks.push({
        ...parsed,
        kind: 'module',
        title: item && item.title,
        description: item && item.description
      });
    });
    (Array.isArray(source.groups) ? source.groups : []).forEach((group) => {
      blocks.push({
        ...group,
        kind: 'group',
        level: clampLevel(group && group.level, Math.min(6, parentLevel + 1))
      });
    });
    return blocks;
  }

  function normalizeBlock(block, parentLevel) {
    if (typeof block === 'string') return createText(block);
    if (!block || typeof block !== 'object') return null;
    const kind = singleLine(block.kind || block.blockType).toLowerCase();
    if (kind === 'text') return createText(block.text, block);
    if (kind === 'notice' || kind === 'note') return createNotice(block.text, block);
    if (kind === 'group' || kind === 'accordion') return createGroup(block, parentLevel);
    if (kind === 'module' || kind === 'card' || block.href || block.module) return createModule(block);
    return null;
  }

  function normalizeModel(model) {
    return createModel(model);
  }

  function parseModuleHref(rawHref) {
    const href = singleLine(rawHref);
    const fallback = {
      module: 'link',
      href,
      variant: '',
      id: '',
      protection: null,
      source: 'prompt',
      prompt: '',
      file: '',
      point: '',
      repositoryId: '',
      internal: '',
      formula: '',
      hash: '',
      params: {}
    };
    if (!href) return fallback;

    let url;
    try {
      url = new URL(href, 'https://dashboard-studio.invalid');
    } catch (_) {
      return fallback;
    }
    const isInternal = href.startsWith('/') || url.origin === 'https://dashboard-studio.invalid';
    if (!isInternal) return fallback;
    const match = url.pathname.match(/^\/members\/module\/([^/]+)\/?$/i);
    if (!match) return fallback;

    let pathModule;
    try {
      pathModule = decodeURIComponent(match[1]).toLowerCase();
    } catch (_) {
      return fallback;
    }
    const canonical = canonicalModuleName(pathModule);
    if (canonical.module === 'link') return fallback;

    const knownKeys = new Set();
    const take = (key) => {
      knownKeys.add(key);
      return singleLine(url.searchParams.get(key));
    };
    const parsed = {
      ...fallback,
      module: canonical.module,
      href: '',
      variant: canonical.variant || '',
      hash: url.hash
    };

    if (['slides', 'pdf', 'film', 'yt', 'forms'].includes(parsed.module)) {
      parsed.id = take('id');
    }
    if (PROTECTION_OPTIONS[parsed.module]) {
      parsed.protection = allowedProtection(parsed.module, take('type'));
    }
    if (parsed.module === 'chat') {
      parsed.repositoryId = take('repo').toLowerCase();
      parsed.prompt = take('prompt');
      parsed.file = take('plik');
      parsed.point = take('punkt');
      parsed.source = parsed.file ? 'file' : 'prompt';
    }
    if (parsed.module === 'lesson') {
      parsed.repositoryId = take('repo').toLowerCase();
      parsed.file = take('file');
    }
    if (parsed.module === 'contact') parsed.internal = take('internal');
    if (parsed.module === 'atonom') parsed.formula = take('formula');

    url.searchParams.forEach((value, key) => {
      if (knownKeys.has(key)) return;
      if (hasOwn(parsed.params, key)) {
        const current = parsed.params[key];
        parsed.params[key] = Array.isArray(current) ? [...current, value] : [current, value];
      } else {
        parsed.params[key] = value;
      }
    });
    return parsed;
  }

  function queryPart(key, value) {
    return `${encodeURIComponent(key)}=${encodeURIComponent(singleLine(value))}`;
  }

  function moduleHref(moduleCard) {
    const card = createModule(moduleCard);
    if (card.module === 'link') return card.href || '#';
    const definition = MODULE_DEFINITIONS[card.module];
    const pathName = definition.path || card.variant || definition.defaultVariant;
    const parts = [];
    const reserved = new Set();
    const add = (key, value) => {
      reserved.add(key);
      if (value != null && singleLine(value)) parts.push(queryPart(key, value));
    };

    if (['slides', 'pdf', 'film', 'yt', 'forms'].includes(card.module)) {
      add('id', card.id);
    }
    if (PROTECTION_OPTIONS[card.module]) add('type', card.protection);
    if (card.module === 'chat') {
      add('repo', card.repositoryId);
      if (card.source === 'file') {
        add('plik', card.file);
        add('punkt', card.point);
      } else {
        add('prompt', card.prompt);
      }
    }
    if (card.module === 'lesson') {
      add('repo', card.repositoryId);
      add('file', card.file);
    }
    if (card.module === 'contact') add('internal', card.internal);
    if (card.module === 'atonom') add('formula', card.formula);

    Object.keys(card.params).forEach((key) => {
      if (reserved.has(key)) return;
      const values = Array.isArray(card.params[key]) ? card.params[key] : [card.params[key]];
      values.forEach((value) => add(key, value));
    });
    const query = parts.length ? `?${parts.join('&')}` : '';
    const hash = card.hash ? (card.hash.startsWith('#') ? card.hash : `#${card.hash}`) : '';
    return `/members/module/${pathName}/${query}${hash}`;
  }

  function parseMarkdown(source) {
    const model = createModel();
    model.blocks = [];
    model.sections = [];
    let currentSection = null;
    let currentGroup = null;
    let groupStack = [];
    let insideComment = false;

    stringValue(source).replace(/\r\n?/g, '\n').split('\n').forEach((rawLine) => {
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
        currentSection = createSection({ title: sectionMatch[1] });
        currentGroup = null;
        groupStack = [];
        model.sections.push(currentSection);
        return;
      }

      const groupMatch = line.match(/^(#{3,6})\s+(.+)$/);
      if (groupMatch && currentSection) {
        const level = groupMatch[1].length;
        const group = createGroup({ level, title: groupMatch[2] }, level - 1);
        while (groupStack.length && groupStack[groupStack.length - 1].level >= level) {
          groupStack.pop();
        }
        const parent = groupStack[groupStack.length - 1] || null;
        (parent ? parent.blocks : currentSection.blocks).push(group);
        groupStack.push(group);
        currentGroup = group;
        return;
      }

      const titleMatch = line.match(/^#\s+(.+)$/);
      if (titleMatch) {
        model.title = singleLine(titleMatch[1]);
        return;
      }

      const noticeMatch = line.match(/^>\s*(.+)$/);
      if (noticeMatch) {
        const target = currentGroup
          ? currentGroup.blocks
          : currentSection ? currentSection.blocks : model.blocks;
        target.push(createNotice(cleanParsedText(noticeMatch[1])));
        return;
      }

      const linkMatch = line.match(/^[-*]\s+\[([^\]]+)]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)\s*(?:(?:—|–|-|:)\s*(.*))?$/);
      if (linkMatch && currentSection) {
        const target = currentGroup ? currentGroup.blocks : currentSection.blocks;
        target.push(createModule({
          ...parseModuleHref(linkMatch[2]),
          title: linkMatch[1],
          description: linkMatch[3] || ''
        }));
        return;
      }

      const cleanLine = cleanParsedText(line.replace(/^#{3,6}\s+/, ''));
      const target = currentGroup
        ? currentGroup.blocks
        : currentSection ? currentSection.blocks : model.blocks;
      target.push(createText(cleanLine));
    });
    return model;
  }

  function safeHeading(value, fallback) {
    return singleLine(value).replace(/[\u0000\u000b\u000c]/g, '') || fallback;
  }

  function safeTextLine(value) {
    const line = singleLine(value).replace(/[\u0000\u000b\u000c]/g, '');
    return /^(?:<!--|#{1,6}\s|>\s*|[-*]\s+\[)/.test(line)
      ? `${ZERO_WIDTH_GUARD}${line}`
      : line;
  }

  function safeLinkTitle(value) {
    return safeHeading(value, 'Materiał').replace(/[\[\]]/g, '');
  }

  function serializeBlock(block) {
    if (block.kind === 'text') return safeTextLine(block.text);
    if (block.kind === 'notice') return `> ${singleLine(block.text)}`;
    if (block.kind === 'module') {
      const description = singleLine(block.description);
      return `- [${safeLinkTitle(block.title)}](${moduleHref(block)})${description ? ` — ${description}` : ''}`;
    }
    return '';
  }

  function serializeContainer(container, level) {
    const heading = `${'#'.repeat(level)} ${safeHeading(container.title, level === 2 ? 'Nowy dział' : 'Nowa harmonijka')}`;
    const ownBlocks = container.blocks.filter((block) => block.kind !== 'group');
    const childGroups = container.blocks.filter((block) => block.kind === 'group');
    const lines = [heading];
    const ownLines = ownBlocks.map(serializeBlock).filter(Boolean);
    if (ownLines.length) lines.push('', ...ownLines);
    childGroups.forEach((group) => {
      lines.push('', ...serializeContainer(group, clampLevel(group.level, Math.min(6, level + 1))));
    });
    return lines;
  }

  function serialize(model, options) {
    const normalized = normalizeModel(model);
    const lines = [`# ${safeHeading(normalized.title, 'Panel kursanta')}`];
    const rootLines = normalized.blocks.map(serializeBlock).filter(Boolean);
    if (rootLines.length) lines.push('', ...rootLines);
    normalized.sections.forEach((section) => {
      lines.push('', ...serializeContainer(section, 2));
    });
    let markdown = `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
    if (options && options.ensureRequiredHelp) {
      markdown = `${ensureRequiredHelpSection(markdown)}\n`;
    }
    return markdown;
  }

  function groupToDashboardModel(group) {
    const result = {
      level: group.level,
      title: group.title,
      description: [],
      notices: [],
      items: [],
      groups: []
    };
    group.blocks.forEach((block) => {
      if (block.kind === 'text') result.description.push(block.text);
      else if (block.kind === 'notice') result.notices.push(block.text);
      else if (block.kind === 'module') {
        result.items.push({
          title: block.title,
          href: moduleHref(block),
          description: block.description
        });
      } else if (block.kind === 'group') {
        result.groups.push(groupToDashboardModel(block));
      }
    });
    return result;
  }

  function sectionToDashboardModel(section) {
    const result = {
      title: section.title,
      description: [],
      notices: [],
      items: [],
      groups: []
    };
    section.blocks.forEach((block) => {
      if (block.kind === 'text') result.description.push(block.text);
      else if (block.kind === 'notice') result.notices.push(block.text);
      else if (block.kind === 'module') {
        result.items.push({
          title: block.title,
          href: moduleHref(block),
          description: block.description
        });
      } else if (block.kind === 'group') {
        result.groups.push(groupToDashboardModel(block));
      }
    });
    return result;
  }

  function toDashboardModel(model) {
    const normalized = normalizeModel(model);
    return {
      title: normalized.title,
      intro: normalized.blocks.filter((block) => block.kind === 'text').map((block) => block.text),
      notices: normalized.blocks.filter((block) => block.kind === 'notice').map((block) => block.text),
      sections: normalized.sections.map(sectionToDashboardModel)
    };
  }

  function ensureRequiredHelpSection(content) {
    const text = stringValue(content).replace(/\r\n?/g, '\n').trim();
    if (!text) return text;
    const visibleText = text.replace(/<!--[\s\S]*?-->/g, '');
    return /^##[ \t]+Pomoc i konto[ \t]*$/im.test(visibleText)
      ? text
      : `${text}\n\n${REQUIRED_HELP_SECTION}`;
  }

  function utf8ByteLength(value) {
    const text = stringValue(value);
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).byteLength;
    return unescape(encodeURIComponent(text)).length;
  }

  function safeResourceReference(value, moduleName, protection) {
    const reference = singleLine(value);
    if (
      !reference
      || reference.length > 2_048
      || /[\u0000-\u0020()\\]/.test(reference)
    ) return false;
    const module = singleLine(moduleName).toLowerCase();
    const idPattern = /^[A-Za-z0-9_-]{10,200}$/;
    const youtubeIdPattern = /^[A-Za-z0-9_-]{11}$/;
    const expectsYouTube = ['yt', 'film'].includes(module) && String(protection) !== '2';
    if (idPattern.test(reference)) {
      return expectsYouTube ? youtubeIdPattern.test(reference) : true;
    }
    try {
      const url = new URL(reference);
      if (url.protocol !== 'https:' || !url.hostname) return false;
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      const path = url.pathname;
      const driveHosts = ['drive.google.com', 'docs.google.com'];
      const youtubeHosts = [
        'youtu.be',
        'youtube.com',
        'm.youtube.com',
        'music.youtube.com',
        'youtube-nocookie.com'
      ];
      const pathId = path.match(
        /\/(?:file|document|presentation|spreadsheets)(?:\/u\/\d+)?\/d\/(?:e\/)?([A-Za-z0-9_-]{10,200})(?:\/|$)/i
      );
      const queryId = url.searchParams.get('id') || '';
      const hasDriveId = Boolean(
        driveHosts.includes(host)
        && (
          (pathId && idPattern.test(pathId[1]))
          || idPattern.test(queryId)
        )
      );
      const youtubeCandidate = host === 'youtu.be'
        ? path.split('/').filter(Boolean)[0] || ''
        : url.searchParams.get('v')
          || (path.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})(?:\/|$)/i) || [])[1]
          || '';
      const hasYouTubeId = youtubeHosts.includes(host) && youtubeIdPattern.test(youtubeCandidate);

      if (module === 'slides') {
        return hasDriveId && (
          host === 'drive.google.com'
          || /^\/presentation(?:\/u\/\d+)?\/d\/(?:e\/)?/i.test(path)
        );
      }
      if (module === 'pdf') return hasDriveId;
      if (module === 'film') {
        return String(protection) === '2' ? hasDriveId : hasYouTubeId;
      }
      if (module === 'yt') return hasYouTubeId;
      if (module === 'forms') {
        if (host === 'forms.gle') return path.split('/').filter(Boolean).length > 0;
        const formId = path.match(/^\/forms\/d\/(?:e\/)?([A-Za-z0-9_-]{10,200})(?:\/|$)/i);
        return host === 'docs.google.com' && Boolean(formId && idPattern.test(formId[1]));
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function safeBuilderFilename(value, extension) {
    const filename = singleLine(value);
    if (!filename || filename.length > 80 || filename.includes('..')) return false;
    return new RegExp(`^[A-Za-z0-9][A-Za-z0-9_.-]*\\.${extension}$`, 'i').test(filename);
  }

  function safeRepositoryId(value) {
    const repositoryId = singleLine(value).toLowerCase();
    return !repositoryId || /^[a-z0-9][a-z0-9-]{0,39}$/.test(repositoryId);
  }

  function safeBuilderLink(value) {
    const href = singleLine(value);
    if (!href || href.length > 2_048 || /[\u0000-\u0020()\\]/.test(href)) return false;
    if (/^\/(?!\/)/.test(href)) return true;
    try {
      const url = new URL(href);
      return url.protocol === 'https:' && Boolean(url.hostname);
    } catch (_) {
      return false;
    }
  }

  function validate(model) {
    const normalized = normalizeModel(model);
    const errors = [];
    const warnings = [];
    const addError = (code, message, node) => {
      errors.push({ code, message, uid: node && node.uid || null });
    };
    if (!normalized.sections.length) {
      addError('SECTION_REQUIRED', 'Dodaj co najmniej jeden dział.', normalized);
    }
    let moduleCount = 0;

    const inspectBlocks = (blocks) => {
      blocks.forEach((block) => {
        if (block.kind === 'group') {
          if (!singleLine(block.title)) addError('GROUP_TITLE_REQUIRED', 'Harmonijka wymaga tytułu.', block);
          inspectBlocks(block.blocks);
          return;
        }
        if (block.kind !== 'module') return;
        moduleCount += 1;
        if (!singleLine(block.title)) addError('MODULE_TITLE_REQUIRED', 'Karta wymaga tytułu.', block);
        if (
          ['slides', 'pdf', 'film', 'yt', 'forms'].includes(block.module)
          && !safeResourceReference(block.id, block.module, block.protection)
        ) {
          addError('MODULE_ID_REQUIRED', 'Podaj prawidłowe ID albo pełny link HTTPS do materiału.', block);
        }
        if (PROTECTION_OPTIONS[block.module] && !allowedProtection(block.module, block.protection)) {
          addError('PROTECTION_REQUIRED', 'Wybierz prawidłowy typ ochrony.', block);
        }
        if (block.module === 'lesson' && !safeBuilderFilename(block.file, 'md')) {
          addError('LESSON_FILE_REQUIRED', 'Podaj bezpieczną nazwę pliku lekcji zakończoną przez .md.', block);
        }
        if (['lesson', 'chat'].includes(block.module) && !safeRepositoryId(block.repositoryId)) {
          addError('CONTENT_REPOSITORY_INVALID', 'Wybierz poprawne repozytorium materiałów.', block);
        }
        if (block.module === 'chat') {
          if (block.source === 'file') {
            if (!safeBuilderFilename(block.file, 'txt')) {
              addError('CHAT_FILE_REQUIRED', 'Podaj bezpieczną nazwę pliku zakończoną przez .txt.', block);
            }
            if (!/^[1-9]\d{0,3}$/.test(block.point)) {
              addError('CHAT_POINT_REQUIRED', 'Podaj numer punktu od 1 do 9999.', block);
            }
          } else if (!safeBuilderFilename(block.prompt, 'json')) {
            addError('CHAT_PROMPT_REQUIRED', 'Podaj bezpieczną nazwę pliku promptu zakończoną przez .json.', block);
          }
        }
        if (block.module === 'contact' && block.internal.length > 240) {
          addError('CONTACT_TOO_LONG', 'Wstępna treść kontaktu może mieć maksymalnie 240 znaków.', block);
        }
        if (
          block.module === 'atonom'
          && block.formula
          && (
            block.formula.length > 140
            || /[\u0000-\u001f<>\\]/.test(block.formula)
          )
        ) {
          addError('ATONOM_FORMULA_INVALID', 'Nazwa związku dla modelu ATONOM jest nieprawidłowa.', block);
        }
        if (block.module === 'link' && !safeBuilderLink(block.href)) {
          addError('LINK_REQUIRED', 'Podaj ścieżkę wewnętrzną /… albo pełny adres HTTPS.', block);
        }
      });
    };

    normalized.sections.forEach((section) => {
      if (!singleLine(section.title)) addError('SECTION_TITLE_REQUIRED', 'Dział wymaga tytułu.', section);
      inspectBlocks(section.blocks);
    });
    if (!moduleCount) addError('MODULE_REQUIRED', 'Dodaj co najmniej jedną kartę materiału.', normalized);

    const markdown = serialize(normalized, { ensureRequiredHelp: true });
    if (/[\u0000\u000b\u000c]/.test(markdown)) {
      addError('INVALID_MARKDOWN', 'Treść zawiera niedozwolone znaki.', normalized);
    }
    const bytes = utf8ByteLength(markdown);
    if (bytes > MAX_MARKDOWN_BYTES) {
      addError('MARKDOWN_TOO_LARGE', 'Dashboard przekracza limit 256 KB.', normalized);
    } else if (bytes > MAX_MARKDOWN_BYTES * 0.9) {
      warnings.push({
        code: 'MARKDOWN_NEAR_LIMIT',
        message: 'Dashboard zbliża się do limitu 256 KB.',
        uid: normalized.uid
      });
    }
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      markdown,
      bytes,
      moduleCount,
      sectionCount: normalized.sections.length
    };
  }

  function createPublishPayload(model, expectedEtag) {
    if (expectedEtag !== null && (
      typeof expectedEtag !== 'string' ||
      !expectedEtag ||
      expectedEtag.length > 512 ||
      /[\u0000-\u001f\u007f]/.test(expectedEtag)
    )) {
      throw new TypeError('expectedEtag musi być wartością null albo prawidłowym ETagiem.');
    }
    const result = validate(model);
    if (!result.valid) {
      const error = new Error(result.errors[0].message);
      error.name = 'DashboardValidationError';
      error.code = result.errors[0].code;
      error.validation = result;
      throw error;
    }
    return { content: result.markdown.trim(), expectedEtag };
  }

  function findNode(model, uid) {
    if (!model || !uid) return null;
    if (model.uid === uid) return { node: model, parent: null, container: null, index: -1 };
    const visitBlocks = (parent) => {
      for (let index = 0; index < parent.blocks.length; index += 1) {
        const node = parent.blocks[index];
        if (node.uid === uid) return { node, parent, container: parent.blocks, index };
        if (node.kind === 'group') {
          const nested = visitBlocks(node);
          if (nested) return nested;
        }
      }
      return null;
    };
    for (let index = 0; index < (model.sections || []).length; index += 1) {
      const section = model.sections[index];
      if (section.uid === uid) {
        return { node: section, parent: model, container: model.sections, index };
      }
      const nested = visitBlocks(section);
      if (nested) return nested;
    }
    return null;
  }

  function containsUid(node, uid) {
    if (!node || !uid) return false;
    if (node.uid === uid) return true;
    return Array.isArray(node.blocks) && node.blocks.some((child) => containsUid(child, uid));
  }

  function insertNode(model, parentUid, inputNode, index) {
    const node = inputNode && inputNode.kind === 'section'
      ? createSection(inputNode)
      : normalizeBlock(inputNode, 2);
    if (!node) return null;
    let target;
    let targetParent;
    if (!parentUid || parentUid === model.uid) {
      if (node.kind !== 'section') return null;
      target = model.sections;
      targetParent = model;
    } else {
      const found = findNode(model, parentUid);
      if (!found || !['section', 'group'].includes(found.node.kind) || node.kind === 'section') return null;
      if (containsUid(node, parentUid)) return null;
      target = found.node.blocks;
      targetParent = found.node;
      if (node.kind === 'group') {
        const nextLevel = targetParent.kind === 'section' ? 3 : targetParent.level + 1;
        if (!relevelGroup(node, nextLevel)) return null;
      }
    }
    let position = Number.isInteger(index)
      ? Math.max(0, Math.min(index, target.length))
      : target.length;
    if (targetParent.kind === 'section' || targetParent.kind === 'group') {
      const groupBoundary = target.findIndex((entry) => entry.kind === 'group');
      const firstGroup = groupBoundary < 0 ? target.length : groupBoundary;
      position = node.kind === 'group'
        ? Math.max(firstGroup, position)
        : Math.min(firstGroup, position);
    }
    target.splice(position, 0, node);
    return node;
  }

  function relevelGroup(group, nextLevel) {
    const delta = nextLevel - group.level;
    let valid = true;
    const visit = (node) => {
      const level = node.level + delta;
      if (level < 3 || level > 6) {
        valid = false;
        return;
      }
      node.level = level;
      node.blocks.filter((block) => block.kind === 'group').forEach(visit);
    };
    visit(group);
    return valid;
  }

  function removeNode(model, uid) {
    const found = findNode(model, uid);
    if (!found || !found.container) return null;
    return found.container.splice(found.index, 1)[0] || null;
  }

  function moveNode(model, uid, parentUid, index) {
    const found = findNode(model, uid);
    if (!found || !found.container || containsUid(found.node, parentUid)) return false;
    const originalParentUid = found.parent && found.parent.uid;
    const originalIndex = found.index;
    const removed = found.container.splice(found.index, 1)[0];
    const adjustedIndex = found.parent && found.parent.uid === parentUid &&
      Number.isInteger(index) && index > originalIndex
      ? index - 1
      : index;
    const inserted = insertNode(model, parentUid, removed, adjustedIndex);
    if (inserted) return true;
    insertNode(model, originalParentUid, removed, originalIndex);
    return false;
  }

  return Object.freeze({
    ADMIN_DASHBOARD_URL,
    MAX_MARKDOWN_BYTES,
    MODULE_DEFINITIONS,
    MODULE_ORDER,
    PROTECTION_OPTIONS,
    REQUIRED_HELP_SECTION,
    STATIC_DASHBOARD_URL,
    createGroup,
    createModel,
    createModule,
    createNotice,
    createPublishPayload,
    createSection,
    createText,
    ensureRequiredHelpSection,
    findNode,
    insertNode,
    moduleHref,
    moveNode,
    normalizeModel,
    parseMarkdown,
    parseModuleHref,
    removeNode,
    serialize,
    toDashboardModel,
    validate
  });
});
