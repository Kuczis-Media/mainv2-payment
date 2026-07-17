const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const moduleRoot = path.join(root, 'public', 'members', 'module');
const media = require(path.join(moduleRoot, 'media-utils.js'));

test('media helpers accept IDs and common Google/YouTube sharing links', () => {
  const driveId = '1qKkDarVM8qn1GHkNalt9f8n7IXNUawZF';
  const slideId = '1q27sAFuVxw-ILceGOdVPcaBz2nD_sC2B';
  const publishedId = '2PACX-1vQ_examplePublishedSlidesId123456789';
  const youtubeId = 'CH50zuS8DD0';

  assert.equal(media.extractDriveId(driveId), driveId);
  assert.equal(media.extractDriveId(`https://drive.google.com/file/d/${driveId}/view?usp=sharing`), driveId);
  assert.equal(media.extractDriveId(`https://drive.google.com/open?id=${driveId}`), driveId);
  assert.equal(media.extractDriveId('https://evil.example/file/d/1qKkDarVM8qn1GHkNalt9f8n7IXNUawZF/view'), '');

  assert.equal(media.extractYouTubeId(youtubeId), youtubeId);
  assert.equal(media.extractYouTubeId(`https://youtu.be/${youtubeId}?feature=shared`), youtubeId);
  assert.equal(media.extractYouTubeId(`https://www.youtube.com/shorts/${youtubeId}`), youtubeId);
  assert.equal(media.extractYouTubeId(`https://www.youtube.com/watch?v=${youtubeId}`), youtubeId);

  assert.deepEqual(
    media.extractSlides(`https://docs.google.com/presentation/d/${slideId}/edit?usp=sharing`),
    { id: slideId, published: false }
  );
  assert.deepEqual(
    media.extractSlides(`https://docs.google.com/presentation/u/1/d/${slideId}/edit`),
    { id: slideId, published: false }
  );
  assert.deepEqual(
    media.extractSlides(`https://docs.google.com/presentation/d/e/${publishedId}/pub?start=false`),
    { id: publishedId, published: true }
  );
});

test('media parameter reader removes source IDs from the visible address immediately', () => {
  let replacedWith = '';
  const fakeWindow = {
    document: { title: 'Viewer' },
    history: {
      state: { preserved: true },
      replaceState(_state, _title, nextUrl) { replacedWith = nextUrl; }
    },
    location: {
      pathname: '/members/module/pdf/',
      search: '?id=secret-drive-id&type=1',
      hash: ''
    }
  };

  const params = media.readParamsAndHide(fakeWindow);
  assert.equal(params.get('id'), 'secret-drive-id');
  assert.equal(params.get('type'), '1');
  assert.equal(replacedWith, '/members/module/pdf/');
});

