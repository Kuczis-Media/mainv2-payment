const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const modulesRoot = path.join(root, 'public', 'members', 'module');

test('every members module has stable asset paths and waits for initial auth', () => {
  const moduleNames = fs.readdirSync(modulesRoot)
    .filter((name) => fs.statSync(path.join(modulesRoot, name)).isDirectory())
    .sort();

  assert.deepEqual(moduleNames, [
    'bitpaper', 'chat', 'classic', 'contact', 'film', 'filmv1', 'forms',
    'kalkulator', 'lesson', 'pdf', 'slides', 'whiteboard', 'yt'
  ]);

  for (const name of moduleNames) {
    const directory = path.join(modulesRoot, name);
    const html = fs.readFileSync(path.join(directory, 'index.html'), 'utf8');
    const scripts = fs.readdirSync(directory)
      .filter((file) => file.endsWith('.js'))
      .map((file) => fs.readFileSync(path.join(directory, file), 'utf8'))
      .join('\n');
    const source = `${html}\n${scripts}`;

    assert.match(html, new RegExp(`<base href=["']/members/module/${name}/["']\\s*/?>`), `${name}: missing stable base`);
    assert.match(html, /<meta name=["']x-members["'] content=["']1["']\s*\/?>/, `${name}: missing members marker`);
    assert.match(html, /<script src=["']\/members\/module\/theme\.js["']><\/script>/, `${name}: missing shared theme bootstrap`);
    assert.match(html, /<link rel=["']stylesheet["'] href=["']\/members\/module\/theme\.css["']\s*\/?>/, `${name}: missing shared theme palette`);
    assert.match(html, /<script src=["']\/assets\/js\/auth\.js["']><\/script>/, `${name}: auth must initialize before module code`);
    assert.match(source, /await window\.ChemAuth\.ready/, `${name}: module starts before the session check`);
  }
});

test('all member applications follow the persistent dashboard theme', () => {
  const themeScript = fs.readFileSync(path.join(modulesRoot, 'theme.js'), 'utf8');
  const themeStyles = fs.readFileSync(path.join(modulesRoot, 'theme.css'), 'utf8');

  assert.match(themeScript, /localStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(themeScript, /STORAGE_KEY\s*=\s*['"]chem\.theme['"]/);
  assert.match(themeScript, /document\.documentElement|const root = document\.documentElement/);
  assert.match(themeScript, /prefers-color-scheme:\s*dark/);
  assert.match(themeScript, /addEventListener\(['"]storage['"]/);
  assert.match(themeStyles, /--chem-bg:\s*#edf2f7/);
  assert.match(themeStyles, /:root\[data-theme=["']dark["']\]/);
  assert.match(themeStyles, /--chem-primary:\s*#70cfbc/);
});

test('classic calculator supports complete physical keyboard input', async () => {
  const html = fs.readFileSync(path.join(modulesRoot, 'classic', 'index.html'), 'utf8');
  const script = fs.readFileSync(path.join(modulesRoot, 'classic', 'script.js'), 'utf8');

  assert.match(html, /aria-keyshortcuts=["']Enter =["']/);
  assert.match(html, /aria-keyshortcuts=["']Backspace Delete["']/);
  assert.match(script, /document\.addEventListener\(['"]keydown['"]/);
  assert.match(script, /event\.key === ['"]Enter['"] \|\| event\.key === ['"]=['"]/);
  assert.match(script, /event\.key === ['"]Backspace['"] \|\| event\.key === ['"]Delete['"]/);
  assert.match(script, /event\.key === ['"]Escape['"]/);
  assert.match(script, /const aliases = \{[^}]*x:\s*['"]\*['"][^}]*['"]:['"]:\s*['"]\/['"]/);

  const displayHandlers = {};
  const documentHandlers = {};
  const display = {
    value: '',
    classList: { add() {}, remove() {} },
    focus() {},
    select() {},
    addEventListener(name, handler) { displayHandlers[name] = handler; }
  };
  const keys = {
    addEventListener() {},
    querySelector() { return null; }
  };
  const context = vm.createContext({
    CSS: { escape: (value) => value },
    document: {
      getElementById: (id) => id === 'display' ? display : keys,
      addEventListener: (name, handler) => { documentHandlers[name] = handler; }
    },
    window: {
      ChemAuth: { ready: Promise.resolve({ authenticated: true, session: { ok: true } }) },
      matchMedia: () => ({ matches: false }),
      setTimeout
    }
  });

  await vm.runInContext(script, context);
  const press = (key) => documentHandlers.keydown({
    key,
    target: {},
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    preventDefault() {}
  });

  ['1', '+', '2', 'Enter'].forEach(press);
  assert.equal(display.value, '3');
  press('Backspace');
  assert.equal(display.value, '');
  ['9', ':', '3', '='].forEach(press);
  assert.equal(display.value, '3');
  press('Escape');
  assert.equal(display.value, '');
});

test('large member modules keep CSS and JavaScript outside index.html', () => {
  for (const name of ['bitpaper', 'whiteboard', 'forms', 'lesson', 'yt']) {
    const directory = path.join(modulesRoot, name);
    const html = fs.readFileSync(path.join(directory, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /<style\b/i, `${name}: CSS remains inline`);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)/i, `${name}: JavaScript remains inline`);
    assert.ok(fs.existsSync(path.join(directory, 'style.css')), `${name}: missing style.css`);
    assert.ok(fs.existsSync(path.join(directory, 'script.js')), `${name}: missing script.js`);
  }

  for (const [name, scriptName] of [['contact', 'script.js'], ['chat', 'bootstrap.js']]) {
    const directory = path.join(modulesRoot, name);
    const html = fs.readFileSync(path.join(directory, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)/i, `${name}: JavaScript remains inline`);
    assert.ok(fs.existsSync(path.join(directory, scriptName)), `${name}: missing ${scriptName}`);
  }
});

test('members home is a local Markdown dashboard rather than a remote iframe', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'members', 'index.html'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'public', 'members', 'dashboard.js'), 'utf8');
  const markdown = fs.readFileSync(path.join(root, 'public', 'members', 'dashboard.md'), 'utf8');

  assert.doesNotMatch(html, /<iframe\b/i);
  assert.match(script, /\/members\/dashboard\.md/);
  assert.match(markdown, /^#\s+\S/m);
  assert.match(markdown, /^##\s+\S/m);
  assert.match(script, /document\.createElement\('details'\)/);
  assert.match(script, /resource-accordion/);
  assert.match(html, /\/members\/dashboard-parser\.js/);
  assert.match(script, /createAccordionGroup\(child,\s*sectionTitle/);
});

test('every local lesson linked from the dashboard has a published Markdown file', () => {
  const markdown = fs.readFileSync(path.join(root, 'public', 'members', 'dashboard.md'), 'utf8');
  const lessonRoot = path.join(root, 'public', 'members', 'module', 'lesson');
  const filenames = [...markdown.matchAll(/\/members\/module\/lesson\/\?file=([A-Za-z0-9._-]+\.md)/g)]
    .map((match) => match[1])
    .filter((filename) => filename !== 'nazwa-lekcji.md');

  assert.ok(filenames.length > 0, 'dashboard should link to at least one local lesson');
  for (const filename of filenames) {
    assert.ok(fs.existsSync(path.join(lessonRoot, filename)), `missing dashboard lesson: ${filename}`);
  }
});

test('members dashboard has a persistent accessible light and dark theme', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'members', 'index.html'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'public', 'members', 'dashboard.js'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'public', 'members', 'dashboard.css'), 'utf8');

  assert.match(html, /id=["']theme-toggle["']/);
  assert.match(html, /prefers-color-scheme:\s*dark/);
  assert.match(script, /localStorage\.setItem\(THEME_STORAGE_KEY/);
  assert.match(script, /aria-pressed/);
  assert.match(styles, /html\[data-theme=["']dark["']\]/);
  assert.match(styles, /color-scheme:\s*dark/);
});

test('members dashboard has a persistent accessible collapsible sidebar', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'members', 'index.html'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'public', 'members', 'dashboard.js'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'public', 'members', 'dashboard.css'), 'utf8');

  assert.match(html, /id=["']menu-button["'][^>]*aria-controls=["']sidebar["']/);
  assert.match(html, /localStorage\.getItem\(['"]chem\.sidebar['"]\)/);
  assert.match(script, /localStorage\.setItem\(SIDEBAR_STORAGE_KEY/);
  assert.match(script, /MOBILE_SIDEBAR_QUERY\s*=\s*'\(max-width:\s*920px\)'/);
  assert.match(script, /Zwiń menu boczne/);
  assert.match(script, /Rozwiń menu boczne/);
  assert.match(styles, /html\[data-sidebar=["']collapsed["']\]\s+\.sidebar/);
  assert.match(styles, /html\[data-sidebar=["']collapsed["']\]\s+\.main-area/);
  assert.match(styles, /\.nav-item\.is-active\s*\{[^}]*background:\s*#e6f8f4/s);
});

test('dashboard admin editor starts clean without hiding untouched static resources', () => {
  const script = fs.readFileSync(path.join(root, 'public', 'members', 'dashboard.js'), 'utf8');

  assert.match(script, /const DASHBOARD_OVERRIDE_STARTER\s*=\s*\[/);
  assert.match(script, /adminDashboardSourceKind === 'static'\s*\?\s*DASHBOARD_OVERRIDE_STARTER\s*:\s*content/);
  assert.match(script, /domyślne materiały znikną dopiero po opublikowaniu zmian/);
  assert.match(script, /function ensureRequiredHelpSection\(content\)/);
  assert.match(script, /model = ensureRequiredDashboardModel\(model\)/);
  assert.match(script, /fetchStaticDashboard\(true\)/);
  assert.match(script, /renderDashboard\(parseMarkdown\(content\)\)/);
});

test('dashboard exposes user management only through the guarded admin workflow', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'members', 'index.html'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'public', 'members', 'dashboard.js'), 'utf8');

  assert.match(html, /id=["']admin-panel-button["'][^>]*\bhidden\b/);
  assert.match(html, /id=["']admin-dialog["']/);
  assert.match(script, /appMetadata\.roles\.includes\('admin'\)/);
  assert.match(script, /\/\.netlify\/functions\/admin-users/);
  assert.match(script, /Authorization:\s*`Bearer \$\{token\}`/);
  assert.match(script, /perPage=100/);
  assert.doesNotMatch(script, /operator[-_ ]token/i);
});

test('administrator UI covers invitations, deletion, Forms and versioned Markdown editing', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'members', 'index.html'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'public', 'members', 'dashboard.js'), 'utf8');

  for (const tab of ['users', 'forms', 'dashboard']) {
    assert.match(html, new RegExp(`data-admin-tab=["']${tab}["']`));
    assert.match(html, new RegExp(`data-admin-panel=["']${tab}["']`));
  }
  assert.match(script, /\/\.netlify\/functions\/admin-users/);
  assert.match(script, /\/\.netlify\/functions\/admin-forms/);
  assert.match(script, /\/\.netlify\/functions\/admin-dashboard/);
  assert.match(script, /method:\s*'POST'/);
  assert.match(script, /method:\s*'DELETE'/);
  assert.match(script, /deleteToken:\s*submission\.deleteToken/);
  assert.match(script, /expectedEtag:\s*adminDashboardEtag/);
  assert.match(script, /window\.confirm/);
  assert.doesNotMatch(script, /process\.env|api\.netlify\.com/);
});

test('dashboard runtime editor initializes strong Netlify Blobs API access', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const implementation = fs.readFileSync(path.join(root, 'netlify', 'functions', 'admin-dashboard.js'), 'utf8');

  assert.equal(manifest.dependencies['@netlify/blobs'], '10.7.9');
  assert.match(implementation, /require\(['"]@netlify\/blobs['"]\)/);
  assert.match(implementation, /process\.env\.NETLIFY_API_TOKEN/);
  assert.match(implementation, /process\.env\.SITE_ID/);
  assert.match(implementation, /siteID:\s*config\.siteId/);
  assert.match(implementation, /consistency:\s*'strong'/);
  assert.doesNotMatch(implementation, /^\s*connectLambda\(event\);/m);
  assert.match(implementation, /writeResult\.modified\s*!==\s*true/);
});

test('published application code is independent from the old Netlify subdomain', () => {
  const roots = [path.join(root, 'public'), path.join(root, 'netlify')];
  const matches = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile() && /\.(?:html|css|js|mjs|md|toml)$/.test(entry.name)) {
        if (/chemdisk\.netlify\.app/i.test(fs.readFileSync(fullPath, 'utf8'))) matches.push(fullPath);
      }
    }
  };
  roots.forEach(walk);
  assert.deepEqual(matches, []);
});

test('access-status page has live Identity states and local published assets', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'time.html'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'public', 'assets', 'time', 'script.js'), 'utf8');

  assert.match(html, /data-state=["']loading["']/);
  assert.match(html, /id=["']countdown-value["']/);
  assert.match(html, /id=["']progress-track["']/);
  assert.match(script, /window\.ChemAuth\.ready/);
  assert.match(script, /SESSION_REFRESH_INTERVAL_MS/);
  assert.doesNotMatch(script, /netlifyIdentity\.init\s*\(/);
});

test('purchase and access-status pages follow the persistent dashboard theme', () => {
  const purchaseHtml = fs.readFileSync(path.join(root, 'public', 'purchase', 'index.html'), 'utf8');
  const purchaseStyles = fs.readFileSync(path.join(root, 'public', 'purchase', 'style.css'), 'utf8');
  const timeHtml = fs.readFileSync(path.join(root, 'public', 'time.html'), 'utf8');
  const timeStyles = fs.readFileSync(path.join(root, 'public', 'assets', 'time', 'style.css'), 'utf8');
  const dashboardStyles = fs.readFileSync(path.join(root, 'public', 'members', 'dashboard.css'), 'utf8');

  for (const html of [purchaseHtml, timeHtml]) {
    assert.match(html, /localStorage\.getItem\(['"]chem\.theme['"]\)/);
    assert.match(html, /document\.documentElement\.dataset\.theme/);
    assert.match(html, /prefers-color-scheme:\s*dark/);
  }
  assert.match(purchaseStyles, /:root\[data-theme=["']dark["']\]/);
  assert.match(timeStyles, /:root\[data-theme=["']dark["']\]/);
  assert.match(dashboardStyles, /html\[data-theme=["']dark["']\]\s+\.purchase-sidebar-action/);
});

test('login page prevents Identity email tokens from leaking through referrers', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'login', 'index.html'), 'utf8');
  assert.match(html, /<meta name=["']referrer["'] content=["']no-referrer["']\s*\/>/);
});

test('all inline scripts in published HTML are valid JavaScript', () => {
  const htmlFiles = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile() && entry.name.endsWith('.html')) htmlFiles.push(fullPath);
    }
  };
  walk(path.join(root, 'public'));

  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    const inlineScript = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let index = 0;
    while ((match = inlineScript.exec(html))) {
      index += 1;
      assert.doesNotThrow(
        () => new vm.Script(match[1], { filename: `${file}#inline-${index}` }),
        `${file}: invalid inline script ${index}`
      );
    }
  }
});

test('all local script and stylesheet references point to published files', () => {
  const htmlFiles = [];
  const publicRoot = path.join(root, 'public');
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile() && entry.name.endsWith('.html')) htmlFiles.push(fullPath);
    }
  };
  walk(publicRoot);

  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    const pagePath = `/${path.relative(publicRoot, file).split(path.sep).join('/')}`;
    const baseMatch = html.match(/<base\b[^>]*href=["']([^"']+)["']/i);
    const baseUrl = new URL(baseMatch ? baseMatch[1] : pagePath, 'https://example.test');
    const references = /<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = references.exec(html))) {
      const raw = match[1].trim();
      if (!raw || /^(?:[a-z]+:)?\/\//i.test(raw) || raw.startsWith('data:')) continue;
      const resolved = new URL(raw, baseUrl);
      const localPath = path.join(publicRoot, decodeURIComponent(resolved.pathname).replace(/^\/+/, ''));
      assert.equal(fs.existsSync(localPath), true, `${file}: missing local asset ${raw}`);
    }
  }
});
