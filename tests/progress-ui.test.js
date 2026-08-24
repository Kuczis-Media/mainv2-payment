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
  const studio = fs.readFileSync(path.join(root, 'public', 'members', 'module', 'studio', 'script.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'public', 'members', 'index.html'), 'utf8');
  assert.match(css, /\.course-progress\s*\{[^}]*--progress-text:\s*#ffffff[^}]*background:\s*rgba\(5, 28, 40, \.72\)/s);
  assert.match(dashboard, /addEventListener\('pageshow',[\s\S]*event\.persisted[\s\S]*hydrateDashboardProgress\(null, true\)/);
  assert.match(dashboard, /api\.resetAll\(\)/);
  assert.match(dashboard, /studentResetButton\('Resetuj'/);
  assert.match(dashboard, /aggregate\.trackedCount <= 0/);
  assert.match(studio, /action:\s*'lesson_manifest',[\s\S]*repositoryId,[\s\S]*manifest:/);
  assert.doesNotMatch(studio, /Uwzględniaj w postępie (?:sekcji|działu|całego kursu)/);
  assert.match(html, /id="profile-reset-progress"/);
});

test('admin student report renders a compact, lazily expanded material tree', () => {
  const css = fs.readFileSync(path.join(root, 'public', 'members', 'dashboard.css'), 'utf8');
  const dashboard = fs.readFileSync(path.join(root, 'public', 'members', 'dashboard.js'), 'utf8');
  assert.match(dashboard, /accountSettings\.className = 'admin-progress-account-settings'/);
  assert.match(dashboard, /card = document\.createElement\('details'\)/);
  assert.match(dashboard, /card\.addEventListener\('toggle',[\s\S]*if \(!card\.open \|\| hydrated\) return;[\s\S]*admin-progress-material-body/);
  assert.match(dashboard, /childrenByParent[\s\S]*admin-progress-material-children[\s\S]*createMaterialRow\(child\)/);
  assert.match(dashboard, /report\.className = 'admin-progress-exam-attempts'/);
  assert.match(dashboard, /report\.addEventListener\('toggle',[\s\S]*view=user[\s\S]*Reset próby/);
  assert.match(css, /\.admin-progress-material > summary\s*\{[\s\S]*min-height:\s*54px/);
  assert.match(css, /\.admin-progress-material-children\s*\{/);
  assert.match(css, /\.admin-progress-exam-attempt\s*\{/);
});

test('global progress report explains metrics and renders readable audit entries', () => {
  const css = fs.readFileSync(path.join(root, 'public', 'members', 'dashboard.css'), 'utf8');
  const dashboard = fs.readFileSync(path.join(root, 'public', 'members', 'dashboard.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'public', 'members', 'index.html'), 'utf8');
  assert.match(html, /Raporty globalne i historia zmian/);
  assert.match(html, /Zbiorcze wyniki kursantów oraz operacje wykonane przez administratorów/);
  assert.match(dashboard, /Jak uczniowie przechodzą kurs/);
  assert.match(dashboard, /wskaźnikiem pomocniczym:[\s\S]*nie jest dowodem/);
  assert.match(dashboard, /adminProgressAuditActionLabel[\s\S]*Zresetowano cały kurs/);
  assert.match(dashboard, /'exam\.attempt\.reset': 'Zresetowano próbę egzaminu'/);
  assert.match(dashboard, /administrator: \$\{adminProgressIdentityLabel\(entry\.adminId\)\}/);
  assert.match(css, /\.admin-progress-distribution\s*\{[\s\S]*repeat\(4/);
  assert.match(css, /\.admin-progress-audit-list li:not\(:last-child\)::before/);
});

test('admin progress lists render in bounded pages and fetch more only on demand', () => {
  const css = fs.readFileSync(path.join(root, 'public', 'members', 'dashboard.css'), 'utf8');
  const dashboard = fs.readFileSync(path.join(root, 'public', 'members', 'dashboard.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'public', 'members', 'index.html'), 'utf8');

  assert.match(html, /id="admin-progress-more"[^>]*hidden/);
  assert.match(dashboard, /const ADMIN_PROGRESS_PAGE_SIZE = 30/);
  assert.match(dashboard, /rows\.slice\(0, adminProgressVisibleCount\)/);
  assert.match(dashboard, /function loadMoreAdminProgressUsers\(\)/);
  assert.match(dashboard, /view=users&limit=\$\{ADMIN_PROGRESS_PAGE_SIZE\}&cursor=/);
  assert.match(dashboard, /function loadMoreAdminProgressAudit\(\)/);
  assert.match(dashboard, /Pokaż starsze wpisy/);
  assert.match(css, /\.admin-progress-pagination/);
});
