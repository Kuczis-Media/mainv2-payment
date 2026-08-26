# ChemDisk — kompletne przykłady materiałów

Ten katalog zawiera poprawne przykłady importu pokazujące wszystkie aktualnie obsługiwane typy treści:

- `lessons/lekcja-wszystkie-mozliwosci.md` — wszystkie 25 typów klocków lekcji, 6 typów zadań, tryb płynny i canvas, ustawienia wyglądu, postępu i nawigacji;
- `quizzes/quiz-wszystkie-mozliwosci/quiz.json` — wszystkie 4 typy pytań quizu;
- `exams/egzamin-wszystkie-mozliwosci/exam.json` — wszystkie 8 typów pytań egzaminu oraz komplet ustawień egzaminu;
- `assets/shared/example-diagram.svg` — przykładowe współdzielone medium użyte w materiałach;
- `lessons/lekcja-wszystkie-mozliwosci/photos/example-photo.svg` — przykładowe medium należące do konkretnej lekcji;
- `prompts/example-prompt.txt` — przykładowy prompt dla klocka AI.

## Jak użyć

Skopiuj zawartość odpowiednich podfolderów do repozytorium treści, zachowując ścieżki:

```text
lessons/lekcja-wszystkie-mozliwosci.md
quizzes/quiz-wszystkie-mozliwosci/quiz.json
exams/egzamin-wszystkie-mozliwosci/exam.json
assets/shared/example-diagram.svg
lessons/lekcja-wszystkie-mozliwosci/photos/example-photo.svg
prompts/example-prompt.txt
```

W lekcji odwołania mają `repository: default`. Jeżeli repozytorium treści ma inne ID, zmień tę wartość w blokach `image`, `presentation`, `quiz`, `aihelp` i `exam`.

Blok prezentacji ChemDisk odwołuje się do przykładowego ID `prezentacja-przykladowa`. Przed publikacją utwórz prezentację o tym ID albo podmień odwołanie. Przykładowe linki Google Slides, YouTube i PDF także należy zastąpić własnymi, jeżeli materiał ma być używany produkcyjnie.

## Typy i warianty

Lekcja prezentuje wszystkie typy klocków:

```text
heading, text, list, table, image, quote, callout, code, style,
accordion, youtube, slides, presentation, quiz, pdf, atonom,
formula, link, ai, board, contact, exam, flashcards,
student-answer, answer-review
```

oraz wszystkie typy zadań:

```text
text, number, choice, abcd, gaps, gaps-text
```

W quizie dostępne są `single`, `multiple`, `true_false`, `text`.

W egzaminie dostępne są `single_choice`, `multiple_choice`, `true_false`, `short_text`, `number`, `matching`, `ordering`, `fill_blanks`.

Niektóre ustawienia są wzajemnie wykluczające, więc jeden materiał nie może aktywować ich jednocześnie. Obsługiwane alternatywy to:

| Obszar | Dostępne wartości |
| --- | --- |
| Nawigacja lekcji | `sequential`, `free` |
| Widoczność kroku | `ON`, `OFF`, `INHERIT`; krok wymagany albo opcjonalny |
| Warunek kroku | `next_click`, `previous_completed`, `material_completed`, `quiz_completed`, `correct_answer`, `exam_completed`, `exam_passed`, `minimum_score` |
| Przejście slajdu | `none`, `fade`, `rise`, `slide`, `zoom` |
| Tło slajdu | `default`, `paper`, `grid`, `dots`, `mint`, `sky`, `lavender`, `sand`, `gradient`, `night`, `custom` |
| Dekoracja slajdu | `none`, `molecules`, `bubbles`, `glow` |
| Ton tekstu | `auto`, `dark`, `light` |
| Luki tekstowe | sprawdzanie `each` albo `all`; wielkość liter włączona albo wyłączona |
| Pytanie otwarte | wielowierszowe albo jednowierszowe; wymagane albo opcjonalne; zapis w postępie albo tylko w sesji; edycja włączona albo blokowana po zapisie |
| Omówienie odpowiedzi | odpowiedź ucznia albo klucz jako pierwszy; odpowiedź widoczna albo ukryta; AI włączone albo wyłączone; analiza wyłącznie po kliknięciu ucznia |
| Google Slides | link standardowy lub opublikowany; kontrolki włączone albo wyłączone |
| Status quizu/egzaminu | `draft`, `published` |
| Tryb wyświetlania egzaminu | `one`, `page`, `all` |
| Dostępność egzaminu | `always`, `from`, `until`, `range` |
| Odbiorcy egzaminu | `all`, `selected` |
| Zegar | `none`, `exam`, `question`; widok `countdown`, `countup`, `hidden` |
| Próby | `one`, `limited`, `unlimited`; wynik `best`, `first`, `last`, `average` |
| Opuszczenie egzaminu | `allow_resume`, `end_attempt`, `warn`, `log` |
| Informacja zwrotna | `immediate`, `after_submit`, `never` |
| Punktacja wielokrotnego wyboru | `all_or_nothing`, `per_option`, `correct_minus_incorrect` |

JSON nie obsługuje komentarzy, dlatego opis wariantów znajduje się tutaj, a pliki przykładów pozostają gotowe do importu.
