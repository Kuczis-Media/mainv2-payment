(function exposeQuizModel(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChemQuizStudioModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createQuizModel() {
  'use strict';

  const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
  const SAFE_STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
  const SAFE_MEDIA_REF = /^(?:photos\/|assets\/shared\/)[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\.(?:png|jpe?g|webp|gif|svg)$/i;
  const QUESTION_TYPES = Object.freeze(['single', 'multiple', 'true_false', 'text', 'open']);
  let sequence = 0;

  function id(prefix) {
    sequence += 1;
    const random = globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 10) || sequence.toString(36);
    return `${prefix}-${random}`;
  }

  function line(value, limit = 500) {
    return String(value ?? '')
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, limit);
  }

  function text(value, limit = 5000) {
    return String(value ?? '').replace(/\0/g, '').trim().slice(0, limit);
  }

  function clamp(value, fallback, min, max) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
  }

  function stable(value, prefix) {
    const candidate = line(value, 128);
    return SAFE_STABLE_ID.test(candidate) ? candidate : id(prefix);
  }

  function image(seed) {
    const source = seed && typeof seed === 'object' && !Array.isArray(seed) ? seed : {};
    const ref = line(source.ref, 240);
    return {
      ref: SAFE_MEDIA_REF.test(ref) ? ref : '',
      alt: line(source.alt, 300)
    };
  }

  function createOption(seed = {}, index = 0) {
    return {
      optionId: stable(seed.optionId, 'option'),
      text: line(seed.text, 500) || `Odpowiedź ${index + 1}`,
      correct: seed.correct === true
    };
  }

  function defaultOptions() {
    return [
      createOption({ text: 'Poprawna odpowiedź', correct: true }, 0),
      createOption({ text: 'Odpowiedź B' }, 1),
      createOption({ text: 'Odpowiedź C' }, 2),
      createOption({ text: 'Odpowiedź D' }, 3)
    ];
  }

  function createQuestion(seed = {}) {
    const type = QUESTION_TYPES.includes(seed.type) ? seed.type : 'single';
    let options = (Array.isArray(seed.options) ? seed.options : defaultOptions())
      .slice(0, 12)
      .map(createOption);
    if (type === 'true_false') {
      const correctIndex = options.findIndex((option) => option.correct);
      options = [
        createOption({ optionId: options[0]?.optionId, text: 'Prawda', correct: correctIndex !== 1 }, 0),
        createOption({ optionId: options[1]?.optionId, text: 'Fałsz', correct: correctIndex === 1 }, 1)
      ];
    } else if (type === 'single') {
      if (options.length < 2) options = defaultOptions();
      const firstCorrect = options.findIndex((option) => option.correct);
      options.forEach((option, index) => { option.correct = index === (firstCorrect < 0 ? 0 : firstCorrect); });
    } else if (type === 'multiple') {
      if (options.length < 2) options = defaultOptions();
      if (!options.some((option) => option.correct)) options[0].correct = true;
    } else {
      options = [];
    }
    const acceptedAnswers = (Array.isArray(seed.acceptedAnswers) ? seed.acceptedAnswers : [])
      .map((answer) => line(answer, 500))
      .filter(Boolean)
      .slice(0, 20);
    const gradingMode = ['ai', 'manual', 'ungraded'].includes(seed.gradingMode) ? seed.gradingMode : 'ai';
    return {
      questionId: stable(seed.questionId, 'question'),
      type,
      prompt: text(seed.prompt, 3000) || 'Wpisz treść pytania.',
      points: Math.round(clamp(seed.points, 1, 0, 10_000) * 100) / 100,
      required: seed.required !== false,
      image: image(seed.image),
      options,
      acceptedAnswers: type === 'text' ? (acceptedAnswers.length ? acceptedAnswers : ['Poprawna odpowiedź']) : [],
      ...(type === 'open' ? {
        gradingMode,
        answerKey: text(seed.answerKey || seed.modelAnswer, 10_000),
        aiInstruction: text(seed.aiInstruction || seed.rubric, 2_000),
        multiline: seed.multiline !== false
      } : {}),
      explanation: text(seed.explanation, 3000)
    };
  }

  function createQuiz(seed = {}) {
    const metadata = seed.metadata && typeof seed.metadata === 'object' ? seed.metadata : {};
    const settings = seed.settings && typeof seed.settings === 'object' ? seed.settings : {};
    const questions = Array.isArray(seed.questions) && seed.questions.length
      ? seed.questions.slice(0, 200).map(createQuestion)
      : [createQuestion()];
    return {
      version: 1,
      quizId: line(seed.quizId || 'nowy-quiz', 80).toLowerCase(),
      metadata: {
        title: line(metadata.title, 180) || 'Nowy quiz',
        description: text(metadata.description, 1200),
        status: metadata.status === 'published' ? 'published' : 'draft',
        tags: (Array.isArray(metadata.tags) ? metadata.tags : [])
          .map((tag) => line(tag, 60))
          .filter(Boolean)
          .slice(0, 20),
        cover: image(metadata.cover)
      },
      settings: {
        passingScore: Math.round(clamp(settings.passingScore, 60, 0, 100)),
        shuffleQuestions: settings.shuffleQuestions === true,
        showFeedback: settings.showFeedback !== false,
        allowRetry: settings.allowRetry !== false
      },
      questions
    };
  }

  function validate(value) {
    const quiz = createQuiz(value);
    const errors = [];
    if (!SAFE_ID.test(quiz.quizId)) {
      errors.push({ code: 'QUIZ_ID_INVALID', message: 'ID quizu może zawierać tylko małe litery, cyfry i myślniki.' });
    }
    if (!quiz.metadata.title) errors.push({ code: 'QUIZ_TITLE_REQUIRED', message: 'Wpisz tytuł quizu.' });
    if (!quiz.questions.length) errors.push({ code: 'QUIZ_QUESTIONS_REQUIRED', message: 'Dodaj co najmniej jedno pytanie.' });
    const ids = new Set();
    quiz.questions.forEach((question, index) => {
      const label = `Pytanie ${index + 1}`;
      if (ids.has(question.questionId)) errors.push({ code: 'QUIZ_QUESTION_ID_DUPLICATE', message: `${label} ma powtórzony identyfikator.` });
      ids.add(question.questionId);
      if (!question.prompt || question.prompt === 'Wpisz treść pytania.') {
        errors.push({ code: 'QUIZ_QUESTION_PROMPT_REQUIRED', message: `${label}: wpisz właściwą treść pytania.` });
      }
      question.options.forEach((option) => {
        if (ids.has(option.optionId)) errors.push({ code: 'QUIZ_OPTION_ID_DUPLICATE', message: `${label} ma powtórzony identyfikator odpowiedzi.` });
        ids.add(option.optionId);
      });
      if (question.type === 'single' && question.options.filter((option) => option.correct).length !== 1) {
        errors.push({ code: 'QUIZ_SINGLE_ANSWER_INVALID', message: `${label}: wybierz dokładnie jedną poprawną odpowiedź.` });
      }
      if (question.type === 'multiple' && !question.options.some((option) => option.correct)) {
        errors.push({ code: 'QUIZ_MULTIPLE_ANSWER_INVALID', message: `${label}: zaznacz co najmniej jedną poprawną odpowiedź.` });
      }
      if (question.type === 'text' && !question.acceptedAnswers.length) {
        errors.push({ code: 'QUIZ_TEXT_ANSWER_REQUIRED', message: `${label}: podaj co najmniej jedną akceptowaną odpowiedź.` });
      }
      if (question.type === 'open' && question.gradingMode === 'ai' && !question.answerKey) {
        errors.push({ code: 'QUIZ_OPEN_ANSWER_KEY_REQUIRED', message: `${label}: dodaj klucz odpowiedzi dla oceny AI.` });
      }
    });
    return { valid: errors.length === 0, errors, quiz };
  }

  function serialize(value) {
    const result = validate(value);
    if (!result.valid) throw new Error(result.errors[0].message);
    return `${JSON.stringify(result.quiz, null, 2)}\n`;
  }

  function parse(source, quizId = '') {
    const parsed = typeof source === 'string' ? JSON.parse(source) : source;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.version !== 1) {
      throw new Error('Nieobsługiwany format quizu.');
    }
    const quiz = createQuiz(parsed);
    if (quizId && quiz.quizId !== quizId) throw new Error('ID quizu nie pasuje do folderu.');
    return quiz;
  }

  function duplicateQuestion(question) {
    const copy = createQuestion(JSON.parse(JSON.stringify(question)));
    copy.questionId = id('question');
    copy.options.forEach((option) => { option.optionId = id('option'); });
    copy.prompt = `${question.prompt} — kopia`;
    return copy;
  }

  function normalizeAnswer(value) {
    return line(value, 500).toLocaleLowerCase('pl');
  }

  function score(value, rawAnswers = {}) {
    const quiz = createQuiz(value);
    let earned = 0;
    const maximum = quiz.questions.reduce((sum, question) => (
      sum + (question.type === 'open' && question.gradingMode === 'ungraded' ? 0 : question.points)
    ), 0);
    const results = quiz.questions.map((question) => {
      const raw = rawAnswers[question.questionId];
      if (question.type === 'open') {
        if (question.gradingMode === 'ungraded') {
          return { questionId: question.questionId, correct: null, points: 0, maximum: 0, reviewStatus: 'not_scored' };
        }
        return { questionId: question.questionId, correct: null, points: null, maximum: question.points, reviewStatus: 'pending' };
      }
      let correct = false;
      if (question.type === 'text') {
        const answer = normalizeAnswer(raw);
        correct = Boolean(answer) && question.acceptedAnswers.some((candidate) => normalizeAnswer(candidate) === answer);
      } else {
        const selected = new Set(Array.isArray(raw) ? raw : raw ? [raw] : []);
        const expected = new Set(question.options.filter((option) => option.correct).map((option) => option.optionId));
        correct = selected.size === expected.size && [...selected].every((optionId) => expected.has(optionId));
      }
      if (correct) earned += question.points;
      return { questionId: question.questionId, correct, points: correct ? question.points : 0, maximum: question.points, reviewStatus: 'graded' };
    });
    const pending = results.some((result) => result.reviewStatus === 'pending');
    const percent = pending ? null : maximum ? Math.round((earned / maximum) * 100) : null;
    return {
      earned,
      maximum,
      percent,
      passed: percent == null ? null : percent >= quiz.settings.passingScore,
      gradingStatus: pending ? 'pending_review' : maximum > 0 ? 'graded' : 'not_scored',
      results
    };
  }

  return Object.freeze({
    QUESTION_TYPES,
    SAFE_ID,
    SAFE_MEDIA_REF,
    createOption,
    createQuestion,
    createQuiz,
    duplicateQuestion,
    parse,
    score,
    serialize,
    validate
  });
});
