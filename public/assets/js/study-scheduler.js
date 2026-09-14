(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChemStudyScheduler = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAY = 86400000, MINUTE = 60000;
  const MODES = Object.freeze({ all: 'Wszystkie karty', due: 'Do powtórzenia dzisiaj', new: 'Nowe', failed: 'Błędne', hard: 'Trudne' });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
  // NextMed's small interval ladder: no external scheduling implementation.
  function review(previous, grade, now = Date.now(), answer = null, correct = null) {
    if (![1, 2, 3, 4].includes(grade) || !Number.isFinite(now)) throw new Error('INVALID_REVIEW');
    const p = previous || {}, interval = clamp(p.interval, 0, 365), ease = clamp(p.ease || 1, .65, 1.6);
    const nextEase = Math.round(clamp(ease + ({ 1: -.15, 2: -.05, 3: .03, 4: .08 })[grade], .65, 1.6) * 100) / 100;
    const nextInterval = grade === 1 ? MINUTE / DAY
      : grade === 2 ? Math.max(1 / 6, Math.min(2, interval * .6))
        : grade === 3 ? Math.max(1, interval * (1.5 + nextEase * .35))
          : Math.max(3, interval * (2 + nextEase * .6));
    const ms = Math.min(365 * DAY, Math.round(nextInterval * DAY));
    const wasCorrect = typeof correct === 'boolean' ? correct : grade !== 1;
    return { repetitions: Math.min(1e6, (p.repetitions || 0) + 1), interval: ms / DAY, ease: nextEase,
      dueAt: new Date(now + ms).toISOString(), lastReviewedAt: new Date(now).toISOString(), lastGrade: grade,
      attempts: Math.min(1e6, (p.attempts || 0) + 1), correct: Math.min(1e6, (p.correct || 0) + Number(wasCorrect)),
      incorrect: Math.min(1e6, (p.incorrect || 0) + Number(!wasCorrect)), lastCorrect: wasCorrect,
      lastAnswer: Array.isArray(answer) ? answer.slice(0, 6).map((a) => String(a).slice(0, 128)) : answer == null ? null : String(answer).slice(0, 500) };
  }
  function cards(questions) {
    return questions.flatMap((q) => {
      if (q.type !== 'image_occlusion') return [{ ...q, studyKey: q.questionId }];
      if (q.occlusion.mode === 'all') return [{ ...q, studyKey: `${q.questionId}/all`, activeMaskIds: q.occlusion.masks.map((m) => m.maskId) }];
      return q.occlusion.masks.map((m) => ({ ...q, studyKey: `${q.questionId}/${m.maskId}`, activeMaskIds: [m.maskId] }));
    });
  }
  function matches(state, mode, now = Date.now()) {
    if (mode === 'new') return !state?.attempts;
    if (mode === 'failed') return state?.lastGrade === 1 || state?.lastCorrect === false;
    if (mode === 'hard') return state?.lastGrade === 2;
    if (mode === 'due') return Boolean(state?.dueAt && Date.parse(state.dueAt) <= now);
    return true;
  }
  function select(all, records, mode, now = Date.now(), random = Math.random) {
    const selected = all.filter((q) => matches(records[q.studyKey], mode, now)), groups = new Map();
    const output = selected.filter((q) => {
      if (q.type !== 'image_occlusion' || q.occlusion.mode !== 'random') return true;
      if (!groups.has(q.questionId)) groups.set(q.questionId, []);
      groups.get(q.questionId).push(q); return false;
    });
    groups.forEach((group) => output.push(group[Math.min(group.length - 1, Math.floor(clamp(random(), 0, 1) * group.length))]));
    return output;
  }
  function stats(all, records, now = Date.now()) {
    const result = { total: all.length, new: 0, due: 0, failed: 0, hard: 0, attempts: 0, correct: 0, incorrect: 0 };
    all.forEach((q) => { const s = records[q.studyKey]; for (const mode of ['new', 'due', 'failed', 'hard']) if (matches(s, mode, now)) result[mode]++;
      for (const key of ['attempts', 'correct', 'incorrect']) result[key] += Number(s?.[key]) || 0;
    }); return result;
  }
  return Object.freeze({ DAY, MINUTE, MODES, review, cards, select, matches, stats });
});
