'use strict';

const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const SAFE_STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const SAFE_MEDIA_REF = /^(?:photos\/|assets\/shared\/)[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\.(?:png|jpe?g|webp|gif|svg)$/i;
const QUESTION_TYPES = new Set(['single', 'multiple', 'true_false', 'text']);

function object(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function string(value, max, required = false) {
  return typeof value === 'string'
    && value.length <= max
    && (!required || Boolean(value.trim()))
    && !/[\u0000]/.test(value);
}

function validImage(value) {
  if (!object(value)) return false;
  if (!string(value.ref, 240) || !string(value.alt, 300)) return false;
  return !value.ref || SAFE_MEDIA_REF.test(value.ref);
}

function validateDefinition(value, expectedQuizId = '') {
  const invalid = () => ({ valid: false, errors: [{ code: 'QUIZ_FILE_INVALID' }] });
  if (!object(value) || value.version !== 1 || !SAFE_ID.test(value.quizId || '')) return invalid();
  if (expectedQuizId && value.quizId !== expectedQuizId) return invalid();
  if (!object(value.metadata) || !string(value.metadata.title, 180, true) || !string(value.metadata.description, 1200)) return invalid();
  if (!['draft', 'published'].includes(value.metadata.status) || !Array.isArray(value.metadata.tags) || value.metadata.tags.length > 20) return invalid();
  if (value.metadata.tags.some((tag) => !string(tag, 60, true)) || !validImage(value.metadata.cover)) return invalid();
  if (!object(value.settings)) return invalid();
  if (!Number.isInteger(value.settings.passingScore) || value.settings.passingScore < 0 || value.settings.passingScore > 100) return invalid();
  if (typeof value.settings.shuffleQuestions !== 'boolean' || typeof value.settings.showFeedback !== 'boolean' || typeof value.settings.allowRetry !== 'boolean') return invalid();
  if (!Array.isArray(value.questions) || !value.questions.length || value.questions.length > 200) return invalid();

  const ids = new Set();
  for (const question of value.questions) {
    if (!object(question) || !SAFE_STABLE_ID.test(question.questionId || '') || ids.has(question.questionId)) return invalid();
    ids.add(question.questionId);
    if (!QUESTION_TYPES.has(question.type) || !string(question.prompt, 3000, true)) return invalid();
    if (!Number.isInteger(question.points) || question.points < 1 || question.points > 100 || typeof question.required !== 'boolean') return invalid();
    if (!validImage(question.image) || !string(question.explanation, 3000)) return invalid();
    if (!Array.isArray(question.options) || question.options.length > 12 || !Array.isArray(question.acceptedAnswers) || question.acceptedAnswers.length > 20) return invalid();
    if (question.acceptedAnswers.some((answer) => !string(answer, 500, true))) return invalid();

    for (const option of question.options) {
      if (!object(option) || !SAFE_STABLE_ID.test(option.optionId || '') || ids.has(option.optionId)) return invalid();
      ids.add(option.optionId);
      if (!string(option.text, 500, true) || typeof option.correct !== 'boolean') return invalid();
    }
    const correctCount = question.options.filter((option) => option.correct).length;
    if (question.type === 'single' && (question.options.length < 2 || correctCount !== 1)) return invalid();
    if (question.type === 'multiple' && (question.options.length < 2 || correctCount < 1)) return invalid();
    if (question.type === 'true_false' && (question.options.length !== 2 || correctCount !== 1)) return invalid();
    if (question.type === 'text' && (question.options.length !== 0 || question.acceptedAnswers.length < 1)) return invalid();
    if (question.type !== 'text' && question.acceptedAnswers.length !== 0) return invalid();
  }
  return { valid: true, errors: [] };
}

module.exports = { validateDefinition };
