# Pomijanie kroków i konfiguratory odpowiedzi

## Przełącznik lekcji

W **Studio → Lesson Builder**, obok nazwy pliku i tytułu, znajduje się przełącznik **Pozwól uczestnikom pomijać kroki**. Wyłączony oznacza naukę po kolei; włączony pozwala przejść do innych kroków i wrócić do zadania później.

Zmiana dotyczy całej lekcji. Zapisz ją przyciskiem zapisu w GitHubie. Studio zapisuje również manifest postępu; jeśli synchronizacja się nie powiedzie, pokazuje ostrzeżenie i przycisk ponowienia bez dodatkowego commitu. Pobranie samego Markdown nie synchronizuje manifestu serwera.

W **panelu admina → Postępy → raport ucznia → Ustawienia ucznia** można ustawić wyjątek:

- **Według lekcji** — respektuje przełącznik autora.
- **Pomijanie dozwolone** — ten uczeń może pomijać w lekcjach.
- **Pomijanie zabronione** — ten uczeń przechodzi po kolei.

Ręczna blokada konkretnego kroku ma pierwszeństwo przed zezwoleniem ucznia. Ręczne odblokowanie kroku pozwala wejść bez ukończenia poprzedniego. Administrator może pomijać kroki; jego przełącznik „Nauka po kolei” w odtwarzaczu jest tylko podglądem.

**Pomijanie nie jest zaliczeniem.** Samo przejście nie rozwiązuje zadania, nie sprawdza go AI i nie przyznaje punktów. Żeby ukończyć lekcję, trzeba nadal zaliczyć wymagane/liczone kroki. Postęp i wynik nie są sztucznie ustawiane na 100%.

Manifesty zapisują się również dla lekcji jeszcze nieumieszczonych w dashboardzie. Kolejna publikacja dashboardu zachowuje już opublikowane warunki i kolejność lekcji.

## Odpowiedzi bez ręcznych identyfikatorów

Egzamin oraz bank pytań mają konfiguratory odpowiednie do typu pytania:

- wybór: osobna treść odpowiedzi i kółko/checkbox poprawności;
- pary: lewa i prawa strona w osobnych polach;
- kolejność: osobne elementy, strzałki przesuwania;
- luki: fragmenty zdania i przycisk „Wstaw lukę tutaj”;
- tekst: lista dopuszczalnych wariantów z przyciskami dodawania/usuwania;
- pytanie otwarte: sposób oceniania, klucz i kryteria, punkty.

Identyfikatory odpowiedzi i przypisane obrazy są zachowywane podczas edycji. Usunięcie jedynej poprawnej odpowiedzi wymaga świadomego zaznaczenia nowej — edytor nie wybiera jej za autora. Niekompletne odpowiedzi i luki blokują publikację z komunikatem.

Quiz i zadania lekcji korzystają z tego samego układu osobnych pól dla wariantów tekstowych, a pytania wyboru i luki zachowują swoje wizualne konfiguratory. Dotychczasowe pliki pozostają obsługiwane; nie trzeba ręcznie przepisywać istniejących odpowiedzi.

Ocena AI nie uruchamia się od edytowania. W egzaminie uruchamia ją autor w raporcie; w quizie uczeń może wywołać sprawdzenie. Tryby ręczny i bez punktów nadal są dostępne.
