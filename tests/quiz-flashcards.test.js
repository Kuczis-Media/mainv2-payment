'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const model = require('../public/members/module/studio/quiz-model');
const common = require('../netlify/quiz-common');
const repository = require('../netlify/content-repository');
const endpoint = require('../netlify/functions/quiz');
const contentEndpoint = require('../netlify/functions/content-library');
const read = (name) => fs.readFileSync(path.join(__dirname, '..', 'public', name), 'utf8');
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));
function deck() {
  return model.createQuiz({ quizId: 'fiszki-chemia', mode: 'deck',
    metadata: { title: 'Pula chemia', description: 'Podstawy', courseId: 'course', active: true, status: 'published' },
    questions: [{ questionId: 'f1', type: 'flashcard', front: { text: '**Woda**\nPodaj wzór.', images: [{ ref: 'photos/woda.webp', alt: 'Model wody' }] },
      back: { text: '\\(\\ce{H2O}\\)', images: [{ ref: 'assets/shared/odpowiedz.png', alt: 'Wzór' }] }, explanation: 'Dwa atomy wodoru i jeden atom tlenu.' }]
  });
}

test('flashcard deck round-trips front/back media, course, activation and stable order through the existing publisher', () => {
  const value = deck();
  value.questions.push(model.duplicateQuestion(value.questions[0]));
  value.questions.reverse();
  value.metadata.active = false;
  const source = model.serialize(value);
  assert.deepEqual(model.parse(source), value);
  assert.equal(common.validateDefinition(JSON.parse(source), value.quizId).valid, true);
  assert.equal(repository._test.validateAssetContent('quiz', value.quizId, source), source);
  assert.equal(value.questions[0].front.images[0].ref, 'photos/woda.webp');
  assert.equal(value.questions[0].back.images[0].ref, 'assets/shared/odpowiedz.png');
  assert.notEqual(value.questions[0].questionId, value.questions[1].questionId);
  assert.equal(common.gradeQuiz(value).gradingStatus, 'not_scored');
  assert.equal(model.score(value).percent, null);
});

test('flashcard validation supports image-only faces and drafts but rejects unsafe media, empty publication and unknown future types', () => {
  const value = deck();
  value.questions[0].front.text = ''; value.questions[0].prompt = '';
  assert.equal(common.validateDefinition(value).valid, true);
  for (const side of ['front', 'back']) {
    const bad = structuredClone(value); bad.questions[0][side].images[0].ref = 'https://evil.example/image.svg';
    assert.equal(common.validateDefinition(bad).valid, false);
  }
  value.questions[0].back = { text: '', images: [] };
  assert.equal(common.validateDefinition(value).valid, false);
  assert.equal(model.validate(value).valid, false);
  value.metadata.status = 'draft';
  assert.equal(common.validateDefinition(value).valid, true);
  assert.equal(model.validate(value).valid, true);
  value.questions[0].type = 'image_occlusion';
  assert.equal(common.validateDefinition(value).valid, false);
  assert.equal(model.validate(value).valid, false);
  assert.throws(() => model.parse(JSON.stringify(value)), /Nieobsługiwany rodzaj/);
});

test('existing quiz fixtures preserve their fields, keys and scores without a migration', () => {
  for (const folder of ['quiz-bez-ai', 'quiz-chemia-organiczna', 'quiz-refleksja']) {
    const value = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'Examples/quizzes', folder, 'quiz.json'), 'utf8'));
    const before = model.parse(value);
    assert.equal(before.mode, undefined);
    const after = model.parse(model.serialize(before));
    assert.deepEqual(after, before);
    const grades = (quiz) => JSON.parse(JSON.stringify(common.gradeQuiz(quiz), (key, value) => key === 'gradedAt' ? undefined : value));
    assert.deepEqual(grades(after), grades(before));
    assert.equal(common.validateDefinition(after).valid, true);
  }
});

