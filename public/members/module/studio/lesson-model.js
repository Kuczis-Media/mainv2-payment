(function (root) {
  'use strict';

  const SCHEMA_VERSION = 1;
  const MAX_SOURCE_CHARS = 512 * 1024;
  const MAX_SLIDES = 100;
  const SAFE_FILENAME = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9_.-]{0,79}\.md$/i;
  const TASK_START = /^\s*:::(?:task|zadanie)\s*$/i;
  const QUESTION_START = /^\s*:::question\s*$/i;
  const CONTAINER_START = /^\s*:::(style|accordion)(?:\s+(.*?))?\s*$/i;
  const CONTAINER_END = /^\s*:::\s*$/;
  const STYLE_FONTS = Object.freeze(['sans', 'serif', 'rounded', 'mono']);
  const STYLE_SIZES = Object.freeze(['small', 'normal', 'large', 'xlarge']);
  const STYLE_ALIGNS = Object.freeze(['left', 'center', 'right']);
  const STYLE_COLOR = /^#[0-9a-f]{6}$/i;
  const BLOCK_TYPES = Object.freeze([
    'heading',
    'text',
    'list',
    'image',
    'quote',
    'callout',
    'code',
    'style',
    'accordion'
  ]);
  const TASK_TYPES = Object.freeze(['text', 'number', 'choice', 'abcd']);

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

  function cleanInline(value) {
    return oneLine(value).replace(/\]/g, '').replace(/\r|\n/g, '');
  }

  function protectStructuralLines(value) {
    return normalizeNewlines(value)
      .split('\n')
      .map((line) => {
        if (/^\s*---\s*$/.test(line)) return '`---`';
        if (/^\s*:::(?:task|zadanie|question|style|accordion)?(?:\s+.*?)?\s*$/i.test(line)) {
          return `\`${line.trim()}\``;
        }
        return line.replace(/\s+$/g, '');
      })
      .join('\n')
      .trim();
  }

  function normalizeStyle(value) {
    const source = value && typeof value === 'object' ? value : {};
    const font = STYLE_FONTS.includes(source.font) ? source.font : 'sans';
    const size = STYLE_SIZES.includes(source.size) ? source.size : 'normal';
    const align = STYLE_ALIGNS.includes(source.align) ? source.align : 'left';
    const color = STYLE_COLOR.test(String(source.color || '')) ? String(source.color).toLowerCase() : '';
    return { font, color, size, align };
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
      label: oneLine(source.label) || (type === 'choice' || type === 'abcd' ? 'Wybierz odpowiedź' : 'Twoja odpowiedź'),
      placeholder: oneLine(source.placeholder),
      options,
      answers,
      caseSensitive: Boolean(source.caseSensitive),
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
    if (task.type === 'choice' && task.options.length < 2) {
      errors.push({ code: 'MISSING_OPTIONS', path: `${path}.options`, message: 'Pytanie wyboru wymaga co najmniej dwóch odpowiedzi.' });
    }
    if (task.options.some((option) => option.includes('|'))) {
      errors.push({ code: 'INVALID_OPTION', path: `${path}.options`, message: 'Odpowiedź nie może zawierać znaku |.' });
    }
    if ((task.type === 'choice' || task.type === 'abcd')) {
      const expectedAnswers = task.type === 'abcd'
        ? task.answers.map((answer) => task.options[(answer || '').toUpperCase().charCodeAt(0) - 65])
        : task.answers;
      const hasMatchingOption = expectedAnswers.some((answer) => task.options.some((option) => (
        task.caseSensitive
          ? answer === option
          : String(answer).toLocaleLowerCase('pl') === String(option).toLocaleLowerCase('pl')
      )));
      if (!hasMatchingOption) {
        errors.push({ code: 'ANSWER_NOT_IN_OPTIONS', path: `${path}.answers`, message: 'Poprawna odpowiedź musi występować na liście opcji.' });
      }
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
    if (block.type === 'style') {
      const attrs = [`font=${block.font}`];
      if (block.color) attrs.push(`color=${block.color}`);
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
    if (task.type === 'choice' || task.type === 'abcd') lines.push(`options: ${task.options.join(' | ')}`);
    lines.push(`answer: ${task.answers.join(' | ')}`);
    if (task.caseSensitive && task.type === 'text') lines.push('case_sensitive: true');
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
        if (TASK_START.test(line) || CONTAINER_START.test(line)) containerDepth += 1;
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
          : rawType;
    const options = String(values.options || '').split('|').map(oneLine).filter(Boolean);
    const answers = String(values.answer || '').split('|').map(oneLine).filter(Boolean);
    return createTask({
      type,
      label: values.label,
      placeholder: values.placeholder,
      hint: values.hint,
      feedback: values.feedback,
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

      const container = allowContainers !== false ? CONTAINER_START.exec(line) : null;
      if (container) {
        const end = findContainerEnd(lines, index);
        if (end > index) {
          const children = parseBlocks(lines.slice(index + 1, end).join('\n'), false);
          if (container[1].toLowerCase() === 'style') {
            blocks.push(createBlock({ type: 'style', ...parseStyleAttributes(container[2]), blocks: children }));
          } else {
            const rawTitle = oneLine(container[2]);
            blocks.push(createBlock({
              type: 'accordion',
              title: rawTitle.replace(/\s+open=true$/i, ''),
              open: /\sopen=true$/i.test(rawTitle),
              blocks: children
            }));
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
        && !(allowContainers !== false && CONTAINER_START.test(lines[index]))
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
    let containerDepth = 0;
    let inCode = false;
    lines.forEach((line, index) => {
      if (/^\s*```/.test(line)) inCode = !inCode;
      if (!inCode && !taskLines && !questionLines && CONTAINER_START.test(line)) containerDepth += 1;
      if (
        !inCode
        && !taskLines
        && !questionLines
        && CONTAINER_END.test(line)
        && containerDepth > 0
      ) containerDepth -= 1;

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
    return createSlide({ blocks, task });
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

  const capabilities = Object.freeze({
    markdown: true,
    imagesFromHttps: true,
    tasks: Object.freeze(['text', 'number', 'choice', 'abcd']),
    styledContainers: true,
    accordions: true,
    nestedContainers: false,
    styleFonts: STYLE_FONTS,
    styleSizes: STYLE_SIZES,
    styleAligns: STYLE_ALIGNS,
    styleColorFormat: '#RRGGBB',
    requiresLessonParserContainers: true
  });

  const api = {
    BLOCK_TYPES,
    SCHEMA_VERSION,
    STYLE_ALIGNS,
    STYLE_FONTS,
    STYLE_SIZES,
    TASK_TYPES,
    StudioLessonError,
    capabilities,
    createBlock,
    createLesson,
    createSlide,
    createTask,
    parseLesson,
    safeImageUrl,
    serializeBlock,
    serializeLesson,
    serializeTask,
    validateFilename,
    validateLesson
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChemLessonStudioModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
