<!-- chemdisk-lesson:{"navigation":"sequential"} -->

<!-- chemdisk-step:{"id":"example-intro","includeInLesson":"ON","requiredToAdvance":true,"condition":{"type":"next_click","materialId":"","minimumScore":0}} -->

:::slide
transition: fade
background: default
decoration: molecules
text_tone: auto
:::

# Lekcja pokazowa — wszystkie możliwości

## Wprowadzenie

Ta lekcja jest kompletnym wzorcem pliku Markdown dla kreatora lekcji ChemDisk. Każdy kolejny slajd pokazuje inną grupę klocków, ustawień albo zadań.

### W tym przykładzie znajdziesz

- tekst, nagłówki, cytaty, listy, tabele, kod i wyróżnienia,
- obrazy z Media Managera oraz zewnętrznego adresu HTTPS,
- multimedia, prezentacje, quiz, PDF, egzamin, AI i tablice,
- wszystkie rodzaje pytań oraz ustawienia postępu ucznia.

1. Otwórz lekcję w Studio.
2. Klikaj kolejne slajdy i sprawdzaj ustawienia inspektora.
3. Zastąp przykładowe identyfikatory własnymi materiałami.

> Wiedza jest najbardziej użyteczna wtedy, gdy potrafimy ją zastosować.

> **Ważne:** To jest materiał demonstracyjny. Przed publikacją podmień przykładowe linki oraz ID.

---

<!-- chemdisk-step:{"id":"example-table-callouts","includeInLesson":"INHERIT","requiredToAdvance":true,"condition":{"type":"previous_completed","materialId":"","minimumScore":0}} -->

:::slide
transition: rise
background: paper
decoration: bubbles
text_tone: dark
:::

## Tabele i komunikaty

:::table
caption: Wyrównanie tabeli do lewej
align: left
headers: Pierwiastek | Symbol | Liczba atomowa
row: Wodór | H | 1
row: Węgiel | C | 6
row: Tlen | O | 8
:::

:::table
caption: Wyrównanie tabeli do środka
align: center
headers: Wielkość | Symbol | Jednostka
row: Masa | m | g
row: Liczność materii | n | mol
:::

:::table
caption: Wyrównanie tabeli do prawej
align: right
headers: Związek | Wzór
row: Woda | H₂O
row: Dwutlenek węgla | CO₂
:::

> **Ważne:** Komunikat informacyjny przekazuje ważny kontekst.

> **Wskazówka:** Tytuł „Wskazówka” nadaje komunikatowi ton porady.

> **Uwaga:** Ten wariant służy do ostrzeżeń.

> **Brawo:** Ten wariant podkreśla sukces ucznia.

---

<!-- chemdisk-step:{"id":"example-styles","includeInLesson":"INHERIT","requiredToAdvance":false,"condition":{"type":"next_click","materialId":"","minimumScore":0}} -->

:::slide
transition: slide
background: grid
decoration: glow
text_tone: dark
:::

## Style tekstu

:::style font=sans size=small align=left color=#17324d background=#eef8f5
Sans, mały rozmiar, wyrównanie do lewej, kolor tekstu i tła.
:::

:::style font=arial size=normal align=center bold=true color=#0e665a
Arial, rozmiar normalny, wyśrodkowanie i pogrubienie.
:::

:::style font=verdana size=large align=right
Verdana, duży rozmiar i wyrównanie do prawej.
:::

:::style font=serif size=xlarge align=left
Serif w największym rozmiarze.
:::

:::style font=georgia size=normal align=left
Krój Georgia.
:::

:::style font=times size=normal align=left
Krój Times.
:::

:::style font=rounded size=normal align=left
Krój zaokrąglony.
:::

:::style font=mono size=normal align=left
Krój monospace.
:::

:::style font=courier size=normal align=left
Krój Courier.
:::

---

<!-- chemdisk-step:{"id":"example-media","includeInLesson":"INHERIT","requiredToAdvance":true,"condition":{"type":"material_completed","materialId":"image:example-diagram","minimumScore":0}} -->

:::slide
transition: zoom
background: dots
decoration: none
text_tone: auto
:::

## Obrazy i kod

