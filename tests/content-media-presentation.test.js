'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repository = require('../netlify/content-repository.js');
const contentFunction = require('../netlify/functions/content-library.js');
const presentationCommon = require('../netlify/presentation-common.js');
const presentationModel = require('../public/members/module/studio/presentation-model.js');
const lessonModel = require('../public/members/module/studio/lesson-model.js');
const lessonParser = require('../public/members/module/lesson/lesson-parser.js');

const configured = {
  configured: true,
  token: 'github_pat_test',
  repository: 'Kuczis-Media/chemdisk-content',
  ref: 'main',
  root: '',
  id: 'default',
  label: 'ChemDisk',
  default: true
};

function response(body, status = 200) {
  return new Response(typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': typeof body === 'string' ? 'text/plain' : 'application/json' }
  });
}

test('Media Manager maps local and shared files to bounded GitHub folders', async () => {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if ((options.method || 'GET') === 'GET') {
      return response([
        { type: 'file', name: 'model.png', size: 128, sha: 'a'.repeat(40) },
        { type: 'file', name: 'notatki.txt', size: 12, sha: 'b'.repeat(40) }
      ]);
    }
    return response({
      content: { sha: 'c'.repeat(40) },
      commit: { sha: 'd'.repeat(40), html_url: 'https://github.com/example/commit/media' }
    }, options.method === 'PUT' ? 201 : 200);
  };

  const listed = await repository.listMedia('local', 'lesson', 'alkohole.md', { config: configured, fetchImpl });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].reference, 'photos/model.png');
  assert.match(requests[0].url, /lessons\/alkohole\/photos/);

  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const saved = await repository.saveMedia('local', 'presentation', 'alkohole', 'wykres.png', png.toString('base64'), 'image/png', { config: configured, fetchImpl });
  assert.equal(saved.reference, 'photos/wykres.png');
  const put = requests.find((entry) => entry.options.method === 'PUT');
  assert.match(put.url, /presentations\/alkohole\/photos\/wykres\.png/);
  assert.equal(JSON.parse(put.options.body).content, png.toString('base64'));

  const sha = 'e'.repeat(40);
  const removed = await repository.deleteMedia('shared', '', '', 'assets/shared/model.png', sha, { config: configured, fetchImpl });
  assert.equal(removed.deleted, true);
  const deletion = requests.find((entry) => entry.options.method === 'DELETE');
  assert.match(deletion.url, /assets\/shared\/model\.png/);
  assert.equal(JSON.parse(deletion.options.body).sha, sha);
});

test('media writes reject traversal, mismatched binaries and active SVG content before GitHub access', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return response({}); };
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64');

  await assert.rejects(
    repository.saveMedia('local', 'exam', 'chemia', '../sekret.png', 'eA==', 'image/png', { config: configured, fetchImpl }),
    (error) => error.code === 'INVALID_MEDIA_REFERENCE'
  );
  await assert.rejects(
    repository.saveMedia('local', 'exam', 'chemia', 'atak.svg', svg, 'image/svg+xml', { config: configured, fetchImpl }),
    (error) => error.code === 'MEDIA_SVG_UNSAFE'
  );
  await assert.rejects(
    repository.deleteMedia('local', 'lesson', 'lekcja.md', 'photos/../sekret.png', 'f'.repeat(40), { config: configured, fetchImpl }),
    (error) => error.code === 'INVALID_MEDIA_REFERENCE'
  );
  assert.equal(called, false);
});

test('generic media mutations are bounded to an explicit owner and reject oversized uploads', async () => {
  assert.equal(contentFunction._test.validateMutationBody({
    kind: 'media',
    scope: 'local',
    materialKind: 'exam',
    materialId: 'alkohole',
    filename: 'model.png',
    contentBase64: 'iVBORw0KGgo=',
    mimeType: 'image/png',
    repositoryId: 'default'
  }, 'PUT').ok, true);
  assert.equal(contentFunction._test.validateMutationBody({
    kind: 'media',
    scope: 'local',
    materialKind: 'prompt',
    materialId: 'tajny.json',
    filename: 'model.png',
    contentBase64: 'iVBORw0KGgo=',
    mimeType: 'image/png'
  }, 'PUT').ok, false);

  const oversized = Buffer.alloc(4 * 1024 * 1024 + 1);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(oversized);
  await assert.rejects(
    repository.saveMedia('shared', '', '', 'za-duzy.png', oversized.toString('base64'), 'image/png', { config: configured, fetchImpl: async () => response({}) }),
    (error) => error.code === 'CONTENT_FILE_TOO_LARGE' && error.status === 413
  );
});

