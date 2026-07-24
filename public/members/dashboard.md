<!--
  EDYCJA DASHBOARDU
  - Nagłówek z jednym # ustawia tytuł strony Start.
  - Zwykły tekst pod tytułem jest opisem powitalnym.
  - Każdy nagłówek ## tworzy dział oraz pozycję w menu.
  - Nagłówki ###, ####, ##### i ###### tworzą zagnieżdżone harmonijki.
  - Zwykła linia opisuje bieżący dział albo harmonijkę.
  - Wiersz zaczynający się od > tworzy komunikat.
  - Każdy link zapisany jak poniżej tworzy kartę:
    - [Nazwa materiału](/members/module/nazwa/?parametr=wartosc) — Krótki opis.

  PARAMETRY MODUŁÓW
  - chat:       ?prompt=nazwa.json albo ?plik=nazwa.txt&punkt=1
  - forms:      ?id=ID_FORMULARZA_GOOGLE
  - contact:    ?internal=Stała%20treść%20wiadomości
  - slides:     ?id=ID_Z_GOOGLE_DRIVE&type=1 (bez ochrony) lub type=2 (ochrona)
  - pdf:        ?id=ID_Z_GOOGLE_DRIVE&type=1 (ochrona pobierania),
                type=2 (wymuszone pobranie), type=3 (zwykły podgląd)
  - film:       ?id=ID&type=1 (YouTube chroniony), type=2 (Google Drive),
                type=3 (YouTube bez ochrony)
  - yt:         ?id=ID_LUB_ZAKODOWANY_LINK_YOUTUBE (własne kontrolki)
  - lesson:     ?file=nazwa-lekcji.md

  SZABLONY KART DO SKOPIOWANIA
  ## Nazwa działu

  Krótki opis działu.

  ### Nazwa lekcji

  - [Lekcja interaktywna](/members/module/lesson/?file=nazwa-lekcji.md) — Lekcja lub quiz ABCD.
  - [Prezentacja](/members/module/slides/?id=ID_PLIKU&type=2) — Slajdy do działu.
  - [Zestaw PDF](/members/module/pdf/?id=ID_PLIKU&type=1) — Zadania do samodzielnej pracy.
  - [Test](/members/module/forms/?id=ID_FORMULARZA) — Sprawdź swoją wiedzę.
  - [Film](/members/module/yt/?id=ID_FILMU) — Nagranie lekcji.
  - [Asystent](/members/module/chat/?prompt=nazwa.json) — Pomoc do tego działu.

  Pełny link Google albo YouTube zakoduj jako wartość parametru URL.
  Nie wstawiaj tutaj kodu HTML — dashboard celowo go nie interpretuje.
-->

# Twoja przestrzeń do nauki

Wszystkie materiały, ćwiczenia i narzędzia do kursu maturalnego masz teraz w jednym miejscu.

> Zacznij od materiału wskazanego przez prowadzącego. Twoje konto działa tylko w jednej aktywnej sesji naraz.

## Materiały kursowe

Prezentacje, dokumenty i nagrania przypisane do kursu.

### Dokumenty i prezentacje

Rozwiń listę, aby zobaczyć materiały do czytania.

- [Dokument PDF](/members/module/pdf/?id=1qKkDarVM8qn1GHkNalt9f8n7IXNUawZF&type=1) — Materiał do wygodnego czytania w przeglądarce.

### Nagrania

Filmy z lekcji i omówienia zadań.

- [Nagranie lekcji](/members/module/film/?id=CH50zuS8DD0&type=1) — Film z lekcji w odtwarzaczu kursowym.

## Ćwiczenia i powtórki

Sprawdź wiedzę i przećwicz zadania przed maturą.

- [Izotopy węgla — lekcja interaktywna](/members/module/lesson/?file=izotopy-wegla.md) — Przejdź przez krótką prezentację i quiz ABCD o izotopach węgla.
- [Asystent Gemini](/members/module/chat/?prompt=test.json) — Zapytaj asystenta korzystającego z przygotowanego promptu.
- [Asystent naprowadzający — przykład](/members/module/chat/?plik=prompty-przyklad.txt&punkt=1) — Instrukcja wybrana z wielopunktowego pliku TXT.

## Tablice i kalkulatory

Narzędzia pomocne podczas lekcji oraz samodzielnej nauki.

- [Tablica BitPaper](/members/module/bitpaper/) — Prosta przestrzeń do wspólnego rozwiązywania zadań.
- [Biała tablica](/members/module/whiteboard/) — Szkicuj wzory, reakcje i notatki.
- [Kalkulator naukowy](/members/module/kalkulator/) — Wykonuj obliczenia potrzebne w zadaniach.
- [Kalkulator klasyczny](/members/module/classic/) — Szybkie podstawowe obliczenia.

## Laboratorium modułów

Zestaw kontrolny wszystkich modułów i dostępnych trybów. Użyj go po wdrożeniu, aby szybko sprawdzić działanie materiałów na docelowej domenie.

