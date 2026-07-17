(function (root) {
  'use strict';

  const MAX_SOURCE_CHARS = 512 * 1024;
  const MAX_SLIDES = 100;
  const SAFE_FILENAME = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9_.-]{0,79}\.md$/i;
  const TASK_START = /^\s*:::(?:task|zadanie)\s*$/i;
  const TASK_END = /^\s*:::\s*$/;

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

  function checkAnswer(task, value) {
    if (!task || !Array.isArray(task.answers)) return false;
    const candidate = normalizeAnswer(value, task.type, task.caseSensitive);
    if (task.type === 'number' && Number.isNaN(candidate)) return false;
    return task.answers.some((answer) => {
      const expected = normalizeAnswer(answer, task.type, task.caseSensitive);
      return task.type === 'number'
        ? !Number.isNaN(expected) && candidate === expected
        : candidate === expected;
    });
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
      choice: 'choice'
    };
    const type = typeAliases[normalizeKey(values.type || 'text')];
    if (!type) {
      throw new LessonFormatError(
        'INVALID_TASK_TYPE',
        `Slajd ${slideNumber}: typ zadania może mieć wartość text, number albo choice.`
      );
    }

    const answers = String(values.answer || '')
      .split('|')
      .map((answer) => answer.trim())
      .filter(Boolean);
    if (!answers.length) {
      throw new LessonFormatError(
        'MISSING_TASK_ANSWER',
        `Slajd ${slideNumber}: zadanie nie zawiera pola answer.`
      );
    }

    const options = String(values.options || '')
      .split('|')
      .map((option) => option.trim())
      .filter(Boolean);
    if (type === 'choice' && options.length < 2) {
      throw new LessonFormatError(
        'MISSING_TASK_OPTIONS',
        `Slajd ${slideNumber}: zadanie choice wymaga co najmniej dwóch opcji.`
      );
    }

    const caseSensitive = /^(?:1|true|tak|yes)$/i.test(values.caseSensitive || '');
    const task = {
      type,
      answers,
      options,
      caseSensitive,
      label: values.label || (type === 'choice' ? 'Wybierz odpowiedź' : 'Twoja odpowiedź'),
      placeholder: values.placeholder || '',
      hint: values.hint || '',
      success: values.success || 'Dobrze! Możesz przejść dalej.'
    };

    if (type === 'choice' && !options.some((option) => checkAnswer(task, option))) {
      throw new LessonFormatError(
        'ANSWER_NOT_IN_OPTIONS',
        `Slajd ${slideNumber}: poprawna odpowiedź nie występuje na liście options.`
      );
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
    for (const line of text.split('\n')) {
      if (/^\s*```/.test(line)) {
        inCodeFence = !inCodeFence;
        current.push(line);
      } else if (!inCodeFence && /^\s*---\s*$/.test(line)) {
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
    return value.replace(/CHEMLESSONTOKEN(\d+)END/g, (_, index) => tokens[Number(index)] || '');
  }

  function renderMarkdown(source) {
    const lines = String(source || '').split('\n');
    let html = '';
    let inCode = false;
    let listType = '';
    let paragraph = [];

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

    for (const rawLine of lines) {
      const line = rawLine || '';
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
    checkAnswer,
    parseLesson,
    renderMarkdown,
    validateFilename
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChemLesson = api;
})(typeof window !== 'undefined' ? window : globalThis);