test('Presentation Studio preserves stable IDs and accepts only managed image references', () => {
  const presentation = presentationModel.createPresentation({
    presentationId: 'alkohole',
    metadata: { title: 'Alkohole', status: 'published' },
    slides: [{
      slideId: 'slide-intro',
      title: 'Wstęp',
      elements: [
        { elementId: 'title-main', type: 'text', content: 'Alkohole' },
        { elementId: 'image-main', type: 'image', ref: 'assets/shared/model.svg', alt: 'Model' }
      ]
    }]
  });
  const serialized = presentationModel.serialize(presentation);
  const reparsed = presentationModel.parse(serialized, 'alkohole');
  assert.equal(reparsed.slides[0].slideId, 'slide-intro');
  assert.equal(reparsed.slides[0].elements[1].elementId, 'image-main');
  assert.equal(reparsed.slides[0].elements[1].ref, 'assets/shared/model.svg');
  assert.equal(presentationCommon.validateDefinition(reparsed, 'alkohole').valid, true);

  const unsafe = presentationModel.createPresentation({
    presentationId: 'niebezpieczna',
    slides: [{ elements: [{ type: 'image', ref: 'photos/../sekret.svg' }] }]
  });
  assert.equal(presentationModel.validate(unsafe).valid, false);
  const duplicate = presentationCommon.validateDefinition({
    presentationId: 'duplikat',
    slides: [{ slideId: 'ten-sam', elements: [] }, { slideId: 'ten-sam', elements: [] }]
  }, 'duplikat');
  assert.ok(duplicate.errors.some((error) => error.code === 'PRESENTATION_SLIDE_ID_DUPLICATE'));
});

test('Presentation Studio round-trips rich elements, typography, crop and backgrounds', () => {
  const elements = [
    presentationModel.createElement('heading', { content: 'Alkohole', fontFamily: 'playfair', fontWeight: 800, lineHeight: 1.25, letterSpacing: 1.2 }),
    presentationModel.createElement('image', { ref: 'photos/model.webp', alt: 'Model cząsteczki', cropMode: true, aspectLocked: false, focalX: 31, focalY: 66, opacity: .7 }),
    presentationModel.createElement('shape', { shape: 'line', opacity: .4 }),
    presentationModel.createElement('formula', { expression: 'C2H5OH', mode: 'chemistry' }),
    presentationModel.createElement('icon', { symbol: '⚗' }),
    presentationModel.createElement('table', { headers: ['Wzór', 'Nazwa'], rows: [['CH3OH', 'metanol']] }),
    presentationModel.createElement('button', { label: 'Czytaj', href: '/members/' }),
    presentationModel.createElement('code', { language: 'text', code: 'CH3OH' }),
    presentationModel.createElement('embed', { title: 'Film', url: 'https://www.youtube-nocookie.com/embed/abcdefghijk' })
  ];
  const presentation = presentationModel.createPresentation({
    presentationId: 'bogata-prezentacja',
    settings: { headingFont: 'playfair', bodyFont: 'open-sans' },
    slides: [{
      slideId: 'slajd-1',
      backgroundType: 'gradient',
      gradientFrom: '#112233',
      gradientTo: '#ddeeff',
      gradientAngle: 42,
      elements
    }]
  });
  const serialized = presentationModel.serialize(presentation);
  const server = presentationCommon.validateDefinition(JSON.parse(serialized), 'bogata-prezentacja');
  assert.equal(server.valid, true);
  assert.equal(server.definition.version, 2);
  assert.equal(server.definition.slides[0].backgroundType, 'gradient');
  assert.equal(server.definition.slides[0].elements.find((element) => element.type === 'image').cropMode, true);
  assert.deepEqual(new Set(server.definition.slides[0].elements.map((element) => element.type)), new Set(['heading', 'image', 'shape', 'formula', 'icon', 'table', 'button', 'code', 'embed']));
  assert.ok(['title-image', 'text-image', 'image-full', 'quote', 'table', 'question'].every((layout) => presentationModel.LAYOUTS.includes(layout)));

  const unsafeEmbed = presentationModel.createPresentation({
    presentationId: 'zly-embed',
    slides: [{ elements: [{ type: 'embed', url: 'https://evil.example/embed/abc' }] }]
  });
  assert.equal(presentationModel.validate(unsafeEmbed).valid, false);
});