test('students can only read published active decks and cannot create, edit or delete administrator decks', async (t) => {
  const value = deck(); let saves = 0, deletes = 0, attempts = 0;
  const user = { id: 'student-fiszki-test', app_metadata: { roles: ['active'] } };
  t.mock.method(global, 'fetch', async () => new Response(JSON.stringify(user)));
  t.mock.method(repository, 'readAsset', async () => ({ content: JSON.stringify(value), sha: 'a'.repeat(40) }));
  t.mock.method(repository, 'saveAsset', async (kind, id, content) => {
    saves++; assert.equal(kind, 'quiz'); assert.equal(id, value.quizId);
    assert.equal(common.validateDefinition(JSON.parse(content)).valid, true);
    return { created: true, sha: 'b'.repeat(40) };
  });
  t.mock.method(repository, 'deleteAsset', async () => { deletes++; return { deleted: true }; });
  endpoint._test.setStoreFactory(() => { attempts++; throw new Error('No attempt storage for flashcards'); });
  t.after(() => endpoint._test.setStoreFactory(null));
  const event = { httpMethod: 'GET', headers: { authorization: 'Bearer fixture', 'content-type': 'application/json', origin: 'https://course.example', host: 'course.example' }, queryStringParameters: { quiz: value.quizId } };
  const context = { clientContext: { user, identity: { url: 'https://course.example/.netlify/identity' } } };
  assert.equal((await endpoint.handler(event, {})).statusCode, 401);
  const downloaded = await endpoint.handler(event, context);
  assert.equal(downloaded.statusCode, 200, downloaded.body);
  assert.deepEqual(JSON.parse(downloaded.body).quiz, value);
  value.metadata.active = false;
  assert.equal((await endpoint.handler(event, context)).statusCode, 404);
  assert.equal((await endpoint.handler({ ...event, queryStringParameters: { quiz: value.quizId, preview: '1' } }, context)).statusCode, 403);
  const mutation = { ...event, httpMethod: 'PUT', body: JSON.stringify({ kind: 'quiz', filename: value.quizId, content: model.serialize(value), expectedSha: '', repositoryId: 'default' }) };
  assert.equal((await contentEndpoint.handler(mutation, context)).statusCode, 403);
  assert.equal((await contentEndpoint.handler({ ...mutation, httpMethod: 'DELETE' }, context)).statusCode, 403);
  assert.equal(saves + deletes, 0);
  user.app_metadata.roles = ['admin'];
  assert.equal((await endpoint.handler({ ...event, queryStringParameters: { quiz: value.quizId, preview: '1' } }, context)).statusCode, 200);
  const saved = await contentEndpoint.handler(mutation, context);
  assert.equal(saved.statusCode, 201, saved.body);
  const deleted = await contentEndpoint.handler({ ...mutation, httpMethod: 'DELETE', body: JSON.stringify({ kind: 'quiz', filename: value.quizId, expectedSha: 'b'.repeat(40), repositoryId: 'default' }) }, context);
  assert.equal(deleted.statusCode, 200, deleted.body);
  assert.equal(saves, 1); assert.equal(deletes, 1); assert.equal(attempts, 0);
});

function browser(t, player = false) {
  const dom = new JSDOM(player ? read('members/module/quiz/index.html') : '<main id="view"></main>', {
    url: 'https://course.example/members/module/quiz/?quiz=fiszki-chemia', runScripts: 'outside-only', pretendToBeVisual: true
  });
  const w = dom.window;
  w.eval(read('members/module/lesson/lesson-parser.js'));
  w.eval(read('assets/js/assessment-text.js'));
  w.MathJax = { typesetPromise: async () => {}, typesetClear() {} };
  w.eval(read('assets/js/quiz-practice.js'));
  w.eval(read('assets/js/quiz-flashcards.js'));
  t.after(() => w.close());
  return w;
}

