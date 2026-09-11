'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { buildSync } = require('esbuild');
const { options } = require('../scripts/build-dashboard.cjs');
const bundle = buildSync({ ...options, write: false, logLevel: 'silent' }).outputFiles[0].text;
const read = (file) => fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8');
const tick = () => new Promise((resolve) => setTimeout(resolve, 30));
const plain = (value) => JSON.parse(JSON.stringify(value));

function setup(t, file, query = '') {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error.message));
  const dom = new JSDOM(file ? read(file) : '<div id="view"></div>', { url: `https://course.example/${file || 'members/'}${query}`, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const w = dom.window;
  w.TextEncoder = TextEncoder;
  w.TextDecoder = TextDecoder;
  w.scrollTo = () => {};
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.confirm = () => true;
  w.ChemAuth = { ready: Promise.resolve({ authenticated: true, session: { ok: true } }), getUser: () => ({ id: 'admin', app_metadata: { roles: ['admin'] } }), getAccessToken: async () => 'test-token' };
  w.ChemAssessmentText = { render(node, text) { node.textContent = text || ''; } };
  w.eval(bundle);
  t.after(() => { w.NextMedUI.releaseWithin(w.document.body); w.close(); assert.deepEqual(errors, []); });
  return { w, d: w.document, evalFile: (name) => w.eval(read(name)), render: (name, props, host = w.document.getElementById('view')) => w.NextMedUI.render(name, host, props) };
}
async function input(w, node, value) {
  assert.ok(node, 'Control exists');
  const proto = node.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : node.tagName === 'SELECT' ? w.HTMLSelectElement.prototype : w.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, value);
  node.dispatchEvent(new w.Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  await tick();
}

function attempt(questions) {
  return { attemptId: 'a1', status: 'active', revision: 1, answers: {}, flags: [], confirmedQuestionIds: [], timedOutQuestionIds: [], currentIndex: 0, highestReachedIndex: 0, totalQuestions: questions.length, questions,
    exam: { metadata: { name: 'Test' }, display: { mode: 'one' }, navigation: { allowFreeNavigation: true, allowBack: true, allowSkip: true, allowFlagging: true }, timing: { mode: 'none' }, security: {}, resultVisibility: {} } };
}

test('React exam controls preserve every answer shape and lock confirmed questions', async (t) => {
  const h = setup(t);
  const questions = [
    { questionId: 'single', type: 'single_choice', options: [{ answerId: 'a', text: 'A' }, { answerId: 'b', text: 'B' }] },
    { questionId: 'multiple', type: 'multiple_choice', options: [{ answerId: 'a', text: 'A' }, { answerId: 'b', text: 'B' }] },
    { questionId: 'text', type: 'short_text' }, { questionId: 'number', type: 'number' }, { questionId: 'open', type: 'open_answer' },
    { questionId: 'matching', type: 'matching', left: [{ pairId: 'l', text: 'L' }], right: [{ answerId: 'r', text: 'R' }] },
    { questionId: 'ordering', type: 'ordering', items: [{ itemId: 'a', text: 'A' }, { itemId: 'b', text: 'B' }] },
    { questionId: 'blanks', type: 'fill_blanks', template: 'H{{liczba}}O', blanks: [{ blankId: 'b1' }] }
  ].map((q) => ({ prompt: 'Treść', images: [], ...q }));
  const a = attempt(questions);
  let writes = 0;
  const props = { indices: questions.map((_, i) => i), attempt: a, typeLabel: (v) => v, getUrl: async () => '', onConfirm() {}, onAnswer(id, value) { writes++; a.answers[id] = value; } };
  assert.equal(h.render('exam-questions', props), true);
  const q = (id, selector) => h.d.querySelector(`[data-question-id="${id}"] ${selector}`);
  q('single', 'input[value="b"]').click(); await tick();
  q('multiple', 'input[value="a"]').click(); await tick();
  q('multiple', 'input[value="b"]').click(); await tick();
  await input(h.w, q('text', 'input'), 'komórka');
  await input(h.w, q('number', 'input'), '1,25');
  await input(h.w, q('open', 'textarea'), 'Opis reakcji H₂O');
  await input(h.w, q('matching', 'select'), 'r');
  q('ordering', '[aria-label="Przesuń niżej"]').click(); await tick();
  await input(h.w, q('blanks', 'input'), '2');
  assert.deepEqual(plain(a.answers), { single: 'b', multiple: ['a', 'b'], text: 'komórka', number: '1,25', open: 'Opis reakcji H₂O', matching: { l: 'r' }, ordering: ['b', 'a'], blanks: { b1: '2' } });
  assert.equal(writes, 9);
  h.render('exam-questions', { ...props, indices: [0] });
  h.render('exam-questions', { ...props, indices: [4] });
  assert.equal(q('open', 'textarea').value, 'Opis reakcji H₂O');
  a.confirmedQuestionIds = ['open'];
  h.render('exam-questions', { ...props, indices: [4] });
  assert.equal(q('open', 'textarea').disabled, true);
});

test('real exam controller keeps optimistic navigation and batches answers with React DOM', async (t) => {
  const h = setup(t, 'members/module/exam/index.html', '?exam=test&repo=glowne');
  const requests = [];
  h.w.ChemExamClient = { mutate(action, params) { return new Promise((resolve) => requests.push({ action, ...params.body, resolve })); } };
  const source = read('members/module/exam/script.js').replace("document.addEventListener('DOMContentLoaded', start);", 'window.testExam = { state, bind, initializeAttempt, renderAttempt, navigateTo };');
  h.w.eval(source);
  const api = h.w.testExam;
  const server = attempt(Array.from({ length: 6 }, (_, i) => ({ questionId: `q${i}`, type: 'short_text', prompt: `Pytanie ${i}` })));
  api.state.reference = { repositoryId: 'glowne', examId: 'test' };
  api.bind(); api.initializeAttempt(plain(server), false); api.renderAttempt();
  assert.equal(h.d.getElementById('exam-question-list').dataset.reactView, 'exam-questions');
  await input(h.w, h.d.querySelector('.exam-text-answer'), 'pierwsza');
  const first = api.navigateTo(1); await tick();
  await input(h.w, h.d.querySelector('.exam-text-answer'), 'druga');
  const latest = api.navigateTo(4); await tick();
  assert.equal(h.d.querySelector('.exam-question').dataset.questionIndex, '4');
  assert.equal(requests.length, 1);
  function respond(index) { const req = requests[index]; Object.assign(server.answers, req.answers); server.currentIndex = req.targetIndex; server.highestReachedIndex = Math.max(server.highestReachedIndex, req.targetIndex); server.revision++; req.resolve({ attempt: plain(server) }); }
  respond(0); await tick();
  assert.equal(h.d.querySelector('.exam-question').dataset.questionIndex, '4');
  assert.equal(requests.length, 2);
  respond(1); await Promise.all([first, latest]);
  assert.deepEqual(plain(api.state.attempt.answers), { q0: 'pierwsza', q1: 'druga' });
  assert.equal(api.state.dirtyQuestions.size, 0);
  assert.equal(h.d.querySelectorAll('#exam-navigator-grid button').length, 6);
});

test('quiz batches long lists, reveals unmounted required questions and retains answers', async (t) => {
  const h = setup(t);
  const questions = Array.from({ length: 80 }, (_, i) => ({ questionId: `q${i}`, type: 'text', prompt: `Pytanie ${i}`, points: 1, image: {} }));
  const props = { questions, answers: {}, results: {}, locked: false, getUrl: async () => '', onAnswer(id, value) { props.answers[id] = value; } };
  h.render('quiz-questions', props);
  assert.equal(h.d.querySelectorAll('fieldset').length, 24);
  await input(h.w, h.d.querySelector('input'), 'zapamiętaj');
  h.d.querySelector('.react-list-more button').click(); await tick();
  assert.equal(h.d.querySelectorAll('fieldset').length, 48);
  h.render('quiz-questions', { ...props, revealId: 'q70' });
  assert.equal(h.d.querySelectorAll('fieldset').length, 72);
  assert.equal(h.d.querySelector('input').value, 'zapamiętaj');
  h.render('quiz-questions', { ...props, locked: true, results: { q0: { reviewStatus: 'pending' } } });
  assert.equal(h.d.querySelector('input').disabled, true);
  assert.match(h.d.querySelector('.quiz-player-feedback').textContent, /oczekuje na ocenę/);
  assert.equal(h.d.querySelector('fieldset').classList.contains('is-wrong'), false);
});

test('real quiz player submits open answers only on request, locks during grading and resets on retry', async (t) => {
  const h = setup(t, 'members/module/quiz/index.html', '?quiz=test&repo=glowne');
  let submit, posts = 0;
  const quiz = { metadata: { title: 'Quiz', description: '', cover: {} }, settings: { passingScore: 50, allowRetry: true, shuffleQuestions: false, showFeedback: true },
    questions: [{ questionId: 'open', type: 'open', prompt: 'Wyjaśnij', points: 5, required: true, gradingMode: 'manual', image: {} }] };
  h.w.fetch = async (_, options = {}) => {
    if (options.method === 'POST') { posts++; return new Promise((resolve) => { submit = () => resolve({ ok: true, json: async () => ({ attemptId: 'one', attemptNumber: 1, progressSaved: true, result: { gradingStatus: 'pending_review', pendingQuestionCount: 1, earned: 0, maximum: 5, percent: null, passed: null, results: [{ questionId: 'open', reviewStatus: 'pending' }] } }) }); }); }
    return { ok: true, json: async () => ({ quiz }) };
  };
  h.evalFile('members/module/quiz/script.js'); await tick();
  assert.equal(h.d.getElementById('quiz-player-form').dataset.reactView, 'quiz-questions');
  assert.equal(posts, 0);
  await input(h.w, h.d.querySelector('.quiz-player-open-answer'), 'Ręczna odpowiedź');
  h.d.getElementById('quiz-player-check').click(); await tick();
  assert.equal(posts, 1);
  assert.equal(h.d.querySelector('textarea').disabled, true);
  h.d.getElementById('quiz-player-check').click(); assert.equal(posts, 1);
  submit(); await tick();
  assert.match(h.d.getElementById('quiz-player-result').textContent, /ocen/);
  h.d.getElementById('quiz-player-retry').click(); await tick();
  assert.equal(h.d.querySelector('textarea').value, '');
  assert.equal(h.d.querySelector('textarea').disabled, false);
  assert.equal(posts, 1);
});

test('lazy media does not fetch offscreen or reload after a normal React update', async (t) => {
  const h = setup(t);
  const observers = [];
  h.w.IntersectionObserver = class { constructor(callback) { this.callback = callback; observers.push(this); } observe(node) { this.node = node; } disconnect() {} };
  let reads = 0;
  const props = { questions: [{ questionId: 'q', type: 'text', prompt: 'Obraz', image: { ref: 'photos/a.png' }, points: 1 }], answers: {}, results: {}, onAnswer() {}, getUrl: async () => { reads++; return 'blob:local'; } };
  h.render('quiz-questions', props); await tick(); assert.equal(reads, 0);
  observers[0].callback([{ isIntersecting: true }]); observers[0].callback([{ isIntersecting: true }]); await tick();
  assert.equal(reads, 1);
  h.render('quiz-questions', { ...props, answers: { q: 'x' } }); await tick();
  assert.equal(reads, 1);
  assert.equal(h.d.querySelector('img').getAttribute('src'), 'blob:local');
});

test('Studio tools use React search, keep links and dispatch editor navigation', async (t) => {
  const h = setup(t, 'members/module/studio/index.html');
  await tick();
  let mode;
  h.d.addEventListener('studio-select-mode', (event) => { mode = event.detail; });
  h.evalFile('members/module/studio/tool-picker.js');
  h.d.dispatchEvent(new h.w.Event('DOMContentLoaded')); await tick();
  assert.equal(h.d.getElementById('studio-tools').dataset.reactView, 'studio-tools');
  await input(h.w, h.d.getElementById('studio-tool-search'), 'lekcji');
  assert.equal(h.d.querySelectorAll('.project-card').length, 1);
  h.d.querySelector('.project-card').click(); await tick(); assert.equal(mode, 'lesson');
  await input(h.w, h.d.getElementById('studio-tool-select'), 'exam'); assert.equal(mode, 'exam');
  await input(h.w, h.d.getElementById('studio-tool-search'), '');
  h.d.querySelector('[data-tool-filter="management"]').click(); await tick();
  assert.ok(h.d.querySelector('a[href="/members/module/studio/manage/?tab=payments"]'));
  assert.equal(h.d.getElementById('content-explorer').hidden, true);
  assert.ok(h.d.querySelector('.project-icon svg path'));
});

test('React lesson canvas folds long content and retains drag/action IDs and selected blocks', async (t) => {
  const h = setup(t);
  const slides = Array.from({ length: 60 }, (_, i) => ({ id: `s${i}`, blocks: [{ id: `b${i}`, type: 'text', text: `Tekst ${i}` }] }));
  const props = { model: { slides }, selected: 's0', adapters: { title: (b) => b.text, subtitle: () => '', symbol: () => 'T', nested: (b) => b.blocks, slideTitle: (s) => s.id, slideSummary: () => '' } };
  h.render('studio-lesson', props); await tick();
  assert.equal(h.d.querySelectorAll('.lesson-slide').length, 60);
  assert.equal(h.d.querySelectorAll('.lesson-block').length, 1);
  h.d.querySelector('[aria-label="Zwiń treść slajdu"]').click(); await tick();
  assert.equal(h.d.querySelectorAll('.lesson-block').length, 0);
  h.render('studio-lesson', { ...props, selected: 'b59' }); await tick();
  assert.ok(h.d.querySelector('[data-lesson-block-id="b59"]'));
  assert.equal(h.d.querySelector('[data-lesson-block-id="b59"]').dataset.lessonSlideId, 's59');
  assert.ok(h.d.querySelector('[data-lesson-block-id="b59"] [data-lesson-action="duplicate"]'));
});

test('ENV React editor preserves secrets locally, supports provider, rename, clear and removal', async (t) => {
  const h = setup(t, 'members/module/studio/env/index.html');
  await tick();
  let requests = 0;
  h.w.fetch = async () => { requests++; throw new Error('No network allowed'); };
  h.evalFile('members/module/studio/env/env-model.js'); h.evalFile('members/module/studio/env/script.js');
  h.d.dispatchEvent(new h.w.Event('DOMContentLoaded')); await tick();
  assert.equal(h.d.getElementById('env-list').dataset.reactView, 'studio-env');
  const provider = [...h.d.querySelectorAll('.env-row')].find((row) => row.querySelector('.env-name').value === 'GIT_PROVIDER');
  await input(h.w, provider.querySelector('select'), 'gitea');
  h.d.getElementById('env-add').click(); await tick();
  const row = h.d.querySelector('.env-row:last-child');
  await input(h.w, row.querySelector('.env-name'), 'MY_PRIVATE_TOKEN');
  await input(h.w, row.querySelector('.env-value'), 'fixture-only-not-a-real-secret');
  assert.equal(row.querySelector('.env-value').type, 'password');
  assert.doesNotMatch(h.d.getElementById('env-output').value, /fixture-only/);
  row.querySelector('.reveal-button').click(); await tick();
  assert.equal(row.querySelector('.env-value').type, 'text');
  h.d.getElementById('env-clear').click(); await tick();
  assert.equal(row.querySelector('.env-value').value, '');
  row.querySelector('.remove-button').click(); await tick();
  assert.equal(row.isConnected, false);
  assert.equal(requests, 0);
});

test('shared runtime disposes detached roots and safely declines missing or legacy renderers', async (t) => {
  const h = setup(t);
  const host = h.d.getElementById('view');
  assert.equal(h.render('not-a-view', {}), false);
  h.render('quiz-result', { title: 'Wynik', score: '100%', message: 'Gotowe' });
  host.remove(); await tick(); assert.equal(host.dataset.reactView, undefined);
  h.d.body.append(host);
  h.w.history.replaceState(null, '', '?uiRenderer=legacy');
  assert.equal(h.render('quiz-result', {}), false);
});

async function studio(t, libraryOverrides = {}) {
  const h = setup(t, 'members/module/studio/index.html');
  await tick();
  h.w.ChemContentLibrary = {
    repositories: async () => [{ id: 'glowne', default: true, label: 'Główna' }],
    list: async () => [], search: (items, query) => items.filter((item) => `${item.title} ${item.filename}`.includes(query)),
    readQuestionBank: async () => ({ bank: { questions: [] }, sha: '' }), ...libraryOverrides
  };
  const files = ['members/dashboard-parser.js', 'members/module/lesson/lesson-parser.js', 'assets/js/assessment-text.js',
    ...['paged-list', 'dashboard-model', 'lesson-model', 'answer-fields', 'prompt-model', 'exam-model', 'assessment-editor', 'presentation-model', 'quiz-model', 'exam-builder', 'presentation-builder', 'quiz-builder', 'script', 'tool-picker'].map((file) => `members/module/studio/${file}.js`)];
  files.forEach(h.evalFile);
  h.d.dispatchEvent(new h.w.Event('DOMContentLoaded')); await tick();
  assert.equal(h.d.getElementById('studio-app').hidden, false, h.d.getElementById('access-state').textContent);
  return h;
}

test('actual Studio boots all React workspaces, with local drafts and no changes to publication format', async (t) => {
  const h = await studio(t);
  for (const [mode, host, view] of [['dashboard', 'dashboard-canvas', 'studio-dashboard'], ['lesson', 'lesson-canvas', 'studio-lesson'], ['prompt', 'prompt-points-list', 'studio-prompt'], ['quiz', 'quiz-question-list', 'studio-quiz'], ['presentation', 'presentation-slide-list', 'studio-presentation-slides']]) {
    await input(h.w, h.d.getElementById('studio-tool-select'), mode);
    if (mode === 'prompt') await input(h.w, h.d.getElementById('prompt-format-select'), 'txt');
    assert.equal(h.d.getElementById(`${mode}-workspace`).hidden, false);
    assert.equal(h.d.getElementById(host)?.dataset.reactView, view, `${mode} is rendered by React`);
  }
  await input(h.w, h.d.getElementById('studio-tool-select'), 'exam');
  h.d.querySelector('[data-exam-tab="questions"]').click(); await tick();
  assert.ok(h.d.querySelector('[data-react-view="studio-exam-list"]'));
  h.d.querySelector('[data-exam-action="add-question"]').click(); await tick();
  assert.ok(h.d.querySelector('.exam-question-editor'), 'Established rich question editor remains available');
  h.w.ChemExamBuilder.flush();
  const exam = JSON.parse(h.w.localStorage.getItem('chemdisk.studio.exam.v1'));
  assert.ok(exam.questions.length > 0);
});

test('actual quiz builder React controls save edits, duplicate once and preserve answer editor events', async (t) => {
  const h = await studio(t);
  await input(h.w, h.d.getElementById('studio-tool-select'), 'quiz');
  await input(h.w, h.d.querySelector('[data-quiz-field="prompt"]'), 'Zmieniona treść');
  await input(h.w, h.d.querySelector('[data-quiz-field="points"]'), '3.5');
  await input(h.w, h.d.querySelector('[data-quiz-field="optionText"]'), 'Poprawiona odpowiedź');
  const original = h.d.querySelectorAll('.quiz-question-card').length;
  h.d.querySelector('[data-quiz-action="duplicate"]').click(); await tick();
  assert.equal(h.d.querySelectorAll('.quiz-question-card').length, original + 1);
  h.w.ChemQuizBuilder.flush();
  const quiz = JSON.parse(h.w.localStorage.getItem('chemdisk.studio.quiz.v1'));
  assert.equal(quiz.questions[0].prompt, 'Zmieniona treść');
  assert.equal(quiz.questions[0].points, 3.5);
  assert.equal(quiz.questions[0].options[0].text, 'Poprawiona odpowiedź');
  assert.notEqual(quiz.questions[0].questionId, quiz.questions[1].questionId);
});

test('React library paginates without fetching and only loads media after opening material', async (t) => {
  const h = setup(t);
  const assets = Array.from({ length: 50 }, (_, i) => ({ filename: `lesson${i}.md`, title: `Lekcja ${i}`, kind: 'lesson', repositoryId: 'glowne' }));
  const paging = require('../public/members/module/studio/paged-list');
  const pagingState = paging.createState();
  let loads = 0;
  const adapters = { repositoryId: 'glowne', open: new Set(), mediaKey: (kind, id) => `${kind}:${id}`, size: () => '25 KB', renderMedia: () => h.d.createElement('div'), renderShared: () => h.d.createElement('div'),
    toggle(key, open) { if (open) this.open.add(key); else this.open.delete(key); }, loadMedia() { loads++; }, more(page) { paging.more(pagingState, page.key, page.total); draw(); } };
  function draw() { h.render('studio-library', { groups: [{ kind: 'lesson', title: 'Lekcje', icon: 'L', assets, paged: paging.page(pagingState, 'lessons', assets) }], adapters }); }
  draw();
  assert.equal(h.d.querySelectorAll('.content-explorer-material').length, 0);
  h.d.querySelector('summary').click(); await tick();
  assert.equal(h.d.querySelectorAll('.content-explorer-material').length, 12);
  assert.equal(loads, 0);
  h.d.querySelector('.studio-list-more').click(); await tick();
  assert.equal(h.d.querySelectorAll('.content-explorer-material').length, 24);
  h.d.querySelector('.content-explorer-material summary').click(); await tick();
  assert.equal(loads, 1);
  assert.equal(h.d.querySelector('[data-explorer-open]').dataset.explorerRepository, 'glowne');
  draw(); assert.equal(loads, 1, 'Rendering does not reload media');
});

test('AI limit controls distinguish zero from empty and payment fields preserve IDs and validation', async (t) => {
  const h = setup(t);
  const props = { metrics: ['requests'], periods: ['hour'], values: { requests: { hour: 0 } }, labels: { requests: 'Żądania' }, periodLabels: { hour: 'Godzina' }, selection: 'default' };
  h.render('studio-ai-limit-grid', props);
  assert.equal(h.d.querySelector('input').value, '0');
  await input(h.w, h.d.querySelector('input'), '20');
  assert.equal(h.d.querySelector('input').value, '20');
  h.render('studio-ai-limit-grid', { ...props, values: null, selection: 'user' });
  assert.equal(h.d.querySelector('input').value, '');
  h.render('studio-price-fields', {});
  assert.equal(h.d.querySelectorAll('.admin-price-plan').length, 6);
  assert.equal(h.d.getElementById('admin-price-month').getAttribute('step'), '0.01');
  assert.equal(h.d.getElementById('admin-price-year').required, true);
});

test('actual quiz publication accepts manual open questions and a failed save leaves the local draft intact', async (t) => {
  const writes = [];
  let fail = true;
  const h = await studio(t, { save: async (kind, value) => { writes.push({ kind, ...value }); if (fail) throw new Error('Zapis niedostępny'); return { sha: 'published-sha' }; } });
  await input(h.w, h.d.getElementById('studio-tool-select'), 'quiz');
  await input(h.w, h.d.querySelector('[data-quiz-field="type"]'), 'open');
  await input(h.w, h.d.querySelector('[data-quiz-field="prompt"]'), 'Wyjaśnij rolę błony komórkowej.');
  await input(h.w, h.d.getElementById('quiz-title'), 'Pytania otwarte');
  h.d.getElementById('quiz-publish-button').click(); await tick();
  assert.equal(writes.length, 1);
  const sent = JSON.parse(writes[0].content);
  assert.equal(sent.questions[0].type, 'open');
  assert.equal(sent.questions[0].gradingMode, 'manual');
  assert.equal(sent.metadata.status, 'published');
  h.w.ChemQuizBuilder.flush();
  assert.equal(JSON.parse(h.w.localStorage.getItem('chemdisk.studio.quiz.v1')).metadata.status, 'draft');
  assert.match(h.d.getElementById('quiz-builder-status').textContent, /Zapis niedostępny/);
  fail = false;
  h.d.getElementById('quiz-publish-button').click(); await tick();
  h.w.ChemQuizBuilder.flush();
  assert.equal(writes.length, 2);
  assert.equal(JSON.parse(h.w.localStorage.getItem('chemdisk.studio.quiz.v1')).metadata.status, 'published');
  const reads = [];
  h.w.fetch = async (url, options) => {
    assert.notEqual(options.method, 'POST');
    const cursor = new URL(url).searchParams.get('cursor'); reads.push(cursor);
    return new Response(JSON.stringify({ cursor: cursor ? null : 'offset:25', metricsScope: 'page', metrics: { participants: 1, attempts: 1, pendingReview: 1, graded: 0, average: 0 },
      attempts: [{ attemptId: cursor ? 'older' : 'newer', userId: 'student', number: 1, gradingStatus: 'pending_review' }] }));
  };
  h.d.getElementById('quiz-report-refresh').click(); await tick();
  assert.match(h.d.getElementById('quiz-report-status').textContent, /tej części/);
  h.d.querySelector('[data-quiz-report-action="next"]').click(); await tick();
  assert.equal(h.d.querySelectorAll('[data-quiz-report-action="open"]').length, 1);
  assert.equal(h.d.querySelector('[data-quiz-report-action="open"]').dataset.attemptId, 'older');
  h.d.querySelector('[data-quiz-report-action="first"]').click(); await tick();
  assert.deepEqual(reads, [null, 'offset:25', null]);
});

test('landing reconciles published sections, keeps native form/3D/pricing nodes and applies independent field colors', async (t) => {
  const h = setup(t, 'index.html');
  let requests = 0;
  h.w.fetch = async () => { requests++; throw new Error('Rendering must not fetch'); };
  h.w.NextMedLandingSource = { ready: Promise.resolve({ unavailable: true }) };
  const form = h.d.querySelector('form[name="contact"]');
  const molecule = h.d.getElementById('hero-biomolecule');
  const pricing = h.d.querySelector('[data-pricing]');
  const email = form.querySelector('[name="email"]'); email.value = 'student@example.com';
  let submits = 0; form.addEventListener('submit', (event) => { event.preventDefault(); submits++; });
  const observers = [];
  h.w.IntersectionObserver = class { constructor(callback) { this.callback = callback; this.nodes = []; observers.push(this); } observe(node) { this.nodes.push(node); } disconnect() { this.nodes = []; } unobserve() {} };
  h.evalFile('assets/start_site/script.js');
  h.evalFile('assets/js/landing-runtime.js'); await tick();
  assert.equal(h.d.querySelector('main').dataset.reactView, 'landing-page');
  assert.ok(observers.at(-1).nodes.some((node) => node.closest('main')), 'Motion reattaches to new React DOM even without a published model');
  assert.ok(observers.at(-1).nodes.every((node) => node.isConnected));
  const model = { branding: { brandName: 'NextMed', tagline: 'Nowy kurs' }, sections: [...h.d.querySelectorAll('main > section')].map((section, i) => ({
    id: section.id, order: i, enabled: true, title: `Nowy ${section.id}`, subtitle: 'Podtytuł', body: 'Treść', ctaLabel: 'Poznaj kurs', ctaHref: '#pricing', heroVisual: 'biomolecule-banner',
    backgroundColor: '#123456', textColor: '#ffffff', fieldBackgroundColor: '#abcdef', fieldTextColor: '#112233'
  })) };
  assert.equal(h.w.NextMedLanding.applyModel(model), true);
  assert.match(h.d.querySelector('#home .text-2').textContent, /Nowy home/);
  assert.equal(h.d.getElementById('home').dataset.heroVisual, 'biomolecule-banner');
  model.sections.find((s) => s.id === 'contact').order = -1;
  model.sections.find((s) => s.id === 'services').enabled = false;
  assert.equal(h.w.NextMedLanding.applyModel(model), true);
  assert.equal(h.d.querySelector('main > section').id, 'contact');
  assert.equal(h.d.getElementById('services').hidden, true);
  assert.equal(h.d.querySelector('form[name="contact"]'), form);
  assert.equal(h.d.getElementById('hero-biomolecule'), molecule);
  assert.equal(h.d.querySelector('[data-pricing]'), pricing);
  assert.equal(email.value, 'student@example.com');
  assert.equal(email.style.backgroundColor, 'rgb(171, 205, 239)');
  assert.equal(h.d.getElementById('contact').style.backgroundColor, 'rgb(18, 52, 86)');
  form.dispatchEvent(new h.w.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(submits, 1);
  h.evalFile('assets/js/landing-session.js');
  const hero = model.sections.find((s) => s.id === 'home');
  hero.ctaHref = '/login/'; hero.ctaLabel = 'Zaloguj się';
  h.w.NextMedLanding.applyModel(model);
  assert.equal(h.d.getElementById('login-cta').textContent, 'Przejdź do kursu');
  hero.ctaLabel = 'Dołącz do nas'; h.w.NextMedLanding.applyModel(model);
  h.w.dispatchEvent(new h.w.CustomEvent('chem-auth-user-changed', { detail: { authenticated: false } }));
  assert.equal(h.d.getElementById('login-cta').textContent, 'Dołącz do nas');
  assert.equal(h.d.getElementById('login-cta').getAttribute('href'), '/login/');
  assert.equal(requests, 0);
});

for (const admin of [true, false]) test(`Studio settings ${admin ? 'load only the selected admin tool' : 'deny a student without any admin request'}`, async (t) => {
  const h = setup(t, 'members/module/studio/admin/index.html', '?tab=users');
  await tick();
  const user = { id: admin ? 'admin' : 'student', email: 'person@example.com', user_metadata: {}, app_metadata: { roles: [admin ? 'admin' : 'active'] }, jwt: async () => 'fixture-jwt' };
  h.w.ChemAuth.getUser = () => user;
  const requests = [];
  h.w.fetch = async (url) => { requests.push(String(url)); return new Response(JSON.stringify({ users: Array.from({ length: 65 }, (_, i) => ({ id: `student-${i}`, email: `student${i}@example.com`, app_metadata: { roles: ['active'] }, user_metadata: {} })), total: 65, pagination: { hasMore: false } })); };
  h.evalFile('members/dashboard.js'); await tick();
  assert.equal(h.d.body.dataset.adminReady === 'true', admin);
  assert.equal(h.d.getElementById('admin-dialog').hasAttribute('open'), admin);
  if (admin) {
    assert.equal(requests.length, 1); assert.match(requests[0], /functions\/admin-users/);
    assert.equal(h.d.querySelectorAll('.admin-user-card').length, 24);
    h.d.querySelector('.react-list-more button').click(); await tick();
    assert.equal(h.d.querySelectorAll('.admin-user-card').length, 48);
    await input(h.w, h.d.getElementById('admin-user-search'), 'student64');
    assert.equal(h.d.querySelectorAll('.admin-user-card').length, 1);
    assert.match(h.d.querySelector('.admin-user-card').textContent, /student64@example/);
    assert.equal(requests.length, 1, 'Paging and search are local');
  }
  else { assert.deepEqual(requests, []); assert.match(h.d.getElementById('studio-admin-access').textContent, /Brak dostępu/); }
  assert.ok(requests.every((url) => !/admin-dashboard|progress|dashboard\.md/.test(url)));
});

test('actual Studio exam report pages on demand without accumulating rows or sending mutations', async (t) => {
  const model = require('../public/members/module/studio/exam-model');
  const exam = model.createExam({ examId: 'report-test' });
  const h = await studio(t, { readExam: async () => ({ content: JSON.stringify(exam), sha: 'saved-exam' }) });
  await input(h.w, h.d.getElementById('studio-tool-select'), 'exam');
  await h.w.ChemExamBuilder.openAsset({ filename: exam.examId, repositoryId: 'glowne' });
  const reads = [];
  h.w.fetch = async (url, options) => {
    assert.notEqual(options.method, 'POST');
    const cursor = new URL(url).searchParams.get('cursor'); reads.push(cursor);
    return new Response(JSON.stringify({ cursor: cursor ? null : 'offset:25', metricsScope: 'page', metrics: { participants: 1, attempts: 1 },
      attempts: [{ attemptId: cursor ? 'older-exam' : 'newer-exam', userId: 'student', number: 1, status: 'submitted', gradingStatus: 'pending_review' }] }));
  };
  h.d.querySelector('[data-exam-tab="reports"]').click(); await tick();
  assert.equal(reads.length, 1, 'Opening the report loads its first page once');
  assert.match(h.d.querySelector('.exam-report-view').textContent, /tej części/);
  h.d.querySelector('[data-exam-action="next-report"]').click(); await tick();
  assert.equal(h.d.querySelectorAll('[data-exam-action="open-attempt-report"]').length, 1);
  assert.equal(h.d.querySelector('[data-exam-action="open-attempt-report"]').dataset.attemptId, 'older-exam');
  h.d.querySelector('[data-exam-action="first-report"]').click(); await tick();
  assert.deepEqual(reads, [null, 'offset:25', null]);
});
