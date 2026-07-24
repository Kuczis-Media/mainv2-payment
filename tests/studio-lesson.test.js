const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.join(__dirname, '..');
const studio = require(path.join(root, 'public', 'members', 'module', 'studio', 'lesson-model.js'));
const lessonParser = require(path.join(root, 'public', 'members', 'module', 'lesson', 'lesson-parser.js'));

test('studio serializes visual blocks and an ABCD quiz to deterministic lesson Markdown', () => {
  const lesson = studio.createLesson({
    title: 'Wiązania chemiczne',
    filename: 'wiazania.md',
    slides: [
      {
        blocks: [
          { type: 'text', text: 'Poznaj podstawy.' },
          { type: 'list', items: ['wiązanie jonowe', 'wiązanie kowalencyjne'] },
          { type: 'quote', text: 'Elektrony walencyjne decydują o wiązaniach.' }
        ]
      },
      {
        blocks: [
          { type: 'heading', level: 2, text: 'Quiz' },
          { type: 'image', alt: 'Model cząsteczki', url: 'https://example.com/model.png' }
        ],
        task: {
          type: 'abcd',
          question: 'Które wiązanie polega na uwspólnieniu elektronów?',
          options: ['Jonowe', 'Kowalencyjne', 'Metaliczne', 'Wodorowe'],
          correctOption: 1,
          hint: 'Pomyśl o wspólnej parze elektronowej.',
          feedback: 'Brawo — to wiązanie kowalencyjne.'
        }
      }
    ]
  });

  const markdown = studio.serializeLesson(lesson);
  assert.equal(markdown, [
    '# Wiązania chemiczne',
    '',
    'Poznaj podstawy.',
    '',
    '- wiązanie jonowe',
    '- wiązanie kowalencyjne',
    '',
    '> Elektrony walencyjne decydują o wiązaniach.',
    '',
    '---',
    '',
    '## Quiz',
    '',
    '![Model cząsteczki](https://example.com/model.png)',
    '',
    'Które wiązanie polega na uwspólnieniu elektronów?',
    '',
    ':::task',
    'type: abcd',
    'label: Wybierz odpowiedź',
    'options: Jonowe | Kowalencyjne | Metaliczne | Wodorowe',
    'answer: B',
    'hint: Pomyśl o wspólnej parze elektronowej.',
    'success: Brawo — to wiązanie kowalencyjne.',
    ':::',
    ''
  ].join('\n'));

  const published = lessonParser.parseLesson(markdown, lesson.filename);
  assert.equal(published.title, 'Wiązania chemiczne');
  assert.equal(published.slides.length, 2);
  assert.equal(published.slides[1].task.choiceStyle, 'abcd');
  assert.equal(lessonParser.checkAnswer(published.slides[1].task, 'B'), true);
  assert.equal(lessonParser.checkAnswer(published.slides[1].task, 'Kowalencyjne'), true);
  assert.match(published.slides[1].html, /https:\/\/example\.com\/model\.png/);
});

test('studio emits text and numeric questions with hints and positive feedback', () => {
  const markdown = studio.serializeLesson({
    title: 'Krótki sprawdzian',
    filename: 'sprawdzian.md',
    slides: [
      {
        blocks: [{ type: 'heading', level: 2, text: 'Symbol pierwiastka' }],
        task: {
          type: 'text',
          question: 'Podaj symbol tlenu.',
          answers: ['O'],
          caseSensitive: true,
          placeholder: 'Wpisz symbol',
          hint: 'To jedna wielka litera.',
          feedback: 'Poprawnie!'
        }
      },
      {
        blocks: [{ type: 'heading', level: 2, text: 'Liczba atomowa' }],
        task: {
          type: 'number',
          question: 'Ile protonów ma atom tlenu?',
          answer: 8,
          label: 'Liczba protonów',
          hint: 'Sprawdź układ okresowy.',
          feedback: 'Tak — tlen ma 8 protonów.'
        }
      }
    ]
  });

  const lesson = lessonParser.parseLesson(markdown, 'sprawdzian.md');
  assert.equal(lesson.slides[0].task.type, 'text');
  assert.equal(lesson.slides[0].task.caseSensitive, true);
  assert.equal(lessonParser.checkAnswer(lesson.slides[0].task, 'O'), true);
  assert.equal(lessonParser.checkAnswer(lesson.slides[0].task, 'o'), false);
  assert.equal(lesson.slides[0].task.hint, 'To jedna wielka litera.');
  assert.equal(lesson.slides[0].task.success, 'Poprawnie!');
  assert.equal(lesson.slides[1].task.type, 'number');
  assert.equal(lessonParser.checkAnswer(lesson.slides[1].task, '8,0'), true);
  assert.equal(lesson.slides[1].task.success, 'Tak — tlen ma 8 protonów.');
});

