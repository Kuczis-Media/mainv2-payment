const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const quizModel = require('../public/members/module/studio/quiz-model.js');
const quizCommon = require('../netlify/quiz-common.js');
const contentRepository = require('../netlify/content-repository.js');

function sampleQuiz() {
  return quizModel.createQuiz({
    quizId: 'stechiometria-1',
    metadata: {
      title: 'Stechiometria',
      description: 'Krótki sprawdzian.',
      status: 'published',
      tags: ['mol', 'równania'],
      cover: { ref: 'assets/shared/okladka.webp', alt: 'Kolby laboratoryjne' }
    },
    settings: { passingScore: 75, shuffleQuestions: true, showFeedback: true, allowRetry: true },
    questions: [
      {
        questionId: 'q-single',
        type: 'single',
        prompt: 'Ile moli zawiera próbka?',
        points: 2,
        options: [
          { optionId: 'q1-a', text: '1 mol', correct: true },
          { optionId: 'q1-b', text: '2 mol', correct: false }
        ],
        explanation: 'Korzystamy z definicji mola.'
      },
      {
        questionId: 'q-multiple',
        type: 'multiple',
        prompt: 'Wybierz pierwiastki.',
        points: 2,
        options: [
          { optionId: 'q2-a', text: 'Tlen', correct: true },
          { optionId: 'q2-b', text: 'Woda', correct: false },
          { optionId: 'q2-c', text: 'Wodór', correct: true }
        ]
      },
      { questionId: 'q-bool', type: 'true_false', prompt: 'H2O to woda.', points: 1 },
      { questionId: 'q-text', type: 'text', prompt: 'Podaj symbol tlenu.', points: 1, acceptedAnswers: ['O', 'o'] }
    ]
  });
}

test('Quiz Builder round-trips all question types with stable IDs and managed media', () => {
  const quiz = sampleQuiz();
  const validation = quizModel.validate(quiz);
  assert.equal(validation.valid, true);

  const serialized = quizModel.serialize(quiz);
  const parsed = quizModel.parse(serialized, 'stechiometria-1');
  assert.deepEqual(parsed, quiz);
  assert.deepEqual(parsed.questions.map((question) => question.type), ['single', 'multiple', 'true_false', 'text']);
  assert.equal(parsed.metadata.cover.ref, 'assets/shared/okladka.webp');
  assert.equal(quizCommon.validateDefinition(JSON.parse(serialized), 'stechiometria-1').valid, true);
  assert.equal(contentRepository._test.validateAssetContent('quiz', 'stechiometria-1', serialized), serialized);
});

test('Quiz preview scores single, multiple, true/false and normalized text answers', () => {
  const quiz = sampleQuiz();
  const answers = {
    'q-single': ['q1-a'],
    'q-multiple': ['q2-a', 'q2-c'],
    'q-bool': [quiz.questions[2].options.find((option) => option.correct).optionId],
    'q-text': ' o '
  };
  const result = quizModel.score(quiz, answers);
  assert.deepEqual(
    { earned: result.earned, maximum: result.maximum, percent: result.percent, passed: result.passed },
    { earned: 6, maximum: 6, percent: 100, passed: true }
  );

  answers['q-multiple'] = ['q2-a'];
  const partial = quizModel.score(quiz, answers);
  assert.equal(partial.earned, 4);
  assert.equal(partial.passed, false);
});

test('quiz definitions reject folder mismatches, duplicate IDs and unsafe media references', () => {
  const quiz = sampleQuiz();
  assert.throws(() => quizModel.parse(quizModel.serialize(quiz), 'inny-folder'), /nie pasuje do folderu/i);
  assert.throws(() => quizModel.parse(JSON.stringify({ version: 2, quizId: quiz.quizId })), /nieobsługiwany format/i);

  const unsafe = JSON.parse(quizModel.serialize(quiz));
  unsafe.questions[1].questionId = unsafe.questions[0].questionId;
  unsafe.questions[0].image = { ref: 'https://evil.example/x.svg', alt: '<img src=x onerror=alert(1)>' };
  assert.equal(quizCommon.validateDefinition(unsafe, 'stechiometria-1').valid, false);
  assert.throws(
    () => contentRepository._test.validateAssetContent('quiz', 'stechiometria-1', JSON.stringify(unsafe)),
    (error) => error.code === 'QUIZ_FILE_INVALID' && error.status === 422
  );
});

test('integrated Studio exposes the active Quiz Builder, shared media and AI manager link safely', () => {
  const html = fs.readFileSync(path.join(root, 'public/members/module/studio/index.html'), 'utf8');
  const studio = fs.readFileSync(path.join(root, 'public/members/module/studio/script.js'), 'utf8');
  const builder = fs.readFileSync(path.join(root, 'public/members/module/studio/quiz-builder.js'), 'utf8');
  const dashboard = fs.readFileSync(path.join(root, 'public/members/dashboard.js'), 'utf8');
  const dashboardModel = fs.readFileSync(path.join(root, 'public/members/module/studio/dashboard-model.js'), 'utf8');
  const player = fs.readFileSync(path.join(root, 'public/members/module/quiz/script.js'), 'utf8');
  const endpoint = fs.readFileSync(path.join(root, 'netlify/functions/quiz.js'), 'utf8');

  assert.match(html, /data-open-mode=["']quiz["']/);
  assert.match(html, /id=["']quiz-workspace["']/);
  assert.match(html, /data-studio-tool=["']media["']/);
  assert.match(html, /href=["']\/members\/\?admin=ai["']/);
  assert.match(studio, /ChemQuizBuilder\?\.openAsset/);
  assert.match(builder, /library\.save\(['"]quiz['"]/);
  assert.match(builder, /ChemMediaManager\.open/);
  assert.doesNotMatch(builder, /\.innerHTML\s*=/);
  assert.match(dashboard, /searchParams\.get\(['"]admin['"]\)/);
  assert.match(dashboardModel, /card\.module === ['"]quiz['"]/);
  assert.match(dashboardModel, /add\(['"]quiz['"], card\.quizId\)/);
  assert.match(endpoint, /requireCourseAccess/);
  assert.match(endpoint, /definition\.metadata\.status !== ['"]published['"]/);
  assert.match(endpoint, /preview && !auth\.roles\.includes\(['"]admin['"]\)/);
  assert.match(player, /action:\s*['"]quiz['"]/);
  assert.match(player, /opened:\s*true/);
  assert.match(player, /SEQUENCE_LOCKED/);
  assert.match(player, /details:\s*\{[\s\S]*passed:\s*result\.passed/);
  assert.doesNotMatch(player, /\.innerHTML\s*=/);
});
