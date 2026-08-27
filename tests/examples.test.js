const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const quizCommon = require(path.join(root, 'netlify', 'quiz-common.js'));
const examCommon = require(path.join(root, 'netlify', 'exam-common.js'));
const presentationCommon = require(path.join(root, 'netlify', 'presentation-common.js'));
const contentRepository = require(path.join(root, 'netlify', 'content-repository.js'));

const readJson = (...parts) => JSON.parse(fs.readFileSync(path.join(root, ...parts), 'utf8'));

test('organic chemistry examples use matching stable IDs and every question type', () => {
  const quiz = readJson('Examples', 'quizzes', 'quiz-chemia-organiczna', 'quiz.json');
  const exam = readJson('Examples', 'exams', 'egzamin-chemia-organiczna', 'exam.json');
  const presentation = readJson('Examples', 'presentations', 'prezentacja-aldehydy', 'presentation.json');
  const lesson = fs.readFileSync(path.join(root, 'Examples', 'lessons', 'lekcja-chemia-organiczna.md'), 'utf8');
  const prompt = fs.readFileSync(path.join(root, 'Examples', 'prompts', 'example-prompt.txt'), 'utf8');

  assert.equal(quizCommon.validateDefinition(quiz, 'quiz-chemia-organiczna').valid, true);
  assert.equal(examCommon.validateDefinition(exam, 'egzamin-chemia-organiczna').valid, true);
  assert.equal(presentationCommon.validateDefinition(presentation, 'prezentacja-aldehydy').valid, true);
  assert.doesNotThrow(() => contentRepository._test.validateAssetContent('prompt', 'example-prompt.txt', prompt));
  assert.deepEqual(new Set(quiz.questions.map((question) => question.type)), new Set(['single', 'multiple', 'true_false', 'text']));
  assert.deepEqual(new Set(exam.questions.map((question) => question.type)), new Set([
    'single_choice', 'multiple_choice', 'true_false', 'short_text', 'number', 'matching', 'ordering', 'fill_blanks'
  ]));
  assert.match(lesson, /presentation: prezentacja-aldehydy/);
  assert.match(lesson, /quiz: quiz-chemia-organiczna/);
  assert.match(lesson, /exam: egzamin-chemia-organiczna/);
  assert.match(lesson, /repository: repo-testowe/);
  assert.doesNotMatch(lesson, /(?:quiz|exam):default:|repository: default/);
  assert.equal(presentation.slides[1].elements.find((element) => element.type === 'image').repositoryId, 'repo-testowe');
});

test('examples and default dashboard contain the supplied real material IDs', () => {
  const lesson = fs.readFileSync(path.join(root, 'Examples', 'lessons', 'lekcja-chemia-organiczna.md'), 'utf8');
  const dashboard = fs.readFileSync(path.join(root, 'public', 'members', 'dashboard.md'), 'utf8');
  const combined = `${lesson}\n${dashboard}`;

  for (const id of [
    '1rxPm5CJl2LDzrzq89fogz-_PWwO_BbqF',
    '1qKkDarVM8qn1GHkNalt9f8n7IXNUawZF',
    '1FAIpQLSeKEXX7ooRB7ZaPJ8UwnqNlPsucgjwnQFzmSlZ3OvrdFlURsA',
    'sU6epNBjvzo',
    'PG6fB57aAoA',
    'kOoRildWO0s'
  ]) assert.match(combined, new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  assert.doesNotMatch(combined, /1AbCdEf|1ZyXwVu|1H5__hUC|1YmTr2X0|https:\/\/example\.com/);
  for (const href of [
    '/members/module/lesson/?repo=repo-testowe&file=lekcja-chemia-organiczna.md',
    '/members/module/quiz/?repo=repo-testowe&quiz=quiz-chemia-organiczna',
    '/members/module/exam/?repo=repo-testowe&exam=egzamin-chemia-organiczna',
    '/members/module/presentation/?repo=repo-testowe&presentation=prezentacja-aldehydy',
    '/members/module/chat/?repo=repo-testowe&plik=example-prompt.txt&punkt=1'
  ]) assert.ok(dashboard.includes(href), `missing curated dashboard link: ${href}`);
});
