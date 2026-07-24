(function (root) {
  'use strict';

  const SCHEMA_VERSION = 1;
  const MAX_SOURCE_CHARS = 512 * 1024;
  const MAX_SLIDES = 100;
  const SAFE_FILENAME = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9_.-]{0,79}\.md$/i;
  const TASK_START = /^\s*:::(?:task|zadanie)\s*$/i;
  const QUESTION_START = /^\s*:::question\s*$/i;
  const SLIDE_SETTINGS_START = /^\s*:::slide\s*$/i;
  const CONTAINER_START = /^\s*:::(style|accordion|youtube|atonom|formula|linkcard|flashcards)(?:\s+(.*?))?\s*$/i;
  const CONTAINER_END = /^\s*:::\s*$/;
  const STYLE_FONTS = Object.freeze([
    'sans',
    'arial',
    'verdana',
    'serif',
    'georgia',
    'times',
    'rounded',
    'mono',
    'courier'
  ]);
  const STYLE_SIZES = Object.freeze(['small', 'normal', 'large', 'xlarge']);
  const STYLE_ALIGNS = Object.freeze(['left', 'center', 'right']);
  const STYLE_COLOR = /^#[0-9a-f]{6}$/i;
  const LINK_ICONS = Object.freeze(['link', 'book', 'video', 'chemistry', 'math', 'file', 'external']);
  const SLIDE_TRANSITIONS = Object.freeze(['none', 'fade', 'rise', 'slide', 'zoom']);
  const FORMULA_ARROWS = Object.freeze(['', '->', '<-', '<->', '<=>', '<=>>', '<<=>']);
  const SAFE_MATH_COMMANDS = new Set([
    'alpha', 'beta', 'gamma', 'delta', 'Delta', 'theta', 'lambda', 'mu', 'pi', 'rho', 'sigma',
    'omega', 'Omega', 'cdot', 'times', 'div', 'pm', 'mp', 'approx', 'neq', 'le', 'leq', 'ge',
    'geq', 'infty', 'frac', 'sqrt', 'sum', 'prod', 'int', 'oint', 'lim', 'min', 'max',
    'sin', 'cos', 'tan', 'log', 'ln', 'partial', 'nabla', 'rightarrow', 'leftarrow',
    'leftrightarrow', 'text', 'mathrm', 'mathbf', 'overline', 'vec', 'left', 'right'
  ]);
  const BLOCK_TYPES = Object.freeze([
    'heading',
    'text',
    'list',
    'image',
    'quote',
    'callout',
    'code',
    'style',
    'accordion',
    'youtube',
    'atonom',
    'formula',
    'link',
    'flashcards'
  ]);
  const TASK_TYPES = Object.freeze(['text', 'number', 'choice', 'abcd', 'gaps', 'gaps-text']);

  let idSequence = 0;

  class StudioLessonError extends Error {
    constructor(code, message, path) {
      super(message || code);
      this.name = 'StudioLessonError';
      this.code = code;
      this.path = path || '';
    }
  }

  function nextId(prefix) {
    idSequence += 1;
    return `${prefix}-${idSequence.toString(36)}`;
  }

  function normalizeNewlines(value) {
    return String(value ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\0/g, '');
  }

  function oneLine(value) {
    return normalizeNewlines(value).replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function normalizeKey(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
  }

  function validateFilename(value) {
    const filename = oneLine(value);
    return SAFE_FILENAME.test(filename) ? filename : '';
  }

  function slugify(value) {
    const slug = String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70);
    return `${slug || 'nowa-lekcja'}.md`;
  }

  function safeImageUrl(value) {
    const raw = oneLine(value);
    if (
      !raw
      || raw.startsWith('//')
      || raw.includes('\\')
      || /[\u0000-\u0020<>()]/.test(raw)
    ) return '';
    return /^https:\/\/[^\s]+$/i.test(raw) ? raw : '';
  }

  function safeLinkUrl(value) {
    const raw = oneLine(value);
    if (
      !raw
      || raw.startsWith('//')
      || raw.includes('\\')
      || /[\u0000-\u0020<>"'`]/.test(raw)
    ) return '';
    if (raw.startsWith('/') || raw.startsWith('#')) return raw;
    return /^(?:https?:\/\/|mailto:)[^\s]+$/i.test(raw) ? raw : '';
  }

  function youtubeVideoId(value) {
    const raw = oneLine(value);
    if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
    try {
      const url = new URL(raw);
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      if (!['youtu.be', 'youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)) return '';
      const candidate = host === 'youtu.be'
        ? url.pathname.split('/').filter(Boolean)[0] || ''
        : url.searchParams.get('v')
          || (url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})(?:\/|$)/) || [])[1]
          || '';
      return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : '';
    } catch (_) {
      return '';
    }
  }

  function safeAtonomFormula(value) {
    const formula = oneLine(value);
    return formula && formula.length <= 140 && !/[\u0000-\u001f<>\\]/.test(formula)
      ? formula
      : '';
  }

  function cleanDirectiveValue(value) {
    return oneLine(value).replace(/:::/g, '').slice(0, 500);
  }

  function migrateRemovedModuleLinks(value) {
    return String(value || '')
      .replace(/\/members\/module\/filmv1(?=\/(?:[?#]|$))/gi, '/members/module/film');
  }

  function cleanInline(value) {
    return oneLine(migrateRemovedModuleLinks(value)).replace(/\]/g, '').replace(/\r|\n/g, '');
  }

  function protectStructuralLines(value) {
    return normalizeNewlines(migrateRemovedModuleLinks(value))
      .split('\n')
      .map((line) => {
        if (/^\s*---\s*$/.test(line)) return '`---`';
        if (/^\s*:::(?:task|zadanie|question|slide|style|accordion|youtube|atonom|formula|linkcard|flashcards)?(?:\s+.*?)?\s*$/i.test(line)) {
          return `\`${line.trim()}\``;
        }
        return line.replace(/\s+$/g, '');
      })
      .join('\n')
      .trim();
  }

  function normalizeStyle(value) {
    const source = value && typeof value === 'object' ? value : {};
    const requestedFont = oneLine(source.font).toLowerCase();
    const requestedSize = oneLine(source.size).toLowerCase();
    const requestedAlign = oneLine(source.align).toLowerCase();
    const font = STYLE_FONTS.includes(requestedFont) ? requestedFont : 'sans';
    const size = STYLE_SIZES.includes(requestedSize) ? requestedSize : 'normal';
    const align = STYLE_ALIGNS.includes(requestedAlign) ? requestedAlign : 'left';
    const bold = source.bold === true || /^(?:1|true|yes|tak|bold|700)$/i.test(oneLine(source.bold));
    const color = STYLE_COLOR.test(String(source.color || '')) ? String(source.color).toLowerCase() : '';
    const background = STYLE_COLOR.test(String(source.background || ''))
      ? String(source.background).toLowerCase()
      : '';
    return { font, color, background, size, align, bold };
  }

  function safeChemistryText(value, condition) {
    const text = oneLine(value);
    if (!text || text.length > (condition ? 120 : 300)) return '';
    const forbidden = condition ? /[\\{}[\]$%#&<>]/ : /[\\$%#&<>]/;
    if (forbidden.test(text)) return '';
    if (!condition) {
      let depth = 0;
      for (const character of text) {
        if (character === '{') depth += 1;
        else if (character === '}') depth -= 1;
        if (depth < 0 || depth > 6) return '';
      }
      if (depth !== 0) return '';
    }
    return text;
  }

  function safeMathExpression(value) {
    const expression = oneLine(value);
    if (!expression || expression.length > 500 || /[$%#&<>]/.test(expression)) return '';
    let depth = 0;
    for (const character of expression) {
      if (character === '{') depth += 1;
      else if (character === '}') depth -= 1;
      if (depth < 0 || depth > 12) return '';
    }
    if (depth !== 0) return '';
    const commands = expression.match(/\\[A-Za-z]+/g) || [];
    if (commands.some((command) => !SAFE_MATH_COMMANDS.has(command.slice(1)))) return '';
    return expression;
  }

  function createBlock(typeOrSeed, maybeSeed) {
    const source = typeof typeOrSeed === 'string'
      ? { ...(maybeSeed || {}), type: typeOrSeed }
      : { ...(typeOrSeed || {}) };
    const type = String(source.type || 'text').toLowerCase();
    if (!BLOCK_TYPES.includes(type)) {
      throw new StudioLessonError('UNKNOWN_BLOCK', `Nieznany typ bloku: ${type}.`, 'block.type');
    }

    const base = { id: oneLine(source.id) || nextId('block'), type };
    if (type === 'heading') {
      return { ...base, level: Math.min(3, Math.max(1, Number(source.level) || 2)), text: oneLine(source.text) };
    }
    if (type === 'text') {
      return { ...base, text: normalizeNewlines(source.text).trim() };
    }
    if (type === 'list') {
      return {
        ...base,
        ordered: Boolean(source.ordered),
        items: (Array.isArray(source.items) ? source.items : []).map(oneLine).filter(Boolean)
      };
    }
    if (type === 'image') {
      return { ...base, url: oneLine(source.url), alt: oneLine(source.alt) || 'Ilustracja' };
    }
    if (type === 'quote') {
      return { ...base, text: normalizeNewlines(source.text).trim() };
    }
    if (type === 'callout') {
      const tone = ['info', 'tip', 'warning', 'success'].includes(source.tone) ? source.tone : 'info';
      const defaultTitles = {
        info: 'Ważne',
        tip: 'Wskazówka',
        warning: 'Uwaga',
        success: 'Brawo'
      };
      return {
        ...base,
        tone,
        title: oneLine(source.title) || defaultTitles[tone],
        text: normalizeNewlines(source.text).trim()
      };
    }
    if (type === 'code') {
      return {
        ...base,
        language: oneLine(source.language).replace(/[^a-z0-9_+-]/gi, '').slice(0, 24),
        code: normalizeNewlines(source.code).replace(/\n+$/g, '')
      };
    }
    if (type === 'youtube') {
      return {
        ...base,
        video: oneLine(source.video || source.url || source.videoId),
        title: oneLine(source.title) || 'Film do lekcji'
      };
    }
    if (type === 'atonom') {
      return {
        ...base,
        formula: oneLine(source.formula) || 'fenol',
        title: oneLine(source.title) || 'Model cząsteczki w ATONOM'
      };
    }
    if (type === 'formula') {
      const mode = ['math', 'matematyka'].includes(oneLine(source.mode).toLowerCase())
        ? 'math'
        : 'chemistry';
      const requestedArrow = Object.prototype.hasOwnProperty.call(source, 'arrow')
        ? oneLine(source.arrow)
        : '->';
      return {
        ...base,
        mode,
        title: oneLine(source.title) || (mode === 'math' ? 'Wzór matematyczny' : 'Równanie reakcji'),
        expression: oneLine(source.expression),
        left: oneLine(source.left),
        right: oneLine(source.right),
        arrow: FORMULA_ARROWS.includes(requestedArrow) ? requestedArrow : '->',
        above: oneLine(source.above),
        below: oneLine(source.below)
      };
    }
    if (type === 'link') {
      const icon = oneLine(source.icon).toLowerCase();
      return {
        ...base,
        title: oneLine(source.title) || 'Otwórz materiał',
        description: oneLine(source.description) || 'Przejdź do dodatkowego materiału.',
        url: oneLine(source.url) || '/members/',
        icon: LINK_ICONS.includes(icon) ? icon : 'link',
        color: STYLE_COLOR.test(String(source.color || '')) ? String(source.color).toLowerCase() : '#0e665a',
        newTab: source.newTab === true || /^(?:1|true|yes|tak|new)$/i.test(oneLine(source.newTab))
      };
    }
    if (type === 'flashcards') {
      const cards = (Array.isArray(source.cards) ? source.cards : [])
        .map((card) => ({
          front: oneLine(card && (card.front ?? card.question)),
          back: oneLine(card && (card.back ?? card.answer))
        }))
        .filter((card) => card.front || card.back)
        .slice(0, 20);
      return {
        ...base,
        title: oneLine(source.title) || 'Fiszki do utrwalenia',
        color: STYLE_COLOR.test(String(source.color || '')) ? String(source.color).toLowerCase() : '#7c3aed',
        cards
      };
    }
    if (type === 'style') {
      return {
        ...base,
        ...normalizeStyle(source),
        blocks: normalizeNestedBlocks(source.blocks)
      };
    }
    return {
      ...base,
      title: oneLine(source.title) || 'Więcej informacji',
      open: Boolean(source.open),
      blocks: normalizeNestedBlocks(source.blocks)
    };
  }

  function normalizeNestedBlocks(blocks) {
    const normalized = (Array.isArray(blocks) ? blocks : []).map((block) => createBlock(block));
    if (normalized.some((block) => ['style', 'accordion'].includes(block.type))) {
      throw new StudioLessonError(
        'NESTED_CONTAINER',
        'Harmonijki i stylowane sekcje nie mogą być zagnieżdżane.',
        'block.blocks'
      );
    }
    return normalized;
  }

  function resolveAbcdAnswer(source, options) {
    const direct = source.correctOption ?? source.answer ?? (Array.isArray(source.answers) ? source.answers[0] : '');
    if (Number.isInteger(direct) && direct >= 0 && direct < 4) return String.fromCharCode(65 + direct);
    if (source.correctOption !== undefined && /^[0-3]$/.test(oneLine(direct))) {
      return String.fromCharCode(65 + Number(direct));
    }
    const text = oneLine(direct);
    if (/^[A-D]$/i.test(text)) return text.toUpperCase();
    const optionIndex = options.findIndex((option) => (
      option.toLocaleLowerCase('pl') === text.toLocaleLowerCase('pl')
    ));
    return optionIndex >= 0 ? String.fromCharCode(65 + optionIndex) : text;
  }

  function createTask(seed) {
    if (!seed) return null;
    const source = typeof seed === 'string' ? { type: seed } : { ...seed };
    const type = String(source.type || 'text').toLowerCase();
    if (!TASK_TYPES.includes(type)) {
      throw new StudioLessonError('UNKNOWN_TASK', `Nieznany typ pytania: ${type}.`, 'task.type');
    }
    const options = (Array.isArray(source.options) ? source.options : []).map(oneLine).filter(Boolean);
    const answers = type === 'abcd'
      ? [resolveAbcdAnswer(source, options)].filter(Boolean)
      : (Array.isArray(source.answers) ? source.answers : [source.answer])
        .map(oneLine)
        .filter(Boolean);
    return {
      id: oneLine(source.id) || nextId('task'),
      type,
      question: normalizeNewlines(source.question).trim(),
      text: oneLine(source.text || source.gapText),
      label: oneLine(source.label) || (
        ['choice', 'abcd', 'gaps'].includes(type)
          ? 'Wybierz odpowiedź'
          : type === 'gaps-text' ? 'Wpisz odpowiedzi w luki' : 'Twoja odpowiedź'
      ),
      placeholder: oneLine(source.placeholder),
      options,
      answers,
      caseSensitive: Boolean(source.caseSensitive),
      checkMode: source.checkMode === 'each' ? 'each' : 'all',
      hint: oneLine(source.hint),
      feedback: oneLine(source.feedback ?? source.success) || 'Dobrze! Możesz przejść dalej.'
    };
  }

  function createSlide(seed) {
    const source = seed && typeof seed === 'object' ? seed : {};
    const blocks = Array.isArray(source.blocks) ? source.blocks.map((block) => createBlock(block)) : [];
    if (source.title && !blocks.some((block) => block.type === 'heading')) {
      blocks.unshift(createBlock('heading', { level: source.level || 2, text: source.title }));
    }
    return {
      id: oneLine(source.id) || nextId('slide'),
      transition: SLIDE_TRANSITIONS.includes(oneLine(source.transition).toLowerCase())
        ? oneLine(source.transition).toLowerCase()
        : 'fade',
      blocks,
      task: createTask(source.task)
    };
  }

  function createLesson(seed) {
    const source = seed && typeof seed === 'object' ? seed : {};
    const title = oneLine(source.title) || 'Nowa lekcja';
    const slides = (Array.isArray(source.slides) && source.slides.length ? source.slides : [{}])
      .map((slide) => createSlide(slide));
    return {
      version: SCHEMA_VERSION,
      id: oneLine(source.id) || nextId('lesson'),
      title,
      filename: validateFilename(source.filename) || slugify(title),
      slides
    };
  }

  function createStarterLesson(filename) {
    const safeFilename = validateFilename(filename) || 'nowa-lekcja.md';
    const baseTitle = safeFilename
      .replace(/\.md$/i, '')
      .replace(/[._-]+/g, ' ')
      .trim() || 'nowa lekcja';
    const title = `${baseTitle.charAt(0).toLocaleUpperCase('pl')}${baseTitle.slice(1)}`;
    return createLesson({
      title,
      filename: safeFilename,
      slides: [{
        blocks: [
          createBlock('heading', { level: 2, text: 'Wprowadzenie' }),
          createBlock('style', {
            font: 'sans',
            size: 'normal',
            align: 'left',
            blocks: [
              createBlock('text', { text: 'Wpisz tutaj treść pierwszego slajdu.' })
            ]
          })
        ]
      }]
    });
  }

  function validateTask(task, path, errors) {
    if (!task) return;
    if (!TASK_TYPES.includes(task.type)) {
      errors.push({ code: 'UNKNOWN_TASK', path: `${path}.type`, message: 'Nieznany typ pytania.' });
      return;
    }
    if (!task.answers.length || task.answers.some((answer) => !answer || answer.includes('|'))) {
      errors.push({ code: 'INVALID_ANSWER', path: `${path}.answers`, message: 'Dodaj poprawną odpowiedź bez znaku |.' });
    }
    if (
      task.type === 'number'
      && task.answers.some((answer) => !Number.isFinite(Number(String(answer).replace(',', '.'))))
    ) {
      errors.push({ code: 'INVALID_NUMBER_ANSWER', path: `${path}.answers`, message: 'Odpowiedź liczbowa musi być prawidłową liczbą.' });
    }
    if (task.type === 'abcd' && task.options.length !== 4) {
      errors.push({ code: 'INVALID_ABCD_OPTIONS', path: `${path}.options`, message: 'Quiz ABCD wymaga dokładnie czterech odpowiedzi.' });
    }
    if ((task.type === 'choice' || task.type === 'gaps') && task.options.length < 2) {
      errors.push({ code: 'MISSING_OPTIONS', path: `${path}.options`, message: 'Pytanie wyboru wymaga co najmniej dwóch odpowiedzi.' });
    }
    if (task.options.some((option) => option.includes('|'))) {
      errors.push({ code: 'INVALID_OPTION', path: `${path}.options`, message: 'Odpowiedź nie może zawierać znaku |.' });
    }
    if ((task.type === 'choice' || task.type === 'abcd' || task.type === 'gaps')) {
      const expectedAnswers = task.type === 'abcd'
        ? task.answers.map((answer) => task.options[(answer || '').toUpperCase().charCodeAt(0) - 65])
        : task.answers;
      const allAnswersMatch = expectedAnswers.every((answer) => task.options.some((option) => (
        task.caseSensitive
          ? answer === option
          : String(answer).toLocaleLowerCase('pl') === String(option).toLocaleLowerCase('pl')
      )));
      if (!allAnswersMatch) {
        errors.push({ code: 'ANSWER_NOT_IN_OPTIONS', path: `${path}.answers`, message: 'Poprawna odpowiedź musi występować na liście opcji.' });
      }
    }
    if (task.type === 'gaps' || task.type === 'gaps-text') {
      const gapCount = (task.text.match(/\{\{[^{}]*\}\}/g) || []).length;
      if (!task.text || gapCount < 1 || gapCount !== task.answers.length) {
        errors.push({
          code: 'INVALID_GAPS',
          path: `${path}.text`,
          message: 'Tekst luk musi zawierać po jednym znaczniku {{luka}} dla każdej poprawnej odpowiedzi.'
        });
      }
    }
    if (task.type === 'gaps-text' && !['each', 'all'].includes(task.checkMode)) {
      errors.push({ code: 'INVALID_GAP_CHECK_MODE', path: `${path}.checkMode`, message: 'Wybierz sposób sprawdzania luk tekstowych.' });
    }
  }

  function validateBlock(block, path, errors) {
    if (!BLOCK_TYPES.includes(block.type)) {
      errors.push({ code: 'UNKNOWN_BLOCK', path: `${path}.type`, message: 'Nieznany typ bloku.' });
      return;
    }
    if (block.type === 'image' && !safeImageUrl(block.url)) {
      errors.push({ code: 'UNSAFE_IMAGE_URL', path: `${path}.url`, message: 'Obraz musi używać pełnego adresu HTTPS.' });
    }
    if (block.type === 'youtube' && !youtubeVideoId(block.video)) {
      errors.push({ code: 'INVALID_YOUTUBE', path: `${path}.video`, message: 'Podaj prawidłowy link lub ID filmu YouTube.' });
    }
    if (block.type === 'atonom' && !safeAtonomFormula(block.formula)) {
      errors.push({ code: 'INVALID_ATONOM_FORMULA', path: `${path}.formula`, message: 'Podaj nazwę związku dla ATONOM.' });
    }
    if (block.type === 'link') {
      if (!block.title || !safeLinkUrl(block.url)) {
        errors.push({
          code: 'INVALID_LINK_CARD',
          path: `${path}.url`,
          message: 'Kafelek wymaga tytułu i bezpiecznego adresu http/https, mailto:, /ścieżki albo #kotwicy.'
        });
      }
      if (!LINK_ICONS.includes(block.icon) || !STYLE_COLOR.test(block.color)) {
        errors.push({ code: 'INVALID_LINK_STYLE', path, message: 'Wybierz obsługiwaną ikonę i kolor kafelka.' });
      }
    }
    if (block.type === 'formula') {
      if (block.mode === 'math') {
        if (!safeMathExpression(block.expression)) {
          errors.push({
            code: 'INVALID_MATH_FORMULA',
            path: `${path}.expression`,
            message: 'Wpisz poprawny wzór matematyczny, używając dostępnych symboli.'
          });
        }
      } else {
        if (!safeChemistryText(block.left, false)) {
          errors.push({
            code: 'INVALID_CHEMISTRY_FORMULA',
            path: `${path}.left`,
            message: 'Wpisz wzór związku albo substraty reakcji.'
          });
        }
        if (!FORMULA_ARROWS.includes(block.arrow)) {
          errors.push({ code: 'INVALID_FORMULA_ARROW', path: `${path}.arrow`, message: 'Wybierz obsługiwany typ strzałki.' });
        }
        if (block.arrow && !safeChemistryText(block.right, false)) {
          errors.push({
            code: 'MISSING_REACTION_PRODUCTS',
            path: `${path}.right`,
            message: 'Reakcja ze strzałką wymaga produktów po prawej stronie.'
          });
        }
        if (
          (block.above && !safeChemistryText(block.above, true))
          || (block.below && !safeChemistryText(block.below, true))
        ) {
          errors.push({
            code: 'INVALID_REACTION_CONDITION',
            path: `${path}.above`,
            message: 'Warunki reakcji zawierają niedozwolone znaki.'
          });
        }
      }
    }
    if (
      block.type === 'flashcards'
      && (
        block.cards.length < 2
        || block.cards.some((card) => !card.front || !card.back || card.front.includes('=>') || card.back.includes('=>'))
      )
    ) {
      errors.push({ code: 'INVALID_FLASHCARDS', path: `${path}.cards`, message: 'Dodaj co najmniej dwie kompletne fiszki bez znaku =>.' });
    }
    if (
      (block.type === 'heading' && !block.text)
      || (block.type === 'text' && !block.text.trim())
      || (block.type === 'list' && !block.items.length)
      || (block.type === 'quote' && !block.text.trim())
    ) {
      errors.push({ code: 'EMPTY_BLOCK', path, message: 'Blok nie może być pusty.' });
    }
    if (block.type === 'code' && block.code.split('\n').some((line) => /^\s*```/.test(line))) {
      errors.push({ code: 'CODE_FENCE_COLLISION', path: `${path}.code`, message: 'Wiersz kodu nie może zaczynać się od ```.' });
    }
    if ((block.type === 'style' || block.type === 'accordion')) {
      if (!block.blocks.length) {
        errors.push({ code: 'EMPTY_CONTAINER', path: `${path}.blocks`, message: 'Kontener nie może być pusty.' });
      }
      block.blocks.forEach((child, index) => validateBlock(child, `${path}.blocks[${index}]`, errors));
    }
  }

  function validateLesson(input) {
    const requestedFilename = input && typeof input === 'object' ? oneLine(input.filename) : '';
    let lesson;
    try {
      lesson = createLesson(input);
    } catch (error) {
      return {
        valid: false,
        errors: [{
          code: error.code || 'INVALID_MODEL',
          path: error.path || '',
          message: error.message || 'Nieprawidłowy model lekcji.'
        }]
      };
    }
    const errors = [];
    if (!lesson.title) errors.push({ code: 'MISSING_TITLE', path: 'title', message: 'Lekcja wymaga tytułu.' });
    if ((requestedFilename && !validateFilename(requestedFilename)) || !validateFilename(lesson.filename)) {
      errors.push({ code: 'INVALID_FILENAME', path: 'filename', message: 'Nazwa pliku musi kończyć się na .md.' });
    }
    if (!lesson.slides.length || lesson.slides.length > MAX_SLIDES) {
      errors.push({ code: 'INVALID_SLIDE_COUNT', path: 'slides', message: `Lekcja może mieć od 1 do ${MAX_SLIDES} slajdów.` });
    }
    lesson.slides.forEach((slide, slideIndex) => {
      const slidePath = `slides[${slideIndex}]`;
      if (!slide.blocks.length && !slide.task && !(slideIndex === 0 && lesson.title)) {
        errors.push({ code: 'EMPTY_SLIDE', path: slidePath, message: 'Slajd nie może być pusty.' });
      }
      slide.blocks.forEach((block, blockIndex) => validateBlock(block, `${slidePath}.blocks[${blockIndex}]`, errors));
      validateTask(slide.task, `${slidePath}.task`, errors);
    });
    return { valid: errors.length === 0, errors, lesson };
  }

  function serializeBlock(input) {
    const block = createBlock(input);
    if (block.type === 'heading') return `${'#'.repeat(block.level)} ${cleanInline(block.text)}`;
    if (block.type === 'text') return protectStructuralLines(block.text);
    if (block.type === 'list') {
      return block.items.map((item, index) => `${block.ordered ? `${index + 1}.` : '-'} ${cleanInline(item)}`).join('\n');
    }
    if (block.type === 'image') {
      return `![${cleanInline(block.alt)}](${safeImageUrl(block.url)})`;
    }
    if (block.type === 'quote') {
      return protectStructuralLines(block.text).split('\n').map((line) => `> ${line}`).join('\n');
    }
    if (block.type === 'callout') {
      const lines = protectStructuralLines(block.text).split('\n');
      const first = `> **${cleanInline(block.title)}:**${lines[0] ? ` ${lines[0]}` : ''}`;
      return [first, ...lines.slice(1).map((line) => `> ${line}`)].join('\n');
    }
    if (block.type === 'code') {
      return `\`\`\`${block.language}\n${block.code}\n\`\`\``;
    }
    if (block.type === 'youtube') {
      return [
        ':::youtube',
        `id: ${youtubeVideoId(block.video)}`,
        `title: ${cleanDirectiveValue(block.title)}`,
        ':::'
      ].join('\n');
    }
    if (block.type === 'atonom') {
      return [
        ':::atonom',
        `formula: ${cleanDirectiveValue(block.formula)}`,
        `title: ${cleanDirectiveValue(block.title)}`,
        ':::'
      ].join('\n');
    }
    if (block.type === 'formula') {
      const lines = [
        ':::formula',
        `mode: ${block.mode}`,
        `title: ${cleanDirectiveValue(block.title)}`
      ];
      if (block.mode === 'math') {
        lines.push(`expression: ${cleanDirectiveValue(block.expression)}`);
      } else {
        lines.push(
          `left: ${cleanDirectiveValue(block.left)}`,
          `arrow: ${block.arrow}`,
          `above: ${cleanDirectiveValue(block.above)}`,
          `below: ${cleanDirectiveValue(block.below)}`,
          `right: ${cleanDirectiveValue(block.right)}`
        );
      }
      lines.push(':::');
      return lines.join('\n');
    }
    if (block.type === 'link') {
      return [
        ':::linkcard',
        `title: ${cleanDirectiveValue(block.title)}`,
        `description: ${cleanDirectiveValue(block.description)}`,
        `url: ${cleanDirectiveValue(safeLinkUrl(block.url))}`,
        `icon: ${block.icon}`,
        `color: ${block.color}`,
        `new_tab: ${block.newTab ? 'true' : 'false'}`,
        ':::'
      ].join('\n');
    }
    if (block.type === 'flashcards') {
      return [
        ':::flashcards',
        `title: ${cleanDirectiveValue(block.title)}`,
        `color: ${block.color}`,
        ...block.cards.map((card) => `${cleanDirectiveValue(card.front)} => ${cleanDirectiveValue(card.back)}`),
        ':::'
      ].join('\n');
    }
    if (block.type === 'style') {
      const attrs = [`font=${block.font}`];
      if (block.color) attrs.push(`color=${block.color}`);
      if (block.background) attrs.push(`background=${block.background}`);
      if (block.bold) attrs.push('bold=true');
      attrs.push(`size=${block.size}`, `align=${block.align}`);
      return `:::style ${attrs.join(' ')}\n${block.blocks.map(serializeBlock).join('\n\n')}\n:::`;
    }
    const open = block.open ? ' open=true' : '';
    return `:::accordion ${cleanInline(block.title)}${open}\n${block.blocks.map(serializeBlock).join('\n\n')}\n:::`;
  }

  function serializeTask(input) {
    const task = createTask(input);
    const lines = [':::task', `type: ${task.type}`];
    if (task.label) lines.push(`label: ${task.label}`);
    if (task.placeholder) lines.push(`placeholder: ${task.placeholder}`);
    if (task.type === 'choice' || task.type === 'abcd' || task.type === 'gaps') {
      lines.push(`options: ${task.options.join(' | ')}`);
    }
    if (task.type === 'gaps' || task.type === 'gaps-text') lines.push(`text: ${task.text}`);
    if (task.type === 'gaps-text') lines.push(`check_mode: ${task.checkMode}`);
    lines.push(`answer: ${task.answers.join(' | ')}`);
    if (task.caseSensitive && (task.type === 'text' || task.type === 'gaps-text')) {
      lines.push('case_sensitive: true');
    }
    if (task.hint) lines.push(`hint: ${task.hint}`);
    if (task.feedback) lines.push(`success: ${task.feedback}`);
    lines.push(':::');
    return lines.join('\n');
  }

  function serializeQuestion(value) {
    const question = protectStructuralLines(value);
    const needsBoundary = /\n\s*\n/.test(question)
      || /^(?:#{1,3}\s+|\s*```|\s*>\s?|\s*!\[|\s*[-*+]\s+|\s*\d+[.)]\s+)/m.test(question);
    return needsBoundary
      ? `:::question\n${question}\n:::`
      : question;
  }

  function serializeLesson(input) {
    const result = validateLesson(input);
    if (!result.valid) {
      const first = result.errors[0];
      throw new StudioLessonError(first.code, first.message, first.path);
    }
    const lesson = result.lesson;
    const slides = lesson.slides.map((slide, slideIndex) => {
      const blocks = slide.blocks.map((block) => ({ ...block }));
      if (slideIndex === 0) {
        const titleBlock = blocks.find((block) => block.type === 'heading' && block.level === 1);
        if (titleBlock) titleBlock.text = lesson.title;
        else blocks.unshift(createBlock('heading', { level: 1, text: lesson.title }));
      }
      const parts = blocks.map(serializeBlock).filter(Boolean);
      if (slide.transition !== 'fade') {
        parts.unshift([':::slide', `transition: ${slide.transition}`, ':::'].join('\n'));
      }
      if (slide.task) {
        if (slide.task.question) parts.push(serializeQuestion(slide.task.question));
        parts.push(serializeTask(slide.task));
      }
      return parts.join('\n\n').trim();
    });
    return `${slides.join('\n\n---\n\n')}\n`;
  }

  function splitSlides(markdown) {
    const parts = [];
    let current = [];
    let inCode = false;
    let containerDepth = 0;
    for (const line of normalizeNewlines(markdown).split('\n')) {
      if (/^\s*```/.test(line)) {
        inCode = !inCode;
        current.push(line);
        continue;
      }
      if (!inCode) {
        if (TASK_START.test(line) || SLIDE_SETTINGS_START.test(line) || CONTAINER_START.test(line)) containerDepth += 1;
        else if (CONTAINER_END.test(line) && containerDepth > 0) containerDepth -= 1;
        if (containerDepth === 0 && /^\s*---\s*$/.test(line)) {
          parts.push(current.join('\n').trim());
          current = [];
          continue;
        }
      }
      current.push(line);
    }
    if (current.join('\n').trim()) parts.push(current.join('\n').trim());
    return parts;
  }

  function parseTaskLines(lines) {
    const aliases = {
      answer: 'answer',
      answers: 'answer',
      odpowiedz: 'answer',
      odpowiedzi: 'answer',
      type: 'type',
      typ: 'type',
      label: 'label',
      etykieta: 'label',
      placeholder: 'placeholder',
      przyklad: 'placeholder',
      hint: 'hint',
      podpowiedz: 'hint',
      success: 'feedback',
      sukces: 'feedback',
      options: 'options',
      opcje: 'options',
      text: 'text',
      tekst: 'text',
      check_mode: 'checkMode',
      tryb_sprawdzania: 'checkMode',
      case_sensitive: 'caseSensitive',
      wielkosc_liter: 'caseSensitive'
    };
    const values = {};
    lines.forEach((line) => {
      if (!line.trim() || line.trim().startsWith('#')) return;
      const match = /^\s*([^:]+):\s*(.*?)\s*$/.exec(line);
      if (!match) {
        throw new StudioLessonError('INVALID_TASK_FIELD', 'Każdy wiersz zadania musi mieć postać „pole: wartość”.', 'task');
      }
      const key = aliases[normalizeKey(match[1])];
      if (!key) {
        throw new StudioLessonError('UNKNOWN_TASK_FIELD', `Nieznane pole zadania: ${match[1].trim()}.`, 'task');
      }
      values[key] = match[2];
    });
    const rawType = normalizeKey(values.type || 'text');
    const type = rawType === 'liczba' ? 'number'
      : rawType === 'tekst' ? 'text'
        : rawType === 'wybor' ? 'choice'
          : ['gaps_text', 'luki_tekstowe'].includes(rawType) ? 'gaps-text'
            : rawType;
    const options = String(values.options || '').split('|').map(oneLine).filter(Boolean);
    const answers = String(values.answer || '').split('|').map(oneLine).filter(Boolean);
    return createTask({
      type,
      label: values.label,
      placeholder: values.placeholder,
      hint: values.hint,
      feedback: values.feedback,
      text: values.text,
      checkMode: values.checkMode,
      options,
      answers,
      answer: answers[0],
      caseSensitive: /^(?:1|true|tak|yes)$/i.test(values.caseSensitive || '')
    });
  }

  function parseStyleAttributes(value) {
    const attrs = {};
    String(value || '').split(/\s+/).forEach((part) => {
      const match = /^([a-z]+)=(\S+)$/i.exec(part);
      if (match) attrs[match[1].toLowerCase()] = match[2];
    });
    return normalizeStyle(attrs);
  }

  function parseDirectiveFields(lines) {
    const values = {};
    lines.forEach((line) => {
      const match = /^\s*([a-z_]+):\s*(.*?)\s*$/i.exec(line);
      if (match) values[match[1].toLowerCase()] = match[2];
    });
    return values;
  }

  function findContainerEnd(lines, startIndex) {
    let depth = 1;
    let inCode = false;
    for (let index = startIndex + 1; index < lines.length; index += 1) {
      if (/^\s*```/.test(lines[index])) {
        inCode = !inCode;
        continue;
      }
      if (inCode) continue;
      if (CONTAINER_START.test(lines[index])) depth += 1;
      else if (CONTAINER_END.test(lines[index])) {
        depth -= 1;
        if (depth === 0) return index;
      }
    }
    return -1;
  }

  function parseBlocks(source, allowContainers) {
    const lines = normalizeNewlines(source).split('\n');
    const blocks = [];
    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        index += 1;
        continue;
      }

      const containerMatch = CONTAINER_START.exec(line);
      const container = containerMatch && (
        allowContainers !== false
        || !['style', 'accordion'].includes(containerMatch[1].toLowerCase())
      ) ? containerMatch : null;
      if (container) {
        const end = findContainerEnd(lines, index);
        if (end > index) {
          const type = container[1].toLowerCase();
          const bodyLines = lines.slice(index + 1, end);
          const children = ['style', 'accordion'].includes(type)
            ? parseBlocks(bodyLines.join('\n'), false)
            : [];
          if (type === 'style') {
            blocks.push(createBlock({ type: 'style', ...parseStyleAttributes(container[2]), blocks: children }));
          } else if (type === 'accordion') {
            const rawTitle = oneLine(container[2]);
            blocks.push(createBlock({
              type: 'accordion',
              title: rawTitle.replace(/\s+open=true$/i, ''),
              open: /\sopen=true$/i.test(rawTitle),
              blocks: children
            }));
          } else if (type === 'youtube') {
            const values = parseDirectiveFields(bodyLines);
            blocks.push(createBlock({ type, video: values.id || values.url, title: values.title }));
          } else if (type === 'atonom') {
            const values = parseDirectiveFields(bodyLines);
            blocks.push(createBlock({ type, formula: values.formula, title: values.title }));
          } else if (type === 'formula') {
            const values = parseDirectiveFields(bodyLines);
            blocks.push(createBlock({
              type,
              mode: values.mode,
              title: values.title,
              expression: values.expression,
              left: values.left,
              arrow: values.arrow,
              above: values.above,
              below: values.below,
              right: values.right
            }));
          } else if (type === 'linkcard') {
            const values = parseDirectiveFields(bodyLines);
            blocks.push(createBlock({
              type: 'link',
              title: values.title,
              description: values.description,
              url: values.url,
              icon: values.icon,
              color: values.color,
              newTab: values.new_tab
            }));
          } else {
            const values = parseDirectiveFields(bodyLines);
            const cards = bodyLines
              .filter((bodyLine) => !/^\s*(?:title|color):/i.test(bodyLine))
              .map((bodyLine) => bodyLine.split(/\s*=>\s*/, 2))
              .filter((parts) => parts.length === 2)
              .map(([front, back]) => ({ front, back }));
            blocks.push(createBlock({ type: 'flashcards', title: values.title, color: values.color, cards }));
          }
          index = end + 1;
          continue;
        }
      }

      const fence = /^\s*```([^\s`]*)\s*$/.exec(line);
      if (fence) {
        const code = [];
        index += 1;
        while (index < lines.length && !/^\s*```/.test(lines[index])) {
          code.push(lines[index]);
          index += 1;
        }
        if (index < lines.length) index += 1;
        blocks.push(createBlock({ type: 'code', language: fence[1], code: code.join('\n') }));
        continue;
      }

      const heading = /^(#{1,3})\s+(.+)$/.exec(line);
      if (heading) {
        blocks.push(createBlock({ type: 'heading', level: heading[1].length, text: heading[2].trim() }));
        index += 1;
        continue;
      }

      const image = /^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/.exec(line);
      if (image) {
        blocks.push(createBlock({ type: 'image', alt: image[1], url: image[2] }));
        index += 1;
        continue;
      }

      if (/^\s*>\s?/.test(line)) {
        const quoteLines = [];
        while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
          quoteLines.push(lines[index].replace(/^\s*>\s?/, ''));
          index += 1;
        }
        const callout = /^\*\*(.+?):\*\*\s*(.*)$/.exec(quoteLines[0] || '');
        const title = callout ? callout[1] : '';
        const normalizedTitle = normalizeKey(title);
        const tone = /^(?:uwaga|ostrzezenie)$/.test(normalizedTitle) ? 'warning'
          : /^(?:wskazowka|podpowiedz)$/.test(normalizedTitle) ? 'tip'
            : /^(?:brawo|sukces)$/.test(normalizedTitle) ? 'success'
              : 'info';
        blocks.push(callout
          ? createBlock({ type: 'callout', tone, title, text: [callout[2], ...quoteLines.slice(1)].join('\n') })
          : createBlock({ type: 'quote', text: quoteLines.join('\n') }));
        continue;
      }

      const unordered = /^\s*[-*+]\s+(.+)$/.exec(line);
      const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
      if (unordered || ordered) {
        const isOrdered = Boolean(ordered);
        const items = [];
        while (index < lines.length) {
          const match = isOrdered
            ? /^\s*\d+[.)]\s+(.+)$/.exec(lines[index])
            : /^\s*[-*+]\s+(.+)$/.exec(lines[index]);
          if (!match) break;
          items.push(match[1]);
          index += 1;
        }
        blocks.push(createBlock({ type: 'list', ordered: isOrdered, items }));
        continue;
      }

      const paragraph = [line];
      index += 1;
      while (
        index < lines.length
        && lines[index].trim()
        && !/^(?:#{1,3}\s+|\s*```|\s*>\s?|\s*!\[|\s*[-*+]\s+|\s*\d+[.)]\s+)/.test(lines[index])
        && !(
          CONTAINER_START.test(lines[index])
          && (
            allowContainers !== false
            || !/^\s*:::(?:style|accordion)\b/i.test(lines[index])
          )
        )
      ) {
        paragraph.push(lines[index]);
        index += 1;
      }
      blocks.push(createBlock({ type: 'text', text: paragraph.join('\n') }));
    }
    return blocks;
  }

  function parseSlide(source) {
    const lines = normalizeNewlines(source).split('\n');
    const content = [];
    let task = null;
    let taskLines = null;
    let taskEndedAt = -1;
    let explicitQuestion = '';
    let questionLines = null;
    let questionSeen = false;
    let slideSettingsLines = null;
    let slideSettingsSeen = false;
    let transition = 'fade';
    let containerDepth = 0;
    let inCode = false;
    lines.forEach((line, index) => {
      if (/^\s*```/.test(line)) inCode = !inCode;
      if (
        !inCode
        && !taskLines
        && !questionLines
        && !slideSettingsLines
        && CONTAINER_START.test(line)
      ) containerDepth += 1;
      if (
        !inCode
        && !taskLines
        && !questionLines
        && !slideSettingsLines
        && CONTAINER_END.test(line)
        && containerDepth > 0
      ) containerDepth -= 1;

      if (slideSettingsLines) {
        if (CONTAINER_END.test(line)) {
          const values = parseDirectiveFields(slideSettingsLines);
          transition = SLIDE_TRANSITIONS.includes(oneLine(values.transition).toLowerCase())
            ? oneLine(values.transition).toLowerCase()
            : 'fade';
          slideSettingsLines = null;
        } else slideSettingsLines.push(line);
        return;
      }
      if (taskLines) {
        if (CONTAINER_END.test(line)) {
          task = parseTaskLines(taskLines);
          taskLines = null;
          taskEndedAt = index;
        } else taskLines.push(line);
        return;
      }
      if (questionLines) {
        if (CONTAINER_END.test(line)) {
          explicitQuestion = normalizeNewlines(questionLines.join('\n')).trim();
          questionLines = null;
        } else questionLines.push(line);
        return;
      }
      if (!inCode && containerDepth === 0 && QUESTION_START.test(line)) {
        if (questionSeen) {
          throw new StudioLessonError(
            'MULTIPLE_QUESTIONS',
            'Slajd może zawierać tylko jeden jawny blok pytania.',
            'task.question'
          );
        }
        questionSeen = true;
        questionLines = [];
        return;
      }
      if (!inCode && containerDepth === 0 && SLIDE_SETTINGS_START.test(line)) {
        if (slideSettingsSeen) {
          throw new StudioLessonError(
            'MULTIPLE_SLIDE_SETTINGS',
            'Slajd może zawierać tylko jeden blok ustawień przejścia.',
            'slide.transition'
          );
        }
        slideSettingsSeen = true;
        slideSettingsLines = [];
        return;
      }
      if (!inCode && containerDepth === 0 && TASK_START.test(line)) {
        if (task) {
          throw new StudioLessonError('MULTIPLE_TASKS', 'Slajd może zawierać tylko jedno zadanie.', 'task');
        }
        taskLines = [];
        return;
      }
      content.push(line);
    });
    if (taskLines) {
      throw new StudioLessonError('UNCLOSED_TASK', 'Blok zadania musi kończyć się linią :::.', 'task');
    }
    if (questionLines) {
      throw new StudioLessonError(
        'UNCLOSED_QUESTION',
        'Blok pytania musi kończyć się linią :::.',
        'task.question'
      );
    }
    if (slideSettingsLines) {
      throw new StudioLessonError(
        'UNCLOSED_SLIDE_SETTINGS',
        'Blok ustawień slajdu musi kończyć się linią :::.',
        'slide.transition'
      );
    }
    if (questionSeen && !explicitQuestion) {
      throw new StudioLessonError('EMPTY_QUESTION', 'Blok pytania nie może być pusty.', 'task.question');
    }
    if (questionSeen && !task) {
      throw new StudioLessonError(
        'QUESTION_WITHOUT_TASK',
        'Jawny blok pytania wymaga znajdującego się po nim zadania.',
        'task.question'
      );
    }

    const blocks = parseBlocks(content.join('\n'), true);
    if (task && explicitQuestion) {
      task.question = explicitQuestion;
    } else if (task && taskEndedAt === lines.length - 1) {
      const candidate = blocks[blocks.length - 1];
      const structuralQuestionTypes = new Set([
        'heading',
        'list',
        'image',
        'quote',
        'callout'
      ]);
      if (candidate && candidate.type === 'text') {
        const questionBlocks = [];
        while (blocks.length && blocks[blocks.length - 1].type === 'text') {
          questionBlocks.unshift(blocks.pop());
        }
        task.question = questionBlocks.map(serializeBlock).join('\n\n');
      } else if (candidate && structuralQuestionTypes.has(candidate.type)) {
        task.question = serializeBlock(candidate);
        blocks.pop();
      }
    }
    return createSlide({ blocks, task, transition });
  }

  function stripMarkdown(value) {
    return String(value || '')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*_`~^]/g, '')
      .trim();
  }

  function parseLesson(markdown, filename) {
    const raw = String(markdown ?? '');
    if (raw.includes('\0')) {
      throw new StudioLessonError('INVALID_LESSON', 'Plik lekcji zawiera niedozwolone znaki.', '');
    }
    const text = normalizeNewlines(raw);
    if (!text.trim()) throw new StudioLessonError('EMPTY_LESSON', 'Plik lekcji jest pusty.', '');
    if (text.length > MAX_SOURCE_CHARS) {
      throw new StudioLessonError('LESSON_TOO_LARGE', 'Plik lekcji jest zbyt duży.', '');
    }
    const parts = splitSlides(text);
    if (!parts.length || parts.some((part) => !part.trim())) {
      throw new StudioLessonError('EMPTY_SLIDE', 'Lekcja zawiera pusty slajd.', 'slides');
    }
    if (parts.length > MAX_SLIDES) {
      throw new StudioLessonError('TOO_MANY_SLIDES', `Lekcja może mieć maksymalnie ${MAX_SLIDES} slajdów.`, 'slides');
    }
    const titleMatch = text.match(/^\s*#\s+(.+?)\s*$/m);
    const safeName = validateFilename(filename) || '';
    const fallback = (safeName || 'Nowa lekcja').replace(/\.md$/i, '').replace(/[-_]+/g, ' ');
    return createLesson({
      title: titleMatch ? stripMarkdown(titleMatch[1]) : fallback,
      filename: safeName || slugify(fallback),
      slides: parts.map(parseSlide)
    });
  }

  function parseEditableLesson(markdown, filename) {
    return String(markdown ?? '').trim()
      ? parseLesson(markdown, filename)
      : createStarterLesson(filename);
  }

  const capabilities = Object.freeze({
    markdown: true,
    imagesFromHttps: true,
    tasks: Object.freeze(['text', 'number', 'choice', 'abcd', 'gaps', 'gaps-text']),
    styledContainers: true,
    youtube: true,
    atonom: true,
    formulas: true,
    linkCards: true,
    flashcards: true,
    accordions: true,
    nestedContainers: false,
    styleFonts: STYLE_FONTS,
    styleSizes: STYLE_SIZES,
    styleAligns: STYLE_ALIGNS,
    slideTransitions: SLIDE_TRANSITIONS,
    styleColorFormat: '#RRGGBB',
    requiresLessonParserContainers: true
  });

  const api = {
    BLOCK_TYPES,
    SCHEMA_VERSION,
    STYLE_ALIGNS,
    STYLE_FONTS,
    STYLE_SIZES,
    FORMULA_ARROWS,
    LINK_ICONS,
    SLIDE_TRANSITIONS,
    TASK_TYPES,
    StudioLessonError,
    capabilities,
    createBlock,
    createLesson,
    createStarterLesson,
    createSlide,
    createTask,
    parseEditableLesson,
    parseLesson,
    safeChemistryText,
    safeImageUrl,
    safeLinkUrl,
    safeMathExpression,
    serializeBlock,
    serializeLesson,
    serializeTask,
    validateFilename,
    validateLesson
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChemLessonStudioModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
