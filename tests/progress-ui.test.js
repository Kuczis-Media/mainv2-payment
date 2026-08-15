'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function loadProgressApi() {
  const source = fs.readFileSync(path.join(root, 'public', 'assets', 'js', 'progress.js'), 'utf8');
  const window = {
    location: { href: 'https://chemdisk.test/members/' },
    addEventListener() {},
    dispatchEvent() {},
    clearTimeout,
    setTimeout
  };
  vm.runInNewContext(source, {
    window,
    URL,
    Promise,
    Map,
    Set,
    console,
    CustomEvent: class CustomEvent {},
    localStorage: { getItem() { return null; }, setItem() {} }
  });
  return window.ChemProgress;
}

test('student progress labels never round a positive value down to zero', () => {
  const api = loadProgressApi();
  assert.equal(api.percentLabel(0), '0%');
  assert.equal(api.percentLabel(0.13), '<1%');
  assert.equal(api.percentLabel(4.26), '4,3%');
  assert.equal(api.percentLabel(68.4), '68%');
});

test('course progress remains legible and refreshes after a cached back navigation', () => {
  const css = fs.readFileSync(path.join(root, 'public', 'members', 'dashboard.css'), 'utf8');
  const dashboard = fs.readFileSync(path.join(root, 'public', 'members', 'dashboard.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'public', 'members', 'index.html'), 'utf8');
  assert.match(css, /\.course-progress\s*\{[^}]*--progress-text:\s*#ffffff[^}]*background:\s*rgba\(5, 28, 40, \.72\)/s);
  assert.match(dashboard, /addEventListener\('pageshow',[\s\S]*event\.persisted[\s\S]*hydrateDashboardProgress\(null, true\)/);
  assert.match(dashboard, /api\.resetAll\(\)/);
  assert.match(dashboard, /studentResetButton\('Resetuj'/);
  assert.match(html, /id="profile-reset-progress"/);
});
