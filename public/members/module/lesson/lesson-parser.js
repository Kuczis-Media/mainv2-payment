(function (root) {
  'use strict';

  const MAX_SOURCE_CHARS = 512 * 1024;
  const MAX_SLIDES = 100;
  const SAFE_FILENAME = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9_.-]{0,79}\.md$/i;
  const TASK_START = /^\s*:::(?:task|zadanie)\s*$/i;
  const TASK_END = /^\s*:::\s*$/;
  const QUESTION_START = /^\s*:::question\s*$/i;
  const STYLE_START = /^\s*:::style(?:\s+(.+?))?\s*$/i;
  const ACCORDION_START = /^\s*:::accordion(?:\s+(.+?))?\s*$/i;
  const STRUCTURAL_CONTAINER_START = /^\s*:::(?:task|zadanie|question|style|accordion|youtube|atonom|flashcards)(?:\s+.*?)?\s*$/i;
  const RICH_CONTAINER_END = /^\s*:::\s*$/;
  const SAFE_STYLE_COLOR = /^#[0-9a-f]{6}$/i;
  const STYLE_FONTS = new Set([
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
  const STYLE_SIZES = new Set(['small', 'normal', 'large', 'xlarge']);
  const STYLE_ALIGNS = new Set(['left', 'center', 'right']);
  const INTERACTIVE_START = /^\s*:::(youtube|atonom|flashcards)\s*$/i;

  class LessonFormatError extends Error {
    constructor(code, message) {
      super(message || code);
      this.name = 'LessonFormatError';
      this.code = code;
    }
  }

  function validateFilename(value) {
    const filename = typeof value === 'string' ? value.trim() : '';
    return SAFE_FILENAME.test(filename) ? filename : '';
  }

  function normalizeKey(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
  }

  function normalizeAnswer(value, type, caseSensitive) {
    let normalized = String(value ?? '')
      .normalize('NFKC')
      .trim()
      .replace(/\s+/g, ' ');
    if (type === 'number') {
      const numeric = Number(normalized.replace(',', '.'));
      return Number.isFinite(numeric) ? numeric : Number.NaN;
    }
    if (!caseSensitive) normalized = normalized.toLocaleLowerCase('pl');
    return normalized;
  }

  function checkGapAnswer(task, value, index) {
    if (
      !task
      || !Array.isArray(task.answers)
      || !Number.isSafeInteger(index)
      || index < 0
      || index >= task.answers.length
    ) return false;
    return normalizeAnswer(value, 'text', task.caseSensitive)
      === normalizeAnswer(task.answers[index], 'text', task.caseSensitive);
  }

  function checkAnswer(task, value) {
    if (!task || !Array.isArray(task.answers)) return false;
    if (task.type === 'gaps' || task.type === 'gaps-text') {
      if (!Array.isArray(value) || value.length !== task.answers.length) return false;
      return task.answers.every((_, index) => checkGapAnswer(task, value[index], index));
    }
    const matchesExpected = (answerValue) => {
      const candidate = normalizeAnswer(answerValue, task.type, task.caseSensitive);
      if (task.type === 'number' && Number.isNaN(candidate)) return false;
      return task.answers.some((answer) => {
        const expected = normalizeAnswer(answer, task.type, task.caseSensitive);
        return task.type === 'number'
          ? !Number.isNaN(expected) && candidate === expected
          : candidate === expected;
      });
    };
    if (matchesExpected(value)) return true;

    if (task.choiceStyle === 'abcd' && Array.isArray(task.options)) {
      const letter = String(value || '').trim().toUpperCase();
      const optionIndex = /^[A-D]$/.test(letter) ? letter.charCodeAt(0) - 65 : -1;
      if (optionIndex >= 0 && optionIndex < task.options.length) {
        return matchesExpected(task.options[optionIndex]);
      }
    }
    return false;
  }

  function parseTask(lines, slideNumber) {
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
      success: 'success',
      sukces: 'success',
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

    for (const rawLine of lines) {
      if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;
      const match = /^\s*([^:]+):\s*(.*)\s*$/.exec(rawLine);
      if (!match) {
        throw new LessonFormatError(
          'INVALID_TASK_FIELD',
          `Slajd ${slideNumber}: każdy wiersz zadania musi mieć postać „pole: wartość”.`
        );
      }
      const rawKey = normalizeKey(match[1]);
      const key = aliases[rawKey];
      if (!key) {
        throw new LessonFormatError(
          'UNKNOWN_TASK_FIELD',
          `Slajd ${slideNumber}: nieznane pole zadania „${match[1].trim()}”.`
        );
      }
      values[key] = match[2].trim();
    }

    const typeAliases = {
      liczba: 'number',
      number: 'number',
      tekst: 'text',
      text: 'text',
      wybor: 'choice',
      choice: 'choice',
      abcd: 'abcd',
      gaps: 'gaps',
      luki: 'gaps',
      gaps_text: 'gaps-text',
      luki_tekstowe: 'gaps-text'
    };
    const requestedType = typeAliases[normalizeKey(values.type || 'text')];
    if (!requestedType) {
      throw new LessonFormatError(
        'INVALID_TASK_TYPE',
        `Slajd ${slideNumber}: typ zadania może mieć wartość text, number, choice, abcd, gaps albo gaps-text.`
      );
    }
    const type = requestedType === 'abcd' ? 'choice' : requestedType;
    const choiceStyle = requestedType === 'abcd' ? 'abcd' : 'default';

    const options = String(values.options || '')
      .split('|')
      .map((option) => option.trim())
      .filter(Boolean);
    if ((type === 'choice' || type === 'gaps') && options.length < 2) {
      throw new LessonFormatError(
        'MISSING_TASK_OPTIONS',
        `Slajd ${slideNumber}: zadanie wyboru wymaga co najmniej dwóch opcji.`
      );
    }
    if (choiceStyle === 'abcd' && options.length !== 4) {
      throw new LessonFormatError(
        'INVALID_ABCD_OPTIONS',
        `Slajd ${slideNumber}: quiz abcd wymaga dokładnie czterech opcji.`
      );
    }

    const answers = String(values.answer || '')
      .split('|')
      .map((answer) => answer.trim())
      .filter(Boolean)
      .map((answer) => {
        if (choiceStyle !== 'abcd') return answer;
        const letter = answer.toUpperCase();
        const optionIndex = /^[A-D]$/.test(letter) ? letter.charCodeAt(0) - 65 : -1;
        return optionIndex >= 0 && optionIndex < options.length ? options[optionIndex] : answer;
      });
    if (!answers.length) {
      throw new LessonFormatError(
        'MISSING_TASK_ANSWER',
        `Slajd ${slideNumber}: zadanie nie zawiera pola answer.`
      );
    }

    const caseSensitive = /^(?:1|true|tak|yes)$/i.test(values.caseSensitive || '');
    const task = {
      type,
      choiceStyle,
      answers,
      options,
      caseSensitive,
      checkMode: values.checkMode === 'each' ? 'each' : 'all',
      label: values.label || (
        type === 'choice' || type === 'gaps'
          ? 'Wybierz odpowiedź'
          : type === 'gaps-text' ? 'Wpisz odpowiedzi w luki' : 'Twoja odpowiedź'
      ),
      placeholder: values.placeholder || '',
      text: values.text || '',
      hint: values.hint || '',
      success: values.success || 'Dobrze! Możesz przejść dalej.'
    };

    const allAnswersMatchOptions = answers.every((answer) => options.some((option) => (
      normalizeAnswer(answer, type, caseSensitive) === normalizeAnswer(option, type, caseSensitive)
    )));
    if ((type === 'choice' || type === 'gaps') && !allAnswersMatchOptions) {
      throw new LessonFormatError(
        'ANSWER_NOT_IN_OPTIONS',
        `Slajd ${slideNumber}: poprawna odpowiedź nie występuje na liście options.`
      );
    }
    if (type === 'gaps' || type === 'gaps-text') {
      const gapCount = (task.text.match(/\{\{[^{}]*\}\}/g) || []).length;
      if (!task.text || gapCount < 1 || gapCount !== answers.length) {
        throw new LessonFormatError(
          'INVALID_GAPS',
          `Slajd ${slideNumber}: liczba znaczników {{luka}} musi odpowiadać liczbie poprawnych odpowiedzi.`
        );
      }
    }
    return task;
  }

  function parseSlide(source, index) {
    const lines = source.split('\n');
    const content = [];
    let task = null;
    let taskLines = null;

    for (const line of lines) {
      if (taskLines) {
        if (TASK_END.test(line)) {
          task = parseTask(taskLines, index + 1);
          taskLines = null;
        } else {
          taskLines.push(line);
        }
        continue;
      }
      if (TASK_START.test(line)) {
        if (task) {
          throw new LessonFormatError(
            'MULTIPLE_TASKS',
            `Slajd ${index + 1}: dozwolone jest tylko jedno zadanie.`
          );
        }
        taskLines = [];
        continue;
      }
      content.push(line);
    }

    if (taskLines) {
      throw new LessonFormatError(
        'UNCLOSED_TASK',
        `Slajd ${index + 1}: blok zadania nie został zamknięty linią :::.`
      );
    }

    const markdown = content.join('\n').trim();
    if (!markdown && !task) {
      throw new LessonFormatError('EMPTY_SLIDE', `Slajd ${index + 1} jest pusty.`);
    }
    const heading = markdown.match(/^\s*#{1,3}\s+(.+?)\s*$/m);
    return {
      markdown,
      html: renderMarkdown(markdown),
      title: heading ? stripMarkdown(heading[1]) : `Krok ${index + 1}`,
      task
    };
  }

  function parseLesson(source, filename = 'lekcja.md') {
    const text = String(source || '')
      .replace(/^\uFEFF/, '')
      .replace(/\r\n?/g, '\n');
    if (!text.trim()) throw new LessonFormatError('EMPTY_LESSON', 'Plik lekcji jest pusty.');
    if (text.length > MAX_SOURCE_CHARS) {
      throw new LessonFormatError('LESSON_TOO_LARGE', 'Plik lekcji jest zbyt duży.');
    }
    if (text.includes('\0')) {
      throw new LessonFormatError('INVALID_LESSON', 'Plik lekcji zawiera niedozwolone znaki.');
    }

    const parts = [];
    let current = [];
    let inCodeFence = false;
    let containerDepth = 0;
    for (const line of text.split('\n')) {
      if (/^\s*```/.test(line)) {
        inCodeFence = !inCodeFence;
        current.push(line);
      } else if (!inCodeFence && STRUCTURAL_CONTAINER_START.test(line)) {
        containerDepth += 1;
        current.push(line);
      } else if (!inCodeFence && TASK_END.test(line) && containerDepth > 0) {
        containerDepth -= 1;
        current.push(line);
      } else if (!inCodeFence && containerDepth === 0 && /^\s*---\s*$/.test(line)) {
        if (!current.join('\n').trim()) {
          throw new LessonFormatError(
            'EMPTY_SLIDE',
            `Slajd ${parts.length + 1} jest pusty. Usuń sąsiadujące separatory ---.`
          );
        }
        parts.push(current.join('\n'));
        current = [];
      } else {
        current.push(line);
      }
    }
    if (current.join('\n').trim()) parts.push(current.join('\n'));
    if (!parts.length) throw new LessonFormatError('EMPTY_LESSON', 'Plik lekcji jest pusty.');
    if (parts.length > MAX_SLIDES) {
      throw new LessonFormatError('TOO_MANY_SLIDES', `Lekcja może mieć maksymalnie ${MAX_SLIDES} slajdów.`);
    }

    const slides = parts.map(parseSlide);
    const firstHeading = text.match(/^\s*#\s+(.+?)\s*$/m);
    const fallback = String(filename || 'Lekcja').replace(/\.md$/i, '').replace(/[-_]+/g, ' ');
    return {
      title: firstHeading ? stripMarkdown(firstHeading[1]) : fallback,
      signature: lessonSignature(text),
      slides
    };
  }

  function lessonSignature(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `${value.length}-${(hash >>> 0).toString(36)}`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function safeUrl(value, image) {
    const raw = String(value || '').trim();
    if (!raw || raw.startsWith('//') || raw.includes('\\') || /[\u0000-\u001f]/.test(raw)) return '';
    if (raw.startsWith('#') && !image) return raw;
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(raw);
    if (!scheme) return raw;
    const protocol = scheme[1].toLowerCase();
    if (protocol === 'http' || protocol === 'https') return raw;
    if (!image && protocol === 'mailto') return raw;
    return '';
  }

  function parseStyleOptions(source) {
    const values = {};
    String(source || '').replace(
      /([a-z_]+)=("[^"]*"|'[^']*'|[^\s]+)/gi,
      (_, rawKey, rawValue) => {
        const key = rawKey.toLowerCase();
        const value = rawValue.replace(/^(["'])|(["'])$/g, '').trim().toLowerCase();
        values[key] = value;
        return '';
      }
    );
    const font = STYLE_FONTS.has(values.font) ? values.font : 'sans';
    const size = STYLE_SIZES.has(values.size) ? values.size : 'normal';
    const align = STYLE_ALIGNS.has(values.align) ? values.align : 'left';
    const bold = /^(?:1|true|yes|tak|bold|700)$/i.test(values.bold || values.weight || '');
    const color = SAFE_STYLE_COLOR.test(values.color || '') ? values.color.toLowerCase() : '';
    const background = SAFE_STYLE_COLOR.test(values.background || '') ? values.background.toLowerCase() : '';
    return { font, size, align, bold, color, background };
  }

  function styleContainerHtml(options) {
    const classes = [
      'lesson-rich-style',
      `lesson-font-${options.font}`,
      `lesson-size-${options.size}`,
      `lesson-align-${options.align}`
    ];
    if (options.bold) classes.push('lesson-weight-bold');
    if (options.background) classes.push('has-background');
    const style = options.color
      || options.background
      ? ` style="${options.color ? `--lesson-rich-color:${escapeHtml(options.color)};` : ''}${options.background ? `--lesson-rich-background:${escapeHtml(options.background)};` : ''}"`
      : '';
    return `<div class="${classes.join(' ')}"${style}>`;
  }

  function parseAccordionOptions(source) {
    const raw = String(source || '').trim();
    const open = /\s+open=(?:1|true|yes|tak)\s*$/i.test(raw);
    const title = raw.replace(/\s+open=(?:1|true|yes|tak)\s*$/i, '').trim();
    return { open, title: title || 'Więcej informacji' };
  }

  function youtubeVideoId(value) {
    const raw = String(value || '').trim();
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

  function directiveFields(body) {
    const values = {};
    String(body || '').split('\n').forEach((line) => {
      const match = /^\s*([a-z_]+):\s*(.*?)\s*$/i.exec(line);
      if (match) values[match[1].toLowerCase()] = match[2];
    });
    return values;
  }

  function interactiveBlockHtml(type, body) {
    const values = directiveFields(body);
    if (type === 'youtube') {
      const id = youtubeVideoId(values.id || values.url);
      if (!id) return '<p class="lesson-interactive-error">Nieprawidłowy film YouTube.</p>';
      const title = values.title || 'Film do lekcji';
      return `<figure class="lesson-embed lesson-youtube"><iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(id)}" title="${escapeHtml(title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe><figcaption>${escapeHtml(title)}</figcaption></figure>`;
    }
    if (type === 'atonom') {
      const formula = String(values.formula || '').trim();
      if (!formula || formula.length > 140 || /[\u0000-\u001f<>\\]/.test(formula)) {
        return '<p class="lesson-interactive-error">Nieprawidłowa nazwa związku dla ATONOM.</p>';
      }
      const title = values.title || `Model cząsteczki: ${formula}`;
      const src = `/members/module/atonom/?formula=${encodeURIComponent(formula)}`;
      return `<figure class="lesson-embed lesson-atonom" data-atonom-formula="${escapeHtml(formula)}"><div class="lesson-atonom-card"><span class="lesson-atonom-symbol" aria-hidden="true">⚛</span><span class="lesson-atonom-copy"><small>Interaktywny model 3D</small><strong>${escapeHtml(formula)}</strong><span>Model zostanie uruchomiony dopiero po kliknięciu.</span></span><button class="lesson-atonom-open" type="button" data-atonom-src="${escapeHtml(src)}" data-atonom-title="${escapeHtml(title)}" aria-expanded="false">Pokaż związek</button></div><div class="lesson-atonom-frame" hidden></div><figcaption>${escapeHtml(title)}</figcaption></figure>`;
    }

    const color = SAFE_STYLE_COLOR.test(values.color || '') ? values.color.toLowerCase() : '#7c3aed';
    const title = values.title || 'Fiszki do utrwalenia';
    const cards = String(body || '').split('\n')
      .filter((line) => !/^\s*(?:title|color):/i.test(line))
      .map((line) => line.split(/\s*=>\s*/, 2))
      .filter((parts) => parts.length === 2 && parts[0].trim() && parts[1].trim())
      .slice(0, 20);
    if (cards.length < 2) return '<p class="lesson-interactive-error">Dodaj co najmniej dwie kompletne fiszki.</p>';
    const items = cards.map(([front, back], index) => (
      `<button class="lesson-flashcard" type="button" aria-pressed="false" style="--flashcard-color:${escapeHtml(color)}"><span class="flashcard-face flashcard-front"><small>Fiszka ${index + 1}</small><strong>${escapeHtml(front.trim())}</strong><em>Kliknij, aby odsłonić</em></span><span class="flashcard-face flashcard-back"><small>Odpowiedź</small><strong>${escapeHtml(back.trim())}</strong><em>Kliknij, aby wrócić</em></span></button>`
    )).join('');
    return `<section class="lesson-flashcards" aria-label="${escapeHtml(title)}"><h3>${escapeHtml(title)}</h3><div class="lesson-flashcard-grid">${items}</div></section>`;
  }

  function extractInteractiveBlocks(source, interactiveBlocks) {
    const lines = String(source || '').split('\n');
    const prepared = [];
    let inCode = false;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (/^\s*```/.test(line)) {
        inCode = !inCode;
        prepared.push(line);
        continue;
      }
      const start = !inCode ? INTERACTIVE_START.exec(line) : null;
      if (!start) {
        prepared.push(line);
        continue;
      }
      const body = [];
      let end = index + 1;
      while (end < lines.length && !RICH_CONTAINER_END.test(lines[end])) {
        body.push(lines[end]);
        end += 1;
      }
      if (end >= lines.length) {
        prepared.push(line);
        continue;
      }
      const html = interactiveBlockHtml(start[1].toLowerCase(), body.join('\n'));
      prepared.push(`CHEMLESSONBLOCK${interactiveBlocks.push(html) - 1}END`);
      index = end;
    }
    return prepared.join('\n');
  }

  function renderInline(source) {
    const tokens = [];
    const keep = (html) => `CHEMLESSONTOKEN${tokens.push(html) - 1}END`;
    let value = String(source || '');

    value = value.replace(/`([^`\n]+)`/g, (_, code) => keep(`<code>${escapeHtml(code)}</code>`));
    value = value.replace(/!\[([^\]\n]*)\]\(([^)\n]+)\)/g, (_, alt, rawUrl) => {
      const url = safeUrl(rawUrl, true);
      if (!url) return escapeHtml(alt);
      return keep(`<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy">`);
    });
    value = value.replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/g, (_, label, rawUrl) => {
      const url = safeUrl(rawUrl, false);
      if (!url) return escapeHtml(label);
      const external = /^https?:/i.test(url);
      const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
      return keep(`<a href="${escapeHtml(url)}"${attrs}>${escapeHtml(label)}</a>`);
    });

    value = escapeHtml(value);
    value = value.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    value = value.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    value = value.replace(/\^([^^\n]{1,40})\^/g, '<sup>$1</sup>');
    value = value.replace(/~([^~\n]{1,40})~/g, '<sub>$1</sub>');
    return value
      .replace(/CHEMLESSONTOKEN(\d+)END/g, (_, index) => tokens[Number(index)] || '')
      .replace(
        /<img\b([^>]*)\sloading="lazy">/g,
        '<img$1 loading="lazy" decoding="async" referrerpolicy="no-referrer">'
      );
  }

  function renderMarkdown(source) {
    const interactiveBlocks = [];
    const preparedSource = extractInteractiveBlocks(source, interactiveBlocks);
    const lines = preparedSource.split('\n');
    let html = '';
    let inCode = false;
    let listType = '';
    let paragraph = [];
    const richContainers = [];

    const closeList = () => {
      if (!listType) return;
      html += `</${listType}>`;
      listType = '';
    };
    const closeParagraph = () => {
      if (!paragraph.length) return;
      html += `<p>${paragraph.map((line) => renderInline(line.trim())).join(' ')}</p>`;
      paragraph = [];
    };
    const closeBlocks = () => {
      closeParagraph();
      closeList();
    };
    const closeRichContainer = () => {
      const container = richContainers.pop();
      if (!container) return false;
      html += container === 'accordion' ? '</div></details>' : '</div>';
      return true;
    };

    for (const rawLine of lines) {
      const line = rawLine || '';
      const interactive = /^\s*CHEMLESSONBLOCK(\d+)END\s*$/.exec(line);
      if (interactive) {
        closeBlocks();
        html += interactiveBlocks[Number(interactive[1])] || '';
        continue;
      }
      if (/^\s*```/.test(line)) {
        closeBlocks();
        if (inCode) {
          html += '</code></pre>';
          inCode = false;
        } else {
          html += '<pre><code>';
          inCode = true;
        }
        continue;
      }
      if (inCode) {
        html += `${escapeHtml(line)}\n`;
        continue;
      }

      if (QUESTION_START.test(line)) {
        closeBlocks();
        html += '<div class="lesson-question">';
        richContainers.push('question');
        continue;
      }

      const styleStart = STYLE_START.exec(line);
      if (styleStart) {
        closeBlocks();
        html += styleContainerHtml(parseStyleOptions(styleStart[1]));
        richContainers.push('style');
        continue;
      }

      const accordionStart = ACCORDION_START.exec(line);
      if (accordionStart) {
        closeBlocks();
        const accordion = parseAccordionOptions(accordionStart[1]);
        html += `<details class="lesson-accordion"${accordion.open ? ' open' : ''}><summary>${renderInline(accordion.title)}</summary><div class="lesson-accordion-content">`;
        richContainers.push('accordion');
        continue;
      }

      if (RICH_CONTAINER_END.test(line) && richContainers.length) {
        closeBlocks();
        closeRichContainer();
        continue;
      }

      if (!line.trim()) {
        closeBlocks();
        continue;
      }

      const heading = /^(#{1,3})\s+(.+)$/.exec(line);
      if (heading) {
        closeBlocks();
        const level = heading[1].length;
        html += `<h${level}>${renderInline(heading[2].trim())}</h${level}>`;
        continue;
      }

      const quote = /^\s*>\s?(.*)$/.exec(line);
      if (quote) {
        closeBlocks();
        html += `<blockquote>${renderInline(quote[1])}</blockquote>`;
        continue;
      }

      const unordered = /^\s*[-*+]\s+(.+)$/.exec(line);
      const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
      if (unordered || ordered) {
        closeParagraph();
        const nextType = ordered ? 'ol' : 'ul';
        if (listType && listType !== nextType) closeList();
        if (!listType) {
          listType = nextType;
          html += `<${listType}>`;
        }
        html += `<li>${renderInline((ordered || unordered)[1])}</li>`;
        continue;
      }

      closeList();
      paragraph.push(line);
    }

    closeBlocks();
    if (inCode) html += '</code></pre>';
    while (richContainers.length) closeRichContainer();
    return html;
  }

  function stripMarkdown(value) {
    return String(value || '')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*_`~^]/g, '')
      .trim();
  }

  const api = {
    LessonFormatError,
    checkGapAnswer,
    checkAnswer,
    parseLesson,
    renderMarkdown,
    validateFilename
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChemLesson = api;
})(typeof window !== 'undefined' ? window : globalThis);
