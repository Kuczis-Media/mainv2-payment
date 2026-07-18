'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parse } = require('../public/members/dashboard-parser.js');

test('dashboard parser builds nested accordions from headings level 3 through 6', () => {
  const model = parse(`
# Panel
## Dział
### Poziom 1
#### Poziom 2
##### Poziom 3
###### Poziom 4
- [Materiał](/members/module/pdf/?id=test) — Opis
#### Drugi poziom 2
- [Film](/members/module/film/?id=test) — Nagranie
### Drugi poziom 1
- [Test](/members/module/forms/?id=test) — Sprawdzenie
`);

  const section = model.sections[0];
  assert.equal(section.groups.length, 2);
  assert.equal(section.groups[0].title, 'Poziom 1');
  assert.equal(section.groups[0].groups[0].title, 'Poziom 2');
  assert.equal(section.groups[0].groups[0].groups[0].title, 'Poziom 3');
  assert.equal(section.groups[0].groups[0].groups[0].groups[0].title, 'Poziom 4');
  assert.equal(section.groups[0].groups[0].groups[0].groups[0].items[0].title, 'Materiał');
  assert.equal(section.groups[0].groups[1].title, 'Drugi poziom 2');
  assert.equal(section.groups[0].groups[1].items[0].title, 'Film');
  assert.equal(section.groups[1].title, 'Drugi poziom 1');
});

test('plain lines become safe text descriptions at the current hierarchy level', () => {
  const model = parse(`
Tekst powitalny.
## Dział
Zwykły tekst działu.
### Harmonijka
Pierwsza linia zwykłego tekstu.
Druga linia zwykłego tekstu.
#### Wnętrze
Tekst wewnętrzny.
> Ważny komunikat.
`);

  assert.deepEqual(model.intro, ['Tekst powitalny.']);
  assert.deepEqual(model.sections[0].description, ['Zwykły tekst działu.']);
  assert.deepEqual(
    model.sections[0].groups[0].description,
    ['Pierwsza linia zwykłego tekstu.', 'Druga linia zwykłego tekstu.']
  );
  assert.deepEqual(model.sections[0].groups[0].groups[0].description, ['Tekst wewnętrzny.']);
  assert.deepEqual(model.sections[0].groups[0].groups[0].notices, ['Ważny komunikat.']);
});