test('media viewers are domain portable and strip query parameters before auth wait', () => {
  for (const name of ['slides', 'pdf', 'film', 'filmv1']) {
    const html = fs.readFileSync(path.join(moduleRoot, name, 'index.html'), 'utf8');
    const script = fs.readFileSync(path.join(moduleRoot, name, 'script.js'), 'utf8');

    assert.doesNotMatch(`${html}\n${script}`, /chemdisk\.netlify\.app/i, `${name}: deployment domain is hardcoded`);
    assert.match(html, /referrerpolicy=["']origin["']/i, `${name}: embedded provider needs an origin referrer`);
    assert.match(script, /readParamsAndHide\(window\)/, `${name}: source query is left in the address bar`);
    assert.ok(
      script.indexOf('readParamsAndHide(window)') < script.indexOf('await window.ChemAuth.ready'),
      `${name}: source query is hidden too late`
    );
    assert.match(script, /setTimeout/, `${name}: missing slow-provider timeout`);
    assert.match(script, /retry/i, `${name}: missing retry flow`);
  }
});

test('filmv1 uses Video.js for YouTube and a Drive embed fallback', () => {
  const html = fs.readFileSync(path.join(moduleRoot, 'filmv1', 'index.html'), 'utf8');
  const script = fs.readFileSync(path.join(moduleRoot, 'filmv1', 'script.js'), 'utf8');

  assert.match(html, /id=["']video-host["']/);
  assert.match(html, /id=["']drive-frame["']/);
  assert.match(script, /VIDEOJS_VERSION\s*=\s*'8\.23\.4'/);
  assert.match(script, /videojs-youtube@\$\{YOUTUBE_TECH_VERSION\}/);
  assert.match(script, /type:\s*'video\/youtube'/);
  assert.match(script, /drive\.google\.com\/file\/d\/\$\{encodedId\}\/preview/);
  assert.match(script, /Google Drive · podgląd dostawcy/);
});

test('shared media viewers expose a persistent collapsible mobile toolbar', () => {
  const chrome = fs.readFileSync(path.join(moduleRoot, 'media-viewer.js'), 'utf8');
  const styles = fs.readFileSync(path.join(moduleRoot, 'media-viewer.css'), 'utf8');

  for (const name of ['pdf', 'slides', 'film', 'filmv1']) {
    const html = fs.readFileSync(path.join(moduleRoot, name, 'index.html'), 'utf8');
    assert.match(html, /src=["']\.\.\/media-viewer\.js["']/, `${name}: missing collapsible toolbar script`);
  }
  assert.match(chrome, /viewer-bar-collapsed/);
  assert.match(chrome, /aria-expanded/);
  assert.match(styles, /100dvh/);
  assert.match(styles, /viewer-bar\.is-collapsed/);
});

test('custom YT player has mobile controls, filled ranges and deterministic mute state', () => {
  const html = fs.readFileSync(path.join(moduleRoot, 'yt', 'index.html'), 'utf8');
  const styles = fs.readFileSync(path.join(moduleRoot, 'yt', 'style.css'), 'utf8');
  const script = fs.readFileSync(path.join(moduleRoot, 'yt', 'script.js'), 'utf8');

  assert.match(styles, /--range-progress/);
  assert.match(styles, /100dvh/);
  assert.match(html, /aria-pressed=["']false["']/);
  assert.match(script, /let desiredMuted = false/);
  assert.match(script, /requestMuteState\(!desiredMuted\)/);
  assert.match(script, /verifyMuteState/);
  assert.doesNotMatch(script, /const muted = player\.isMuted\(\);\s*if \(muted\)/);
});

test('protected Film and FilmV1 suppress provider links and sandbox YouTube frames without popups', () => {
  for (const name of ['film', 'filmv1']) {
    const html = fs.readFileSync(path.join(moduleRoot, name, 'index.html'), 'utf8');
    const script = fs.readFileSync(path.join(moduleRoot, name, 'script.js'), 'utf8');
    const styles = fs.readFileSync(path.join(moduleRoot, name, 'style.css'), 'utf8');

    assert.match(html, new RegExp(`${name}-guard-title`));
    assert.match(script, /providerTop\.hidden\s*=\s*protectedMode/);
    assert.match(script, /providerLink\.hidden\s*=\s*protectedMode/);
    assert.match(script, /sandbox.*allow-scripts allow-same-origin allow-presentation/);
    assert.doesNotMatch(script, /allow-popups/);
    assert.match(styles, new RegExp(`\\.${name}-guard-title`));
  }
});

test('protected PDF and Slides suppress every direct Google fallback link', () => {
  const cases = [
    { name: 'pdf', protectedType: /const protectedMode = state\.type === '1'/ },
    { name: 'slides', protectedType: /const protectedMode = state\.type === '2'/ }
  ];

  for (const { name, protectedType } of cases) {
    const script = fs.readFileSync(path.join(moduleRoot, name, 'script.js'), 'utf8');

    assert.match(script, protectedType, `${name}: unexpected protected type mapping`);
    assert.match(script, /providerTop\.hidden\s*=\s*protectedMode/);
    assert.match(script, /providerLink\.hidden\s*=\s*protectedMode/);
    assert.match(script, /if \(!protectedMode\)\s*\{[\s\S]*providerTop\.href\s*=\s*outsideUrl;[\s\S]*providerLink\.href\s*=\s*outsideUrl;/);
    assert.match(script, /providerTop\.removeAttribute\('href'\)/);
    assert.match(script, /providerLink\.removeAttribute\('href'\)/);
    assert.match(script, /sandbox.*allow-scripts allow-same-origin allow-forms allow-presentation/);
    assert.doesNotMatch(script, /allow-popups|allow-top-navigation/);
  }
});