test('legacy native presentations migrate to the versioned model without changing saved IDs later', () => {
  const migrated = presentationModel.parse({
    version: 1,
    presentationId: 'starsza',
    metadata: { title: 'Starsza' },
    slides: [{ title: 'Pierwszy', elements: [{ type: 'text', content: 'Treść' }] }]
  }, 'starsza');
  assert.equal(migrated.version, 2);
  assert.match(migrated.slides[0].slideId, /^slide-/);
  assert.match(migrated.slides[0].elements[0].elementId, /^element-/);
  const reparsed = presentationModel.parse(presentationModel.serialize(migrated), 'starsza');
  assert.equal(reparsed.slides[0].slideId, migrated.slides[0].slideId);
  assert.equal(reparsed.slides[0].elements[0].elementId, migrated.slides[0].elements[0].elementId);
});

test('Lesson Builder round-trips managed local media while keeping legacy HTTPS images', () => {
  const lesson = lessonModel.createLesson({
    title: 'Obrazy',
    filename: 'obrazy.md',
    slides: [{ blocks: [
      { type: 'image', ref: 'photos/schemat.webp', repositoryId: 'default', alt: 'Schemat', width: 72, align: 'right' },
      { type: 'image', url: 'https://example.com/stary.png', alt: 'Starszy obraz' }
    ] }]
  });
  const markdown = lessonModel.serializeLesson(lesson);
  assert.match(markdown, /:::image[\s\S]*ref: photos\/schemat\.webp[\s\S]*repository: default[\s\S]*width: 72[\s\S]*align: right/);
  assert.match(markdown, /!\[Starszy obraz\]\(https:\/\/example\.com\/stary\.png\)/);
  const editable = lessonModel.parseLesson(markdown, 'obrazy.md');
  assert.equal(editable.slides[0].blocks.find((block) => block.ref)?.ref, 'photos/schemat.webp');
  const published = lessonParser.parseLesson(markdown, 'obrazy.md');
  assert.match(published.slides[0].html, /data-lesson-media-ref="photos\/schemat\.webp"/);
});

test('Studio publishes the shared Media Manager and a nested, lazy content explorer', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'public/members/module/studio/index.html'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'public/members/module/studio/script.js'), 'utf8');
  const manager = fs.readFileSync(path.join(root, 'public/assets/js/media-manager.js'), 'utf8');
  assert.match(html, /media-manager\.css/);
  assert.match(html, /media-manager\.js/);
  assert.match(script, /function loadExplorerMedia/);
  assert.match(script, /function deleteExplorerMedia/);
  assert.match(script, /function duplicateContentExplorerAsset/);
  assert.match(script, /readMediaBlob/);
  assert.match(script, /uploadMedia/);
  assert.ok(script.indexOf("ChemContentLibrary.remove(kind") < script.indexOf("ChemContentLibrary.removeMedia({", script.indexOf('async function deleteContentExplorerAsset')));
  assert.match(script, /ChemMediaManager\.open/);
  assert.match(manager, /IntersectionObserver/);
  assert.match(manager, /clipboardData/);
  assert.match(manager, /dataTransfer/);
  assert.match(manager, /removeMedia/);
});

test('visual editors expose direct resize handles and duplicate elements with fresh stable IDs', () => {
  const root = path.join(__dirname, '..');
  const studio = fs.readFileSync(path.join(root, 'public/members/module/studio/script.js'), 'utf8');
  const presentation = fs.readFileSync(path.join(root, 'public/members/module/studio/presentation-builder.js'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'public/members/module/studio/style.css'), 'utf8');
  assert.match(studio, /function bindLessonPreviewImageResize/);
  assert.match(studio, /lesson-preview-image-handle/);
  assert.match(presentation, /presentation-resize-handle/);
  assert.match(presentation, /delete seed\.elementId/);
  assert.match(presentation, /cropDrag/);
  assert.match(presentation, /has-guide-x/);
  assert.match(styles, /\.lesson-preview-image-handle/);
  assert.match(styles, /\.presentation-resize-handle/);
});
