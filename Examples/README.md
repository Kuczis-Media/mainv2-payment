# ChemDisk — kompletne przykłady z chemii organicznej

Katalog zawiera spójny zestaw gotowy do importu. Lekcja, quiz, egzamin i natywna prezentacja używają stabilnych identyfikatorów, które są już ze sobą poprawnie powiązane:

- lekcja: `lekcja-chemia-organiczna.md`;
- quiz: `quiz-chemia-organiczna`;
- egzamin: `egzamin-chemia-organiczna`;
- prezentacja ChemDisk: `prezentacja-aldehydy`.

Nie zmieniaj pojedynczej nazwy bez równoczesnej zmiany odwołań w lekcji. Nazwa folderu quizu, egzaminu i prezentacji musi być identyczna z odpowiednio `quizId`, `examId` i `presentationId` w JSON.

## Co pokazują pliki

- `lessons/lekcja-chemia-organiczna.md` — wszystkie 25 typów klocków lekcji, wszystkie 6 typów zadań, pytania otwarte i omówienia, tryb płynny i canvas, multimedia, AI, ustawienia wyglądu, postępu i nawigacji;
- `quizzes/quiz-chemia-organiczna/quiz.json` — wszystkie 4 typy pytań quizu: `single`, `multiple`, `true_false`, `text`;
- `exams/egzamin-chemia-organiczna/exam.json` — wszystkie 8 typów pytań egzaminu oraz kompletną konfigurację egzaminu;
- `presentations/prezentacja-aldehydy/presentation.json` — natywną prezentację ChemDisk ze stabilnymi ID slajdów i elementów;
- `assets/shared/example-diagram.svg` — diagram grup funkcyjnych współdzielony przez materiały;
- `lessons/lekcja-chemia-organiczna/photos/example-photo.svg` — lokalne medium lekcji ilustrujące próbę Tollensa;
- `prompts/example-prompt.txt` — prompt używany przez klocek AI.

## Jak wgrać do repozytorium treści

Skopiuj pliki z zachowaniem dokładnych ścieżek:

```text
lessons/lekcja-chemia-organiczna.md
lessons/lekcja-chemia-organiczna/photos/example-photo.svg
quizzes/quiz-chemia-organiczna/quiz.json
exams/egzamin-chemia-organiczna/exam.json
presentations/prezentacja-aldehydy/presentation.json
assets/shared/example-diagram.svg
prompts/example-prompt.txt
```

Zestaw jest przygotowany dla repozytorium skonfigurowanego w ChemDisk pod ID `repo-testowe` (`Kuczis-Media/test`). Lekcja, prezentacja, quiz, egzamin, prompt i media współdzielone używają tego samego stabilnego ID, dlatego nie wymagają ręcznej poprawy po wgraniu do tego repozytorium. Jeżeli świadomie wybierzesz inne ID, zmień wszystkie wystąpienia `repo-testowe` w lekcji, prezentacji i linkach dashboardu.

Do dashboardu dodaj dokładnie:

```markdown
- [Chemia organiczna — lekcja](/members/module/lesson/?repo=repo-testowe&file=lekcja-chemia-organiczna.md) — Kompletna lekcja o grupach funkcyjnych, aldehydach i ketonach.
```

## Rzeczywiste materiały Google i YouTube

Przykłady używają przekazanych identyfikatorów:

- Google Slides o aldehydach: `1rxPm5CJl2LDzrzq89fogz-_PWwO_BbqF`;
- PDF o cykloaddycji: `1qKkDarVM8qn1GHkNalt9f8n7IXNUawZF`;
- Google Forms o szybkości reakcji: `1FAIpQLSeKEXX7ooRB7ZaPJ8UwnqNlPsucgjwnQFzmSlZ3OvrdFlURsA`;
- YouTube: `sU6epNBjvzo`, `PG6fB57aAoA`, `kOoRildWO0s`.

ID jest poprawnie wyodrębnione z podanych linków. Osadzenie zadziała tylko wtedy, gdy właściciel materiału zezwolił osobom z linkiem na wyświetlanie; dla Google Slides przydatna jest także publikacja prezentacji w internecie. To ustawienie należy wykonać po stronie Google.

## Typy i warianty lekcji

Lekcja zawiera wszystkie typy klocków:

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

Wybrane ustawienia są wzajemnie wykluczające, dlatego materiał demonstruje je na różnych krokach:

| Obszar | Pokazane możliwości |
| --- | --- |
| Nawigacja lekcji | `sequential`; dostępny jest też `free` |
| Widoczność kroku | `ON`, `OFF`, `INHERIT`; krok wymagany i opcjonalny |
| Warunki kroku | kliknięcie dalej, poprzedni krok, materiał, quiz, poprawna odpowiedź, ukończenie/zaliczenie/wynik egzaminu |
| Przejścia | `none`, `fade`, `rise`, `slide`, `zoom` |
| Tła i dekoracje | wszystkie tła systemowe, własny kolor i dekoracje |
| Układ | płynny oraz pozycjonowany `canvas` |
| Luki | lista rozwijana oraz ręczne wpisywanie; nowe linie zapisane jawnie przez autora w `text_json` |
| Pytanie otwarte | wielo- i jednowierszowe, wymagane lub opcjonalne, zapis do postępu lub tylko sesyjny |
| Omówienie | odpowiedź ucznia albo klucz jako pierwszy, AI włączone lub wyłączone |
| Google Slides | kontrolki włączone i wyłączone dla tej samej prawdziwej prezentacji |
| PDF | wszystkie obsługiwane tryby otwierania tego samego prawdziwego pliku |
| Egzamin | karta opcjonalna, wymagane ukończenie, zaliczenie i własny próg |

JSON nie obsługuje komentarzy, dlatego opisy wariantów znajdują się tutaj, a pliki materiałów pozostają gotowe do importu.