:::image
ref: assets/shared/example-diagram.svg
repository: default
alt: Czerwony atom tlenu pośrodku, dwa białe atomy wodoru u góry oraz wiązania tworzące kąt; podpis H₂O — cząsteczka polarna
width: 70
align: center
:::

:::image
ref: photos/example-photo.svg
repository: default
owner: lekcja-wszystkie-mozliwosci.md
alt: Lokalny obraz lekcji wyrównany do lewej; niebieska kolba z trzema bąbelkami
width: 35
align: left
:::

:::image
ref: photos/example-photo.svg
repository: default
owner: lekcja-wszystkie-mozliwosci.md
alt: Ten sam lokalny obraz lekcji wyrównany do prawej
width: 35
align: right
:::

![Zewnętrzny model cząsteczki wody](https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Water_molecule_3D.svg/640px-Water_molecule_3D.svg.png)

Opis ALT obrazu z Media Managera jest dostępny dla czytników ekranu i trafia do kontekstu AI. Przykłady wyżej pokazują współdzielony zasób, lokalne zdjęcie lekcji, szerokość oraz wszystkie trzy wyrównania: `left`, `center` i `right`.

```javascript
const molarMass = (atoms) => atoms.reduce((sum, atom) => sum + atom.mass, 0);
console.log(molarMass([{ mass: 1 }, { mass: 1 }, { mass: 16 }]));
```

---

<!-- chemdisk-step:{"id":"example-containers","includeInLesson":"INHERIT","requiredToAdvance":true,"condition":{"type":"next_click","materialId":"","minimumScore":0}} -->

:::slide
transition: none
background: mint
decoration: molecules
text_tone: dark
:::

## Harmonijki i fiszki

:::accordion Harmonijka domyślnie zamknięta
Tutaj można ukryć dodatkowe wyjaśnienie, listę albo inny zwykły klocek.

- Pierwszy szczegół
- Drugi szczegół
:::

:::accordion Harmonijka domyślnie otwarta open=true
Ta sekcja jest od razu rozwinięta. Harmonijki i sekcje stylowane nie mogą być zagnieżdżane jedna w drugiej.
:::

:::flashcards
title: Fiszki — symbole i nazwy
color: #7c3aed
H => wodór
O => tlen
Na => sód
Cl => chlor
:::

---

<!-- chemdisk-step:{"id":"example-formulas","includeInLesson":"INHERIT","requiredToAdvance":true,"condition":{"type":"next_click","materialId":"","minimumScore":0}} -->

:::slide
transition: fade
background: sky
decoration: bubbles
text_tone: dark
:::

## Wzory matematyczne i chemiczne

:::formula
mode: math
title: Przykład wzoru matematycznego
expression: \frac{-b \pm \sqrt{b^{2}-4ac}}{2a}
:::

:::formula
mode: chemistry
title: Sam zapis chemiczny — bez strzałki
left: H_{2}O
arrow: 
above: 
below: 
right: 
:::

:::formula
mode: chemistry
title: Reakcja w prawo
left: 2H_{2} + O_{2}
arrow: ->
above: zapłon
below: 
right: 2H_{2}O
:::

:::formula
mode: chemistry
title: Reakcja w lewo
left: produkty
arrow: <-
above: 
below: chłodzenie
right: substraty
:::

:::formula
mode: chemistry
title: Strzałka dwukierunkowa
left: A
arrow: <->
above: 
below: 
right: B
:::

:::formula
mode: chemistry
title: Równowaga
left: N_{2} + 3H_{2}
arrow: <=>
above: Fe
below: temperatura
right: 2NH_{3}
:::

:::formula
mode: chemistry
title: Równowaga przesunięta w prawo
left: A
arrow: <=>>
above: 
below: 
right: B
:::

:::formula
mode: chemistry
title: Równowaga przesunięta w lewo
left: A
arrow: <<=>
above: 
below: 
right: B
:::

---

<!-- chemdisk-step:{"id":"example-video-model","includeInLesson":"INHERIT","requiredToAdvance":true,"condition":{"type":"material_completed","materialId":"youtube:FSyAehMdpyI","minimumScore":0}} -->

:::slide
transition: rise
background: lavender
decoration: glow
text_tone: dark
:::

## Film i model cząsteczki