> Tryby Google Drive korzystają z podanego pliku testowego. Odtwarzacze filmów pokażą film tylko wtedy, gdy wskazany plik Drive jest materiałem wideo i ma odpowiednie uprawnienia udostępniania.

### Lekcja interaktywna

- [Izotopy węgla — przykład Markdown](/members/module/lesson/?file=izotopy-wegla.md) — Prezentacja krokowa z zadaniem liczbowym i quizem ABCD.

### Formularze

- [Ćwiczenie 3 — szybkość reakcji chemicznych i równowaga chemiczna](/members/module/forms/?id=1FAIpQLSeKEXX7ooRB7ZaPJ8UwnqNlPsucgjwnQFzmSlZ3OvrdFlURsA) — Ćwiczenie w Google Forms.
- [Test Forms](/members/module/forms/?id=1YmTr2X0Fx-0T5a8CHpH0sBBz9rTzmIELo2bLnlsdd3M) — Drugi formularz sprawdzający wiedzę.

### Film — odtwarzacz podstawowy

- [Ciekawostka 1 — tryb chroniony](/members/module/film/?id=sU6epNBjvzo&type=1) — YouTube z ograniczonym interfejsem.
- [Ciekawostka 2 — tryb chroniony](/members/module/film/?id=PG6fB57aAoA&type=1) — YouTube z ograniczonym interfejsem.
- [Ciekawostka 3 — tryb chroniony](/members/module/film/?id=kOoRildWO0s&type=1) — YouTube z ograniczonym interfejsem.
- [Film testowy — type=1](/members/module/film/?id=p_5yt5IX38I&type=1) — YouTube w trybie chronionym.
- [Film testowy — type=2](/members/module/film/?id=1qKkDarVM8qn1GHkNalt9f8n7IXNUawZF&type=2) — Test osadzenia pliku z Google Drive.
- [Film testowy — type=3](/members/module/film/?id=p_5yt5IX38I&type=3) — YouTube z pełniejszym interfejsem.

### Odtwarzacz YT

- [Film w odtwarzaczu YT](/members/module/yt/?id=p_5yt5IX38I) — YouTube z własnymi kontrolkami ChemDisk.

### Prezentacje

- [Prezentacja bez ograniczenia pobierania — type=1](/members/module/slides/?id=1H5__hUC_iQxeR5jW6kg4TBICCL2XK_mL&type=1) — Zwykły podgląd prezentacji Google.
- [Prezentacja z ograniczonym interfejsem — type=2](/members/module/slides/?id=1H5__hUC_iQxeR5jW6kg4TBICCL2XK_mL&type=2) — Podgląd z maskami i bez bezpośredniego przejścia do Google.

### Dokumenty PDF

- [PDF — type=1, podgląd ograniczony](/members/module/pdf/?id=1qKkDarVM8qn1GHkNalt9f8n7IXNUawZF&type=1) — Podgląd z maskami ograniczającymi typowe pobieranie.
- [PDF — type=2, pobieranie](/members/module/pdf/?id=1qKkDarVM8qn1GHkNalt9f8n7IXNUawZF&type=2) — Test bezpośredniego rozpoczęcia pobierania.
- [PDF — type=3, zwykły podgląd](/members/module/pdf/?id=1qKkDarVM8qn1GHkNalt9f8n7IXNUawZF&type=3) — Podgląd bez ograniczonego interfejsu.

### Asystent AI

- [Asystent — prompt JSON](/members/module/chat/?prompt=test.json) — Test instrukcji zapisanej w pliku JSON.
- [Asystent naprowadzający — punkt 1](/members/module/chat/?plik=prompty-przyklad.txt&punkt=1) — Test pierwszej instrukcji z pliku TXT.
- [Asystent sprawdzający — punkt 2](/members/module/chat/?plik=prompty-przyklad.txt&punkt=2) — Test drugiej instrukcji z pliku TXT.

### Tablice i kalkulatory

- [Tablica BitPaper](/members/module/bitpaper/) — Test prostej tablicy.
- [Biała tablica](/members/module/whiteboard/) — Test narzędzia do szkicowania.
- [Kalkulator naukowy](/members/module/kalkulator/) — Kalkulator naukowy.
- [Kalkulator prosty](/members/module/classic/) — Kalkulator do podstawowych obliczeń.

### Kontakt i materiały zewnętrzne

- [Formularz kontaktowy](/members/module/contact/?internal=wiadomosc) — Test formularza z przekazaną informacją wewnętrzną.
- [ATONOM](/members/module/atonom/) — Buduj interaktywne modele cząsteczek z polskich nazw związków.

## Pomoc i konto

Zarządzaj dostępem albo skontaktuj się z prowadzącym.

> Imię i nazwisko zmienisz po kliknięciu swojej karty konta w menu. Administratorzy mają tam również osobny panel zarządzania użytkownikami.

- [Status dostępu](/time) — Sprawdź rolę i czas pozostały do końca dostępu.
- [Napisz do nas](/members/module/contact/?internal=Wiadomo%C5%9B%C4%87%20z%20panelu%20kursanta) — Wyślij wiadomość bez opuszczania platformy.
