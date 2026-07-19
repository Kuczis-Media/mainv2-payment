# ChemDisk — platforma kursów maturalnych

ChemDisk jest statyczną aplikacją wdrażaną na Netlify. Publiczna strona prowadzi do logowania przez Netlify Identity, a zalogowany kursant otrzymuje panel z materiałami zdefiniowanymi w pliku Markdown. Dostęp kontrolują role w `app_metadata`, nadawane automatycznie po płatności Stripe albo ręcznie przez administratora.

## Architektura

```text
public/
├── index.html                         # publiczna strona startowa
├── login/                             # logowanie, rejestracja i odzyskiwanie konta
├── purchase/                          # osobny ekran zakupu i przedłużania dostępu
├── assets/js/auth.js                  # wspólna obsługa sesji, ról i profilu
└── members/
    ├── index.html                     # panel kursanta
    ├── dashboard.md                   # działy i materiały widoczne w panelu
    ├── dashboard.js / dashboard.css   # parser Markdown i interfejs panelu
    └── module/                        # narzędzia i przeglądarki materiałów
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
├── chat-prompts/                      # prywatne prompty dołączane do funkcji
└── chat.mjs                           # chronione połączenie z Gemini i limit Netlify
netlify/admin-common.js                # wspólna kanoniczna autoryzacja
netlify/payment-common.js              # pakiety, księga zakupów i synchronizacja Identity
netlify.toml                           # publikacja, nagłówki i ochrona /members/*
tests/                                 # testy auth i Netlify Functions
```

To nie jest aplikacja SPA ani projekt wymagający własnego, stale uruchomionego serwera. Netlify publikuje katalog `public`, a pliki z `netlify/functions` uruchamia na żądanie jako funkcje serverless. Profile i role przechowuje Identity, zgłoszenia — Netlify Forms, a aktywny Markdown edytora — Netlify Blobs.

## Uruchomienie lokalne

Wymagane są Node.js 20.12.2 lub nowszy oraz npm (zgodnie z wymaganiami aktualnego Netlify CLI).

```bash
npm install
npm run dev
```

Polecenie uruchamia `netlify dev`, dzięki czemu jednocześnie działają statyczne strony, przekierowania i funkcje. Samo otwarcie pliku `public/index.html` z dysku nie odtworzy zachowania Netlify Identity ani Functions.

Dla lokalnego czatu, zakładek administratora, edytora dashboardu i Stripe skopiuj `.env.example` jako nieśledzony plik `.env`:

```bash
cp .env.example .env
```