test('flashcard preview reveals back and explanation, renders Markdown/LaTeX safely and requests managed images', async (t) => {
  const w = browser(t), q = deck().questions[0];
  q.front.text += '\n\n- pierwsza\n- druga\n\n<script>alert(1)</script>';
  const refs = [], getUrl = async (ref) => { refs.push(ref); return 'data:image/gif;base64,R0lGODlhAQABAAAAACw='; };
  const card = w.ChemQuizFlashcards.card(q, getUrl); w.document.body.append(card);
  await tick();
  assert.ok(card.querySelector('strong')); assert.equal(card.querySelectorAll('li').length, 2);
  assert.equal(card.querySelector('script'), null);
  assert.equal(card.querySelector('.quiz-flashcard-back').hidden, true);
  assert.deepEqual(refs, ['photos/woda.webp']);
  card.querySelector('[data-flashcard-reveal]').click(); await tick();
  assert.equal(card.querySelector('.quiz-flashcard-back').hidden, false);
  assert.ok(card.querySelector('[data-assessment-math]'));
  assert.ok(card.querySelector('sub'), 'Chemical formula has an immediate subscript preview');
  assert.match(card.textContent, /Dwa atomy wodoru/);
  assert.deepEqual(refs, ['photos/woda.webp', 'assets/shared/odpowiedz.png']);
});

test('student deck loads once, reviews locally and only saves start/completion progress', async (t) => {
  const w = browser(t, true), value = deck();
  value.questions.push(model.duplicateQuestion(value.questions[0]));
  value.questions.forEach((q) => { q.front.images = []; q.back.images = []; });
  const requests = [], progress = [];
  w.ChemAuth = { ready: Promise.resolve({ authenticated: true, session: { ok: true } }), getAccessToken: async () => 'fixture' };
  w.ChemProgress = { materialId: () => 'quiz:default:fiszki-chemia', load: async () => {}, record: () => null, update: async (event) => { progress.push(event); return {}; } };
  w.fetch = async (url, options) => { requests.push({ url, options }); return new Response(JSON.stringify({ quiz: value })); };
  w.eval(read('members/module/quiz/script.js')); await tick();
  assert.equal(w.document.getElementById('quiz-player').hidden, false);
  assert.equal(w.document.getElementById('quiz-player-check').hidden, true);
  assert.equal(progress.length, 1);
  for (let i = 0; i < 2; i++) {
    assert.equal(w.document.querySelectorAll('.quiz-flashcard').length, 1, 'Only the active card is mounted');
    assert.equal(w.document.querySelector('.quiz-flashcard-ratings').hidden, true);
    w.document.querySelector('[data-flashcard-reveal]').click();
    w.document.querySelector('[data-flashcard-rating="3"]').click(); await tick();
  }
  assert.match(w.document.getElementById('quiz-player-form').textContent, /Pula przejrzana/);
  assert.equal(requests.length, 1); assert.equal(requests[0].options.method, undefined);
  assert.equal(progress.length, 2); assert.equal(progress[1].details.completed, true);
  assert.equal(progress[1].details.scorePercent, null);
});

test('flashcard image cache deduplicates reads, limits retained images and releases URLs on disposal', async (t) => {
  const w = browser(t), revoked = [];
  let reads = 0, sequence = 0;
  w.URL.createObjectURL = () => `blob:https://course.example/${++sequence}`;
  w.URL.revokeObjectURL = (url) => revoked.push(url);
  const cache = w.ChemQuizFlashcards.imageCache(async () => { reads++; return new Blob(['image']); });
  const first = cache.get('photos/one.png');
  assert.equal(cache.get('photos/one.png'), first);
  const firstUrl = await first;
  for (let i = 0; i < 35; i++) await cache.get(`photos/image-${i}.png`);
  await tick();
  assert.equal(reads, 36);
  assert.ok(revoked.includes(firstUrl));
  assert.equal(revoked.length, 4, 'Only 32 non-visible image URLs are retained');
  cache.clear(); assert.equal(revoked.length, 36);
});