test('studio imports the published lesson into editable blocks and preserves task semantics', () => {
  const source = [
    '# Izotopy',
    '',
    'Treść wprowadzenia.',
    '',
    '---',
    '',
    '## Zadanie',
    '',
    'Ile neutronów ma węgiel-13?',
    '',
    ':::task',
    'type: number',
    'label: Liczba neutronów',
    'answer: 7',
    'hint: Oblicz A − Z.',
    'success: Dobrze!',
    ':::'
  ].join('\n');

  const model = studio.parseLesson(source, 'izotopy.md');
  assert.equal(model.title, 'Izotopy');
  assert.equal(model.slides.length, 2);
  assert.equal(model.slides[1].task.question, 'Ile neutronów ma węgiel-13?');
  assert.deepEqual(model.slides[1].task.answers, ['7']);
  assert.equal(model.slides[1].task.feedback, 'Dobrze!');

  const reparsed = lessonParser.parseLesson(studio.serializeLesson(model), 'izotopy.md');
  assert.equal(reparsed.slides[1].task.type, 'number');
  assert.equal(lessonParser.checkAnswer(reparsed.slides[1].task, '7'), true);
});

test('complex task questions keep paragraphs and Markdown structure across export and import', () => {
  const questions = [
    'Pierwszy akapit pytania.\n\nDrugi akapit pytania?',
    '### Wybierz poprawną odpowiedź',
    '- atom\n- cząsteczka',
    '> Zinterpretuj tę wskazówkę.',
    '![Schemat](https://example.com/schemat.png)'
  ];
  const lesson = studio.createLesson({
    title: 'Złożone pytania',
    filename: 'zlozone-pytania.md',
    slides: questions.map((question, index) => ({
      blocks: [{ type: 'heading', level: 2, text: `Krok ${index + 1}` }],
      task: {
        type: 'text',
        question,
        answers: ['tak']
      }
    }))
  });

  const markdown = studio.serializeLesson(lesson);
  assert.equal((markdown.match(/:::question/g) || []).length, questions.length);

  const imported = studio.parseLesson(markdown, lesson.filename);
  assert.deepEqual(imported.slides.map((slide) => slide.task.question), questions);

  const published = lessonParser.parseLesson(markdown, lesson.filename);
  published.slides.forEach((slide) => {
    assert.match(slide.html, /class="lesson-question"/);
    assert.doesNotMatch(slide.html, /:::question/);
  });

  const legacy = studio.parseLesson([
    '# Starszy zapis',
    '',
    '### Pytanie jako nagłówek',
    '',
    ':::task',
    'type: text',
    'answer: tak',
    ':::'
  ].join('\n'), 'starszy.md');
  assert.equal(legacy.slides[0].task.question, '### Pytanie jako nagłówek');
});