:::youtube
id: FSyAehMdpyI
title: Przykładowy film YouTube do lekcji
:::

:::atonom
formula: woda
title: Interaktywny model cząsteczki w ATONOM
:::

---

<!-- chemdisk-step:{"id":"example-google-slides","includeInLesson":"INHERIT","requiredToAdvance":true,"condition":{"type":"material_completed","materialId":"slides:google-example","minimumScore":0}} -->

:::slide
transition: slide
background: sand
decoration: none
text_tone: dark
:::

## Google Slides — sterowanie włączone i wyłączone

:::googleslides
id: 1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
published: false
controls: true
title: Standardowa prezentacja Google — przyciski sterowania włączone
:::

:::googleslides
id: 1ZyXwVuTsRqPoNmLkJiHgFeDcBa0987654321
published: true
controls: false
title: Opublikowana prezentacja Google — przyciski sterowania wyłączone
:::

Google Slides działa w zewnętrznym iframe. AI nie może odczytać jego zawartości bezpośrednio, dlatego dokładny opis slajdów znajduje się w polu ręcznego kontekstu klocka AI na kolejnym slajdzie.

---

<!-- chemdisk-step:{"id":"example-native-materials","includeInLesson":"INHERIT","requiredToAdvance":true,"condition":{"type":"quiz_completed","materialId":"quiz:default:quiz-wszystkie-mozliwosci","minimumScore":0}} -->

:::slide
transition: zoom
background: gradient
decoration: molecules
text_tone: dark
:::

## Materiały ChemDisk wewnątrz lekcji

:::presentation
repository: default
presentation: prezentacja-przykladowa
title: Prezentacja ChemDisk
description: Otwiera natywną prezentację wskazaną przez presentation.json.
button: Otwórz prezentację
:::

:::quiz
repository: default
quiz: quiz-wszystkie-mozliwosci
title: Quiz ze wszystkich typów pytań
description: Otwiera przykładowy quiz dołączony do katalogu Examples.
button: Rozpocznij quiz
:::

---

<!-- chemdisk-step:{"id":"example-pdfs","includeInLesson":"INHERIT","requiredToAdvance":true,"condition":{"type":"material_completed","materialId":"pdf:example","minimumScore":0}} -->

:::slide
transition: none
background: night
decoration: glow
text_tone: light
:::

## PDF — pięć trybów ochrony

:::pdf
id: 1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
protection: 1
title: PDF z Dysku Google — tryb 1
description: Dokument wskazany identyfikatorem Google Drive.
button: Otwórz PDF
:::

:::pdf
id: 1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
protection: 2
title: PDF z Dysku Google — tryb 2
description: Drugi wariant osadzania dokumentu Google.
button: Otwórz PDF
:::

:::pdf
id: 1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
protection: 3
title: PDF z Dysku Google — tryb 3
description: Trzeci wariant osadzania dokumentu Google.
button: Otwórz PDF
:::

:::pdf
id: https://example.com/material.pdf
protection: 4
title: Zewnętrzny PDF HTTPS — tryb 4
description: Bezpieczny pełny adres HTTPS.
button: Otwórz PDF
:::

:::pdf
id: https://example.com/material.pdf
protection: 5
title: Zewnętrzny PDF HTTPS — tryb 5
description: Bezpieczny pełny adres HTTPS z alternatywnym odtwarzaczem.
button: Otwórz PDF
:::

---

<!-- chemdisk-step:{"id":"example-ai","includeInLesson":"INHERIT","requiredToAdvance":true,"condition":{"type":"correct_answer","materialId":"","minimumScore":0}} -->

:::slide
transition: fade
background: custom
background_color: #edfdf8
decoration: bubbles
text_tone: dark
:::

## AI z pełnym kontekstem

:::aihelp
title: Zapytaj AI o treść, obraz i zadanie
description: AI otrzyma tekst slajdu, opisy ALT mediów, bieżące zadanie oraz dodatkowy opis autora.
button: Zapytaj AI
repository: default
prompt: example-prompt.txt
point: 1
include_slide: true
include_task: true
context_json: "Na ilustracji atom tlenu jest czerwony i znajduje się centralnie. Dwa białe atomy wodoru leżą wyżej, po lewej i prawej stronie. Wiązania tworzą kąt, co pomaga wyjaśnić polarność cząsteczki. W prezentacji Google poprzedniego slajdu: slajd 1 pokazuje budowę H₂O, slajd 2 rozkład ładunku, a slajd 3 doświadczenie z odchylaniem strumienia wody."
:::

