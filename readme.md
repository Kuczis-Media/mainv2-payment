# ChemDisk — platforma kursów maturalnych

ChemDisk jest statyczną aplikacją wdrażaną na Netlify. Publiczna strona prowadzi do logowania przez Netlify Identity, a zalogowany kursant otrzymuje panel z materiałami zdefiniowanymi w pliku Markdown. Dostęp kontrolują role zapisane przez administratora w `app_metadata`.

## Architektura

```text
public/
├── index.html                         # publiczna strona startowa
├── login/                             # logowanie, rejestracja i odzyskiwanie konta
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
├── admin-forms.js                     # odczyt/usuwanie zgłoszeń Netlify Forms
├── admin-dashboard.js                 # aktywny Markdown w Netlify Blobs
├── chat-prompts/                      # prywatne prompty dołączane do funkcji
└── chat.mjs                           # chronione połączenie z Gemini i limit Netlify
netlify/admin-common.js                # wspólna kanoniczna autoryzacja administratora
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

Dla lokalnego czatu, zakładki formularzy i edytora dashboardu utwórz nieśledzony plik `.env`:

```dotenv
GEMINI_API_KEY=klucz_z_Google_AI_Studio
NETLIFY_API_TOKEN=osobisty_token_Netlify
SITE_ID=id_witryny_Netlify
```

Nie umieszczaj kluczy w `public`, plikach JavaScript przeglądarki, `dashboard.md` ani `netlify.toml`. `SITE_ID` jest ustawiane automatycznie na wdrożeniu Netlify; ręcznie jest potrzebne tylko lokalnie.

## Wdrożenie na Netlify

1. Utwórz witrynę z tego repozytorium. Ustawienia publikacji i funkcji są już zapisane w `netlify.toml` (`public` oraz `netlify/functions`).
2. Włącz Netlify Identity. W ustawieniach rejestracji wybierz rejestrację otwartą albo tylko na zaproszenie, zależnie od sposobu sprzedaży kursu. Jeśli wymagane jest potwierdzenie e-maila, pozostaw włączone wiadomości potwierdzające.
3. Dodaj `GEMINI_API_KEY` oraz `NETLIFY_API_TOKEN` w zmiennych środowiskowych witryny i ustaw ich zakres na **Functions**. Token Netlify umożliwia zakładce administracyjnej obsługę zgłoszeń Forms oraz silnie spójny dostęp edytora dashboardu do Netlify Blobs; traktuj go jak sekret. `SITE_ID` Netlify ustawia automatycznie.
4. Pierwszemu administratorowi przypisz ręcznie rolę `admin` w `app_metadata` w panelu Netlify Identity. Kolejnymi kontami można już zarządzać z panelu administratora w dashboardzie.
5. Po rejestracji przypisz użytkownikowi jedną z ról dostępu opisaną niżej. Nowe konto bez roli może się uwierzytelnić, ale nie otworzy `/members/`.
6. Udostępnij osadzane pliki Google odbiorcom, którzy mają je oglądać. Aplikacja nie omija uprawnień Dysku, Prezentacji ani Formularzy Google.
7. Jeżeli używasz własnej domeny, ustaw ją jako główną domenę witryny, włącz HTTPS i sprawdź na niej link potwierdzający oraz zaproszenie Identity. Kod korzysta ze ścieżek same-origin i `location.origin`, więc nie wymaga zamiany `chemdisk.netlify.app` na `chemdisk.pl` w plikach.
8. Po pierwszym deployu sprawdź logowanie, trzy zakładki panelu administratora, formularz kontaktowy, czat oraz po jednym materiale Google i YouTube na docelowej domenie.

Dodanie `chemdisk.pl` jako domeny własnej do tej samej witryny nie zmienia danych. Utworzenie całkiem nowej witryny Netlify to migracja, nie sama zmiana domeny: użytkownicy Identity, zgłoszenia Forms i site-wide Blobs nie są automatycznie kopiowane między witrynami.

W logu deployu sprawdź również etap post-processingu: Netlify powinien potwierdzić regułę limitu wywołań funkcji `chat`. Platformowy limit per IP jest uzupełniony limitem per konto wewnątrz funkcji.

Formularz kontaktowy jest oznaczony `data-netlify="true"` i korzysta z Netlify Forms oraz reCAPTCHA. Netlify musi przetworzyć stronę podczas deployu, aby formularz pojawił się w panelu witryny.

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

Okres roli czasowej zaczyna się przy pierwszym udanym logowaniu po jej przypisaniu. Ponowne logowanie nie przedłuża działającego okresu. Po wygaśnięciu klient blokuje dostęp, a przy kolejnym logowaniu hook usuwa wygasłą rolę; aby przyznać kolejny okres, administrator musi ponownie nadać odpowiednią rolę.

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
- przeglądać i trwale usuwać zgłoszenia Netlify Forms;
- edytować, podglądać, publikować i przywracać Markdown dashboardu;
- obsłużyć całą listę użytkowników dzięki stronicowaniu.

Interfejs wysyła JWT zalogowanego administratora do `/.netlify/functions/admin-users`. Funkcja ponownie pobiera aktualny rekord administratora z Identity, dopiero wtedy używa dostarczonego przez środowisko Netlify krótkotrwałego tokena operatora do listowania lub aktualizacji kont. Token operatora nigdy nie jest zwracany do przeglądarki. Funkcja blokuje odebranie sobie własnej roli administratora i zachowuje `session_id` oraz niezwiązane metadane konta.

Przy rzeczywistej zmianie roli stare `timed_access` jest czyszczone. Nowa rola czasowa rozpoczyna okres przy następnym logowaniu użytkownika. Sama poprawka imienia lub nazwiska z pozostawioną aktywną rolą czasową nie zeruje jej bieżącego terminu. Zmiany ról są w pełni widoczne po odświeżeniu tokenu albo ponownym logowaniu.

Panel pokazuje termin aktywnej roli czasowej. Po wygaśnięciu pojawia się jawna akcja **Odnów ten okres**; dopiero ona przygotowuje nowy okres do uruchomienia przy kolejnym logowaniu. Zwykłe zapisanie nazwiska nie odnawia dostępu przypadkiem.

Panel administracyjny wymaga środowiska Netlify Functions (`netlify dev` lub deployu), ponieważ lokalne otwarcie statycznego HTML nie dostarcza serwerowego kontekstu Identity. Jeśli kontekst administratora Identity nie jest dostępny, endpoint kończy żądanie bezpiecznym błędem `503` zamiast wykonywać operację bez weryfikacji.

Zakładka **Formularze** pokazuje formularze przetworzone przez Netlify Forms, np. `members-contact` oraz publiczny `contact`. Nie pobiera odpowiedzi z osadzonych Google Forms — te pozostają w Google Forms/Sheets. Każde usunięcie wymaga potwierdzenia, a funkcja wydaje dla konkretnego zgłoszenia krótkotrwały, podpisany token; `NETLIFY_API_TOKEN` nigdy nie trafia do przeglądarki.

## Edycja dashboardu

Wersją bazową jest `public/members/dashboard.md`. Administrator może również zapisać aktywną wersję w zakładce **Dashboard** bez wykonywania deployu. Jest ona przechowywana w Netlify Blobs, a zapis używa kontroli wersji (`etag`) i silnie spójnego dostępu przez serwerowe `NETLIFY_API_TOKEN` oraz `SITE_ID`, aby dwóch administratorów nie nadpisało sobie zmian po cichu. Sekretny token nie jest wysyłany do przeglądarki. Przycisk przywracania atomowo dezaktywuje override i ponownie aktywuje plik z wdrożenia.

Panel kursanta najpierw próbuje pobrać aktywną wersję z funkcji, a gdy jej nie ma lub magazyn jest chwilowo niedostępny, bezpiecznie wraca do `dashboard.md`. Nie trzeba zmieniać `index.html`.

Magazyn `chemdisk-dashboard` jest site-wide i pozostaje po kolejnych wdrożeniach. Deploy Preview tej samej witryny również może zobaczyć ten magazyn, dlatego nie publikuj zmian z podglądu, jeśli nie mają trafić do produkcyjnego dashboardu. Lokalny `netlify dev` korzysta z lokalnego magazynu testowego.

Obsługiwana składnia:

```md
# Tytuł panelu