test('studio serializes code, callouts, safe style containers and accordions', () => {
  const lesson = studio.createLesson({
    title: 'Materiały interaktywne',
    slides: [{
      blocks: [
        { type: 'callout', tone: 'tip', title: 'Wskazówka', text: 'Zapisz jednostkę.' },
        { type: 'code', language: 'js', code: 'const mol = 6.022e23;' },
        {
          type: 'style',
          font: 'serif',
          color: '#0F766E',
          size: 'large',
          align: 'center',
          blocks: [{ type: 'text', text: 'Wyróżniona definicja.' }]
        },
        {
          type: 'accordion',
          title: 'Pokaż rozwiązanie',
          open: true,
          blocks: [
            { type: 'heading', level: 3, text: 'Rozwiązanie' },
            { type: 'text', text: 'Najpierw oblicz liczbę moli.' }
          ]
        }
      ]
    }]
  });

  const markdown = studio.serializeLesson(lesson);
  assert.match(markdown, /> \*\*Wskazówka:\*\* Zapisz jednostkę\./);
  assert.match(markdown, /```js\nconst mol = 6\.022e23;\n```/);
  assert.match(markdown, /:::style font=serif color=#0f766e size=large align=center\nWyróżniona definicja\.\n:::/);
  assert.match(markdown, /:::accordion Pokaż rozwiązanie open=true\n### Rozwiązanie\n\nNajpierw oblicz liczbę moli\.\n:::/);

  const imported = studio.parseLesson(markdown, 'materialy.md');
  assert.equal(imported.slides[0].blocks.find((block) => block.type === 'callout').title, 'Wskazówka');
  assert.equal(imported.slides[0].blocks.find((block) => block.type === 'style').font, 'serif');
  assert.equal(imported.slides[0].blocks.find((block) => block.type === 'style').color, '#0f766e');
  assert.equal(imported.slides[0].blocks.find((block) => block.type === 'accordion').blocks.length, 2);
  assert.equal(imported.slides[0].blocks.find((block) => block.type === 'accordion').open, true);
  assert.match(lessonParser.parseLesson(markdown, 'materialy.md').slides[0].html, /<details class="lesson-accordion" open>/);
});

test('studio publishes backgrounds, YouTube, ATONOM, flashcards and selectable text gaps', () => {
  const lesson = studio.createLesson({
    title: 'Chemia angażująca',
    filename: 'chemia-angazujaca.md',
    slides: [{
      blocks: [
        {
          type: 'style',
          font: 'rounded',
          color: '#173f35',
          background: '#dff7ed',
          size: 'large',
          align: 'center',
          blocks: [{ type: 'text', text: 'Zapamiętaj grupy funkcyjne.' }]
        },
        { type: 'youtube', video: 'https://youtu.be/M7lc1UVf-VE', title: 'Wprowadzenie' },
        { type: 'atonom', formula: 'kwas octowy', title: 'Obejrzyj model 3D' },
        {
          type: 'flashcards',
          title: 'Szybka powtórka',
          color: '#7c3aed',
          cards: [
            { front: '–OH', back: 'grupa hydroksylowa' },
            { front: '–COOH', back: 'grupa karboksylowa' }
          ]
        }
      ],
      task: {
        type: 'gaps',
        question: 'Uzupełnij opis.',
        text: 'Etanol jest {{typ związku}}, a zawarta w nim grupa to {{nazwa grupy}}.',
        options: ['alkoholem', 'aldehydem', 'hydroksylowa', 'karboksylowa'],
        answers: ['alkoholem', 'hydroksylowa'],
        feedback: 'Wszystkie luki są poprawne.'
      }
    }]
  });

  const markdown = studio.serializeLesson(lesson);
  assert.match(markdown, /background=#dff7ed/);
  assert.match(markdown, /:::youtube\nid: M7lc1UVf-VE\n/);
  assert.match(markdown, /:::atonom\nformula: kwas octowy\n/);
  assert.match(markdown, /–OH => grupa hydroksylowa/);
  assert.match(markdown, /type: gaps/);
  assert.match(markdown, /text: Etanol jest \{\{typ związku\}\}/);

  const imported = studio.parseLesson(markdown, lesson.filename);
  assert.deepEqual(
    imported.slides[0].blocks.map((block) => block.type),
    ['heading', 'style', 'youtube', 'atonom', 'flashcards']
  );
  assert.equal(imported.slides[0].blocks[1].background, '#dff7ed');
  assert.equal(imported.slides[0].blocks[3].formula, 'kwas octowy');
  assert.equal(imported.slides[0].blocks[4].cards.length, 2);
  assert.equal(imported.slides[0].task.type, 'gaps');

  const published = lessonParser.parseLesson(markdown, lesson.filename);
  const slide = published.slides[0];
  assert.match(slide.html, /youtube-nocookie\.com\/embed\/M7lc1UVf-VE/);
  assert.match(slide.html, /\/members\/module\/atonom\/\?formula=kwas%20octowy/);
  assert.match(slide.html, /class="lesson-flashcard"/);
  assert.match(slide.html, /--lesson-rich-background:#dff7ed/);
  assert.equal(lessonParser.checkAnswer(slide.task, ['alkoholem', 'hydroksylowa']), true);
  assert.equal(lessonParser.checkAnswer(slide.task, ['aldehydem', 'hydroksylowa']), false);
});

test('studio rejects unsafe image URLs, malformed quizzes and ambiguous code fences', () => {
  const unsafeImage = studio.validateLesson({
    title: 'Obraz',
    slides: [{ blocks: [{ type: 'image', alt: 'XSS', url: 'javascript:alert(1)' }] }]
  });
  assert.equal(unsafeImage.valid, false);
  assert.equal(unsafeImage.errors[0].code, 'UNSAFE_IMAGE_URL');

  assert.throws(
    () => studio.serializeLesson({
      title: 'Quiz',
      slides: [{
        task: {
          type: 'abcd',
          options: ['A', 'B', 'C'],
          correctOption: 1
        }
      }]
    }),
    (error) => error.code === 'INVALID_ABCD_OPTIONS'
  );

  assert.throws(
    () => studio.serializeLesson({
      title: 'Kod',
      slides: [{ blocks: [{ type: 'code', code: 'tekst\n```html\nwięcej' }] }]
    }),
    (error) => error.code === 'CODE_FENCE_COLLISION'
  );

  assert.throws(
    () => studio.serializeLesson({
      title: 'Liczby',
      slides: [{ task: { type: 'number', answer: 'siedem' } }]
    }),
    (error) => error.code === 'INVALID_NUMBER_ANSWER'
  );

  const filename = studio.validateLesson({
    title: 'Plik',
    filename: '../plik.md',
    slides: [{ blocks: [{ type: 'text', text: 'Treść' }] }]
  });
  assert.equal(filename.valid, false);
  assert.equal(filename.errors.some((error) => error.code === 'INVALID_FILENAME'), true);
});

test('studio exposes renderer extension capabilities and a strict authoring filename policy', () => {
  assert.equal(studio.capabilities.styledContainers, true);
  assert.equal(studio.capabilities.accordions, true);
  assert.equal(studio.capabilities.youtube, true);
  assert.equal(studio.capabilities.atonom, true);
  assert.equal(studio.capabilities.flashcards, true);
  assert.ok(studio.capabilities.tasks.includes('gaps'));
  assert.equal(studio.capabilities.nestedContainers, false);
  assert.deepEqual(studio.capabilities.styleFonts, ['sans', 'serif', 'rounded', 'mono']);
  assert.equal(studio.validateFilename('dzial-1.md'), 'dzial-1.md');
  assert.equal(studio.validateFilename('../sekret.md'), '');
  assert.equal(studio.safeImageUrl('https://example.com/a.png'), 'https://example.com/a.png');
  assert.equal(studio.safeImageUrl('http://example.com/a.png'), '');
  assert.equal(studio.safeImageUrl('data:image/png;base64,AAA'), '');
});