:::aihelp
title: AI tylko z opisem autora
description: Ten wariant celowo nie dołącza automatycznie treści slajdu ani zadania.
button: Otwórz AI
repository: 
prompt: 
point: 1
include_slide: false
include_task: false
context_json: "Autor może podać osobny, wielowierszowy opis dla każdego klocka AI. To dobre miejsce na opis elementów obrazu, diagramu albo kolejnych slajdów Google."
:::

:::question
Cząsteczka wody ma geometrię kątową.
:::

:::task
type: choice
label: Wybierz Prawda albo Fałsz
options: Prawda | Fałsz
answer: Prawda
hint: Spójrz na położenie atomów wodoru względem tlenu.
success: Dobrze! Zaznaczenie zostanie pokazane na zielono, a błędne na czerwono.
:::

---

<!-- chemdisk-step:{"id":"example-links","includeInLesson":"INHERIT","requiredToAdvance":true,"condition":{"type":"next_click","materialId":"","minimumScore":0}} -->

:::slide
transition: rise
background: paper
decoration: none
text_tone: auto
:::

## Kafelki linków — wszystkie ikony

:::linkcard
title: Zwykły link
description: Ikona link i otwarcie w tej samej karcie.
url: /members/
icon: link
color: #0e665a
new_tab: false
:::

:::linkcard
title: Książka
description: Materiał do czytania.
url: https://example.com/book
icon: book
color: #2563eb
new_tab: true
:::

:::linkcard
title: Film
description: Dodatkowy materiał wideo.
url: https://example.com/video
icon: video
color: #dc2626
new_tab: true
:::

:::linkcard
title: Chemia
description: Materiał chemiczny.
url: https://example.com/chemistry
icon: chemistry
color: #059669
new_tab: true
:::

:::linkcard
title: Matematyka
description: Materiał matematyczny.
url: https://example.com/math
icon: math
color: #7c3aed
new_tab: true
:::

:::linkcard
title: Plik
description: Link do pliku.
url: https://example.com/file
icon: file
color: #d97706
new_tab: true
:::

:::linkcard
title: Zewnętrzna strona
description: Ikona external.
url: https://example.com/
icon: external
color: #475569
new_tab: true
:::

---

<!-- chemdisk-step:{"id":"example-tools","includeInLesson":"INHERIT","requiredToAdvance":true,"condition":{"type":"next_click","materialId":"","minimumScore":0}} -->

:::slide
transition: slide
background: grid
decoration: molecules
text_tone: dark
:::

## Tablice i kontakt

:::board
title: Biała tablica ChemDisk
description: Szkicuj wzory i rozwiązania bez wychodzenia z lekcji.
button: Otwórz tablicę
variant: whiteboard
path: 
new_tab: false
:::

:::board
title: Plansza BitPaper
description: Otwórz wcześniej przygotowaną planszę w nowej karcie.
button: Otwórz BitPaper
variant: bitpaper
path: example-board.json
new_tab: true
:::

:::contactform
title: Zapytaj prowadzącego
description: Otwiera wewnętrzny formularz kontaktowy platformy.
button: Napisz wiadomość
internal: Pytanie do lekcji pokazowej — slajd „Tablice i kontakt”.
new_tab: false
:::

:::contactform
title: Formularz w nowej karcie
description: Ten wariant otwiera formularz osobno.
button: Otwórz formularz
internal: Proszę o pomoc z materiałem demonstracyjnym.
new_tab: true
:::

---

<!-- chemdisk-step:{"id":"example-exams","includeInLesson":"INHERIT","requiredToAdvance":true,"condition":{"type":"exam_passed","materialId":"exam:default:egzamin-wszystkie-mozliwosci","minimumScore":0}} -->

:::slide
transition: zoom
background: dots
decoration: bubbles
text_tone: dark
:::

## Egzamin w lekcji — wszystkie wymagania

