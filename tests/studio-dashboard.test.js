'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const studio = require('../public/members/module/studio/dashboard-model.js');
const runtimeParser = require('../public/members/dashboard-parser.js');

test('studio exposes every requested dashboard block with the runtime protection modes', () => {
  assert.deepEqual(studio.MODULE_ORDER, [
    'slides',
    'pdf',
    'film',
    'filmv1',
    'yt',
    'forms',
    'chat',
    'lesson',
    'calculator',
    'whiteboard',
    'contact',
    'atonom'
  ]);
  assert.deepEqual(
    studio.PROTECTION_OPTIONS.slides.map((option) => option.value),
    ['1', '2']
  );
  for (const moduleName of ['pdf', 'film', 'filmv1']) {
    assert.deepEqual(
      studio.PROTECTION_OPTIONS[moduleName].map((option) => option.value),
      ['1', '2', '3']
    );
  }
  assert.deepEqual(
    studio.MODULE_DEFINITIONS.calculator.variants.map((option) => option.value),
    ['kalkulator', 'classic']
  );
  assert.deepEqual(
    studio.MODULE_DEFINITIONS.whiteboard.variants.map((option) => option.value),
    ['bitpaper', 'whiteboard']
  );
});

test('module cards serialize to the exact URLs consumed by existing applications', () => {
  const cases = [
    [{ module: 'slides', id: 'slide id', protection: 2 }, '/members/module/slides/?id=slide%20id&type=2'],
    [{ module: 'pdf', id: 'drive', protection: 3 }, '/members/module/pdf/?id=drive&type=3'],
    [{ module: 'film', id: 'youtube', protection: 1 }, '/members/module/film/?id=youtube&type=1'],
    [{ module: 'filmv1', id: 'drive', protection: 2 }, '/members/module/filmv1/?id=drive&type=2'],
    [{ module: 'yt', id: 'abc' }, '/members/module/yt/?id=abc'],
    [{ module: 'forms', id: 'form' }, '/members/module/forms/?id=form'],
    [{ module: 'chat', source: 'prompt', prompt: 'pomoc.json' }, '/members/module/chat/?prompt=pomoc.json'],
    [{ module: 'chat', source: 'file', file: 'pomoc.txt', point: 4 }, '/members/module/chat/?plik=pomoc.txt&punkt=4'],
    [{ module: 'lesson', file: 'atomy.md' }, '/members/module/lesson/?file=atomy.md'],
    [
      { module: 'chat', source: 'prompt', repositoryId: 'organiczna', prompt: 'pomoc.json' },
      '/members/module/chat/?repo=organiczna&prompt=pomoc.json'
    ],
    [
      { module: 'lesson', repositoryId: 'organiczna', file: 'atomy.md' },
      '/members/module/lesson/?repo=organiczna&file=atomy.md'
    ],
    [{ module: 'calculator', variant: 'classic' }, '/members/module/classic/'],
    [{ module: 'calculators', variant: 'kalkulator' }, '/members/module/kalkulator/'],
    [{ module: 'whiteboards', variant: 'bitpaper' }, '/members/module/bitpaper/'],
    [{ module: 'whiteboard', variant: 'whiteboard' }, '/members/module/whiteboard/'],
    [{ module: 'contact', internal: 'Proszę o pomoc' }, '/members/module/contact/?internal=Prosz%C4%99%20o%20pomoc'],
    [{ module: 'atonom' }, '/members/module/atonom/'],
    [
      { module: 'atonom', formula: 'kwas octowy' },
      '/members/module/atonom/?formula=kwas%20octowy'
    ]
  ];
  for (const [input, expected] of cases) {
    assert.equal(studio.moduleHref(studio.createModule(input)), expected);
  }
});

test('repository selection survives dashboard Markdown import and export', () => {
  for (const href of [
    '/members/module/lesson/?repo=organiczna&file=alkany.md',
    '/members/module/chat/?repo=organiczna&plik=alkany.txt&punkt=3'
  ]) {
    const parsed = studio.parseModuleHref(href);
    assert.equal(parsed.repositoryId, 'organiczna');
    assert.equal(studio.moduleHref(studio.createModule(parsed)), href);
  }
});

test('ATONOM compound names survive dashboard Markdown import and export', () => {
  const href = '/members/module/atonom/?formula=cis-but-2-en';
  const parsed = studio.parseModuleHref(href);
  assert.equal(parsed.module, 'atonom');
  assert.equal(parsed.formula, 'cis-but-2-en');
  assert.equal(studio.moduleHref(studio.createModule(parsed)), href);
});