```dotenv
GEMINI_API_KEY=klucz_z_Google_AI_Studio
NETLIFY_API_TOKEN=osobisty_token_Netlify
SITE_ID=id_witryny_Netlify
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Nie umieszczaj kluczy w `public`, plikach JavaScript przeglądarki, `dashboard.md` ani `netlify.toml`. `SITE_ID` jest ustawiane automatycznie na wdrożeniu Netlify; ręcznie jest potrzebne tylko lokalnie.

## Wdrożenie na Netlify

1. Utwórz witrynę z tego repozytorium. Ustawienia publikacji i funkcji są już zapisane w `netlify.toml` (`public` oraz `netlify/functions`).
2. Włącz Netlify Identity. W ustawieniach rejestracji wybierz rejestrację otwartą albo tylko na zaproszenie, zależnie od sposobu sprzedaży kursu. Jeśli wymagane jest potwierdzenie e-maila, pozostaw włączone wiadomości potwierdzające.
3. Dodaj `GEMINI_API_KEY` oraz `NETLIFY_API_TOKEN` w zmiennych środowiskowych witryny i ustaw ich zakres na **Functions**. Token Netlify umożliwia zakładce administracyjnej obsługę zgłoszeń Forms oraz silnie spójny dostęp do Netlify Blobs (dashboard, ceny i księgi zakupów); traktuj go jak sekret. `SITE_ID` Netlify ustawia automatycznie.
4. Skonfiguruj Stripe według osobnej instrukcji poniżej i dodaj `STRIPE_SECRET_KEY` oraz `STRIPE_WEBHOOK_SECRET` z zakresem **Functions**.
5. Pierwszemu administratorowi przypisz ręcznie rolę `admin` w `app_metadata` w panelu Netlify Identity. Kolejnymi kontami można już zarządzać z panelu administratora w dashboardzie.
6. Nowe konto bez roli może się uwierzytelnić i zobaczy cennik, ale nie otworzy `/members/`. Po udanej płatności rola i dokładny termin są nadawane automatycznie. Administrator nadal może przyznać dostęp ręcznie.
7. Udostępnij osadzane pliki Google odbiorcom, którzy mają je oglądać. Aplikacja nie omija uprawnień Dysku, Prezentacji ani Formularzy Google.
8. Jeżeli używasz własnej domeny, ustaw ją jako główną domenę witryny, włącz HTTPS i sprawdź na niej link potwierdzający oraz zaproszenie Identity. Kod korzysta ze ścieżek same-origin i `location.origin`, więc nie wymaga zamiany `chemdisk.netlify.app` na `chemdisk.pl` w plikach.
9. Po pierwszym deployu sprawdź logowanie, cztery zakładki panelu administratora, testową płatność, formularz kontaktowy, czat oraz po jednym materiale Google i YouTube na docelowej domenie.

Dodanie `chemdisk.pl` jako domeny własnej do tej samej witryny nie zmienia danych. Utworzenie całkiem nowej witryny Netlify to migracja, nie sama zmiana domeny: użytkownicy Identity, zgłoszenia Forms i site-wide Blobs nie są automatycznie kopiowane między witrynami.

W logu deployu sprawdź również etap post-processingu: Netlify powinien potwierdzić regułę limitu wywołań funkcji `chat`. Platformowy limit per IP jest uzupełniony limitem per konto wewnątrz funkcji.

Formularz kontaktowy jest oznaczony `data-netlify="true"` i korzysta z Netlify Forms oraz reCAPTCHA. Netlify musi przetworzyć stronę podczas deployu, aby formularz pojawił się w panelu witryny.

## Konfiguracja Stripe

Integracja sprzedaje **jednorazowe pakiety czasu**, a nie automatycznie odnawiane subskrypcje Stripe Billing. Administrator może udostępnić godzinę, dzień, tydzień, miesiąc, pół roku albo rok. Zakup odbywa się na osobnej stronie `/purchase/`, otwieranej w panelu kursanta przez **Kup lub przedłuż**.

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

Księga użytkownika jest zapisywana w site-wide magazynie Netlify Blobs `chemdisk-payments`. Każdy zapis używa warunku ETag. Historia przechowuje maksymalnie 100 najnowszych zakupów i operacji administracyjnych; starsze pozycje są automatycznie usuwane, a pojedynczy znacznik czasu nadal chroni przed ponownym naliczeniem starej Checkout Session. Usunięcie konta w panelu administratora usuwa również jego księgę z tego magazynu. Dane transakcji pozostają niezależnie w Stripe.

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

Ważne ograniczenie: statyczny CDN Netlify sprawdza role znajdujące się w już wydanym JWT, ale nie odpytuje bazy Identity o aktualny `session_id` przy każdym pliku. Dlatego wcześniej wydany token może nadal przejść samą regułę CDN do czasu jego wygaśnięcia, choć zwykły interfejs wyloguje starą kartę po kontroli sesji. Zmiana roli również staje się w pełni widoczna po odświeżeniu lub ponownym wydaniu tokenu.

Jeśli każdy pojedynczy zasób ma wymagać natychmiastowej, serwerowej weryfikacji jednej sesji, nie może być podawany bezpośrednio jako statyczny plik. Trzeba go obsłużyć przez Function/Edge Function albo osobny backend, który przy każdym żądaniu sprawdza bieżący stan konta.

## Profil kursanta

Rejestracja wymaga imienia, nazwiska, e-maila i hasła mającego co najmniej 10 znaków. Imię i nazwisko trafiają do `user_metadata`; hook rejestracji normalizuje tekst i usuwa z tych metadanych pola wyglądające jak uprawnienia.

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
- obsłużyć całą listę użytkowników dzięki stronicowaniu.

Interfejs wysyła JWT zalogowanego administratora do `/.netlify/functions/admin-users`. Funkcja ponownie pobiera aktualny rekord administratora z Identity, dopiero wtedy używa dostarczonego przez środowisko Netlify krótkotrwałego tokena operatora do listowania lub aktualizacji kont. Token operatora nigdy nie jest zwracany do przeglądarki. Funkcja blokuje odebranie sobie własnej roli administratora i zachowuje `session_id` oraz niezwiązane metadane konta.

Przy rzeczywistej zmianie roli stare `timed_access` jest czyszczone. Nowa rola czasowa rozpoczyna okres przy następnym logowaniu użytkownika. Sama poprawka imienia lub nazwiska z pozostawioną aktywną rolą czasową nie zeruje jej bieżącego terminu. Zmiany ról są w pełni widoczne po odświeżeniu tokenu albo ponownym logowaniu.

Panel pokazuje termin aktywnej roli czasowej. Po wygaśnięciu roli nadanej ręcznie pojawia się jawna akcja **Odnów ten okres**; dopiero ona przygotowuje nowy okres do uruchomienia przy kolejnym logowaniu. Dostęp kupiony przedłuża się przez kolejny Checkout. Zwykłe zapisanie nazwiska nie odnawia dostępu przypadkiem.

Panel administracyjny wymaga środowiska Netlify Functions (`netlify dev` lub deployu), ponieważ lokalne otwarcie statycznego HTML nie dostarcza serwerowego kontekstu Identity. Jeśli kontekst administratora Identity nie jest dostępny, endpoint kończy żądanie bezpiecznym błędem `503` zamiast wykonywać operację bez weryfikacji.

Zakładka **Formularze** pokazuje formularze przetworzone przez Netlify Forms, np. `members-contact` oraz publiczny `contact`. Nie pobiera odpowiedzi z osadzonych Google Forms — te pozostają w Google Forms/Sheets. Każde usunięcie wymaga potwierdzenia, a funkcja wydaje dla konkretnego zgłoszenia krótkotrwały, podpisany token; `NETLIFY_API_TOKEN` nigdy nie trafia do przeglądarki.

## Edycja dashboardu

Wersją bazową jest `public/members/dashboard.md`. Administrator może również zapisać aktywną wersję w zakładce **Dashboard** bez wykonywania deployu. Jest ona przechowywana w Netlify Blobs, a zapis używa kontroli wersji (`etag`) i silnie spójnego dostępu przez serwerowe `NETLIFY_API_TOKEN` oraz `SITE_ID`, aby dwóch administratorów nie nadpisało sobie zmian po cichu. Sekretny token nie jest wysyłany do przeglądarki. Przycisk przywracania atomowo dezaktywuje override i ponownie aktywuje plik z wdrożenia.

Panel kursanta najpierw próbuje pobrać aktywną wersję z funkcji, a gdy jej nie ma lub magazyn jest chwilowo niedostępny, bezpiecznie wraca do `dashboard.md`. Nie trzeba zmieniać `index.html`.

Jeżeli administrator nie opublikował własnej wersji, kursanci widzą pełny bazowy `dashboard.md` ze wszystkimi przykładowymi materiałami i narzędziami. Przy pierwszym otwarciu edytora administrator dostaje czysty szablon zawierający tylko ekran Start oraz sekcję **Pomoc i konto**. Dopiero kliknięcie **Opublikuj zmiany** zapisuje ten szablon jako aktywną wersję i ukrywa bazowe materiały. Sekcja **Pomoc i konto** jest obowiązkowa i aplikacja automatycznie dołącza ją podczas publikacji, jeżeli administrator pominie ją we własnym tekście. Akcja **Przywróć plik z wdrożenia** usuwa własną wersję, omija starą kopię z pamięci podręcznej i ponownie pokazuje pełny dashboard bazowy.

Magazyn `chemdisk-dashboard` jest site-wide i pozostaje po kolejnych wdrożeniach. Deploy Preview tej samej witryny również może zobaczyć ten magazyn, dlatego nie publikuj zmian z podglądu, jeśli nie mają trafić do produkcyjnego dashboardu. Lokalny `netlify dev` korzysta z lokalnego magazynu testowego.

### Graficzne Studio treści

Administrator widzi w bocznym menu dodatkowy skrót **Studio treści** prowadzący do `/members/module/studio/`. Studio ma dwa tryby:

- **Dashboard Builder** — przeciąganie sekcji, harmonijek, tekstów, komunikatów i kart wszystkich modułów; formularze konfigurują identyfikator, wariant oraz właściwy dla modułu tryb `type`;
- **Lesson Builder** — slajdy, stylowany tekst, obrazy HTTPS, listy, cytaty, callouty, kod, harmonijki oraz pytania tekstowe, liczbowe, wyboru i ABCD.

Przed publikacją dashboardu Studio zawsze pobiera pełną aktywną wersję wraz z jej `etag`. Zapis jest wykonywany warunkowo przez `admin-dashboard`; konflikt nie nadpisuje nowszej wersji i pozostawia lokalny draft do porównania. JWT nie jest zapisywany w pamięci trwałej przeglądarki. Robocze modele obu edytorów są automatycznie przechowywane lokalnie, a cofanie i ponawianie obejmuje do 60 operacji.

Lesson Builder nie publikuje jeszcze plików do Blobs ani GitHuba. Generuje, kopiuje lub pobiera gotowy plik `.md`, który należy umieścić w `public/members/module/lesson/`.

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
| `/members/module/bitpaper/` | Brak parametrów; prosta tablica. | `/members/module/bitpaper/` |
| `/members/module/whiteboard/` | Brak parametrów; biała tablica. | `/members/module/whiteboard/` |
| `/members/module/kalkulator/` | Brak parametrów; kalkulator naukowy. | `/members/module/kalkulator/` |
| `/members/module/classic/` | Brak parametrów; kalkulator klasyczny. | `/members/module/classic/` |
| `/members/module/lesson/` | `file` — plik `.md` z folderu modułu; prezentacja krokowa z opcjonalnymi zadaniami. | `/members/module/lesson/?file=izotopy-wegla.md` |
| `/members/module/chat/` | `prompt=nazwa.json` albo `plik=nazwa.txt&punkt=N`; prompt jest wybierany po stronie funkcji. | `/members/module/chat/?plik=prompty-przyklad.txt&punkt=1` |
| `/members/module/forms/` | `id` — ID albo zakodowany link Google Forms. | `/members/module/forms/?id=ID_FORMULARZA` |
| `/members/module/contact/` | `internal` — stała informacja dołączana do zgłoszenia, maks. 240 znaków. | `/members/module/contact/?internal=Pytanie%20o%20dzia%C5%82%201` |
| `/members/module/slides/` | `id` — ID/link Google Slides; `type=1` zwykły podgląd, `type=2` ograniczony interfejs. | `/members/module/slides/?id=ID_PREZENTACJI&type=2` |
| `/members/module/pdf/` | `id` — ID/link z Dysku; `type=1` podgląd z maskami, `type=2` rozpoczęcie pobierania, `type=3` zwykły podgląd. | `/members/module/pdf/?id=ID_PLIKU&type=1` |
| `/members/module/film/` | `id` — ID/link; `type=1` YouTube z ograniczonym interfejsem, `type=2` Google Drive, `type=3` zwykły YouTube. | `/members/module/film/?id=CH50zuS8DD0&type=1` |
| `/members/module/filmv1/` | Nowy odtwarzacz: YouTube w Video.js; Drive w osadzeniu Google. Obsługuje `type=1/2/3` albo `provider=youtube/drive`. | `/members/module/filmv1/?id=CH50zuS8DD0&type=1` |
| `/members/module/yt/` | `id` — ID albo link YouTube; własne kontrolki i maska odtwarzacza. Obsługuje też linki `youtu.be`, `watch`, `shorts`, `live` i `embed`. | `/members/module/yt/?id=CH50zuS8DD0` |
| `/time` | Brak parametrów; pokazuje rolę i pozostały czas dostępu. | `/time` |

W trybach ograniczonych (`pdf: type=1`, `slides: type=2`) odnośniki „Awaryjnie” i „Sprawdź w Google” są ukryte i nie otrzymują adresu pliku. „Ponów” tylko ponownie ładuje osadzony podgląd. Dla Slides `type=1` jest świadomie zwykłym podglądem, dlatego może udostępniać przejście do Google — do materiałów chronionych używaj `type=2`.

Maski, sandbox i ukrycie linków ograniczają typowe przejścia z interfejsu, ale nie są zabezpieczeniem DRM. Plik musi być dostępny dla przeglądarki, więc zaawansowany użytkownik nadal może ustalić źródło przez narzędzia deweloperskie lub ruch sieciowy. Materiałów, których odbiorca absolutnie nie może pobrać, nie należy udostępniać klientowi w oryginalnej postaci.

### Interaktywne lekcje z Markdown

Moduł `/members/module/lesson/` zamienia plik Markdown w prezentację typu wizard. Pliki lekcji umieszczaj bezpośrednio w katalogu:

```text
public/members/module/lesson/
├── index.html
├── lesson-parser.js
├── script.js
├── style.css
├── izotopy-wegla.md
├── przyklad.md
└── moja-lekcja.md
```

Lekcję otwiera parametr `file`:

```text
/members/module/lesson/?file=moja-lekcja.md
```

Do dashboardu można dodać ją jak każdy inny materiał:

```md
- [Izotopy węgla](/members/module/lesson/?file=izotopy-wegla.md) — Lekcja interaktywna z krótkim zadaniem.
```

Nazwa z parametru może zawierać litery ASCII, cyfry, kropki, myślniki i podkreślenia, musi kończyć się `.md` i nie może zawierać ścieżki do innego katalogu. Dzięki temu link nie może odczytać pliku spoza folderu modułu. Plik Markdown i sam moduł są objęte ochroną `/members/*`.

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

Parser obsługuje nagłówki `#`, `##`, `###`, akapity, listy numerowane i punktowane, cytaty `>`, pogrubienie `**tekst**`, kursywę `*tekst*`, kod, bezpieczne linki oraz obrazy. Obraz można trzymać w podfolderze modułu i wstawić np. jako `![Opis](obrazy/schemat.png)`. Surowy HTML jest wyświetlany jako tekst i nie jest wykonywany.

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
| `type` | nie | `text` (domyślnie), `number`, `choice` albo `abcd`. |
| `label` | nie | Podpis pola lub polecenie nad odpowiedziami. |
| `placeholder` | nie | Przykład wyświetlany w pustym polu. |
| `hint` | nie | Podpowiedź pokazywana po błędnej próbie. |
| `success` | nie | Komunikat po poprawnej odpowiedzi. |
| `options` | dla `choice` i `abcd` | Opcje rozdzielone `|`. `choice` wymaga co najmniej dwóch, a `abcd` dokładnie czterech opcji. |
| `case_sensitive` | nie | `true`/`tak`, jeśli wielkość liter ma mieć znaczenie. Domyślnie tekst jest sprawdzany bez rozróżniania wielkości liter. |

Można również używać polskich nazw pól bez znaków diakrytycznych lub z nimi: `typ`, `odpowiedź`, `etykieta`, `przykład`, `podpowiedź`, `sukces`, `opcje`, `wielkość liter`.

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

Postęp, rozwiązane zadania i ukończenie są zachowywane w `sessionStorage`, czyli przy odświeżeniu w tej samej karcie. Przycisk **Powtórz lekcję** czyści ten postęp. Odpowiedzi znajdują się w statycznym pliku Markdown, więc ten moduł służy do nauki i samosprawdzenia, a nie do tajnych lub punktowanych egzaminów.

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

Pliki promptów umieszczaj w prywatnym katalogu `netlify/functions/chat-prompts/`. Nie są publikowane jako pliki statyczne; `netlify.toml` dołącza je wyłącznie do paczki funkcji. Zmiana promptu wymaga nowego deployu.

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

Link do drugiego punktu: `/members/module/chat/?plik=prompty-przyklad.txt&punkt=2`. Nagłówki `::punkt N` pozwalają umieszczać wewnątrz promptu zwykłe listy `1.`, `2.` bez przypadkowego podziału. Nazwa pliku, numer punktu i treść są ponownie walidowane po stronie funkcji; klient nie może przesłać własnego pola `system`.

Obsługiwany jest też prostszy zapis zgodny ze zwykłą numerowaną listą:

```txt
1. Naprowadzaj na rozwiązanie zadania bez podawania od razu wyniku.
2. Sprawdź odpowiedź, jednostki i cyfry znaczące.
```

Nie mieszaj obu zapisów w jednym pliku. Jeżeli pojedyncza instrukcja sama zawiera numerowaną listę, użyj wariantu `::punkt N`, aby granice punktów pozostały jednoznaczne.

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

Oba polecenia uruchamiają bez zależności frameworkowych testy hooków Identity, autoryzacji czatu, zachowania klienta auth i spójności plików statycznych. Netlify wykonuje `npm run build` przed publikacją katalogu `public`.

Opcjonalna kontrola składni wszystkich plików JavaScript:

```bash
find public netlify -type f \( -name '*.js' -o -name '*.mjs' \) -exec node --check {} \;
```

Przed publikacją wykonaj też krótki test ręczny:

1. konto bez roli jest odsyłane do logowania;
2. każda z używanych ról otwiera dashboard i właściwe materiały;
3. drugie logowanie wylogowuje pierwszą przeglądarkę po kontroli sesji;
4. wygasła rola czasowa blokuje czat i panel;
5. zmiana imienia i nazwiska pozostaje po odświeżeniu;
6. administrator widzi listę kont, a zwykły kursant nie widzi panelu administracyjnego;
7. zmiana roli w panelu działa po ponownym logowaniu i nie przedłuża czasu przy samej zmianie nazwiska;
8. formularz kontaktowy pojawia się w Netlify Forms, a administrator może odczytać testowe zgłoszenie;
9. edycja dashboardu działa po odświeżeniu i można ją przywrócić do wersji z wdrożenia;
10. linki Google i YouTube działają na docelowej domenie i przy docelowych ustawieniach udostępniania.