:::exam
repository: default
exam: egzamin-wszystkie-mozliwosci
title: Egzamin opcjonalny
description: Karta nie blokuje przejścia dalej.
button: Otwórz egzamin
requirement: optional
minimum_score: 0
:::

:::exam
repository: default
exam: egzamin-wszystkie-mozliwosci
title: Wymagane ukończenie egzaminu
description: Uczeń musi zakończyć próbę.
button: Rozpocznij egzamin
requirement: completed
minimum_score: 0
:::

:::exam
repository: default
exam: egzamin-wszystkie-mozliwosci
title: Wymagane zaliczenie egzaminu
description: Uczeń musi osiągnąć próg zapisany w exam.json.
button: Rozpocznij egzamin
requirement: passed
minimum_score: 0
:::

:::exam
repository: default
exam: egzamin-wszystkie-mozliwosci
title: Wymagany własny próg
description: Uczeń musi zdobyć co najmniej 80 procent.
button: Rozpocznij egzamin
requirement: minimum_score
minimum_score: 80
:::

---

<!-- chemdisk-step:{"id":"example-canvas","includeInLesson":"ON","requiredToAdvance":true,"condition":{"type":"minimum_score","materialId":"exam:default:egzamin-wszystkie-mozliwosci","minimumScore":80}} -->

:::slide
transition: none
layout: canvas
background: mint
decoration: glow
text_tone: dark
:::

:::layout id=canvas-title x=4 y=3 width=92 height=14
## Układ canvas
:::

:::layout id=canvas-left x=5 y=23 width=42 height=52
:::style font=rounded color=#0e665a background=#ffffff bold=true size=large align=center
Klocek można ustawić przez współrzędne X i Y oraz szerokość i wysokość.
:::
:::

:::layout id=canvas-right x=53 y=23 width=42 height=52
:::image
ref: assets/shared/example-diagram.svg
repository: default
alt: Schemat wody umieszczony po prawej stronie slajdu canvas
width: 100
align: center
:::
:::

---

<!-- chemdisk-step:{"id":"example-task-text","includeInLesson":"INHERIT","requiredToAdvance":true,"condition":{"type":"correct_answer","materialId":"","minimumScore":0}} -->

:::slide
transition: fade
background: sky
decoration: none
text_tone: dark
:::

## Zadanie tekstowe

:::question
Podaj symbol chemiczny tlenu.
Możesz wpisać wielką albo małą literę, ponieważ sprawdzanie wielkości liter jest wyłączone.
:::

:::task
type: text
label: Symbol tlenu
placeholder: Wpisz symbol
answer: O
hint: Symbol ma jedną literę.
success: Poprawnie — symbolem tlenu jest O.
:::

---

<!-- chemdisk-step:{"id":"example-task-number","includeInLesson":"INHERIT","requiredToAdvance":true,"condition":{"type":"correct_answer","materialId":"","minimumScore":0}} -->

:::slide
transition: rise
background: lavender
decoration: molecules
text_tone: dark
:::

## Zadanie liczbowe

Ile atomów znajduje się łącznie w jednej cząsteczce H₂O?

:::task
type: number
label: Liczba atomów
placeholder: Wpisz liczbę
answer: 3
hint: Dodaj dwa atomy wodoru i jeden atom tlenu.
success: Zgadza się — 2 + 1 = 3.
:::

---

<!-- chemdisk-step:{"id":"example-task-abcd","includeInLesson":"INHERIT","requiredToAdvance":true,"condition":{"type":"correct_answer","materialId":"","minimumScore":0}} -->

:::slide
transition: slide
background: sand
decoration: bubbles
text_tone: dark
:::

## Zadanie ABCD

:::question
Która odpowiedź opisuje geometrię cząsteczki wody?
:::

:::task
type: abcd
label: Wybierz jedną odpowiedź
options: liniowa | tetraedryczna | kątowa | trygonalna płaska
answer: C
hint: Wolne pary elektronowe wpływają na kształt cząsteczki.
success: Dobrze — cząsteczka wody ma geometrię kątową.
:::

---

<!-- chemdisk-step:{"id":"example-task-gaps","includeInLesson":"INHERIT","requiredToAdvance":true,"condition":{"type":"correct_answer","materialId":"","minimumScore":0}} -->

:::slide
transition: zoom
background: gradient
decoration: glow
text_tone: dark
:::

