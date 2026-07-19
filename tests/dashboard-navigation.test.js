'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const { pickActiveSection } = require('../public/members/dashboard-navigation.js');

test('dashboard navigation switches to the next visible section near the top of the viewport', () => {
  const sections = [
    { id: 'start', top: -180 },
    { id: 'biologia', top: 218 },
    { id: 'chemia-organiczna', top: 870 }
  ];

  assert.equal(pickActiveSection(sections, 224, false), 'biologia');
  assert.equal(pickActiveSection(sections, 180, false), 'start');
});

test('dashboard navigation ignores filtered sections and selects the final section at page end', () => {
  const sections = [
    { id: 'start', top: -900 },
    { id: 'biologia', top: -100, hidden: true },
    { id: 'powtorki', top: 420 },
    { id: 'pomoc', top: 760 }
  ];

  assert.equal(pickActiveSection(sections, 240, false), 'start');
  assert.equal(pickActiveSection(sections, 240, true), 'pomoc');
});

test('dashboard binds immediate click, scroll and browser-history navigation tracking', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'members', 'index.html'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'public', 'members', 'dashboard.js'), 'utf8');

  assert.match(html, /<script defer src=["']\/members\/dashboard-navigation\.js["']><\/script>/);
  assert.match(script, /elements\.nav\.addEventListener\(['"]click['"],\s*handleNavigationClick\)/);
  assert.match(script, /function startNavigationIntent\(id\)[\s\S]*?setActiveNavigation\(id\)/);
  assert.match(script, /window\.addEventListener\(['"]scroll['"],\s*requestNavigationSync,\s*\{\s*passive:\s*true\s*\}\)/);
  assert.match(script, /window\.addEventListener\(['"]hashchange['"],\s*handleLocationNavigation\)/);
  assert.match(script, /window\.addEventListener\(['"]popstate['"],\s*handleLocationNavigation\)/);
  assert.match(script, /requestAnimationFrame/);
  assert.doesNotMatch(script, /new IntersectionObserver/);
});

test('members dashboard publishes a local ChemDisk SVG favicon', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'members', 'index.html'), 'utf8');
  const faviconPath = path.join(root, 'public', 'members', 'favicon.svg');

  assert.match(html, /<link rel=["']icon["'] href=["']\/members\/favicon\.svg["'] type=["']image\/svg\+xml["']\s*\/>/);
  assert.equal(fs.existsSync(faviconPath), true);
  assert.match(fs.readFileSync(faviconPath, 'utf8'), /<svg[\s\S]*aria-label=["']ChemDisk["']/);
});
