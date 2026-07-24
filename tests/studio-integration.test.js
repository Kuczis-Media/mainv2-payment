const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const studioRoot = path.join(root, 'public', 'members', 'module', 'studio');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('Studio is an admin-only member application linked only for administrators', () => {
  const html = read('public/members/module/studio/index.html');
  const script = read('public/members/module/studio/script.js');
  const dashboardHtml = read('public/members/index.html');
  const dashboardScript = read('public/members/dashboard.js');
  const redirects = read('netlify.toml');

  assert.match(html, /<base href=["']\/members\/module\/studio\/["']/);
  assert.match(html, /<meta name=["']x-members["'] content=["']1["']/);
  assert.match(html, /\/members\/module\/theme\.js/);
  assert.match(html, /\/assets\/js\/auth\.js/);
  assert.match(script, /await window\.ChemAuth\.ready/);
  assert.match(script, /metadata\.roles\.includes\(['"]admin['"]\)/);

  assert.match(dashboardHtml, /id=["']content-studio-link["'][^>]*hidden/);
  assert.match(dashboardScript, /contentStudioLink\.hidden\s*=\s*!visible/);

  const studioRoleRule = redirects.indexOf('from = "/members/module/studio"');
  const generalMembersRule = redirects.indexOf('from = "/members/*"');
  assert.ok(studioRoleRule >= 0, 'missing exact Studio redirect');
  assert.ok(generalMembersRule > studioRoleRule, 'Studio role protection must run before the general members route');
  assert.match(
    redirects.slice(studioRoleRule, generalMembersRule),
    /conditions\s*=\s*\{\s*Role\s*=\s*\["admin"\]\s*\}/
  );
});

test('Dashboard Builder loads and conditionally publishes the active Blob version', () => {
  const html = read('public/members/module/studio/index.html');
  const script = read('public/members/module/studio/script.js');
  const model = read('public/members/module/studio/dashboard-model.js');

  assert.match(html, /id=["']dashboard-load-button["']/);
  assert.match(html, /id=["']dashboard-publish-button["']/);
  assert.match(html, /data-dashboard-add=["']slides["']/);
  assert.match(html, /data-dashboard-add=["']text["']/);
  assert.match(html, /data-dashboard-add=["']group["']/);
  assert.match(script, /method:\s*['"]GET['"]/);
  assert.match(script, /method:\s*['"]PUT['"]/);
  assert.match(script, /expectedEtag/);
  assert.match(script, /response\.status\s*===\s*409/);
  assert.match(script, /credentials:\s*['"]same-origin['"]/);
  assert.match(script, /getAccessToken\(\{\s*forceRefresh:\s*true\s*\}\)/);
  assert.match(model, /ADMIN_DASHBOARD_URL\s*=\s*['"]\/\.netlify\/functions\/admin-dashboard['"]/);
  assert.doesNotMatch(script, /localStorage\.setItem\([^)]*(?:token|jwt)/i);
});

test('both visual editors expose drag-and-drop, previews and reversible source workflows', () => {
  const html = read('public/members/module/studio/index.html');
  const script = read('public/members/module/studio/script.js');
  const styles = read('public/members/module/studio/style.css');

  assert.ok(fs.existsSync(path.join(studioRoot, 'dashboard-model.js')));
  assert.ok(fs.existsSync(path.join(studioRoot, 'lesson-model.js')));
  assert.match(html, /draggable=["']true["']/);
  assert.match(html, /id=["']lesson-download-button["']/);
  assert.match(html, /id=["']lesson-copy-button["']/);
  assert.match(html, /id=["']source-dialog["']/);
  assert.match(html, /data-lesson-add=["']quote["']/);
  assert.match(html, /data-lesson-add=["']youtube["']/);
  assert.match(html, /data-lesson-add=["']atonom["']/);
  assert.match(html, /data-lesson-add=["']flashcards["']/);
  assert.match(html, /data-lesson-add=["']task-gaps["']/);
  assert.match(script, /addEventListener\(['"]dragstart['"]/);
  assert.match(script, /addEventListener\(['"]drop['"]/);
  assert.match(script, /window\.open\(/);
  assert.match(script, /data-full-preview/);
  assert.match(script, /state\.lesson\.model\.slides\.forEach/);
  assert.match(script, /serializeLesson/);
  assert.match(script, /parseLesson/);
  assert.match(styles, /\.studio-preview-window/);
  assert.match(styles, /\.full-preview-main/);
  assert.match(styles, /\.full-lesson-list/);
  assert.match(styles, /\.lesson-font-serif/);
  assert.match(styles, /\.lesson-align-center/);
  assert.match(styles, /\.drop-zone\.is-dragover/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);

  const dashboardClone = script.slice(
    script.indexOf('function cloneDashboardNode'),
    script.indexOf('function cloneLessonNode')
  );
  assert.match(dashboardClone, /delete node\.uid/);
  assert.doesNotMatch(dashboardClone, /delete node\.id/);
  assert.match(script, /saveTimers:\s*\{\s*dashboard:\s*0,\s*lesson:\s*0\s*\}/);
  assert.match(script, /addEventListener\(['"]pagehide['"],\s*flushDrafts\)/);
});

test('lesson authoring extensions are rendered through strict, non-HTML directives', () => {
  const parser = read('public/members/module/lesson/lesson-parser.js');
  const styles = read('public/members/module/lesson/style.css');

  assert.match(parser, /STYLE_FONTS\s*=\s*new Set/);
  assert.match(parser, /SAFE_STYLE_COLOR/);
  assert.match(parser, /lesson-accordion/);
  assert.match(parser, /decoding=["']async["']/);
  assert.match(parser, /referrerpolicy=["']no-referrer["']/);
  assert.match(styles, /\.lesson-rich-style/);
  assert.match(styles, /\.lesson-font-rounded/);
  assert.match(styles, /\.lesson-accordion\[open\]/);
  assert.match(styles, /\.lesson-flashcard/);
  assert.match(styles, /\.lesson-embed/);
  assert.match(styles, /\.gap-exercise/);
});