## Luki z listą rozwijaną

Uzupełnij zdanie, wybierając pojęcia z listy. Każda luka jest wyświetlana w osobnym wierszu, dzięki czemu pola nie nakładają się na tekst.

:::task
type: gaps
label: Wybierz odpowiedzi
options: dwa | jeden | wodór | tlen
text_json: "Cząsteczka wody zawiera {{pierwsza luka}} atomy wodoru.\nZawiera także {{druga luka}} atom tlenu."
answer: dwa | jeden
hint: Odczytaj indeksy we wzorze H₂O.
success: Obie luki uzupełniono poprawnie.
:::

---

<!-- chemdisk-step:{"id":"example-task-gaps-text","includeInLesson":"INHERIT","requiredToAdvance":true,"condition":{"type":"correct_answer","materialId":"","minimumScore":0}} -->

:::slide
transition: none
background: night
decoration: molecules
text_tone: light
:::

## Luki wpisywane ręcznie — Enter kontrolowany przez autora

Wielowierszowy tekst jest zapisany w `text_json`. Autor sam decyduje, gdzie wstawić znak nowej linii; kreator nie dodaje Enterów automatycznie.

:::task
type: gaps-text
label: Wpisz brakujące pojęcia
text_json: "Wzór wody to {{wzór}}.\nPierwiastkiem o symbolu O jest {{nazwa}}."
check_mode: each
answer: H2O | tlen
case_sensitive: false
hint: Pierwsza odpowiedź to wzór, druga to polska nazwa pierwiastka.
success: Wszystkie wpisane odpowiedzi są poprawne.
:::

---

<!-- chemdisk-step:{"id":"example-task-case-sensitive","includeInLesson":"OFF","requiredToAdvance":false,"condition":{"type":"next_click","materialId":"","minimumScore":0}} -->

:::slide
transition: fade
background: custom
background_color: #fff7ed
decoration: none
text_tone: dark
:::

## Dodatkowy wariant zadania tekstowego

Ten krok ma `includeInLesson: OFF`, żeby pokazać możliwość wyłączenia go z organizera postępu. W Studio nadal można go edytować.

:::question
Wpisz dokładnie zapis `NaCl`, zachowując wielkość liter.
:::

:::task
type: text
label: Wzór chlorku sodu
placeholder: NaCl
answer: NaCl
case_sensitive: true
hint: Wielkość liter ma znaczenie.
success: Zapis jest poprawny.
:::

---

<!-- chemdisk-step:{"id":"example-open-answer","includeInLesson":"ON","requiredToAdvance":true,"condition":{"type":"next_click","materialId":"","minimumScore":0}} -->

:::slide
transition: fade
background: mint
decoration: molecules
text_tone: dark
:::

## Pytanie otwarte — odpowiedź zapisywana w postępie

Ten przykład pokazuje odpowiedź wielowierszową, wymagany wpis, limit znaków, możliwość późniejszej edycji i zapis w istniejącym postępie lekcji.

:::studentanswer
question_id: q_example_carbon_14
question_json: "Dlaczego atom węgla-14 jest izotopem węgla? Odwołaj się do liczby protonów i neutronów."
label: Twoja odpowiedź
placeholder_json: "Napisz własne wyjaśnienie w kilku zdaniach…"
min_height: 220
multiline: true
max_length: 1400
required: true
save_progress: true
allow_edit: true
button: Zapisz odpowiedź
:::

---

<!-- chemdisk-step:{"id":"example-answer-review","includeInLesson":"ON","requiredToAdvance":true,"condition":{"type":"previous_completed","materialId":"","minimumScore":0}} -->

:::slide
transition: rise
background: paper
decoration: glow
text_tone: dark
:::

## Omówienie odpowiedzi — samodzielne porównanie i opcjonalne AI

Najpierw pojawia się dokładnie zapisana odpowiedź ucznia, potem bogaty klucz autora. Żaden request do AI nie jest wykonywany przy otwarciu slajdu — analiza rusza wyłącznie po kliknięciu przycisku.