test('studio parses the current dashboard without losing cards unsupported by the palette', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'members', 'dashboard.md'),
    'utf8'
  );
  const builderModel = studio.parseMarkdown(source);
  const runtimeModel = runtimeParser.parse(source);
  const compatible = studio.toDashboardModel(builderModel);

  assert.deepEqual(compatible, runtimeModel);
  assert.equal(studio.validate(builderModel).valid, true);
  const knownModules = new Set();
  const collect = (blocks) => blocks.forEach((block) => {
    if (block.kind === 'module') knownModules.add(block.module);
    if (block.kind === 'group') collect(block.blocks);
  });
  builderModel.sections.forEach((section) => collect(section.blocks));
  for (const expected of [
    'slides',
    'pdf',
    'film',
    'filmv1',
    'yt',
    'forms',
    'chat',
    'lesson',
    'calculator',
    'whiteboard',
    'contact',
    'atonom',
    'link'
  ]) {
    assert.ok(knownModules.has(expected), `missing parsed module: ${expected}`);
  }
});

test('serialized text, notices, cards and four nested accordions match dashboard-parser.js', () => {
  const deepest = studio.createGroup({
    level: 6,
    title: 'Poziom 4',
    blocks: [
      studio.createText('# Tekst, nie nagłówek'),
      studio.createNotice('Ważna notatka'),
      studio.createModule({
        module: 'pdf',
        id: 'drive',
        protection: 1,
        title: 'Zadania [PDF]',
        description: 'Opis materiału'
      })
    ]
  });
  const model = studio.createModel({
    title: 'Kurs',
    blocks: [
      studio.createText('Wprowadzenie'),
      studio.createNotice('Komunikat główny')
    ],
    sections: [{
      title: 'Chemia',
      blocks: [
        studio.createText('Opis działu'),
        studio.createGroup({
          level: 3,
          title: 'Poziom 1',
          blocks: [studio.createGroup({
            level: 4,
            title: 'Poziom 2',
            blocks: [studio.createGroup({
              level: 5,
              title: 'Poziom 3',
              blocks: [deepest]
            })]
          })]
        })
      ]
    }]
  });

  const markdown = studio.serialize(model);
  const parsed = runtimeParser.parse(markdown);
  assert.equal(parsed.title, 'Kurs');
  assert.deepEqual(parsed.intro, ['Wprowadzenie']);
  assert.deepEqual(parsed.notices, ['Komunikat główny']);
  assert.equal(parsed.sections[0].groups[0].groups[0].groups[0].groups[0].title, 'Poziom 4');
  assert.deepEqual(
    parsed.sections[0].groups[0].groups[0].groups[0].groups[0].description,
    ['\u200b# Tekst, nie nagłówek']
  );
  assert.equal(
    parsed.sections[0].groups[0].groups[0].groups[0].groups[0].items[0].href,
    '/members/module/pdf/?id=drive&type=1'
  );
  assert.match(markdown, /\[Zadania PDF]\(/);

  const reparsedByStudio = studio.parseMarkdown(markdown);
  assert.equal(
    reparsedByStudio.sections[0].blocks[1].blocks[0].blocks[0].blocks[0].blocks[0].text,
    '# Tekst, nie nagłówek'
  );
});

test('nested blocks are normalized before child accordions so Markdown keeps the intended parent', () => {
  const group = studio.createGroup({
    title: 'Harmonijka',
    blocks: [
      studio.createGroup({ title: 'Wnętrze' }),
      studio.createModule({ module: 'forms', id: 'test', title: 'Test' })
    ]
  });
  const model = studio.createModel({
    sections: [{ title: 'Dział', blocks: [group] }]
  });
  const parsed = runtimeParser.parse(studio.serialize(model));

  assert.deepEqual(group.blocks.map((block) => block.kind), ['module', 'group']);
  assert.equal(parsed.sections[0].groups[0].items[0].title, 'Test');
  assert.equal(parsed.sections[0].groups[0].groups[0].title, 'Wnętrze');
});

test('visual insertion keeps cards before accordions to match Markdown hierarchy', () => {
  const model = studio.createModel({
    sections: [{
      title: 'Dział',
      blocks: [
        studio.createModule({ module: 'atonom', title: 'Pierwsza karta' }),
        studio.createGroup({ title: 'Harmonijka' })
      ]
    }]
  });
  const section = model.sections[0];
  studio.insertNode(
    model,
    section.uid,
    studio.createModule({ module: 'atonom', title: 'Druga karta' }),
    section.blocks.length
  );
  studio.insertNode(model, section.uid, studio.createGroup({ title: 'Druga harmonijka' }), 0);

  assert.deepEqual(
    section.blocks.map((block) => block.kind),
    ['module', 'module', 'group', 'group']
  );
  assert.deepEqual(
    runtimeParser.parse(studio.serialize(model)).sections[0].items.map((item) => item.title),
    ['Pierwsza karta', 'Druga karta']
  );
});

test('Blob publish payload follows the admin-dashboard ETag and required help contract', () => {
  const model = studio.createModel({
    title: 'Panel',
    sections: [{
      title: 'Materiały',
      blocks: [
        studio.createModule({ module: 'lesson', file: 'lekcja.md', title: 'Lekcja' })
      ]
    }]
  });
  const payload = studio.createPublishPayload(model, 'etag-current');

  assert.deepEqual(Object.keys(payload), ['content', 'expectedEtag']);
  assert.equal(payload.expectedEtag, 'etag-current');
  assert.match(payload.content, /^# Panel/m);
  assert.match(payload.content, /^## Pomoc i konto$/m);
  assert.equal(
    payload.content.match(/^## Pomoc i konto$/gm).length,
    1,
    'required section must not be duplicated'
  );
  assert.throws(
    () => studio.createPublishPayload(model, 'bad\netag'),
    /expectedEtag/
  );
});

test('validation catches incomplete visual cards before publication', () => {
  const incomplete = studio.createModel({
    sections: [{
      title: 'Dział',
      blocks: [
        studio.createModule({ module: 'slides', id: '', protection: 2 }),
        studio.createModule({ module: 'chat', source: 'file', file: 'pomoc.txt', point: 0 })
      ]
    }]
  });
  const result = studio.validate(incomplete);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === 'MODULE_ID_REQUIRED'));
  assert.ok(result.errors.some((error) => error.code === 'CHAT_POINT_REQUIRED'));
  assert.equal(result.moduleCount, 2);
});

test('validation rejects unsafe links, malformed media references and traversal-prone filenames', () => {
  const model = studio.createModel({
    sections: [{
      title: 'Błędy',
      blocks: [
        studio.createModule({ module: 'link', href: 'javascript:alert(1)', title: 'Zły link' }),
        studio.createModule({ module: 'slides', id: 'za krótkie', protection: 1, title: 'Złe ID' }),
        studio.createModule({ module: 'lesson', file: '../lekcja.md', title: 'Zła lekcja' }),
        studio.createModule({ module: 'chat', source: 'prompt', prompt: 'prompt.txt', title: 'Zły prompt' })
      ]
    }]
  });
  const result = studio.validate(model);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === 'LINK_REQUIRED'));
  assert.ok(result.errors.some((error) => error.code === 'MODULE_ID_REQUIRED'));
  assert.ok(result.errors.some((error) => error.code === 'LESSON_FILE_REQUIRED'));
  assert.ok(result.errors.some((error) => error.code === 'CHAT_PROMPT_REQUIRED'));
  assert.equal(result.sectionCount, 1);
});

