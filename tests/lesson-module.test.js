const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const lessonRoot = path.join(root, 'public', 'members', 'module', 'lesson');
const parser = require(path.join(lessonRoot, 'lesson-parser.js'));

test('lesson parser builds a wizard from the bundled Markdown example', () => {
  const markdown = fs.readFileSync(path.join(lessonRoot, 'izotopy-wegla.md'), 'utf8');
  const lesson = parser.parseLesson(markdown, 'izotopy-wegla.md');

  assert.equal(lesson.title, 'Izotopy węgla');
  assert.equal(lesson.slides.length, 5);
  assert.match(lesson.signature, /^\d+-[a-z0-9]+$/);
  assert.equal(lesson.slides[2].task.type, 'number');
  assert.equal(parser.checkAnswer(lesson.slides[2].task, '7'), true);
  assert.equal(parser.checkAnswer(lesson.slides[2].task, '7,0'), true);
  assert.equal(parser.checkAnswer(lesson.slides[2].task, '6'), false);
  assert.equal(lesson.slides[3].task.choiceStyle, 'abcd');
  assert.equal(parser.checkAnswer(lesson.slides[3].task, 'B'), true);
  assert.equal(parser.checkAnswer(lesson.slides[3].task, '6'), true);
  assert.equal(parser.checkAnswer(lesson.slides[3].task, 'A'), false);
  assert.match(lesson.slides[1].html, /<sup>13<\/sup>C/);
});

test('the legacy example filename remains an exact alias of the published carbon lesson', () => {
  const published = fs.readFileSync(path.join(lessonRoot, 'izotopy-wegla.md'), 'utf8');
  const legacy = fs.readFileSync(path.join(lessonRoot, 'przyklad.md'), 'utf8');

  assert.equal(legacy, published);
});

test('a slide separator inside a fenced code block remains lesson content', () => {
  const lesson = parser.parseLesson([
    '# Kod',
    '```md',
    '---',
    '```',
    '---',
    '# Drugi slajd'
  ].join('\n'), 'kod.md');

  assert.equal(lesson.slides.length, 2);
  assert.match(lesson.slides[0].html, /---/);
});

test('lesson tasks support text aliases and multiple-choice answers', () => {
  const lesson = parser.parseLesson([
    '# Powtórka',
    '',
    ':::zadanie',
    'typ: tekst',
    'odpowiedź: atom | ATOM',
    'wielkość liter: nie',
    ':::',
    '',
    '---',
    '',
    '## Wybór',
    '',
    ':::task',
    'type: choice',
    'answer: 7',
    'options: 6 | 7 | 13',
    ':::'
  ].join('\n'), 'quiz.md');

  assert.equal(parser.checkAnswer(lesson.slides[0].task, '  ATOM  '), true);
  assert.equal(parser.checkAnswer(lesson.slides[1].task, '7'), true);
  assert.equal(parser.checkAnswer(lesson.slides[1].task, '13'), false);
});

test('lesson tasks support an ABCD quiz with a letter or option as the answer', () => {
  const lesson = parser.parseLesson([
    '# Quiz',
    '',
    ':::task',
    'type: abcd',
    'label: Wybierz poprawny symbol tlenu',
    'options: H | O | N | C',
    'answer: B',
    ':::'
  ].join('\n'), 'abcd.md');
  const task = lesson.slides[0].task;

  assert.equal(task.type, 'choice');
  assert.equal(task.choiceStyle, 'abcd');
  assert.deepEqual(task.options, ['H', 'O', 'N', 'C']);
  assert.equal(parser.checkAnswer(task, 'B'), true);
  assert.equal(parser.checkAnswer(task, 'O'), true);
  assert.equal(parser.checkAnswer(task, 'A'), false);
  const singleLetterOptions = parser.parseLesson([
    '# Symbole',
    ':::task',
    'type: abcd',
    'options: C | O | N | H',
    'answer: A',
    ':::'
  ].join('\n'), 'symbole.md').slides[0].task;
  assert.equal(parser.checkAnswer(singleLetterOptions, 'A'), true);
  assert.equal(parser.checkAnswer(singleLetterOptions, 'C'), true);
  assert.equal(parser.checkAnswer(singleLetterOptions, 'B'), false);
  assert.throws(
    () => parser.parseLesson('# Quiz\n\n:::task\ntype: abcd\noptions: A | B | C\nanswer: B\n:::', 'blad.md'),
    /dokładnie czterech opcji/i
  );
});

test('lesson renderer supports allowlisted typography, colors and accordions without executing HTML', () => {
  const lesson = parser.parseLesson([
    '# Stylowana lekcja',
    '',
    ':::style font=serif color=#0e665a size=large align=center',
    '## Kolorowy nagłówek',
    '',
    'Tekst zapisany bez surowego HTML.',
    ':::',
    '',
    ':::accordion Dodatkowe wyjaśnienie open=true',
    'Treść **harmonijki**.',
    ':::',
    '',
    ':::style font=evil color=red size=huge align=justify',
    '<script>alert(1)</script>',
    ':::'
  ].join('\n'), 'style.md');

  const html = lesson.slides[0].html;
  assert.match(html, /lesson-font-serif/);
  assert.match(html, /lesson-size-large/);
  assert.match(html, /lesson-align-center/);
  assert.match(html, /--lesson-rich-color:#0e665a/);
  assert.match(html, /<details class="lesson-accordion" open>/);
  assert.match(html, /<summary>Dodatkowe wyjaśnienie<\/summary>/);
  assert.match(html, /Treść <strong>harmonijki<\/strong>/);
  assert.match(html, /lesson-font-sans/);
  assert.doesNotMatch(html, /color:red|font-evil|size-huge|align-justify/);
  assert.doesNotMatch(html, /<script>/);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('lesson filename and Markdown rendering reject path traversal and active HTML', () => {
  assert.equal(parser.validateFilename('dzial-1.md'), 'dzial-1.md');
  assert.equal(parser.validateFilename('../sekret.md'), '');
  assert.equal(parser.validateFilename('lekcja.html'), '');

  const html = parser.renderMarkdown([
    '# Test',
    '<script>alert(1)</script>',
    '[zły link](javascript:alert(1))',
    '![zły obraz](data:text/html,boom)',
    '![bezpieczny obraz](https://example.com/schemat.png)'
  ].join('\n'));
  assert.doesNotMatch(html, /<script>/i);
  assert.doesNotMatch(html, /href="javascript:/i);
  assert.doesNotMatch(html, /src="data:/i);
  assert.match(
    html,
    /<img src="https:\/\/example\.com\/schemat\.png" alt="bezpieczny obraz" loading="lazy" decoding="async" referrerpolicy="no-referrer">/
  );

  const fencedDirective = parser.renderMarkdown([
    '```text',
    ':::youtube',
    'id: M7lc1UVf-VE',
    ':::',
    '```'
  ].join('\n'));
  assert.doesNotMatch(fencedDirective, /<iframe/);
  assert.match(fencedDirective, /:::youtube/);
});

test('lesson parser reports authoring errors instead of silently skipping tasks', () => {
  assert.throws(
    () => parser.parseLesson('# Zadanie\n\n:::task\ntype: number\n:::', 'blad.md'),
    /nie zawiera pola answer/i
  );
  assert.throws(
    () => parser.parseLesson('# A\n\n---\n\n---\n\n# B', 'blad.md'),
    /jest pusty/i
  );
});