:::answerreview
question_id: q_example_carbon_14
question_json: "Dlaczego atom węgla-14 jest izotopem węgla? Odwołaj się do liczby protonów i neutronów."
show_student_answer: true
ai_enabled: true
ai_instruction_json: "Oceniaj poprawność merytoryczną, a nie identyczność słów. Wskaż krótko, czy uczeń uwzględnił tę samą liczbę protonów oraz inną liczbę neutronów."
order: student-first
key_json: "### Poprawna odpowiedź / klucz\n\nIzotopy jednego pierwiastka mają tę samą liczbę protonów, ale różną liczbę neutronów. Węgiel-14 ma **6 protonów** i 8 neutronów, dlatego nadal jest węglem.\n\n- liczba atomowa: **6** — tyle samo protonów,\n- liczba masowa: **14** — protony i neutrony łącznie,\n- liczba neutronów: **14 − 6 = 8**.\n\nW zapisie ^14^C indeks górny oznacza liczbę masową; zapis H~2~O pokazuje również obsługę indeksu dolnego.\n\n:::formula\nmode: math\ntitle: Obliczenie liczby neutronów\nexpression: 14 - 6 = 8\n:::\n\n:::table\ncaption: Budowa węgla-14\nalign: center\nheaders: Wielkość | Wartość\nrow: Protony | 6\nrow: Neutrony | 8\nrow: Nukleony | 14\n:::\n\n:::image\nref: assets/shared/example-diagram.svg\nrepository: default\nalt: Przykładowy schemat ilustrujący, że klucz odpowiedzi może zawierać obraz\nwidth: 42\nalign: center\n:::"
:::

---

<!-- chemdisk-step:{"id":"example-open-answer-optional","includeInLesson":"INHERIT","requiredToAdvance":false,"condition":{"type":"next_click","materialId":"","minimumScore":0}} -->

:::slide
transition: slide
background: sky
decoration: none
text_tone: dark
:::

## Pytanie otwarte — wariant jednowierszowy i sesyjny

Ten wariant jest opcjonalny, ma jedno pole tekstowe bez limitu ustawionego przez autora i nie zapisuje treści do profilu ucznia. Po zapisaniu blokuje ponowną edycję.

:::studentanswer
question_id: q_example_symbol_oxygen
question_json: "Podaj symbol chemiczny tlenu."
label: Krótka odpowiedź
placeholder_json: "Np. O"
min_height: 80
multiline: false
max_length: 0
required: false
save_progress: false
allow_edit: false
button: Zachowaj w tej sesji
:::

---

<!-- chemdisk-step:{"id":"example-answer-review-without-ai","includeInLesson":"INHERIT","requiredToAdvance":false,"condition":{"type":"previous_completed","materialId":"","minimumScore":0}} -->

:::slide
transition: zoom
background: lavender
decoration: bubbles
text_tone: dark
:::

## Omówienie odpowiedzi — klucz pierwszy, bez AI

Alternatywny układ może pokazywać najpierw klucz, ukryć odpowiedź ucznia i całkowicie wyłączyć przycisk AI.

:::answerreview
question_id: q_example_symbol_oxygen
question_json: "Podaj symbol chemiczny tlenu."
show_student_answer: false
ai_enabled: false
ai_instruction_json: ""
order: key-first
key_json: "### Klucz odpowiedzi\n\nPoprawny symbol chemiczny tlenu to **O**."
:::

---

<!-- chemdisk-step:{"id":"example-summary","includeInLesson":"ON","requiredToAdvance":true,"condition":{"type":"exam_completed","materialId":"exam:default:egzamin-wszystkie-mozliwosci","minimumScore":0}} -->

:::slide
transition: rise
background: default
decoration: bubbles
text_tone: auto
:::

## Koniec przykładu

W lekcji użyto wszystkich obsługiwanych typów klocków i zadań. Powiązany quiz zawiera wszystkie typy pytań quizowych, a egzamin — wszystkie typy pytań egzaminacyjnych oraz pełny zestaw ustawień.

> **Brawo:** Możesz skopiować wybrane slajdy i traktować je jako wzorce dla własnych materiałów.

:::contactform
title: Zgłoś pytanie do przykładu
description: Wyślij wiadomość do prowadzącego bez opuszczania platformy.
button: Napisz do prowadzącego
internal: Pytanie dotyczące kompletnego przykładu lekcji.
new_tab: false
:::