test('validation accepts only provider links matching the configured media module', () => {
  const model = studio.createModel({
    title: 'Dostawcy',
    sections: [{
      title: 'Materiały',
      blocks: [
        studio.createModule({
          module: 'slides',
          title: 'Prezentacja',
          id: 'https://example.com/presentation/abcdefghijk',
          protection: '1'
        }),
        studio.createModule({
          module: 'film',
          title: 'Film Drive w trybie YouTube',
          id: 'https://drive.google.com/file/d/abcdefghijk/view',
          protection: '1'
        }),
        studio.createModule({
          module: 'forms',
          title: 'Formularz',
          id: 'https://forms.gle/abcdefghijk'
        })
      ]
    }]
  });

  const result = studio.validate(model);
  assert.equal(
    result.errors.filter((error) => error.code === 'MODULE_ID_REQUIRED').length,
    2
  );

  model.sections[0].blocks[0].id = 'https://docs.google.com/presentation/d/abcdefghijk/edit';
  model.sections[0].blocks[1].id = 'https://youtu.be/CH50zuS8DD0';
  assert.equal(studio.validate(model).valid, true);
});

test('drag-and-drop helpers move blocks and reject cyclic accordion moves', () => {
  const card = studio.createModule({ module: 'atonom', title: 'ATONOM' });
  const child = studio.createGroup({ title: 'Dziecko', blocks: [card] });
  const parent = studio.createGroup({ title: 'Rodzic', blocks: [child] });
  const first = studio.createSection({ title: 'Pierwszy', blocks: [parent] });
  const second = studio.createSection({ title: 'Drugi' });
  const model = studio.createModel({ sections: [first, second] });

  const parentUid = model.sections[0].blocks[0].uid;
  const childUid = model.sections[0].blocks[0].blocks[0].uid;
  const cardUid = model.sections[0].blocks[0].blocks[0].blocks[0].uid;
  assert.equal(studio.moveNode(model, parentUid, childUid), false);
  assert.equal(studio.moveNode(model, cardUid, model.sections[1].uid), true);
  assert.equal(studio.findNode(model, cardUid).parent.uid, model.sections[1].uid);
});
