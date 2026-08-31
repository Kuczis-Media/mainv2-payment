'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const model = require('../public/members/module/studio/env/env-model.js');

test('env generator serializes defaults and safely quotes complex values', () => {
  const entries = model.defaultEntries();
  entries.find((entry) => entry.name === 'SITE_ID').value = 'abc-123';
  entries.push({ name: 'CUSTOM_VALUE', value: 'tekst ze spacją i #', secret: false });
  const output = model.serializeEnv(entries);
  assert.match(output, /^NETLIFY_API_TOKEN=/);
  assert.match(output, /SITE_ID=abc-123/);
  assert.match(output, /CUSTOM_VALUE="tekst ze spacją i #"/);
  assert.doesNotMatch(output, /undefined|null/);
});

test('env generator imports quoted values, export syntax and keeps the last duplicate', () => {
  const parsed = model.parseEnv('export SITE_ID=first\n# komentarz\nCUSTOM="dwa słowa"\nSITE_ID=second\nBŁĄD=x\n');
  assert.deepEqual(parsed.entries.map(({ name, value }) => [name, value]), [['SITE_ID', 'second'], ['CUSTOM', 'dwa słowa']]);
  assert.deepEqual(parsed.invalidLines, [5]);
});

test('env generator can omit blanks and rejects invalid names', () => {
  const output = model.serializeEnv([
    { name: 'VALID_NAME', value: 'ok' },
    { name: 'EMPTY_NAME', value: '' },
    { name: 'BAD-NAME', value: 'no' }
  ], { includeEmpty: false });
  assert.equal(output, 'VALID_NAME=ok\n');
});

test('admin UI exposes a no-Function env tool and protects it with the admin session', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/members/module/studio/env/index.html'), 'utf8');
  const script = fs.readFileSync(path.join(__dirname, '../public/members/module/studio/env/script.js'), 'utf8');
  const studio = fs.readFileSync(path.join(__dirname, '../public/members/module/studio/index.html'), 'utf8');
  const members = fs.readFileSync(path.join(__dirname, '../public/members/index.html'), 'utf8');
  assert.match(html, /id="env-import"/);
  assert.match(html, /id="env-copy"/);
  assert.match(html, /id="env-download"/);
  assert.match(script, /ChemAuth\.ready/);
  assert.match(script, /roles\.includes\('admin'\)/);
  assert.doesNotMatch(script, /fetch\s*\(/);
  assert.doesNotMatch(script, /localStorage/);
  assert.match(studio, /href="\/members\/module\/studio\/env\/"/);
  assert.match(members, /Otwórz generator \.env/);
});
