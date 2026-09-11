import React, { useState, useEffect } from 'react';
import { register, LazyImage, LimitedList } from '../shared/runtime.jsx';

function QuizQuestion({ question: q, index, answers, results, locked, onAnswer, getUrl }) {
  const incoming = answers[q.questionId] ?? (['open', 'text'].includes(q.type) ? '' : []);
  const [value, setValue] = useState(incoming);
  const signature = JSON.stringify(incoming);
  useEffect(() => setValue(incoming), [signature]);
  const result = results[q.questionId];
  const pending = result?.reviewStatus === 'pending', ungraded = result?.reviewStatus === 'not_scored';
  const tone = result && !pending && !ungraded ? result.correct ? 'is-correct' : 'is-wrong' : '';
  function change(next) { if (locked) return; setValue(next); onAnswer(q.questionId, next); }
  const text = ['open', 'text'].includes(q.type);
  const Tag = q.type === 'open' && q.multiline !== false ? 'textarea' : 'input';
  return <fieldset className={`quiz-player-question ${tone}`} data-question-id={q.questionId}>
    <div className="quiz-player-question-heading"><span>Pytanie {index + 1}</span><span>{q.type === 'open' && q.gradingMode === 'ungraded' ? 'bez punktów' : `${q.points} pkt`}</span></div>
    <legend>{q.prompt}</legend>
    {q.image?.ref && <LazyImage image={q.image} getUrl={getUrl} />}
    {text ? <Tag className={`quiz-player-text${q.type === 'open' ? ' quiz-player-open-answer' : ''}`} type={Tag === 'input' ? 'text' : undefined}
      rows={Tag === 'textarea' ? 7 : undefined} value={value} maxLength={q.type === 'open' ? 8000 : undefined} disabled={locked}
      autoComplete="off" data-answer-text="1" aria-label={`Odpowiedź: ${q.prompt}`} placeholder="Wpisz odpowiedź…" onChange={(e) => change(e.target.value)} />
      : q.options.map((option) => <label className="quiz-player-option" key={option.optionId}>
        <input type={q.type === 'multiple' ? 'checkbox' : 'radio'} name={`quiz-answer-${q.questionId}`} value={option.optionId} disabled={locked}
          checked={Array.isArray(value) && value.includes(option.optionId)} onChange={(e) => change(q.type === 'multiple' ? e.target.checked ? [...value, option.optionId] : value.filter((id) => id !== option.optionId) : [option.optionId])} />
        <span>{option.text}</span></label>)}
    <p className={`quiz-player-feedback ${tone}`} hidden={!result}>{result && (pending ? 'Odpowiedź zapisana — oczekuje na ocenę.' : ungraded ? 'Odpowiedź zapisana — to pytanie nie wpływa na wynik.'
      : result.message || `${result.correct ? 'Poprawnie' : 'Ocena częściowa lub niepoprawna'} · ${result.points}/${result.maximum} pkt${result.feedback ? ` — ${result.feedback}` : result.explanation ? ` — ${result.explanation}` : ''}`)}</p>
  </fieldset>;
}
register('quiz-questions', ({ questions, revealId, ...props }) => {
  const minimum = revealId ? Math.ceil((questions.findIndex((q) => q.questionId === revealId) + 1) / 24) * 24 : 24;
  return <LimitedList key={revealId || 'questions'} items={questions} pageSize={Math.max(24, minimum)} label="pytań" renderItem={(q, index) => <QuizQuestion key={q.questionId} question={q} index={index} {...props} />} />;
});
register('quiz-result', ({ score, title, message, onRefresh }) => <><strong>{score}</strong><div><h2>{title}</h2><p>{message}</p>
  {onRefresh && <button type="button" className="quiz-player-button is-secondary" onClick={(event) => onRefresh(event.currentTarget)}>Odśwież wynik</button>}
</div></>);