Krótki tekst powitalny.

> Komunikat widoczny nad wszystkimi działami.

## Stechiometria

Opis działu wyświetlany pod jego nazwą.

> Opcjonalny komunikat tylko dla tego działu.

### Lekcja 1 — obliczenia molowe

Ta linia opisuje rozwijaną listę.

- [Prezentacja](/members/module/slides/?id=ID_PLIKU&type=2) — Slajdy do lekcji.
- [Zestaw zadań](/members/module/pdf/?id=ID_PLIKU&type=1) — Zadania do samodzielnej pracy.
```

Zasady parsera:

- pojedynczy `#` ustawia tytuł panelu;
- `##` rozpoczyna dział i tworzy pozycję w menu;
- `###` wewnątrz działu rozpoczyna harmonijkę; kolejne opisy, komunikaty i karty należą do niej aż do następnego `###` albo `##`;
- zwykły tekst pod tytułem lub działem staje się opisem;
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
| `/members/module/lesson/` | `file` — plik `.md` z folderu modułu; prezentacja krokowa z opcjonalnymi zadaniami. | `/members/module/lesson/?file=przyklad.md` |
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
├── przyklad.md
└── moja-lekcja.md
```

Lekcję otwiera parametr `file`:

```text
/members/module/lesson/?file=moja-lekcja.md
```

Do dashboardu można dodać ją jak każdy inny materiał:

```md
- [Izotopy węgla](/members/module/lesson/?file=przyklad.md) — Lekcja interaktywna z krótkim zadaniem.
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
| `type` | nie | `text` (domyślnie), `number` albo `choice`. |
| `label` | nie | Podpis pola lub polecenie nad odpowiedziami. |
| `placeholder` | nie | Przykład wyświetlany w pustym polu. |
| `hint` | nie | Podpowiedź pokazywana po błędnej próbie. |
| `success` | nie | Komunikat po poprawnej odpowiedzi. |
| `options` | dla `choice` | Co najmniej dwie opcje rozdzielone `|`. Jedna musi odpowiadać wartości `answer`. |
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
