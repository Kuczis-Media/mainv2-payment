'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const model = require('../public/members/module/studio/quiz-model');
const common = require('../netlify/quiz-common');

test('parseCsv handles basic comma-separated flashcards without quotes', () => {
  const csv = 'Pytanie 1,Odpowiedź 1\nPytanie 2,Odpowiedź 2';
  const result = model.parseCsv(csv);
  assert.equal(result.count, 2);
  assert.equal(result.cards[0].front, 'Pytanie 1');
  assert.equal(result.cards[0].back, 'Odpowiedź 1');
  assert.equal(result.cards[1].front, 'Pytanie 2');
  assert.equal(result.cards[1].back, 'Odpowiedź 2');
});

test('parseCsv auto-detects semicolon and tab delimiters', () => {
  const semicolonCsv = 'Termin A;Definicja A\nTermin B;Definicja B';
  const semiResult = model.parseCsv(semicolonCsv);
  assert.equal(semiResult.delimiter, ';');
  assert.equal(semiResult.count, 2);
  assert.equal(semiResult.cards[0].front, 'Termin A');
  assert.equal(semiResult.cards[0].back, 'Definicja A');

  const tabCsv = 'Pojęcie 1\tZnaczenie 1\nPojęcie 2\tZnaczenie 2';
  const tabResult = model.parseCsv(tabCsv);
  assert.equal(tabResult.delimiter, '\t');
  assert.equal(tabResult.count, 2);
  assert.equal(tabResult.cards[0].front, 'Pojęcie 1');
  assert.equal(tabResult.cards[0].back, 'Znaczenie 1');
});

test('parseCsv supports explicit delimiter override in options', () => {
  const mixedCsv = 'Pytanie;część 1, część 2';
  const result = model.parseCsv(mixedCsv, { delimiter: ';' });
  assert.equal(result.count, 1);
  assert.equal(result.cards[0].front, 'Pytanie');
  assert.equal(result.cards[0].back, 'część 1, część 2');
});

test('parseCsv respects RFC 4180 quotes with embedded delimiters, escaped quotes and newlines', () => {
  const csv = [
    '"Woda, tlenek wodoru","Główny rozpuszczalnik, wzór H2O"',
    '"Cytat: ""Być albo nie być""","William Shakespeare"',
    '"Pytanie wielolinijkowe:\nLinia 1\nLinia 2","Odpowiedź"'
  ].join('\n');

  const result = model.parseCsv(csv);
  assert.equal(result.count, 3);
  assert.equal(result.cards[0].front, 'Woda, tlenek wodoru');
  assert.equal(result.cards[0].back, 'Główny rozpuszczalnik, wzór H2O');
  assert.equal(result.cards[1].front, 'Cytat: "Być albo nie być"');
  assert.equal(result.cards[1].back, 'William Shakespeare');
  assert.equal(result.cards[2].front, 'Pytanie wielolinijkowe:\nLinia 1\nLinia 2');
  assert.equal(result.cards[2].back, 'Odpowiedź');
});

test('parseCsv detects and skips common header rows, but keeps data rows', () => {
  const withHeader = 'Front,Back\nCo to jest DNA?,Kwas deoksyrybonukleinowy';
  const result1 = model.parseCsv(withHeader);
  assert.equal(result1.count, 1);
  assert.equal(result1.cards[0].front, 'Co to jest DNA?');

  const polishHeader = 'Pytanie;Odpowiedź;Wyjaśnienie\nCo to jest RNA?;Kwas rybonukleinowy;Jednoniciowy';
  const result2 = model.parseCsv(polishHeader);
  assert.equal(result2.count, 1);
  assert.equal(result2.cards[0].front, 'Co to jest RNA?');
  assert.equal(result2.cards[0].back, 'Kwas rybonukleinowy');
  assert.equal(result2.cards[0].explanation, 'Jednoniciowy');

  const noHeader = 'Mitoza,Podział komórki somatycznej\nMejoza,Podział redukcyjny';
  const result3 = model.parseCsv(noHeader);
  assert.equal(result3.count, 2);
  assert.equal(result3.cards[0].front, 'Mitoza');
});

