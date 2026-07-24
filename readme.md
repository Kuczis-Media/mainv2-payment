# ChemDisk — platforma kursów maturalnych

ChemDisk jest statyczną aplikacją wdrażaną na Netlify. Publiczna strona prowadzi do logowania przez Netlify Identity, a zalogowany kursant otrzymuje panel z materiałami zdefiniowanymi w Markdownzie dashboardu i prywatnych repozytoriach lekcji. Dostęp kontrolują role w `app_metadata`, nadawane automatycznie po płatności Stripe albo ręcznie przez administratora.

## Architektura

```text
public/
├── index.html                         # strona startowa, oferta i publiczny formularz
├── 404.html                           # lokalna strona błędu
├── login/                             # logowanie, rejestracja i odzyskiwanie konta
├── purchase/                          # osobny ekran zakupu i przedłużania dostępu
├── payment-success/                   # powrót ze Stripe i kontrolna realizacja zakupu
├── time.html                          # bieżąca rola i termin dostępu
├── assets/js/auth.js                  # wspólna obsługa sesji, ról i profilu
└── members/
    ├── index.html                     # panel kursanta
    ├── dashboard.md                   # działy i materiały widoczne w panelu
    ├── dashboard.js / dashboard.css   # interfejs, motyw, sidebar i wyszukiwarka
    ├── dashboard-parser.js            # bezpieczny parser kart i harmonijek
    ├── dashboard-navigation.js        # aktywna sekcja podczas kliknięcia/przewijania
    ├── favicon.svg                    # lokalna ikona panelu kursanta
    └── module/
        ├── theme.js / theme.css       # wspólna paleta jasna/ciemna aplikacji
        ├── media-*.js / *.css         # wspólne mechanizmy podglądów mediów
        ├── studio/                    # Dashboard Builder i Lesson Builder
        ├── lesson/                    # odtwarzacz lekcji z prywatnego repo treści
        ├── atonom/                    # modele cząsteczek z polskich nazw
        └── …                          # kalkulatory, tablice, media, czat i kontakt
netlify/functions/
├── identity-login.js                  # role czasowe i identyfikator sesji
├── identity-signup.js                 # sanitowanie profilu przy rejestracji
├── admin-users.js                     # konta, zaproszenia i role Identity
├── create-checkout.js                 # uwierzytelnione tworzenie Stripe Checkout
├── stripe-webhook.js                  # podpisany webhook i nadawanie dostępu
├── payment-status.js                  # potwierdzenie płatności po powrocie ze Stripe
├── payment-config.js                  # publiczny cennik i administracyjna edycja cen
├── payment-admin.js                   # historia i odebranie płatnego dostępu
├── admin-forms.js                     # odczyt/usuwanie zgłoszeń Netlify Forms
├── admin-dashboard.js                 # aktywny Markdown w Netlify Blobs
├── content-library.js                 # chroniona lista i odczyt repo treści
└── chat.mjs                           # chronione połączenie z Gemini i limit Netlify
netlify/admin-common.js                # wspólna kanoniczna autoryzacja
netlify/content-repository.js           # serwerowy klient GitHub Contents API
netlify/payment-common.js              # pakiety, księga zakupów i synchronizacja Identity
netlify.toml                           # publikacja, nagłówki i ochrona /members/*
tests/                                 # testy auth i Netlify Functions
```

To nie jest aplikacja SPA ani projekt wymagający własnego, stale uruchomionego serwera. Netlify publikuje katalog `public`, a pliki z `netlify/functions` uruchamia na żądanie jako funkcje serverless. Profile i role przechowuje Identity, zgłoszenia — Netlify Forms, aktywny Markdown edytora — Netlify Blobs, a lekcje i prompty — osobne prywatne repozytorium GitHub odczytywane wyłącznie przez Functions.

## Panel kursanta, motyw i nawigacja

Panel buduje działy, harmonijki i karty z aktywnego Markdownu. Wyszukiwarka filtruje nazwy i opisy bez przeładowania strony; klawisz `/` przenosi do pola wyszukiwania. Po kliknięciu działu, ręcznym przewijaniu, zmianie hasha albo dojściu do końca strony właściwa pozycja menu jest zaznaczana od razu. Sekcje ukryte przez wyszukiwanie nie wpływają na wybór aktywnej pozycji.

Na komputerze przycisk menu całkowicie chowa sidebar i zapamiętuje stan w `localStorage` pod kluczem `chem.sidebar`. Sama kolumna pozostaje przewijalna kółkiem, gładzikiem i klawiaturą, ale jej wewnętrzny scrollbar jest wizualnie ukryty. Na ekranach mobilnych ten sam przycisk otwiera menu jako warstwę nad treścią. Motyw jasny lub ciemny jest wspólny dla dashboardu, stron płatności i aplikacji modułów; wybór trafia do `chem.theme`, a bez zapisanego wyboru używane jest ustawienie systemowe. Zmiana w jednej karcie jest przekazywana pozostałym otwartym kartom przez zdarzenie `storage`.

Wspólna paleta obejmuje interfejs należący do ChemDisk. Zawartość zewnętrznego iframe — między innymi tldraw, NumWorks, Google i YouTube — jest dokumentem innego dostawcy i nie może zostać przemalowana przez CSS aplikacji.

Każda chroniona aplikacja modułu czeka na zakończenie pierwszej kontroli `ChemAuth.ready`. Przy chwilowej niedostępności Identity klient może zachować wcześniej aktywny stan lokalny, dlatego ostateczną granicą dostępu pozostają reguły ról CDN oraz ponowna autoryzacja wykonywana przez chronione Functions. Zewnętrzne iframe, odtwarzacze i API nie są uruchamiane, gdy kontrola zwróci brak aktywnej sesji.

## Uruchomienie lokalne

Wymagane są Node.js 20.12.2 lub nowszy oraz npm (zgodnie z wymaganiami aktualnego Netlify CLI).

```bash
npm install
```

Przy pierwszym uruchomieniu zaloguj CLI i połącz katalog wyłącznie z przygotowaną witryną testową:

```bash
npx netlify login
npx netlify link
npm run dev
```

`netlify link` dostarcza lokalnym Functions kontekst witryny i Identity. Bez poprawnie powiązanej witryny zakładki administracyjne mogą zakończyć się bezpiecznym błędem `503`, ponieważ nie otrzymają `clientContext.identity` ani tokena operatora. `npm run dev` uruchamia `netlify dev`, dzięki czemu jednocześnie działają statyczne strony, przekierowania i funkcje. Samo otwarcie pliku `public/index.html` z dysku nie odtworzy zachowania Netlify Identity ani Functions.

Dla lokalnego czatu, zakładek administratora, edytora dashboardu i Stripe skopiuj `.env.example` jako nieśledzony plik `.env`:

```bash
cp .env.example .env
```

```dotenv
GEMINI_API_KEY=klucz_z_Google_AI_Studio
NETLIFY_API_TOKEN=osobisty_token_Netlify
SITE_ID=id_witryny_Netlify
GITHUB_CONTENT_TOKEN=github_pat_...
GITHUB_CONTENT_REPOSITORIES=
GITHUB_CONTENT_REPOSITORY=Kuczis-Media/chemdisk-content
GITHUB_CONTENT_REF=main
GITHUB_CONTENT_ROOT=
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Nie umieszczaj kluczy w `public`, plikach JavaScript przeglądarki, `dashboard.md` ani `netlify.toml`. `GITHUB_CONTENT_TOKEN` jest używany wyłącznie przez Functions i nigdy nie jest zwracany do przeglądarki. `SITE_ID` jest ustawiane automatycznie na wdrożeniu Netlify; ręcznie jest potrzebne tylko lokalnie.

`SITE_ID` i `NETLIFY_API_TOKEN` wskazują konkretną witrynę oraz jej site-wide Blobs. Jeżeli wpiszesz w lokalnym `.env` dane produkcyjne, funkcje uruchomione przez `netlify dev` mogą odczytać lub zmienić prawdziwy dashboard, konfigurację cen i księgi zakupów. Do prób administracyjnych i Stripe używaj osobnej witryny testowej z osobnym Identity, Blobs oraz kluczami Stripe test mode. Samo uruchomienie lokalne nie izoluje magazynów otwieranych z jawnymi poświadczeniami.

## Wdrożenie na Netlify

1. Utwórz witrynę z tego repozytorium. Ustawienia publikacji i funkcji są już zapisane w `netlify.toml` (`public` oraz `netlify/functions`).
2. Włącz Netlify Identity. W ustawieniach rejestracji wybierz rejestrację otwartą albo tylko na zaproszenie, zależnie od sposobu sprzedaży kursu. Jeśli wymagane jest potwierdzenie e-maila, pozostaw włączone wiadomości potwierdzające.
3. Dodaj `GEMINI_API_KEY` oraz `NETLIFY_API_TOKEN` w zmiennych środowiskowych witryny i ustaw ich zakres na **Functions**. Token Netlify umożliwia zakładce administracyjnej obsługę zgłoszeń Forms oraz silnie spójny dostęp do Netlify Blobs (dashboard, ceny i księgi zakupów); traktuj go jak sekret. Musi należeć do konta mającego dostęp do witryny wskazanej przez `SITE_ID`. `SITE_ID` Netlify ustawia automatycznie na deployu.
4. Utwórz i podłącz prywatne repozytorium lub repozytoria materiałów według instrukcji poniżej. Zmienne `GITHUB_CONTENT_*` również ustaw z zakresem **Functions**.
5. Skonfiguruj Stripe według osobnej instrukcji poniżej i dodaj `STRIPE_SECRET_KEY` oraz `STRIPE_WEBHOOK_SECRET` z zakresem **Functions**. Klucze live ogranicz do kontekstu Production; Preview/Branch powinny otrzymywać wyłącznie dane Stripe test mode i poświadczenia osobnej witryny testowej.
6. Pierwszemu administratorowi przypisz ręcznie rolę `admin` w `app_metadata` w panelu Netlify Identity. Kolejnymi kontami można już zarządzać z panelu administratora w dashboardzie.
7. Nowe konto bez roli może się uwierzytelnić i zobaczy cennik, ale nie otworzy `/members/`. Po udanej płatności rola i dokładny termin są nadawane automatycznie. Administrator nadal może przyznać dostęp ręcznie.
8. Udostępnij osadzane pliki Google odbiorcom, którzy mają je oglądać. Aplikacja nie omija uprawnień Dysku, Prezentacji ani Formularzy Google.
9. Jeżeli używasz własnej domeny, ustaw ją jako główną domenę witryny, włącz HTTPS i sprawdź na niej link potwierdzający oraz zaproszenie Identity. Kod korzysta ze ścieżek same-origin i `location.origin`, więc nie wymaga zamiany `chemdisk.netlify.app` na `chemdisk.pl` w plikach.
10. Po pierwszym deployu sprawdź logowanie, pięć zakładek panelu administratora, status biblioteki materiałów, testową płatność, formularz kontaktowy, czat oraz po jednym materiale Google i YouTube na docelowej domenie.

Deploy Preview tej samej witryny może widzieć site-wide store `chemdisk-dashboard` oraz `chemdisk-payments`, jeśli udostępnisz mu produkcyjny token i `SITE_ID`. Publikacja dashboardu, edycja cen, usuwanie użytkownika lub test Checkoutu z takiego podglądu mogą zmienić realne dane. Nie wykonuj mutacji administracyjnych na Preview podłączonym do produkcyjnych Blobs.

Po rotacji `NETLIFY_API_TOKEN` zaktualizuj zmienną środowiskową i wykonaj deploy Functions. Token służy również do podpisywania krótkotrwałych uprawnień kasowania zgłoszeń Forms, więc wcześniej otwarta akcja usuwania wygaśnie i trzeba ponownie pobrać listę — nie powoduje to utraty zgłoszenia.

Dodanie `chemdisk.pl` jako domeny własnej do tej samej witryny nie zmienia danych. Utworzenie całkiem nowej witryny Netlify to migracja, nie sama zmiana domeny: użytkownicy Identity, zgłoszenia Forms i site-wide Blobs nie są automatycznie kopiowane między witrynami.

W logu deployu sprawdź również etap post-processingu: Netlify powinien potwierdzić regułę limitu wywołań funkcji `chat`. Platformowy limit per IP jest uzupełniony limitem per konto wewnątrz funkcji.

Formularz kontaktowy jest oznaczony `data-netlify="true"` i korzysta z Netlify Forms oraz reCAPTCHA. Netlify musi przetworzyć stronę podczas deployu, aby formularz pojawił się w panelu witryny.

## Prywatne repozytoria materiałów

Lekcje i prompty AI mają osobne źródło prawdy — jedno lub kilka prywatnych repozytoriów GitHub, niezależnych od kodu i deployu aplikacji. Każde repozytorium ma taką samą strukturę:

```text
chemdisk-content/
├── catalog.json
├── lessons/
│   └── nazwa-lekcji.md
└── prompts/
    ├── nazwa-promptu.json
    └── zestaw-promptow.txt