test('parseCsv respects explicit hasHeader option', () => {
  const forcedHeader = 'Mitoza,Podział komórki somatycznej\nMejoza,Podział redukcyjny';
  const result1 = model.parseCsv(forcedHeader, { hasHeader: true });
  assert.equal(result1.count, 1);
  assert.equal(result1.cards[0].front, 'Mejoza');

  const forcedNoHeader = 'Front,Back\nDNA,Kwas';
  const result2 = model.parseCsv(forcedNoHeader, { hasHeader: false });
  assert.equal(result2.count, 2);
  assert.equal(result2.cards[0].front, 'Front');
});

test('parseCsv converts single-dollar math to assessment notation unless disabled', () => {
  const mathCsv = 'Aminokwas przy węglu $\\alpha$?,"Wzór cząsteczki to $H_2O$, podstawnik $R$."';
  const result1 = model.parseCsv(mathCsv);
  assert.equal(result1.cards[0].front, 'Aminokwas przy węglu \\(\\alpha\\)?');
  assert.equal(result1.cards[0].back, 'Wzór cząsteczki to \\(H_2O\\), podstawnik \\(R\\).');

  const result2 = model.parseCsv(mathCsv, { convertMath: false });
  assert.equal(result2.cards[0].front, 'Aminokwas przy węglu $\\alpha$?');
  assert.equal(result2.cards[0].back, 'Wzór cząsteczki to $H_2O$, podstawnik $R$.');
});

test('parseCsv correctly parses real flashcards CSV dataset with 35 cards and math formulas', () => {
  const csvPath = '/Users/hipolitplatek/Downloads/flashcards.csv';
  if (!fs.existsSync(csvPath)) return;
  const content = fs.readFileSync(csvPath, 'utf8');
  const result = model.parseCsv(content);
  assert.equal(result.count, 35);
  assert.equal(result.errors.length, 0);
  assert.equal(result.cards[0].front.includes('\\(\\alpha\\)'), true);
  assert.equal(result.cards[0].back.includes('\\(R\\)'), true);
  assert.equal(result.cards[3].back.includes('\\(H_2O\\)'), true);
  assert.equal(result.cards[34].front, 'Jak skrajne pH wpływa na strukturę białka?');
});

test('importCardsFromCsv converts quiz to deck mode and generates valid schema', () => {
  const quiz = model.createQuiz({ quizId: 'fiszki-biologia', mode: 'quiz' });
  const csv = [
    'Pytanie 1,Odpowiedź 1',
    'Pytanie 2,Odpowiedź 2',
    'Pytanie 3,Odpowiedź 3'
  ].join('\n');

  const imported = model.importCardsFromCsv(quiz, csv, { append: false });
  assert.equal(imported.quiz.mode, 'deck');
  assert.equal(imported.count, 3);
  assert.equal(imported.quiz.questions.length, 3);
  assert.equal(imported.quiz.questions[0].type, 'flashcard');
  assert.equal(imported.quiz.questions[0].points, 0);
  assert.equal(imported.quiz.questions[0].required, false);
  assert.equal(imported.quiz.questions[0].front.text, 'Pytanie 1');
  assert.equal(imported.quiz.questions[0].back.text, 'Odpowiedź 1');

  // Serialization and parsing round-trip
  const serialized = model.serialize(imported.quiz);
  const parsedBack = model.parse(serialized);
  assert.equal(parsedBack.mode, 'deck');
  assert.equal(parsedBack.questions.length, 3);

  // Schema validations
  assert.equal(model.validate(imported.quiz).valid, true);
  assert.equal(common.validateDefinition(imported.quiz).valid, true);
});

test('importCardsFromCsv supports appending cards to existing deck', () => {
  const existing = model.createQuiz({
    quizId: 'fiszki-istniejace',
    mode: 'deck',
    questions: [
      model.createQuestion({
        type: 'flashcard',
        prompt: 'Stara karta',
        front: { text: 'Stara karta', images: [] },
        back: { text: 'Stara odpowiedź', images: [] }
      })
    ]
  });

  const csv = 'Nowa karta 1,Nowa odp 1\nNowa karta 2,Nowa odp 2';
  const imported = model.importCardsFromCsv(existing, csv, { append: true });
  assert.equal(imported.quiz.questions.length, 3);
  assert.equal(imported.quiz.questions[0].front.text, 'Stara karta');
  assert.equal(imported.quiz.questions[1].front.text, 'Nowa karta 1');
  assert.equal(imported.quiz.questions[2].front.text, 'Nowa karta 2');
  assert.equal(model.validate(imported.quiz).valid, true);
  assert.equal(common.validateDefinition(imported.quiz).valid, true);
});