```

`catalog.json` jest opcjonalny. Pozwala nadać plikom tytuły, opisy i tagi używane przez wyszukiwarki dashboardu, odtwarzacza lekcji i Studio:

```json
{
  "assets": {
    "lessons/izotopy-wegla.md": {
      "title": "Izotopy węgla",
      "description": "Lekcja o zapisie izotopowym i neutronach.",
      "tags": ["atom", "matura"]
    }
  }
}
```

Konfiguracja krok po kroku:

1. Utwórz prywatne repozytorium, np. `Kuczis-Media/chemdisk-content`, z gałęzią `main`. W tym katalogu roboczym gotowy zalążek osobnego repo znajduje się w `chemdisk-content/`; katalog jest ignorowany przez repo aplikacji.

   ```bash
   cd chemdisk-content
   git remote add origin git@github.com:Kuczis-Media/chemdisk-content.git
   git push -u origin main
   ```

2. Na GitHubie otwórz **Settings → Developer settings → Personal access tokens → Fine-grained tokens** i utwórz token ograniczony wyłącznie do repozytoriów materiałów:
   - w **Repository access** wybierz **Only select repositories** i wskaż tylko repozytoria, które mają pojawić się w selektorze;
   - w **Repository permissions** ustaw wyłącznie **Contents: Read and write**;
   - pozostałych uprawnień nie rozszerzaj i nie wybieraj dostępu do wszystkich repozytoriów.

   Jeden fine-grained token może obejmować kilka jawnie wybranych repozytoriów tego samego właściciela zasobów. Uprawnienie zapisu jest potrzebne tylko funkcji serwerowej obsługującej Lesson Builder i Prompt Builder. Token nadal nie daje dostępu do pozostałych repozytoriów konta.
3. W Netlify otwórz ustawienia witryny i dodaj poniższe zmienne środowiskowe z zakresem **Functions**:

   ```dotenv
   GITHUB_CONTENT_TOKEN=github_pat_...
   GITHUB_CONTENT_REPOSITORY=Kuczis-Media/chemdisk-content
   GITHUB_CONTENT_REF=main
   GITHUB_CONTENT_ROOT=
   ```

   `GITHUB_CONTENT_ROOT` pozostaw pusty, jeśli `lessons`, `prompts` i `catalog.json` leżą w katalogu głównym. Dla monorepo można ustawić np. `materials`.
4. Dla kilku repozytoriów pozostaw `GITHUB_CONTENT_TOKEN` i zamiast trzech zmiennych opisujących pojedyncze repo ustaw jedną listę JSON:

   ```dotenv
   GITHUB_CONTENT_TOKEN=github_pat_...
   GITHUB_CONTENT_REPOSITORIES=[{"id":"glowne","label":"Materiały główne","repository":"Kuczis-Media/chemdisk-content","ref":"main","root":"","default":true},{"id":"organiczna","label":"Chemia organiczna","repository":"Kuczis-Media/chemia-organiczna","ref":"main","root":""}]
   ```

   `id` jest trwałym identyfikatorem zapisywanym w linkach jako `repo=...`; używaj małych liter, cyfr i myślników. `label` to nazwa widoczna w selektorze. Jedna pozycja może mieć `default: true`; bez tego domyślna jest pierwsza. Lista obsługuje najwyżej 20 repozytoriów.

   Jeśli repozytoria należą do różnych właścicieli zasobów, utwórz osobne, równie wąskie tokeny. Drugi zapisz np. jako `GITHUB_CONTENT_TOKEN_SZKOLA`, a w odpowiedniej pozycji listy dodaj `"tokenEnv":"GITHUB_CONTENT_TOKEN_SZKOLA"`. Nazwa wskazanej zmiennej musi zaczynać się od `GITHUB_CONTENT_TOKEN`.
5. Wykonaj jeden deploy Functions po dodaniu lub zmianie zmiennych środowiskowych. Następnie w dashboardzie administratora otwórz zakładkę **Materiały**, wybierz każde repozytorium i sprawdź liczbę znalezionych plików.

Późniejsze dodanie, poprawienie lub usunięcie pliku w repo materiałów — przez GitHub albo Studio — nie wymaga deployu ani ponownego commitu aplikacji. Lista jest pobierana na żywo przez GitHub Contents API i trzymana w pamięci funkcji najwyżej przez 20 sekund; administrator może wymusić odświeżenie w zakładce **Materiały**. Odtwarzacz lekcji pobiera wskazany plik przy otwarciu.

Przeglądarka nigdy nie otrzymuje tokenu GitHub. Kursant po sprawdzeniu aktywnego dostępu może pobrać treść lekcji, ponieważ musi ją wyświetlić, ale nie może zapisywać ani usuwać plików. Lista i treść promptów są dostępne w bibliotece tylko administratorowi, aby Prompt Builder mógł je edytować; zwykły moduł czatu nadal pobiera wybrany prompt po stronie funkcji `chat` i nie wysyła go kursantowi.

Dozwolone są lekcje `.md` do 512 KiB oraz prompty `.txt` i `.json` do 256 KiB. Nazwa pliku nie może zawierać ścieżki, `..` ani niedozwolonych znaków. `catalog.json` ma limit 256 KiB. Po rotacji tokenu zaktualizuj `GITHUB_CONTENT_TOKEN` w Netlify i ponownie wdróż Functions.

Te same repozytoria materiałów mogą zasilać inne wdrożenie ChemDisk: skopiuj do niego moduł `netlify/content-repository.js`, funkcję `content-library`, klienta `public/assets/js/content-library.js` i ustaw tę samą konfigurację `GITHUB_CONTENT_*`. Klient domyślnie używa chronionej funkcji w tej samej domenie. Jeśli aplikacja ma własny zgodny endpoint, można wskazać go w `<head>` przez:

```html
<meta name="chemdisk-content-endpoint" content="/.netlify/functions/content-library">
```

Celowo nie ma bezpośrednich zapytań z przeglądarki do prywatnego GitHuba ani domyślnie otwartego endpointu między domenami. Dzięki temu token i kontrola dostępu pozostają po stronie każdej aplikacji.

## Konfiguracja Stripe

Integracja sprzedaje **jednorazowe pakiety czasu**, a nie automatycznie odnawiane subskrypcje Stripe Billing. Administrator może udostępnić godzinę, dzień, tydzień, miesiąc, pół roku albo rok. Zakup odbywa się na osobnej stronie `/purchase/`, otwieranej w panelu kursanta przez **Kup lub przedłuż**.

Checkout jest skonfigurowany dla metody `card`. Kod nie włącza obecnie BLIK-a, przelewów bankowych ani innych asynchronicznych metod płatności, niezależnie od tego, co jest dostępne globalnie na koncie Stripe.

Domyślna konfiguracja:

| Pakiet | Czas | Cena startowa | Domyślnie w ofercie |
| --- | ---: | ---: | --- |
| Godzina | 1 godzina | 5 zł | Nie |
| Dzień | 24 godziny | 15 zł | Nie |
| Tydzień | 7 dni | 30 zł | Tak |
| Miesiąc | 30 dni | 50 zł | Tak |
| Pół roku | 182 dni | 300 zł | Tak |
| Rok | 365 dni | 500 zł | Tak |

### Tryb testowy

1. Otwórz [Stripe Dashboard](https://dashboard.stripe.com/) i przełącz konto na środowisko testowe/sandbox.
2. W **Developers → API keys** skopiuj tajny klucz testowy zaczynający się od `sk_test_`. Nie używaj publishable key `pk_test_` jako `STRIPE_SECRET_KEY`.
3. W Netlify dodaj zmienną `STRIPE_SECRET_KEY=sk_test_...` z zakresem **Functions**.
4. Wykonaj deploy, aby publiczny adres funkcji webhook już istniał.
5. W Stripe, w **Developers → Webhooks / Event destinations**, dodaj endpoint:

   ```text
   https://TWOJA-DOMENA/.netlify/functions/stripe-webhook
   ```

6. Zaznacz zdarzenia:

   ```text
   checkout.session.completed
   checkout.session.async_payment_succeeded
   ```

7. Otwórz utworzony endpoint, odsłoń signing secret zaczynający się od `whsec_` i zapisz go w Netlify jako `STRIPE_WEBHOOK_SECRET` z zakresem **Functions**.
8. Uruchom ponowny deploy. W panelu administratora otwórz **Płatności**. Komunikat powinien potwierdzić tryb testowy.

Do udanej płatności testowej użyj:

```text
Numer karty: 4242 4242 4242 4242
Data ważności: dowolny przyszły miesiąc i rok
CVC: dowolne 3 cyfry
Kod pocztowy: dowolny poprawny kod
```

Przydatne scenariusze testowe Stripe:

| Karta | Wynik |
| --- | --- |
| `4242 4242 4242 4242` | Płatność udana. |
| `4000 0000 0000 9995` | Odrzucenie z powodu braku środków. |
| `4000 0025 0000 3155` | Przepływ wymagający uwierzytelnienia 3D Secure. |

W trybie testowym nie używaj prawdziwych danych kart. Oficjalne scenariusze są opisane w [dokumentacji testów Stripe](https://docs.stripe.com/testing).

Po udanej próbie sprawdź w Stripe **Event deliveries**, czy właściwe zdarzenie zakończyło się odpowiedzią HTTP `200`, a w logach Netlify Functions — czy `stripe-webhook` nie zgłosił błędu. Następnie potwierdź rolę użytkownika oraz wpis w historii płatności ChemDisk. Odpowiedź `5xx` oznacza, że trzeba usunąć przyczynę i ponowić dostarczenie zdarzenia w Stripe. Nie polegaj wyłącznie na powrocie przeglądarki: `payment-success` jest kontrolnym fallbackiem tylko wtedy, gdy kupujący faktycznie wróci z Checkout.

### Test webhooka lokalnie

Zainstaluj Stripe CLI, zaloguj się i w osobnym terminalu uruchom:

```bash
stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook
```

CLI wyświetli tymczasowy sekret `whsec_...`. Wpisz właśnie ten sekret do lokalnego `.env` jako `STRIPE_WEBHOOK_SECRET` (sekret CLI jest inny niż sekret produkcyjnego endpointu), a potem uruchom:

```bash
npm run dev
```

Lokalny Checkout musi dostać działający kontekst Netlify Identity oraz konfigurację `NETLIFY_API_TOKEN` i `SITE_ID`, ponieważ historia i blokada przed podwójną realizacją są przechowywane w Netlify Blobs.

### Przejście na prawdziwe płatności

Tryb testowy i produkcyjny Stripe mają osobne klucze, webhooki oraz transakcje.

1. Dokończ aktywację konta Stripe i wymagane dane firmy.
2. Przełącz Dashboard Stripe na tryb live.
3. Podmień w Netlify `STRIPE_SECRET_KEY` na `sk_live_...`.
4. Utwórz osobny webhook live dla tego samego adresu funkcji i podmień `STRIPE_WEBHOOK_SECRET` na jego sekret.
5. Wykonaj deploy i przeprowadź małą prawdziwą transakcję kontrolną.

Nigdy nie kopiuj `sk_*` ani `whsec_*` do plików w `public`, kodu przeglądarki, repozytorium lub wiadomości błędu.

### Ceny, księga zakupów i bezpieczeństwo

Ceny i ofertę edytuje administrator w zakładce **Płatności**. Może tam:

- ustawić ceny wszystkich sześciu okresów;
- zaznaczyć, które okresy są aktualnie dostępne;
- wybrać PLN, EUR, USD, GBP, CHF, CZK, CAD albo AUD;
- globalnie wyłączyć i ponownie włączyć rozpoczynanie płatności;
- włączyć blokadę dokupowania przy aktywnym dostępie.

Zmiana waluty nie przelicza automatycznie wpisanych liczb — po wybraniu nowej waluty administrator powinien ustawić odpowiednie ceny i zapisać cały formularz. Aplikacja przekazuje do Stripe `price_data` obliczone wyłącznie na serwerze; kwota, waluta ani dostępność pakietu z przeglądarki nie są przyjmowane jako źródło prawdy. Zmiany dotyczą nowych Checkout Sessions. Poprzednia transakcja nadal zachowuje w Stripe i historii ChemDisk kwotę oraz walutę z chwili zakupu.

Stripe Dashboard nie jest źródłem aktualnego cennika tej aplikacji. Zmiana przypadkowego Price w katalogu Stripe nie zmieni kart cenowych ChemDisk. Dzięki temu administrator nie musi kopiować nowych `price_...` po każdej zmianie kwoty.

Księga użytkownika jest zapisywana w site-wide magazynie Netlify Blobs `chemdisk-payments`. Każdy zapis używa warunku ETag. Historia przechowuje maksymalnie 100 najnowszych zakupów i operacji administracyjnych; starsze pozycje są automatycznie usuwane, a pojedynczy znacznik czasu nadal chroni przed ponownym naliczeniem starej Checkout Session. Dane transakcji pozostają niezależnie w Stripe.

Usunięcie konta nie jest jedną transakcją obejmującą Identity i Blobs. Funkcja najpierw usuwa użytkownika z Identity, a następnie próbuje usunąć jego księgę. Jeśli pojawi się `PAYMENT_HISTORY_DELETE_FAILED` z `identityDeleted: true`, zachowaj zwrócone ID użytkownika i ponów akcję **Usuń konto**; endpoint potrafi dokończyć czyszczenie także wtedy, gdy rekord Identity już nie istnieje. Do czasu skutecznego ponowienia w Blobs może pozostawać osierocona księga.

Globalne wyłączenie płatności pozostawia ofertę i ceny widoczne, ale dezaktywuje przyciski zakupu, a serwer odrzuca każdą próbę utworzenia Checkout. Ponowne włączenie nie wymaga zmiany kluczy Stripe.

Gdy sumowanie jest włączone, kolejny zakup jest dołączany do późniejszej z dat: bieżący termin wygaśnięcia lub chwila zakupu. Gdy administrator włączy blokadę dokupowania, serwer nie utworzy Checkout użytkownikowi mającemu aktywny dostęp; następny zakup będzie możliwy dopiero po wygaśnięciu obecnego okresu.

Webhook jest głównym mechanizmem nadawania dostępu. Strona `/payment-success/` wykonuje dodatkową, uwierzytelnioną weryfikację jako bezpieczny fallback i odświeża JWT z nową rolą. Samo wejście pod adres sukcesu bez opłaconej sesji niczego nie przyznaje.

Odebranie płatnego dostępu w panelu administratora zapisuje zdarzenie w historii i natychmiast wygasza rolę, ale **nie wykonuje zwrotu pieniędzy**. Ewentualny refund wykonuje się osobno przy właściwej płatności w Stripe Dashboard.

## Identity, role i dostęp

Jedynym źródłem uprawnień jest `app_metadata`. `user_metadata` jest edytowalne przez użytkownika i służy wyłącznie do danych profilu — nigdy nie wolno na jego podstawie przyznawać dostępu.

Przykład metadanych nadanych z panelu Identity lub Admin API:

```json
{
  "app_metadata": {
    "roles": ["week"]
  }
}
```

Nie ustawiaj ręcznie `session_id` ani `timed_access`; zarządza nimi funkcja `identity-login`. Pole `app_metadata.status` jest obsługiwane tylko dla zgodności ze starszą konfiguracją, ale nowe konta należy aktywować rolami.

| Rola | Znaczenie |
| --- | --- |
| `admin` | Stały dostęp administracyjny. |
| `active` | Stały dostęp kursanta. |
| `hour` | Dostęp przez 1 godzinę. |
| `day` | Dostęp przez 24 godziny. |
| `week` | Dostęp przez 7 dni. |
| `month` | Dostęp przez 30 dni. |
| `halfyear` | Dostęp przez 182 dni. |
| `year` | Dostęp przez 365 dni. |

Okres roli czasowej przypisanej **ręcznie** zaczyna się przy pierwszym udanym logowaniu po jej przypisaniu. Okres kupiony przez Stripe zaczyna się po potwierdzeniu płatności i ma od razu dokładny termin wygaśnięcia. Ponowne logowanie nie przedłuża żadnego działającego okresu. Po wygaśnięciu klient blokuje dostęp, a przy kolejnym logowaniu hook usuwa wygasłą rolę.

`netlify.toml` przepuszcza do `/members` i `/members/*` wyłącznie JWT z jedną z powyższych ról. Funkcja czatu dodatkowo sprawdza aktualny czas wygaśnięcia roli.

### Jedna aktywna sesja

Przy każdym udanym logowaniu konta z dostępem `identity-login` zapisuje nowy `app_metadata.session_id`. Zalogowana przeglądarka porównuje swój identyfikator z bieżącym kontem mniej więcej co 30 sekund oraz po powrocie do karty lub odzyskaniu sieci. Gdy inne urządzenie się zaloguje, starsza sesja jest lokalnie zamykana. Moduły czekają z uruchomieniem zewnętrznych iframe i API na wynik pierwszej kontroli. Funkcja czatu i funkcje administracyjne również porównują identyfikator po stronie serwera i odrzucają token poprzedniego urządzenia.

Monitor pomija ukryte karty, aby kilka kart tej samej przeglądarki nie próbowało jednocześnie odświeżać tokenu po uśpieniu komputera. Widoczna karta ponawia kontrolę po `focus`, `online`, `pageshow` i wybudzeniu. Chwilowy brak sieci, timeout Identity albo nieudane odświeżenie ciasteczka nie powodują samodzielnie wylogowania poprawnej sesji; aplikacja zachowuje stan i próbuje ponownie. Wylogowanie następuje dopiero po potwierdzonym zastąpieniu sesji, braku aktywnego dostępu albo świadomej akcji użytkownika.

„Jedna aktywna sesja” oznacza ostatnie poprawne logowanie, a nie jedną kartę. Karty w tym samym profilu przeglądarki współdzielą dane GoTrue i `localStorage`; starsza karta przed wyczyszczeniem stanu ponownie sprawdza, czy inna karta nie zapisała już nowszej sesji.

Ważne ograniczenie: statyczny CDN Netlify sprawdza role znajdujące się w już wydanym JWT, ale nie odpytuje bazy Identity o aktualny `session_id` przy każdym pliku. Dlatego wcześniej wydany token może nadal przejść samą regułę CDN do czasu jego wygaśnięcia, choć zwykły interfejs wyloguje starą kartę po kontroli sesji. Zmiana roli również staje się w pełni widoczna po odświeżeniu lub ponownym wydaniu tokenu.

Jeśli każdy pojedynczy zasób ma wymagać natychmiastowej, serwerowej weryfikacji jednej sesji, nie może być podawany bezpośrednio jako statyczny plik. Trzeba go obsłużyć przez Function/Edge Function albo osobny backend, który przy każdym żądaniu sprawdza bieżący stan konta.

## Profil kursanta

Interfejs rejestracji, przyjmowania zaproszenia i resetowania hasła w ChemDisk wymaga co najmniej 10 znaków. Jest to walidacja po stronie tej aplikacji; niezależną, serwerową politykę haseł konfiguruje Netlify Identity. Hook `identity-signup` nie ocenia siły hasła — normalizuje imię i nazwisko trafiające do `user_metadata` oraz usuwa z tych metadanych pola wyglądające jak uprawnienia.

W Identity zapisywane są zgodne pola `first_name`, `last_name`, `full_name` i `name`. Dashboard pokazuje nazwę oraz inicjały konta. Zalogowany użytkownik może kliknąć swoją kartę konta i zmienić imię oraz nazwisko. Zmiana własnego profilu nie zmienia roli, czasu dostępu ani aktywnej sesji.

## Panel administratora

Przycisk **Panel administratora** pojawia się w bocznym menu wyłącznie dla konta mającego aktualną rolę `admin`. Panel pozwala:

- zaprosić konto przez e-mail bez ustawiania lub poznawania hasła użytkownika;
- wyszukać użytkownika po imieniu, nazwisku albo e-mailu;
- poprawić imię i nazwisko zapisane w `user_metadata`;
- wybrać brak dostępu, stały dostęp albo dokładnie jeden okres czasowy;
- dodatkowo przyznać rolę `admin`;
- trwale usunąć inne konto (własne konto administratora jest chronione);
- przeglądać datę i czas utworzenia konta, ostatnie logowanie i pozostały czas;
- rozwijać pojedyncze konta zamiast renderować wszystkie formularze naraz;
- przeglądać historię zakupów Stripe i operacji odebrania dostępu;
- odebrać płatny dostęp bez automatycznego wykonywania refundu;
- ustawić ceny i dostępność sześciu pakietów, walutę, globalny stan płatności oraz zasadę sumowania okresów;
- przeglądać i trwale usuwać zgłoszenia Netlify Forms;
- edytować, podglądać, publikować i przywracać Markdown dashboardu;
- sprawdzić konfigurację prywatnego repo materiałów oraz liczbę lekcji i promptów bez ujawniania tokenu;
- obsłużyć całą listę użytkowników dzięki stronicowaniu.

Interfejs wysyła JWT zalogowanego administratora do `/.netlify/functions/admin-users`. Funkcja ponownie pobiera aktualny rekord administratora z Identity, dopiero wtedy używa dostarczonego przez środowisko Netlify krótkotrwałego tokena operatora do listowania lub aktualizacji kont. Token operatora nigdy nie jest zwracany do przeglądarki. Funkcja blokuje odebranie sobie własnej roli administratora i zachowuje `session_id` oraz niezwiązane metadane konta.

Przy rzeczywistej zmianie roli stare `timed_access` jest czyszczone. Nowa rola czasowa rozpoczyna okres przy następnym logowaniu użytkownika. Sama poprawka imienia lub nazwiska z pozostawioną aktywną rolą czasową nie zeruje jej bieżącego terminu. Zmiany ról są w pełni widoczne po odświeżeniu tokenu albo ponownym logowaniu.

Panel pokazuje termin aktywnej roli czasowej. Po wygaśnięciu roli nadanej ręcznie pojawia się jawna akcja **Odnów ten okres**; dopiero ona przygotowuje nowy okres do uruchomienia przy kolejnym logowaniu. Dostęp kupiony przedłuża się przez kolejny Checkout. Zwykłe zapisanie nazwiska nie odnawia dostępu przypadkiem.

Panel administracyjny wymaga środowiska Netlify Functions (`netlify dev` lub deployu), ponieważ lokalne otwarcie statycznego HTML nie dostarcza serwerowego kontekstu Identity. Jeśli kontekst administratora Identity nie jest dostępny, endpoint kończy żądanie bezpiecznym błędem `503` zamiast wykonywać operację bez weryfikacji.

Zakładka **Formularze** pokazuje formularze przetworzone przez Netlify Forms, np. `members-contact` oraz publiczny `contact`. Nie pobiera odpowiedzi z osadzonych Google Forms — te pozostają w Google Forms/Sheets. Panel stronicuje odpowiedzi po 50 i wczytuje maksymalnie 100 stron; po przekroczeniu tego zakresu przerywa z jawnym błędem zamiast pokazywać niepełną listę. Każde usunięcie wymaga potwierdzenia, a funkcja wydaje dla konkretnego zgłoszenia podpisany token ważny przez 15 minut. Po jego wygaśnięciu odśwież listę przed ponowieniem; `NETLIFY_API_TOKEN` nigdy nie trafia do przeglądarki.

## Edycja dashboardu

Wersją bazową jest `public/members/dashboard.md`. Administrator może również zapisać aktywną wersję w zakładce **Dashboard** bez wykonywania deployu. Jest ona przechowywana w Netlify Blobs, a zapis używa kontroli wersji (`etag`) i silnie spójnego dostępu przez serwerowe `NETLIFY_API_TOKEN` oraz `SITE_ID`, aby dwóch administratorów nie nadpisało sobie zmian po cichu. Sekretny token nie jest wysyłany do przeglądarki. Przycisk przywracania atomowo dezaktywuje override i ponownie aktywuje plik z wdrożenia.

Aplikacja ma dwa interfejsy dla tego samego aktywnego klucza:

- zakładka **Dashboard** w panelu administratora służy do bezpośredniej edycji Markdownu, podglądu, publikacji i przywracania pliku z wdrożenia;
- **Dashboard Builder** w Studio zamienia obsługiwany Markdown na graficzne klocki, pozwala importować plik i publikować, ale nie ma akcji przywracania wersji statycznej.

Przywracanie wykonuj wyłącznie z zakładki administratora. Oba edytory używają tego samego `etag`, więc otwarcie ich równocześnie może prawidłowo zakończyć starszą publikację konfliktem `409`.

Panel kursanta najpierw próbuje pobrać aktywną wersję z funkcji, a gdy jej nie ma lub magazyn jest chwilowo niedostępny, bezpiecznie wraca do `dashboard.md`. Nie trzeba zmieniać `index.html`.

Jeżeli administrator nie opublikował własnej wersji, kursanci widzą pełny bazowy `dashboard.md` ze wszystkimi przykładowymi materiałami i narzędziami. Przy pierwszym otwarciu edytora administrator dostaje czysty szablon zawierający tylko ekran Start oraz sekcję **Pomoc i konto**. Dopiero kliknięcie **Opublikuj zmiany** zapisuje ten szablon jako aktywną wersję i ukrywa bazowe materiały. Nagłówek **Pomoc i konto** jest obowiązkowy: jeżeli nie występuje, aplikacja dołącza cały domyślny szablon sekcji. Jeżeli autor utworzył już taki nagłówek, jego własna treść jest zachowywana i brakujące domyślne linki nie są dopisywane pojedynczo. Akcja **Przywróć plik z wdrożenia** dezaktywuje override, omija starą kopię z pamięci podręcznej i ponownie pokazuje pełny dashboard bazowy.

Magazyn `chemdisk-dashboard` jest site-wide i pozostaje po kolejnych wdrożeniach. Deploy Preview tej samej witryny również może zobaczyć ten magazyn, dlatego nie publikuj zmian z podglądu, jeśli nie mają trafić do produkcyjnego dashboardu.

Uwaga na pracę lokalną: `admin-dashboard` celowo otwiera magazyn z jawnymi `SITE_ID` i `NETLIFY_API_TOKEN`, aby uzyskać silną spójność. Jeżeli lokalny `.env` wskazuje produkcyjną witrynę, `netlify dev` może odczytać i zmienić jej site-wide Blobs. Do prób zapisu używaj osobnej witryny testowej i jej danych albo nie wykonuj mutacji z lokalnego środowiska. Lokalny sandbox Blobs nie zastępuje magazynu wskazanego jawnymi poświadczeniami.

Aktywna treść znajduje się pod jednym kluczem `dashboard.md` i może mieć maksymalnie 256 KiB po dołączeniu obowiązkowej sekcji pomocy. Otwarcie lub odświeżenie panelu wykonuje jeden chroniony `GET` do `admin-dashboard`, jedną kanoniczną kontrolę Identity i jeden silnie spójny odczyt Bloba. Dashboard nie odpytuje Blobs cyklicznie — pozostawienie otwartej strony nie pobiera ponownie Markdownu. Jeżeli override nie istnieje, klient wykonuje dodatkowy odczyt statycznego `/members/dashboard.md`.

Udana publikacja to jedno żądanie `PUT`. Funkcja odczytuje metadane bieżącej wersji, wykonuje zapis warunkowy i odczyt kontrolny, po czym zwraca treść oraz nowy `etag`. Przywracanie zapisuje wersjonowany tombstone zamiast wykonywać niekontrolowane usunięcie; następnie klient pobiera plik statyczny. Żadna z tych operacji nie uruchamia production deployu.

### Blobs i kredyty Netlify

W aktualnej tabeli metered billing Netlify Blobs nie występuje jako osobny miernik miejsca ani pojedynczych operacji `get`/`set`. Z tego wynika, że w tej architekturze koszt dostępu do Blobs powstaje pośrednio przez:

- web request do Function;
- czas działania Function, obejmujący kontrolę Identity i komunikację z Blobs;
- transfer odpowiedzi JSON z Markdownem do przeglądarki;
- pozostałe pliki i żądania całej strony, które nie są kosztem samego Bloba.

Aktualna tabela planów kredytowych podaje:

| Miernik | Zużycie |
| --- | ---: |
| Udany production deploy | 15 kredytów |
| Deploy Preview, branch deploy, nieudany deploy lub rollback | 0 kredytów |
| Compute Functions | 10 kredytów za GB-godzinę |
| Web bandwidth | 20 kredytów za GB |
| Web requests | 2 kredyty za 10 000 żądań |

Plan Free zawiera 300 kredytów miesięcznie i ma twardy limit, Personal — 1000, a Pro zaczyna się od 3000. Według bieżącej tabeli automatyczne doładowanie kosztuje w Personal 5 USD za 500 kredytów, a w Pro 10 USD za 1500 kredytów. Stawki i zasady mogą się zmieniać; przed szacowaniem ruchu sprawdź [aktualne zasady kredytów](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/), [naliczanie Functions](https://docs.netlify.com/build/functions/usage-and-billing/) oraz [dokumentację Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/). Konto Free, Starter lub Pro utworzone przed 4 września 2025 r. może nadal korzystać z planu Legacy, którego limity są rozliczane inaczej.

Zapis w Studio nie jest deployem, dlatego nie nalicza 15 kredytów przewidzianych dla production deployu. Zużywa jednak zwykłe żądanie i compute Function podczas publikowania dashboardu.

Ten sam model rozliczenia dotyczy publicznego pobrania cennika, utworzenia Checkout, webhooka, biblioteki materiałów oraz widoków historii: korzystają z Functions. Biblioteka wykonuje dodatkowo autoryzowany odczyt GitHub API. Roboczy zapis Lesson Buildera jest lokalny; pobranie listy lub import lekcji ze zdalnego repo używa Function, ale zapis draftu w przeglądarce nie używa Blobs.

### Trwałe dane, kopie i rollback

Kod w Git oraz deploy Netlify nie są kopią wszystkich danych aplikacji:

| System | Dane |
| --- | --- |
| Repozytorium/deploy aplikacji | Bazowy `public/members/dashboard.md`, pliki aplikacji i Functions. |
| Prywatne repo materiałów | Lekcje `lessons/*.md`, prompty `prompts/*.txt`/`*.json` i opcjonalny `catalog.json`. |
| Blob `chemdisk-dashboard` | Jeden aktywny klucz `dashboard.md` albo tombstone przywracający wersję bazową. |
| Blob `chemdisk-payments` | Cennik w `config/prices.json` i księgi `users/<uuid>.json`, po maksymalnie 100 ostatnich zdarzeń. |
| Netlify Identity | Konta, role, `timed_access`, profil i identyfikator ostatniej sesji. |
| Netlify Forms | Zgłoszenia formularzy ChemDisk. |
| Stripe | Checkout Sessions, płatności, zdarzenia i dane rozliczeniowe Stripe. |

Rollback deployu przywraca pliki oraz kod Functions z wybranego wdrożenia, ale nie cofa site-wide Blobs, Identity, Forms ani Stripe. `etag`, numer wersji i metadane `updatedAt`/`updatedBy` chronią przed przypadkowym nadpisaniem i ułatwiają diagnostykę; aplikacja nie udostępnia na ich podstawie historii poprzednich wersji. Akcja przywrócenia dashboardu aktywuje bieżący plik statyczny z deployu, a nie wcześniejszy override z Blobs.

Przed zmianą produkcyjnego dashboardu, cennika, migracją witryny albo masowym usuwaniem skopiuj aktywny Markdown do lokalnego pliku i wykonaj osobny eksport potrzebnych danych przez stronę **Blobs** w panelu Netlify, autoryzowane API/SDK lub panel właściwego dostawcy. Kopię trzymaj poza tą samą witryną. Lekcje i prompty nie są przechowywane w Blobs ani deployu aplikacji; ich źródłem prawdy, kopią i historią jest prywatne repozytorium materiałów.

### Graficzne Studio treści

Administrator widzi w bocznym menu dodatkowy skrót **Studio treści** prowadzący do `/members/module/studio/`. Reguły w `netlify.toml` chronią cały katalog Studio rolą `admin` przed ogólną regułą `/members/*`; samo ukrycie linku w interfejsie nie jest mechanizmem autoryzacji.

Studio ma trzy tryby:

- **Dashboard Builder** — przeciąganie sekcji, harmonijek poziomów 3–6, tekstów, komunikatów i kart modułów. Inspektor konfiguruje ID lub link materiału, wariant kalkulatora/tablicy, tryb ochrony `type`, plik lekcji, prompt czatu, notatkę kontaktową albo bezpieczny własny link. Selektor przełącza przeszukiwane repozytorium, a karta zapamiętuje jego `id`, więc identyczne nazwy plików nie kolidują;
- **Lesson Builder** — układanie slajdów oraz bloków nagłówka, tekstu, obrazu HTTPS, wideo YouTube, listy, cytatu, calloutu, kodu, stylowanej sekcji i harmonijki. Do slajdu można dodać pytanie tekstowe, liczbowe, wyboru, ABCD, luki z listą albo luki wpisywane ręcznie. Opcje quizu mają osobne pola i znacznik ✓ poprawnej odpowiedzi, a luki tworzy się przyciskiem bez ręcznego wpisywania składni. Lekcję można wyszukać, wczytać, zapisać, zaktualizować albo usunąć w repozytorium wybranym z listy;
- **Prompt Builder** — tworzenie pojedynczego promptu `.json` lub zestawu ponumerowanych instrukcji `.txt`. Builder waliduje numery punktów, limity treści i format, pokazuje gotowe źródło oraz obsługuje ten sam ręczny, repozytoryjny i wielorepozytoryjny obieg co lekcje.

#### Przepływ Dashboard Buildera

1. Kliknij **Wczytaj aktywny**, zanim zaczniesz publikować. Studio pobiera wtedy override z Blobs albo bazowy `dashboard.md` oraz zapamiętuje jego `etag`.
2. Edytuj klocki, ich ustawienia albo kod w oknie **Markdown**. Podgląd korzysta z tego samego modelu co eksport.
3. Kliknij **Opublikuj**. `PUT` używa zapamiętanego `etag`; Studio nie wykonuje automatycznie nowego `GET` tuż przed zapisem.
4. Jeżeli inna karta lub administrator zdążył opublikować nowszą wersję, serwer zwraca `409`. Nowszy dashboard nie zostaje nadpisany, a lokalny draft pozostaje w przeglądarce. Ponowne wczytanie aktywnej wersji zastępuje draft dopiero po potwierdzeniu użytkownika; Studio nie wykonuje automatycznego diffu ani scalania.

Import pliku dashboardu w Studio przyjmuje do 512 KiB, ale publikacja nadal ma twardy limit 256 KiB UTF-8. Walidacja wymaga tytułu, co najmniej jednego działu i jednej poprawnej karty, sprawdza typy ochrony, domeny Google/YouTube, nazwę pliku lekcji i bezpieczne adresy. Domyślny szablon **Pomoc i konto** jest dołączany, gdy w dokumencie nie ma nagłówka o tej nazwie.

Round-trip dashboardu zachowuje znaczenie składni obsługiwanej przez parser, lecz nie gwarantuje identycznego tekstu źródłowego. Komentarze i nadmiarowe puste linie są usuwane, formatowanie jest normalizowane, parametry URL mogą zostać ponownie zakodowane, a nieobsługiwana konstrukcja może zmienić się w zwykły tekst. Przed importem rozbudowanego, ręcznie pisanego pliku zachowaj jego kopię.

#### Przepływ Lesson Buildera

Lesson Builder może rozpocząć pustą lekcję albo zaimportować istniejący `.md`, zamienić go na edytowalne bloki i ponownie wygenerować deterministyczny Markdown. Dostępne są podgląd, edycja źródła, kopiowanie do schowka i pobranie pliku. Import pliku ma limit 512 KiB, edytor źródła przyjmuje do 524 288 znaków, lekcja może zawierać od 1 do 100 slajdów, a nazwa pliku musi kończyć się `.md`, zaczynać znakiem alfanumerycznym, mieć maksymalnie 80 znaków i nie może zawierać `..` ani ścieżki katalogu. Builder przyjmuje dla obrazów wyłącznie pełne adresy `https://`.

Ręczny obieg pozostaje zawsze dostępny: kliknij **Pobierz .md**, a następnie samodzielnie dodaj plik do `lessons/` w prywatnym repo i wykonaj commit. Możesz też wybrać repozytorium nad biblioteką i użyć przycisku **Zapisz w GitHubie**. Nowy plik tworzy commit, a wcześniej wczytany plik jest aktualizowany tylko wtedy, gdy jego SHA nie zmienił się od odczytu. Zmiana repozytorium albo nazwy wczytanego dokumentu tworzy nowy plik i pozostawia oryginał do osobnego usunięcia. **Usuń z GitHuba** jest aktywne wyłącznie dla repozytorium, z którego plik wczytano, wymaga potwierdzenia i także zapisuje zmianę jako commit; zawartość można odzyskać z historii repo.

Studio nie wykonuje cichego automatycznego zapisu do GitHuba. Autosave zapisuje wyłącznie lokalny draft, a operacja sieciowa następuje dopiero po kliknięciu przycisku repozytorium. Gdy inna karta albo osoba zmieni plik wcześniej, serwer zwraca konflikt zamiast nadpisywać nowszą wersję. Należy wtedy ponownie wczytać plik i świadomie połączyć zmiany.

Odtwarzacz lekcji odrzuca plik większy niż 512 KiB lub zawierający ponad 100 slajdów. Builder pilnuje liczby slajdów, lecz obecnie nie blokuje pobrania tylko dlatego, że wynikowy Markdown przekroczył limit bajtów odtwarzacza. Przed wysłaniem bardzo dużej lekcji sprawdź rozmiar, np. `wc -c lessons/nazwa.md`, i utrzymaj go poniżej 524 288 bajtów.

Na jednym slajdzie może znajdować się najwyżej jedno zadanie. Pytanie można dodać bezpośrednio z pustego slajdu, a następnie wpisać każdą opcję osobno i wskazać poprawną znakiem ✓. Quiz ABCD wymaga czterech opcji; pytanie `choice` co najmniej dwóch, a graficzne pole Studio zachowuje maksymalnie osiem. Przy lukach przycisk **Wstaw lukę** dodaje znacznik w miejscu kursora oraz osobny wiersz poprawnej odpowiedzi. Dla luk tekstowych można ustawić sprawdzanie każdej luki osobno albo wszystkich naraz. Opcje i aliasy odpowiedzi nie mogą zawierać separatora `|`. Kontenery `:::style` i `:::accordion` muszą mieć treść i nie mogą zawierać kolejnego kontenera tego typu. Studio nie kopiuje obrazów do repozytorium ani Blobs; użyj pełnego publicznego adresu HTTPS do obrazu, także gdy sam plik obrazu leży w innym publicznym repozytorium GitHub.

Eksport zawsze synchronizuje nagłówek `#` pierwszego slajdu z globalnym tytułem lekcji. Ton calloutu nie ma osobnego pola w Markdownzie i po ponownym imporcie jest rozpoznawany z jego tytułu. Tak jak przy dashboardzie, dla ważnego ręcznie pisanego źródła zachowaj kopię przed round-tripem przez graficzne klocki.

Robocze modele są automatycznie zapisywane w `localStorage` jako `chemdisk.studio.dashboard.v1`, `chemdisk.studio.lesson.v1` i `chemdisk.studio.prompt.v1`; autosave nie wysyła requestu, nie zapisuje Bloba i nie synchronizuje danych między urządzeniami. Draft nie jest przypisany do ID administratora, dlatego inny administrator korzystający z tego samego profilu przeglądarki zobaczy ten sam lokalny stan. Historia obejmuje do 60 operacji osobno dla każdego trybu, ale istnieje tylko do przeładowania strony i nie jest odtwarzana razem z draftem. `Ctrl/Cmd+Z` cofa, `Ctrl/Cmd+Shift+Z` lub `Ctrl/Cmd+Y` ponawia, a `Ctrl/Cmd+S` otwiera publikację dashboardu albo pobiera lekcję lub prompt na dysk — nie zapisuje go automatycznie w GitHubie. JWT jest pobierany dopiero do operacji serwerowej i nie trafia do trwałej pamięci Studio.

Podgląd dashboardu w Studio pokazuje strukturę i wygląd kart bez całej logiki właściwego panelu, a Prompt Builder pokazuje dokładne źródło, które zostanie zapisane. Podgląd lekcji jest interaktywny: pozwala zaznaczać odpowiedzi, wpisywać tekst, uzupełniać luki oraz zobaczyć podpowiedź i wynik. Działa zarówno po prawej stronie Studio, jak i w pełnym osobnym oknie. Ostateczny test całego postępu i nawigacji wykonuj w rzeczywistym module `/members/module/lesson/`.

Obsługiwana składnia:

```md
# Tytuł panelu

Krótki tekst powitalny.

> Komunikat widoczny nad wszystkimi działami.

## Stechiometria

Opis działu wyświetlany pod jego nazwą.

> Opcjonalny komunikat tylko dla tego działu.

### Lekcja 1 — obliczenia molowe

To jest zwykły tekst opisujący harmonijkę. Nie wymaga żadnego specjalnego znacznika.

#### Materiały podstawowe

To jest tekst wewnątrz zagnieżdżonej harmonijki.

- [Prezentacja](/members/module/slides/?id=ID_PLIKU&type=2) — Slajdy do lekcji.
- [Zestaw zadań](/members/module/pdf/?id=ID_PLIKU&type=1) — Zadania do samodzielnej pracy.

##### Zadania dodatkowe

Możesz schodzić niżej aż do nagłówka z sześcioma znakami `#`.

- [Zestaw dodatkowy](/members/module/pdf/?id=ID_PLIKU&type=1) — Materiał dla chętnych.
```

Zasady parsera:

- pojedynczy `#` ustawia tytuł panelu;
- `##` rozpoczyna dział i tworzy pozycję w menu;
- `###` wewnątrz działu rozpoczyna harmonijkę główną;
- `####`, `#####` i `######` tworzą kolejne poziomy harmonijek; nagłówek z taką samą albo mniejszą liczbą `#` wraca do odpowiedniego poziomu;
- zwykła linia bez specjalnego początku staje się bezpiecznym tekstem-opisem aktualnego panelu, działu albo harmonijki; kilka kolejnych linii jest łączonych w jeden opis;
- wiersz zaczynający się od `>` tworzy komunikat;
- karta musi być listą w formacie `- [Nazwa](adres) — Opis` i znajdować się pod działem;
- HTML nie jest wykonywany, a pozostałe elementy pełnego Markdown nie są interpretowane;
- dla modułów używaj ścieżek zaczynających się od `/members/module/` i koduj tekst parametrów URL, np. spację jako `%20`;
- linki zewnętrzne `http`/`https` otwierają się w nowej karcie, ale materiały kursowe najlepiej prowadzić przez chronione moduły.

## Moduły i parametry linków

Wartość `id` może być bezpośrednim identyfikatorem. Moduły Google i YouTube akceptują też właściwy pełny link, jeśli zostanie prawidłowo zakodowany jako wartość parametru URL.

| Moduł | Parametry i działanie | Przykład |
| --- | --- | --- |
| `/members/module/bitpaper/` | Opcjonalne `path` — bezpieczna nazwa opublikowanego pliku JSON z katalogu modułu; lokalna tablica z importem i eksportem. | `/members/module/bitpaper/?path=plansza.json` |
| `/members/module/whiteboard/` | Brak parametrów; biała tablica. | `/members/module/whiteboard/` |
| `/members/module/kalkulator/` | Brak parametrów; kalkulator naukowy. | `/members/module/kalkulator/` |
| `/members/module/classic/` | Brak parametrów; kalkulator klasyczny. | `/members/module/classic/` |
| `/members/module/atonom/` | Opcjonalne `formula` — polska nazwa obsługiwanego związku; interaktywny model cząsteczki. Bez parametru otwiera fenol. | `/members/module/atonom/?formula=cis-but-2-en` |
| `/members/module/lesson/` | `file` — plik `.md` z `lessons/`; opcjonalne `repo` wybiera skonfigurowane repozytorium. Bez `file` otwiera wyszukiwarkę biblioteki. | `/members/module/lesson/?repo=organiczna&file=izotopy-wegla.md` |
| `/members/module/chat/` | Opcjonalne `repo` oraz `prompt=nazwa.json` albo `plik=nazwa.txt&punkt=N`; prompt jest wybierany po stronie funkcji. | `/members/module/chat/?repo=organiczna&plik=prompty-przyklad.txt&punkt=1` |
| `/members/module/forms/` | `id` — ID albo zakodowany link Google Forms. | `/members/module/forms/?id=ID_FORMULARZA` |
| `/members/module/contact/` | `internal` — stała informacja dołączana do zgłoszenia, maks. 240 znaków. | `/members/module/contact/?internal=Pytanie%20o%20dzia%C5%82%201` |
| `/members/module/slides/` | `id` — ID/link Google Slides; `type=1` zwykły podgląd, `type=2` ograniczony interfejs. | `/members/module/slides/?id=ID_PREZENTACJI&type=2` |
| `/members/module/pdf/` | `id` — ID/link z Dysku; `type=1` podgląd z maskami, `type=2` rozpoczęcie pobierania, `type=3` zwykły podgląd. | `/members/module/pdf/?id=ID_PLIKU&type=1` |
| `/members/module/film/` | `id` — ID/link; `type=1` YouTube z ograniczonym interfejsem, `type=2` Google Drive, `type=3` zwykły YouTube. | `/members/module/film/?id=CH50zuS8DD0&type=1` |
| `/members/module/filmv1/` | Nowy odtwarzacz: YouTube w Video.js; Drive w osadzeniu Google. Obsługuje `type=1/2/3` albo `provider=youtube/drive`. | `/members/module/filmv1/?id=CH50zuS8DD0&type=1` |
| `/members/module/yt/` | `id` — ID albo link YouTube; własne kontrolki i maska odtwarzacza. Obsługuje też linki `youtu.be`, `watch`, `shorts`, `live` i `embed`. | `/members/module/yt/?id=CH50zuS8DD0` |
| `/time` | Brak parametrów; pokazuje rolę i pozostały czas dostępu. | `/time` |

`/members/module/studio/` nie jest kartą kursową. To osobna aplikacja administracyjna chroniona rolą `admin`; zwykły kursant jest przekierowywany do panelu.

W trybach ograniczonych (`pdf: type=1`, `slides: type=2`) odnośniki „Awaryjnie” i „Sprawdź w Google” są ukryte i nie otrzymują adresu pliku. „Ponów” tylko ponownie ładuje osadzony podgląd. Dla Slides `type=1` jest świadomie zwykłym podglądem, dlatego może udostępniać przejście do Google — do materiałów chronionych używaj `type=2`.

Maski, sandbox i ukrycie linków ograniczają typowe przejścia z interfejsu, ale nie są zabezpieczeniem DRM. Plik musi być dostępny dla przeglądarki, więc zaawansowany użytkownik nadal może ustalić źródło przez narzędzia deweloperskie lub ruch sieciowy. Materiałów, których odbiorca absolutnie nie może pobrać, nie należy udostępniać klientowi w oryginalnej postaci.

### Interaktywne lekcje z Markdown

Moduł `/members/module/lesson/` zamienia plik Markdown w prezentację typu wizard. Pliki lekcji umieszczaj w osobnym prywatnym repo:

```text
chemdisk-content/
└── lessons/
    ├── izotopy-wegla.md
    └── przyklad.md
```

Lekcję otwiera parametr `file`. Przy wielu źródłach `repo` wskazuje `id` z konfiguracji; link bez `repo` zachowuje zgodność i używa repozytorium domyślnego:

```text
/members/module/lesson/?file=moja-lekcja.md
/members/module/lesson/?repo=organiczna&file=moja-lekcja.md
```

Do dashboardu można dodać ją jak każdy inny materiał:

```md
- [Izotopy węgla](/members/module/lesson/?file=izotopy-wegla.md) — Lekcja interaktywna z krótkim zadaniem.
```

Nazwa z parametru może zawierać litery ASCII, cyfry, kropki, myślniki i podkreślenia, musi kończyć się `.md` i nie może zawierać ścieżki do innego katalogu. Dzięki temu link nie może odczytać pliku spoza `lessons/`. Moduł i serwerowy endpoint wymagają aktywnego dostępu kursowego; bezpośredni adres prywatnego repo nie jest ujawniany jako publiczne źródło.

Każda linia zawierająca wyłącznie `---` kończy slajd i zaczyna następny:

```md
# Tytuł lekcji

Wprowadzenie do tematu.

---

## Drugi krok

- Pierwsza informacja
- Druga informacja

> Ważna uwaga dla kursanta.
```

Parser obsługuje nagłówki `#`, `##`, `###`, akapity, listy numerowane i punktowane, cytaty `>`, pogrubienie `**tekst**`, kursywę `*tekst*`, kod, bezpieczne linki oraz obrazy. Dla obrazu z publicznego repozytorium wstaw jego pełny publiczny adres HTTPS, np. `![Opis](https://raw.githubusercontent.com/OWNER/REPO/main/images/schemat.png)`. Token do prywatnych lekcji nie jest używany do pobierania obrazów. Surowy HTML jest wyświetlany jako tekst i nie jest wykonywany.

Dodatkowo zapis `^13^C` tworzy indeks górny (¹³C), a `H~2~O` — indeks dolny. Jest to wygodne przy zapisie izotopów i wzorów chemicznych.

Stylowany fragment i harmonijkę można zapisać bez wykonywania HTML lub dowolnego CSS:

```md
:::style font=serif color=#0e665a size=large align=center
Treść z wybraną czcionką, kolorem, rozmiarem i wyrównaniem.
:::

:::accordion Dodatkowe wyjaśnienie open=true
Treść widoczna po rozwinięciu. Parametr `open=true` jest opcjonalny.
:::
```

Dozwolone czcionki to `sans`, `serif`, `rounded` i `mono`; rozmiary: `small`, `normal`, `large`, `xlarge`; wyrównanie: `left`, `center`, `right`. Kolor musi mieć format `#RRGGBB`. Inne wartości wracają do bezpiecznych ustawień domyślnych.

Gdy pytanie utworzone w Studio zawiera kilka akapitów albo element Markdown, builder otacza je blokiem `:::question … :::` bezpośrednio przed `:::task`. Dzięki temu ponowny import jednoznacznie odróżnia treść pytania od pozostałej zawartości slajdu; moduł lekcji renderuje wnętrze tego bloku jak zwykły, bezpieczny Markdown.

#### Zadanie z polem odpowiedzi

Na slajdzie może wystąpić jeden blok `:::task` (działa również polska nazwa `:::zadanie`). Slajd z zadaniem nie odblokuje przycisku **Dalej**, dopóki kursant nie poda poprawnej odpowiedzi.

```md
## Zadanie

Ile neutronów znajduje się w izotopie ^13^C?

:::task
type: number
label: Liczba neutronów
answer: 7
placeholder: Wpisz liczbę
hint: Odejmij Z = 6 od A = 13.
success: Dokładnie — 13 − 6 = 7 neutronów.
:::
```

Pola bloku zadania:

| Pole | Wymagane | Znaczenie |
| --- | --- | --- |
| `answer` | tak | Poprawna odpowiedź. Kilka wariantów rozdziel znakiem `|`, np. `atom \| ATOM`. |
| `type` | nie | `text` (domyślnie), `number`, `choice`, `abcd`, `gaps` albo `gaps-text`. |
| `label` | nie | Podpis pola lub polecenie nad odpowiedziami. |
| `placeholder` | nie | Przykład wyświetlany w pustym polu. |
| `hint` | nie | Podpowiedź pokazywana po błędnej próbie. |
| `success` | nie | Komunikat po poprawnej odpowiedzi. |
| `options` | dla `choice`, `abcd` i `gaps` | Opcje rozdzielone `|`. `choice` i `gaps` wymagają co najmniej dwóch, a `abcd` dokładnie czterech opcji. |
| `text` | dla `gaps` i `gaps-text` | Zdanie z lukami zapisanymi jako `{{opis luki}}`; kolejność znaczników odpowiada kolejności wartości w `answer`. |
| `check_mode` | nie | Dla `gaps-text`: `each` sprawdza każdą lukę osobno, a `all` wszystkie naraz (domyślnie). |
| `case_sensitive` | nie | `true`/`tak`, jeśli wielkość liter ma mieć znaczenie. Domyślnie tekst jest sprawdzany bez rozróżniania wielkości liter. |

Można również używać polskich nazw pól bez znaków diakrytycznych lub z nimi: `typ`, `odpowiedź`, `etykieta`, `przykład`, `podpowiedź`, `sukces`, `opcje`, `tekst`, `tryb sprawdzania`, `wielkość liter`.

Odpowiedź tekstowa jest normalizowana Unicode NFKC, przycinana i ma łączone wielokrotne odstępy. Odpowiedź liczbowa akceptuje przecinek albo kropkę dziesiętną, ale porównanie jest dokładne — bez tolerancji i bez automatycznego rozpoznawania jednostek. Liczbę akceptowanych aliasów zwiększa się separatorem `|`. Liczba prób nie jest ograniczona; błędna próba pokazuje podpowiedź, a dopiero poprawna odpowiedź odblokowuje następny slajd.

Przykład pytania wyboru:

```md
:::task
type: choice
label: Wybierz liczbę neutronów w węglu-13
options: 6 | 7 | 13
answer: 7
hint: Liczba neutronów to A − Z.
:::
```

Quiz z widocznymi oznaczeniami A–D można zapisać krócej jako `type: abcd`. Poprawną odpowiedź podaj literą albo pełną treścią opcji:

```md
:::task
type: abcd
label: Która liczba jest liczbą atomową węgla?
options: 4 | 6 | 12 | 13
answer: B
hint: Liczba atomowa jest równa liczbie protonów.
success: Dobrze — węgiel ma liczbę atomową 6.
:::
```

Luki z `type: gaps` pokazują listy wyboru. Jeśli uczeń ma sam wpisać tekst, użyj `type: gaps-text`; liczba odpowiedzi rozdzielonych `|` musi być taka sama jak liczba znaczników:

```md
:::task
type: gaps-text
label: Uzupełnij wzór i masę molową
text: Woda ma wzór {{wzór}}, a jej masa molowa wynosi około {{masa}} g/mol.
answer: H2O | 18
check_mode: each
case_sensitive: true
hint: Sprawdź symbole pierwiastków i dodaj ich masy atomowe.
success: Wszystkie luki są poprawne.
:::
```

Postęp, rozwiązane zadania i ukończenie są zachowywane w `sessionStorage`, czyli przy odświeżeniu w tej samej karcie. Przycisk **Powtórz lekcję** czyści ten postęp. Odpowiedzi znajdują się w statycznym pliku Markdown, więc ten moduł służy do nauki i samosprawdzenia, a nie do tajnych lub punktowanych egzaminów.

### Atonom — modele cząsteczek

Moduł `/members/module/atonom/` buduje edukacyjny, interaktywny model cząsteczki na podstawie polskiej nazwy związku. Pokazuje wzór sumaryczny, rodzinę związku, liczbę atomów i wiązań, przybliżoną masę molową oraz krótką wskazówkę dotyczącą budowy. Canvas można obracać i powiększać; dostępne są pauza animacji, reset widoku oraz suwaki energii ruchu, rozmiaru atomów i odległości kamery.

Obsługiwany zakres obejmuje między innymi:

- proste i rozgałęzione alkany, alkeny, alkiny oraz cykloalkany do 12 atomów węgla w łańcuchu głównym;
- halogenowe i alkilowe podstawniki z lokantami;
- alkohole i polialkohole, aldehydy, ketony, kwasy karboksylowe, estry i aminy;
- benzen, fenol, toluen, anilinę i podstawione pochodne benzenu;
- glicynę, alaninę, wodę, amoniak i dwutlenek węgla;
- poprawne przypadki izomerii `cis`/`trans` dla obsługiwanych alkenów.

Parser nie jest pełnym parserem całej nomenklatury IUPAC. Nieobsługiwana albo chemicznie niespójna nazwa daje czytelny błąd i przykład poprawnego zapisu zamiast zgadywania struktury. Model ma charakter dydaktyczny — nie zastępuje obliczeń geometrii kwantowej ani profesjonalnego oprogramowania chemicznego.

Wybrany związek można przekazać i udostępnić w parametrze `formula`:

```text
/members/module/atonom/?formula=fenol
/members/module/atonom/?formula=cis-but-2-en
/members/module/atonom/?formula=kwas%202-metylopropanowy
```

Przycisk kopiowania zachowuje aktualną nazwę w linku. Indywidualne kolory atomów i wiązań są zapisywane lokalnie w `atonom-atom-colors` oraz `atonom-bond-colors`; można je przywrócić do palety domyślnej. Atonom respektuje wspólny `chem.theme` i ograniczenie ruchu `prefers-reduced-motion`.

Na publicznej stronie głównej pozycja **Atonom** prowadzi obecnie do osobnej witryny `https://atonom.netlify.app`, natomiast karta w chronionym dashboardzie otwiera lokalny moduł `/members/module/atonom/`. Są to dwa różne wdrożenia; zmiana zewnętrznej witryny nie aktualizuje automatycznie wersji dołączonej do ChemDisk i odwrotnie.

### Kalkulatory i tablice

`/members/module/kalkulator/` osadza naukowy symulator NumWorks. Wymaga połączenia z zewnętrzną usługą i uruchamia iframe dopiero po potwierdzeniu sesji.

`/members/module/classic/` działa lokalnie i obsługuje dodawanie, odejmowanie, mnożenie, dzielenie, modulo, nawiasy, znaki jednoargumentowe oraz kropkę lub przecinek dziesiętny. Nie używa `eval`. Można klikać przyciski albo pisać z klawiatury:

- cyfry, `+`, `-`, `*`, `/`, `%`, `(`, `)`, `.` i `,` wpisują działanie;
- `x`, `X` i `×` oznaczają mnożenie, a `:` i `÷` — dzielenie;
- `Enter` lub `=` oblicza wynik;
- `Backspace` i `Delete` usuwają ostatni znak;
- `Escape` czyści kalkulator.

Operator `%` oznacza resztę z dzielenia, a nie przeliczenie wartości procentowej.

`/members/module/bitpaper/` jest lokalną tablicą canvas z przesuwaniem, skalowaniem, zaznaczaniem, ołówkiem, gumką, tekstem, cofaniem/ponawianiem oraz oknami zadań, do których można dodawać obrazy. Planszę można wyeksportować/importować jako JSON albo pobrać jako PNG. Import planszy ma limit 15 MB, a pojedynczy obraz zadania 8 MB. Parametr `path=nazwa.json` automatycznie wczytuje bezpiecznie nazwaną planszę opublikowaną w katalogu modułu.

BitPaper nie synchronizuje uczestników w czasie rzeczywistym i nie zapisuje planszy na serwerze; do przenoszenia stanu służy plik JSON. `/members/module/whiteboard/` osadza tldraw i podobnie jak NumWorks wymaga dostępności usługi zewnętrznej.

### Filmy i FilmV1

Najprostsze linki:

```text
/members/module/filmv1/?id=ID_YOUTUBE&type=1
/members/module/filmv1/?id=ID_DRIVE&type=2
/members/module/filmv1/?id=ID_YOUTUBE&type=3
```

- `type=1` uruchamia YouTube w Video.js z ograniczonym interfejsem;
- `type=2` uruchamia film z Google Drive we wbudowanym odtwarzaczu Google;
- `type=3` uruchamia YouTube z pełniejszymi kontrolkami;
- zamiast `type` pełny link może zostać rozpoznany automatycznie; dla samego ID pliku Drive trzeba podać `type=2` albo `provider=drive`;
- strona odtwarzacza i całe otoczenie działają pod domeną ChemDisk, ale film nadal jest przesyłany przez YouTube lub Google. Video.js nie zmienia pliku Drive w bezpośredni strumień HTML5, ponieważ publiczny URL pobrania, CORS i uprawnienia Google nie są stabilnym API odtwarzania.

Moduł `film` korzysta bezpośrednio z osadzenia YouTube/Google, natomiast `filmv1` używa Video.js dla YouTube i osadzenia dostawcy dla Dysku. Przykłady:

```text
/members/module/film/?id=CH50zuS8DD0&type=1
/members/module/film/?id=ID_PLIKU_DRIVE&type=2
/members/module/filmv1/?id=CH50zuS8DD0&type=1
/members/module/filmv1/?id=ID_PLIKU_DRIVE&type=2
```

W `type=1` oba odtwarzacze ukrywają odnośniki awaryjne, nakładają maski na tytuł, logo i przyciski dostawcy oraz uruchamiają iframe w sandboxie bez `allow-popups` i bez nawigacji górnego okna. `type=3` jest świadomie trybem zwykłym i może udostępniać pełniejsze funkcje YouTube. `type=2` korzysta z Google Drive i wymaga poprawnego udostępnienia pliku.

Ponieważ zawartość YouTube działa w zewnętrznym iframe, aplikacja nie może modyfikować jej kodu. Sandbox i maski blokują typowe kliknięcia prowadzące do YouTube w trybie ograniczonym, ale po zmianie interfejsu przez dostawcę położenie masek może wymagać aktualizacji. Nie jest to zabezpieczenie DRM.

### Odtwarzacz YT

Moduł `/members/module/yt/` jest osobnym odtwarzaczem YouTube z kontrolkami ChemDisk. W linku podaj 11-znakowe ID filmu albo pełny, zakodowany link YouTube:

```text
/members/module/yt/?id=CH50zuS8DD0
/members/module/yt/?id=https%3A%2F%2Fyoutu.be%2FCH50zuS8DD0
```

Akceptowane są linki `youtu.be`, `youtube.com/watch`, `shorts`, `live` i `embed`. Po otwarciu parametr `id` jest przenoszony do `sessionStorage` i usuwany z paska adresu. Odświeżenie w tej samej karcie zachowuje film; otwarcie czystego adresu w nowej karcie wymaga ponownego przekazania ID.

Odtwarzacz ma własne przyciski odtwarzania, restartu, wyciszania i pełnego ekranu, suwaki postępu oraz głośności i obsługę dotyku. Na telefonie podpisy przycisków są zastępowane ikonami, a film pozostaje osadzony w stronie dzięki `playsinline=1`. Ostatnie szybkie kliknięcie wyciszenia zawsze wyznacza stan docelowy, niezależnie od opóźnienia API YouTube.

Film musi pozwalać na osadzanie. Własne kontrolki i maski ograniczają przypadkowe przejście do YouTube, ale nie są zabezpieczeniem DRM.

### Prompty czatu

Pliki promptów umieszczaj w `prompts/` prywatnego repo materiałów. Funkcja `chat` pobiera wybrany plik z GitHuba po stronie serwera; token i treść promptu nie trafiają do przeglądarki kursanta. Administrator może odczytać treść w chronionym Prompt Builderze, aby ją świadomie edytować. Zmiana promptu wymaga tylko commitu w repo materiałów, bez deployu aplikacji.

W **Studio treści → Prompt AI** można utworzyć `.json` z jedną instrukcją albo `.txt` z wieloma punktami `::punkt N`. Dostępne są: import pliku, edycja źródła, kopiowanie, pobranie na dysk, wczytanie z repo, zapis oraz usunięcie. Ręczny obieg jest równorzędny z przyciskami GitHub. Builder nie wysyła promptu do modelu AI i nie uruchamia czatu — przygotowuje oraz waliduje tylko plik instrukcji.

Najprostsza zawartość:

```json
{
  "prompt": "Jesteś asystentem przygotowującym do matury z chemii..."
}
```

Rozpoznawane są tekstowe pola `prompt`, `system`, `text`, `value` i `content`. Czat wywołuje wyłącznie serwerową funkcję z tokenem użytkownika; model i klucz API nie są wybierane przez adres URL.

Jeden plik TXT może zawierać wiele niezależnych instrukcji. Używaj jednoznacznych nagłówków w osobnych liniach:

```txt
::punkt 1
Jesteś korepetytorem chemii. Naprowadzaj, ale nie podawaj od razu wyniku.

::punkt 2
Sprawdź równanie reakcji, jednostki i cyfry znaczące.
Zakończ krótką modelową odpowiedzią.
```

Link do drugiego punktu: `/members/module/chat/?plik=prompty-przyklad.txt&punkt=2`. Dla innego źródła dodaj np. `repo=organiczna`: `/members/module/chat/?repo=organiczna&plik=prompty-przyklad.txt&punkt=2`. Nagłówki `::punkt N` pozwalają umieszczać wewnątrz promptu zwykłe listy `1.`, `2.` bez przypadkowego podziału. Nazwa repozytorium, pliku, numer punktu i treść są ponownie walidowane po stronie funkcji; klient nie może przesłać własnego pola `system`.

Obsługiwany jest też prostszy zapis zgodny ze zwykłą numerowaną listą:

```txt
1. Naprowadzaj na rozwiązanie zadania bez podawania od razu wyniku.
2. Sprawdź odpowiedź, jednostki i cyfry znaczące.
```

Nie mieszaj obu zapisów w jednym pliku. Jeżeli pojedyncza instrukcja sama zawiera numerowaną listę, użyj wariantu `::punkt N`, aby granice punktów pozostały jednoznaczne.

Netlify nakłada na funkcję `chat` limit 30 wywołań na minutę dla agregacji IP i domeny. Dodatkowy licznik w funkcji dopuszcza 12 wywołań na minutę dla użytkownika, lecz istnieje tylko w pamięci danego ciepłego wystąpienia Function — nie jest globalnym, trwałym licznikiem między wszystkimi instancjami. Obie warstwy ograniczają nadużycia i koszt, ale nie zastępują zewnętrznego systemu limitów, jeśli potrzebny jest ścisły globalny przydział na konto.

### Osobne pliki CSS i JavaScript modułu

Każdy moduł ma stały element `<base>`, np.:

```html
<base href="/members/module/kalkulator/">
<link rel="stylesheet" href="./style.css">
<script defer src="./script.js"></script>
```

Dzięki temu `style.css` i `script.js` są pobierane z katalogu modułu również wtedy, gdy Netlify obsłuży ładny adres bez `index.html`. Przy dodawaniu nowego modułu ustaw jego własny bezwzględny `<base>` i w dashboardzie linkuj najlepiej do ścieżki zakończonej `/`.

## Bezpieczeństwo i ograniczenia materiałów

- Role są odczytywane wyłącznie z `app_metadata`; pola profilu nie mogą przyznać dostępu.
- `/members/*` otrzymuje nagłówki `no-store`, `noindex`, `nosniff` i ochronę przed osadzaniem ChemDisk w obcej stronie.
- Funkcja Gemini wymaga zalogowanego użytkownika z aktualnym dostępem, ma limity wywołań, czasu odpowiedzi, długości wyniku, historii i załączników oraz nie zwraca diagnostyki dostawcy. Przeglądarka przesyła obrazy JPEG, PNG, WebP lub GIF do około 3 MB.
- Identyfikatory i pełne linki wejściowe są walidowane względem oczekiwanych domen Google lub YouTube.
- Moduły Forms, Slides, PDF, Film, FilmV1 i YT po odczytaniu parametrów zapisują stan w `sessionStorage` i czyszczą zapytanie z paska adresu. Odświeżenie działa w tej samej karcie, ale czysty adres bez ID nie przeniesie materiału do nowej karty lub przeglądarki.
- Wartość `internal` formularza kontaktowego jest stała w interfejsie, lecz pochodzi z adresu URL. Nie używaj jej jako zaufanego identyfikatora ceny, uprawnień ani użytkownika.

Maski, ukrywanie przycisków, blokada menu kontekstowego i ograniczone kontrolki mają jedynie utrudniać przypadkowe pobranie lub przejście do źródła. **Nie są DRM.** Użytkownik mający dostęp do materiału może użyć narzędzi przeglądarki, ruchu sieciowego, funkcji dostawcy albo zrzutu ekranu. Realną granicą dostępu są role aplikacji, uprawnienia udostępniania Google/YouTube oraz ewentualny backend wydający chronione pliki.

## Testy i kontrola przed deployem

```bash
npm test
npm run build
```

Oba skrypty uruchamiają `node --test`; projekt nie ma osobnego etapu bundlowania ani kompilowania zasobów. Testy obejmują między innymi hooki Identity, odporność sesji po uśpieniu i w wielu kartach, funkcje administracyjne, Stripe i księgi Blobs, bezpieczny odczyt i zapis prywatnego repo GitHub, parser dashboardu, natychmiastowe śledzenie sekcji, wspólny motyw, media, kalkulator klasyczny, parser chemiczny Atonom, odtwarzacz lekcji oraz trzy modele Studio. Netlify wykonuje tę samą bramkę `npm run build` przed publikacją katalogu `public`.

Opcjonalna kontrola składni wszystkich plików JavaScript:

```bash
find public netlify -type f \( -name '*.js' -o -name '*.mjs' \) -exec node --check {} \;
```

Przed publikacją wykonaj też krótki test ręczny:

1. konto bez roli jest odsyłane do logowania;
2. każda z używanych ról otwiera dashboard i właściwe materiały;
3. drugie logowanie na innym urządzeniu wylogowuje pierwszą przeglądarkę po kontroli sesji, ale kilka kart tego samego profilu pozostaje zalogowanych;
4. po uśpieniu i wybudzeniu komputera chwilowy brak sieci nie wylogowuje poprawnej sesji, a faktycznie zastąpiona sesja zostaje zamknięta;
5. wygasła rola czasowa blokuje czat i panel;
6. zmiana imienia i nazwiska pozostaje po odświeżeniu;
7. administrator widzi listę kont, a zwykły kursant nie widzi panelu administracyjnego;
8. zmiana roli w panelu działa po ponownym logowaniu i nie przedłuża czasu przy samej zmianie nazwiska;
9. formularz kontaktowy pojawia się w Netlify Forms, a administrator może odczytać i po potwierdzeniu usunąć testowe zgłoszenie;
10. edycja dashboardu działa po odświeżeniu i można ją przywrócić do wersji z wdrożenia;
11. zwijanie sidebara jest zapamiętane, a aktywny dział zmienia się od razu po kliknięciu i podczas przewijania;
12. przełączenie motywu dashboardu jest respektowane przez każdą aplikację modułu, stronę zakupu i status dostępu;
13. kalkulator klasyczny przyjmuje cyfry, operatory, `Enter`, `=`, `Backspace`, `Delete` i `Escape` z klawiatury;
14. BitPaper importuje i eksportuje JSON, zapisuje PNG oraz respektuje limity planszy i obrazu;
15. Atonom poprawnie buduje kilka rodzin związków, pokazuje błąd dla nieobsługiwanej nazwy i kopiuje link z `formula`;
16. Studio wczytuje aktywny dashboard, zachowuje lokalny draft, wykrywa konflikt `etag` i publikuje poprawny układ;
17. Lesson Builder importuje istniejącą lekcję, odtwarza jej bloki i quizy, pozwala pobrać `.md` ręcznie oraz generuje plik działający w module `lesson`;
18. Prompt Builder importuje, waliduje i eksportuje pliki `.json` oraz wielopunktowe `.txt`;
19. administrator tworzy testowy plik lekcji lub promptu w GitHubie, aktualizuje go po ponownym wczytaniu, a konflikt SHA nie nadpisuje nowszej wersji;
20. usunięcie testowego pliku wymaga potwierdzenia i tworzy commit widoczny w historii repo;
21. zakładka **Materiały** pokazuje poprawne repo i liczby plików, wyszukiwarka Studio widzi lekcje i prompty, a odtwarzacz otwiera lekcję z repo;
22. po zmianie pliku w repo materiałów nowa wersja jest widoczna bez deployu aplikacji po wygaśnięciu 20-sekundowego cache’u;
23. linki Google i YouTube działają na docelowej domenie i przy docelowych ustawieniach udostępniania.
