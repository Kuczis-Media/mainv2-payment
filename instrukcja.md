# ChemDisk — kompletna instrukcja od zera

Ta instrukcja jest przeznaczona dla osoby, która nie musi znać programowania. Prowadzi od założenia kont, przez wdrożenie aplikacji, aż do codziennego dodawania lekcji, użytkowników i płatności.

Stan instrukcji: 24 lipca 2026 r. Nazwy pojedynczych przycisków w GitHubie, Netlify, Google lub Stripe mogą z czasem zostać lekko zmienione, ale opisane miejsca i zasady pozostają takie same.

## 1. Najważniejsze pojęcia

W tej aplikacji występują trzy różne rodzaje kont i dwa różne rodzaje repozytoriów.

### Konta

1. **Konto GitHub** — służy do przechowywania kodu aplikacji oraz osobnych plików lekcji i promptów.
2. **Konto Netlify** — publikuje stronę, uruchamia funkcje serwerowe, obsługuje logowanie, formularze i magazyn danych.
3. **Konto Stripe** — obsługuje płatności.
4. **Konto Google** — służy do utworzenia klucza Gemini oraz opcjonalnie do przechowywania Prezentacji, PDF-ów i Formularzy Google.

Kursant nie musi mieć konta GitHub, Netlify ani Stripe. Kursant ma zwykłe konto utworzone w systemie logowania strony.

### Repozytoria

- **Repozytorium aplikacji** zawiera kod ChemDisk. Otrzymujesz do niego od właściciela oprogramowania link GitHub. W tej instrukcji nie podajemy konkretnego adresu, ponieważ właściciel może go zmienić.
- **Repozytorium materiałów** tworzysz osobno. Zawiera lekcje `.md` i prompty `.json` lub `.txt`. Może być prywatne.
- Można podłączyć jedno albo kilka repozytoriów materiałów.
- Repozytorium obrazów może być publiczne. Lekcja używa wtedy zwykłych adresów HTTPS do obrazów.

### Co oznacza deploy

**Deploy** to opublikowanie nowej wersji kodu aplikacji na Netlify.

- Zmiana kodu aplikacji wymaga nowego deployu.
- Dodanie, poprawienie lub usunięcie lekcji albo promptu w repozytorium materiałów nie wymaga deployu aplikacji.
- Opublikowanie dashboardu w Studio również nie wymaga deployu.
- Zmiana klucza lub zmiennej środowiskowej wymaga uruchomienia nowego deployu, aby funkcje dostały nową konfigurację.

## 2. Jak działa całość

| Element | Do czego służy | Czy wymaga klucza |
| --- | --- | --- |
| GitHub — repo aplikacji | Przechowuje kod ChemDisk i uruchamia automatyczne deploye | Nie dla aplikacji; potrzebny jest dostęp konta GitHub |
| GitHub — repo materiałów | Przechowuje prywatne lekcje i prompty | Tak, fine-grained token |
| Netlify Hosting | Publikuje stronę z katalogu `public` | Nie |
| Netlify Functions | Bezpiecznie łączy stronę z Gemini, GitHubem i Stripe | Korzysta z kluczy zapisanych w Netlify |
| Netlify Identity | Rejestracja, logowanie, reset hasła, użytkownicy i role | Nie |
| Netlify Forms | Formularz publiczny i kontakt kursanta | Nie |
| Netlify Blobs | Aktywny dashboard, cennik i historia dostępu | W tej aplikacji używa tokenu Netlify |
| Gemini API | Asystent AI | Tak, `GEMINI_API_KEY` |
| Stripe | Checkout i płatności za czas dostępu | Tak, klucz tajny i sekret webhooka |
| Google Drive / Slides / Forms | PDF-y, prezentacje, filmy Drive i formularze | Nie, ale pliki muszą mieć prawidłowe udostępnianie |
| YouTube | Filmy w dashboardzie i lekcjach | Nie |
| NumWorks | Kalkulator naukowy | Nie |
| tldraw | Zewnętrzna biała tablica | Nie |
| ATONOM | Lokalne modele związków chemicznych | Nie |

Pozostałe połączenia techniczne, które nie wymagają własnego klucza:

- `identity.netlify.com` dostarcza używany przez aplikację interfejs Netlify Identity;
- `cdn.jsdelivr.net` dostarcza część ikon i publicznych grafik;
- `cdnjs.cloudflare.com` dostarcza Font Awesome na stronie publicznej;
- `fonts.googleapis.com` dostarcza używane kroje pisma;
- MathJax z jsDelivr wyświetla wzory matematyczne i reakcje chemiczne w czacie, kreatorze oraz lekcjach;
- `raw.githubusercontent.com` może dostarczać publiczne obrazy użyte w lekcjach;
- publiczna strona ATONOM jest osobnym odnośnikiem na stronie głównej, a chroniony moduł ATONOM znajduje się również lokalnie w ChemDisk.

Awaria CDN albo zablokowanie go przez rozszerzenie przeglądarki może czasowo ukryć ikonę, font, wzór lub zewnętrzny moduł, ale nie zmienia kont i ról użytkowników.

## 3. Kolejność pierwszej konfiguracji

Najbezpieczniej wykonać czynności w tej kolejności:

1. Załóż konto GitHub i uzyskaj dostęp do repozytorium aplikacji.
2. Załóż konto Netlify i wdroż projekt z GitHuba.
3. Włącz Netlify Identity.
4. Utwórz pierwsze konto administratora.
5. Utwórz prywatne repozytorium materiałów.
6. Utwórz wąski token GitHub tylko do repozytorium materiałów.
7. Dodaj zmienne GitHub do Netlify.
8. Utwórz klucz Gemini i dodaj go do Netlify.
9. Utwórz token Netlify i dodaj go do Netlify.
10. Utwórz sandbox Stripe, klucz testowy i webhook.
11. Wykonaj ponowny deploy.
12. Przetestuj logowanie, administratora, lekcję, czat, formularz i płatność.
13. Dopiero po pełnych testach przełącz Stripe na prawdziwe płatności.

## 4. Konto GitHub i dostęp do kodu

### 4.1. Założenie konta

1. Otwórz [stronę rejestracji GitHub](https://github.com/signup).
2. Podaj e-mail, utwórz hasło i nazwę użytkownika.
3. Potwierdź adres e-mail.
4. Włącz uwierzytelnianie dwuskładnikowe, czyli 2FA. Jest to szczególnie ważne, ponieważ konto będzie miało dostęp do kodu i materiałów.

### 4.2. Otrzymanie aplikacji

1. Właściciel oprogramowania przekazuje Ci link do repozytorium aplikacji.
2. Jeśli repozytorium jest prywatne, właściciel musi również nadać Twojemu kontu dostęp.
3. Zaakceptuj ewentualne zaproszenie wysłane przez GitHub.
4. Otwórz otrzymany link po zalogowaniu.
5. Jeżeli widzisz listę plików, dostęp działa.

Nie wpisuj linku właściciela na stałe do tej instrukcji. W Netlify wybierzesz repozytorium z listy udostępnionej Twojemu kontu.

## 5. Utworzenie strony na Netlify

### 5.1. Konto Netlify

1. Otwórz [Netlify](https://app.netlify.com/).
2. Kliknij rejestrację.
3. Najwygodniej wybierz logowanie przez GitHub.
4. Potwierdź dostęp Netlify do konta GitHub.
5. Jeśli Netlify pyta o utworzenie zespołu, możesz na początku utworzyć własny zespół.

### 5.2. Import repozytorium aplikacji

1. Na głównym ekranie Netlify kliknij **Add new project**.
2. Wybierz **Import an existing project**.
3. Wybierz **GitHub**.
4. Zezwól aplikacji Netlify na odczyt repozytorium aplikacji.
5. Wybierz repozytorium otrzymane od właściciela oprogramowania.
6. Jeżeli go nie widzisz:
   - kliknij konfigurację dostępu GitHub;
   - przy aplikacji Netlify wybierz dostęp do wskazanego repozytorium;
   - upewnij się, że zaakceptowano zaproszenie do prywatnego repozytorium;
   - wróć do Netlify i odśwież listę.
7. Ustaw lub sprawdź:
   - **Build command:** `npm run build`
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions`
8. Ustawienia te znajdują się już w `netlify.toml`, więc Netlify powinno je wykryć automatycznie.
9. Kliknij **Publish** albo **Deploy**.
10. Poczekaj, aż deploy otrzyma status **Published**.

Netlify nada stronie tymczasowy adres zakończony `.netlify.app`. Własną domenę można dodać później w **Domain management → Production domains**.

### 5.3. Automatyczne aktualizacje kodu

Po połączeniu z GitHubem każdy push lub commit do używanej gałęzi repozytorium aplikacji uruchamia nowy deploy. Materiały z osobnego repo nie uruchamiają deployu i nie muszą go uruchamiać.

Jeżeli Netlify jest połączone bezpośrednio z repozytorium właściciela, jego nowy commit na używanej gałęzi uruchomi deploy automatycznie. Jeżeli utworzysz własny fork lub osobną kopię repozytorium, późniejsze zmiany właściciela nie pojawią się w niej samoczynnie — trzeba je scalić do swojej kopii.

### 5.4. Własna domena

1. W Netlify otwórz **Domain management → Production domains**.
2. Kliknij **Add a domain**.
3. Wybierz kupno domeny albo dodanie domeny posiadanej u innego operatora.
4. Przy domenie zewnętrznej przepisz rekordy DNS dokładnie według instrukcji Netlify.
5. Poczekaj na aktywację DNS i certyfikatu HTTPS.
6. Ustaw właściwy adres jako domenę główną.
7. Wyślij nowe zaproszenie testowe Identity i sprawdź, czy link prowadzi na prawidłową domenę.
8. Zaktualizuj adres endpointu Stripe, jeżeli chcesz używać własnej domeny zamiast `.netlify.app`, i skopiuj sekret tego endpointu do Netlify.

Dodanie domeny do tej samej witryny nie kopiuje ani nie usuwa użytkowników, Forms i Blobs. Utworzenie nowej witryny Netlify jest już migracją danych.

### 5.5. Sprawdzanie deployu i powrót do starszej wersji

1. Wejdź do zakładki **Deploys**.
2. Otwórz najnowszy deploy.
3. Sprawdź, czy etap `npm run build` zakończył się powodzeniem.
4. W razie błędu otwórz log i znajdź pierwszą czerwoną informację.
5. Jeżeli nowy kod jest wadliwy, wybierz wcześniej działający deploy i użyj opcji ponownego opublikowania.

Powrót do starszego deployu kodu nie cofa automatycznie site-wide danych Blobs, historii Stripe ani commitów repozytorium materiałów.

## 6. Włączenie logowania Netlify Identity

Aplikacja ma już gotowy interfejs logowania. Nie trzeba pisać formularza ani instalować dodatkowego kodu.

1. Otwórz projekt w Netlify.
2. Wejdź w **Project configuration → Identity**.
3. Kliknij **Enable Identity**.
4. Otwórz ustawienia rejestracji.
5. Wybierz jeden z trybów:
   - **Invite only** — zalecany dla zamkniętego kursu; konto powstaje po zaproszeniu;
   - **Open** — każdy może utworzyć konto, ale bez roli i tak nie otworzy materiałów.
6. Pozostaw potwierdzanie e-maila włączone, jeśli chcesz ograniczyć fałszywe konta.
7. Wykonaj nowy deploy, jeśli Netlify o to poprosi.

Oficjalna instrukcja: [włączenie Netlify Identity](https://docs.netlify.com/manage/security/secure-access-to-sites/identity/get-started/).

## 7. Pierwszy administrator

Pierwszego administratora trzeba nadać w Netlify. Następnych administratorów można już tworzyć z panelu ChemDisk.

1. W Netlify przejdź do **Project configuration → Identity → Users**.
2. Zaproś swój adres e-mail.
3. Otwórz wiadomość z zaproszeniem.
4. Wejdź w link i ustaw hasło mające co najmniej 10 znaków.
5. Wróć do listy użytkowników Identity.
6. Otwórz swoje konto.
7. W edycji ról lub `app_metadata` dodaj rolę:

   ```json
   {
     "roles": ["admin"]
   }
   ```

8. Zapisz.
9. Wyloguj się ze strony ChemDisk i zaloguj ponownie.
10. W bocznym menu powinien pojawić się **Panel administratora** i wejście do **Studio treści**.

Jeśli Netlify pokazuje osobne pole **Roles**, wpisz po prostu `admin`; nie trzeba wtedy ręcznie edytować JSON. Oficjalna dokumentacja potwierdza, że role można ustawiać w szczegółach użytkownika: [Identity w Functions i role](https://docs.netlify.com/manage/security/secure-access-to-sites/identity/use-identity-in-functions/).

Nie wpisuj ról do `user_metadata`. Uprawnienia aplikacji pochodzą wyłącznie z `app_metadata`.

## 8. Wszystkie zmienne i klucze

### 8.1. Zmienne, które trzeba skonfigurować

| Zmienna | Czy obowiązkowa | Skąd ją wziąć | Do czego służy |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | Dla czatu AI | Google AI Studio | Wywołania modelu `gemini-2.5-flash` |
| `GITHUB_CONTENT_TOKEN` | Dla repo materiałów | GitHub fine-grained PAT | Odczyt, zapis i usuwanie lekcji/promptów |
| `GITHUB_CONTENT_REPOSITORY` | Przy jednym repo | Właściciel i nazwa repo GitHub | Wskazuje repo, np. `login/nazwa-repo` |
| `GITHUB_CONTENT_REF` | Zalecana | Nazwa gałęzi | Zwykle `main` |
| `GITHUB_CONTENT_ROOT` | Opcjonalna | Własny układ repo | Pusty albo np. `materials` |
| `GITHUB_CONTENT_REPOSITORIES` | Przy wielu repo | Tworzysz samodzielnie jako JSON | Lista repozytoriów do selektora |
| `GITHUB_CONTENT_TOKEN_DOWOLNA_NAZWA` | Opcjonalna | Osobny token GitHub | Token dla repo innego właściciela |
| `NETLIFY_API_TOKEN` | Dla Forms, Blobs i pełnego panelu admina | Konto Netlify | Dostęp serwerowy do bieżącej witryny |
| `STRIPE_SECRET_KEY` | Dla płatności | Sandbox lub live Stripe | Tworzenie i sprawdzanie Checkout |
| `STRIPE_WEBHOOK_SECRET` | Dla płatności | Endpoint webhooka Stripe | Sprawdzenie podpisu zdarzeń |

### 8.2. Zmienne ustawiane automatycznie przez Netlify

Nie twórz ich ręcznie w produkcyjnym projekcie:

| Zmienna | Znaczenie |
| --- | --- |
| `SITE_ID` | Identyfikator projektu Netlify; w interfejsie może nazywać się **Project ID** |
| `URL` | Główny adres produkcyjny strony |
| `DEPLOY_PRIME_URL` | Główny adres danego deployu |
| `DEPLOY_URL` | Adres konkretnego deployu |

`SITE_ID` wpisuje się ręcznie tylko do lokalnego pliku `.env`, jeśli uruchamiasz projekt na swoim komputerze.

### 8.3. Gdzie dodać zmienne w Netlify

1. Otwórz projekt Netlify.
2. Wejdź w **Project configuration → Environment variables**.
3. Kliknij dodanie zmiennej.
4. Wpisz nazwę, na przykład `GEMINI_API_KEY`.
5. Wklej wartość.
6. Oznacz sekret jako zawierający poufną wartość, jeśli interfejs oferuje taką opcję.
7. Zakres musi obejmować **Functions**. Na planach bez osobnego wyboru zakresu pozostaw dostępność domyślną.
8. Dla produkcyjnych sekretów wybierz kontekst **Production**.
9. Dla Deploy Preview używaj osobnych danych testowych albo nie udostępniaj tam sekretów.
10. Po dodaniu lub zmianie zmiennych uruchom **Deploys → Trigger deploy → Deploy site**.

Oficjalna instrukcja: [zmienne środowiskowe Netlify](https://docs.netlify.com/build/environment-variables/get-started/).

### 8.4. Najważniejsza zasada bezpieczeństwa

Kluczy nigdy nie wolno:

- wklejać do pliku w `public`;
- dodawać do `dashboard.md`, lekcji lub promptu;
- commitować do GitHuba;
- wpisywać w kod JavaScript działający w przeglądarce;
- wysyłać kursantom;
- pokazywać na zrzucie ekranu.

Klucz w repozytorium prywatnym również należy uznać za ujawniony. Repozytorium prywatne nie jest sejfem na sekrety.

## 9. Prywatne repozytorium lekcji i promptów

### 9.1. Utworzenie repozytorium

1. Zaloguj się do GitHuba.
2. W prawym górnym rogu kliknij **+ → New repository**.
3. Wybierz właściciela.
4. Wpisz dowolną nazwę repozytorium materiałów.
5. Wybierz **Private**.
6. Zaznacz utworzenie pliku README, aby repo nie było puste.
7. Kliknij **Create repository**.

Oficjalna instrukcja: [tworzenie repozytorium GitHub](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository).

### 9.2. Wymagana struktura

Repo powinno wyglądać tak:

```text
repozytorium-materialow/
├── catalog.json             # opcjonalny
├── lessons/
│   ├── stechiometria.md
│   └── izotopy.md
└── prompts/
    ├── korepetytor.json
    └── zestaw-promptow.txt
```

GitHub nie przechowuje pustych folderów. Aby utworzyć pierwszy folder:

1. Kliknij **Add file → Create new file**.
2. W polu nazwy wpisz `lessons/start.md`.
3. Wpisz na przykład `# Pierwsza lekcja` albo pozostaw plik pusty i później wczytaj go do Lesson Buildera.
4. Kliknij **Commit changes**.
5. Powtórz z plikiem `prompts/start.json` i wpisz poprawną treść, np.:

   ```json
   {
     "prompt": "Pomagaj uczniowi zrozumieć zadanie krok po kroku."
   }
   ```

Można też od razu utworzyć nową lekcję i prompt w Studio po podłączeniu tokenu.

### 9.3. Token GitHub ograniczony tylko do repo materiałów

Nie używaj klasycznego tokenu do całego konta. Utwórz **fine-grained personal access token** ograniczony do wybranego repozytorium.

1. Kliknij zdjęcie profilowe GitHub.
2. Wybierz **Settings**.
3. Na dole lewego menu wybierz **Developer settings**.
4. Wybierz **Personal access tokens → Fine-grained tokens**.
5. Kliknij **Generate new token**.
6. Wpisz nazwę, np. `ChemDisk materiały`.
7. Ustaw datę wygaśnięcia. Zanotuj ją w kalendarzu.
8. W **Resource owner** wybierz właściciela repozytorium materiałów.
9. W **Repository access** wybierz **Only select repositories**.
10. Wskaż wyłącznie repozytorium lub repozytoria materiałów.
11. W **Repository permissions** znajdź **Contents**.
12. Ustaw **Read and write**.
13. Pozostałe dodatkowe uprawnienia pozostaw wyłączone lub tylko domyślne.
14. Kliknij **Generate token**.
15. Natychmiast skopiuj wartość zaczynającą się zwykle od `github_pat_`.
16. Wklej ją do Netlify jako `GITHUB_CONTENT_TOKEN`.

Jeśli repo należy do organizacji, token może oczekiwać na zatwierdzenie przez administratora organizacji. Do czasu zatwierdzenia aplikacja nie odczyta plików.

Oficjalna instrukcja: [zarządzanie fine-grained tokenami GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).

### 9.4. Konfiguracja jednego repozytorium

Dodaj do Netlify:

```dotenv
GITHUB_CONTENT_TOKEN=github_pat_TUTAJ_WKLEJ_TOKEN
GITHUB_CONTENT_REPOSITORY=TWOJ_LOGIN/NAZWA_REPOZYTORIUM
GITHUB_CONTENT_REF=main
GITHUB_CONTENT_ROOT=
```

Ważne:

- `GITHUB_CONTENT_REPOSITORY` nie jest drugim kluczem. Jest zwykłym adresem w formie `właściciel/repo`.
- Bez tej zmiennej sam token nie wystarczy. W panelu pojawi się wtedy „Wymaga konfiguracji”.
- `GITHUB_CONTENT_ROOT` pozostaw pusty, jeżeli foldery `lessons` i `prompts` są w katalogu głównym.
- Jeżeli foldery leżą w `materials/lessons` i `materials/prompts`, ustaw `GITHUB_CONTENT_ROOT=materials`.

### 9.5. Konfiguracja kilku repozytoriów

Ustaw `GITHUB_CONTENT_TOKEN` oraz jedną zmienną `GITHUB_CONTENT_REPOSITORIES`:

```dotenv
GITHUB_CONTENT_TOKEN=github_pat_TUTAJ_WKLEJ_TOKEN
GITHUB_CONTENT_REPOSITORIES=[{"id":"glowne","label":"Materiały główne","repository":"TWOJ_LOGIN/pierwsze-repo","ref":"main","root":"","default":true},{"id":"organiczna","label":"Chemia organiczna","repository":"TWOJ_LOGIN/drugie-repo","ref":"main","root":""}]
```

Zasady:

- całość musi być poprawnym JSON-em w jednym wierszu;
- `id` zawiera małe litery, cyfry i myślniki;
- `label` jest nazwą widoczną w selektorze;
- `repository` ma format `właściciel/repo`;
- `default: true` ustaw przy jednym repo;
- maksymalnie można skonfigurować 20 repozytoriów;
- jeden token może obejmować kilka jawnie wybranych repo tego samego właściciela.
- ustawienie `GITHUB_CONTENT_REPOSITORIES` zastępuje konfigurację pojedynczego repo z `GITHUB_CONTENT_REPOSITORY`, `GITHUB_CONTENT_REF` i `GITHUB_CONTENT_ROOT`.

Jeżeli repozytoria mają różnych właścicieli zasobów, utwórz drugi token:

```dotenv
GITHUB_CONTENT_TOKEN=github_pat_TOKEN_PIERWSZEGO_WLASCICIELA
GITHUB_CONTENT_TOKEN_SZKOLA=github_pat_TOKEN_DRUGIEGO_WLASCICIELA
GITHUB_CONTENT_REPOSITORIES=[{"id":"glowne","label":"Moje materiały","repository":"LOGIN/pierwsze-repo","default":true},{"id":"szkola","label":"Materiały szkoły","repository":"ORGANIZACJA/drugie-repo","tokenEnv":"GITHUB_CONTENT_TOKEN_SZKOLA"}]
```

Nazwa dodatkowej zmiennej tokenu musi zaczynać się od `GITHUB_CONTENT_TOKEN`.

### 9.6. Czy po dodaniu lekcji trzeba robić deploy

Nie.

1. Dodajesz lub poprawiasz plik w `lessons/`.
2. GitHub zapisuje commit w repo materiałów.
3. Aplikacja pobiera aktualną listę przez GitHub API.
4. Lista może być pamiętana najwyżej przez około 20 sekund.
5. Administrator może kliknąć odświeżenie w zakładce **Materiały**.

Deploy jest potrzebny tylko po zmianie konfiguracji `GITHUB_CONTENT_*`, a nie po zmianie plików.

### 9.7. Opcjonalny `catalog.json`

Plik pozwala dodać tytuł, opis i tagi używane przez wyszukiwarkę:

```json
{
  "assets": {
    "lessons/izotopy.md": {
      "title": "Izotopy",
      "description": "Lekcja o liczbach A i Z.",
      "tags": ["atom", "matura"]
    },
    "prompts/korepetytor.json": {
      "title": "Korepetytor chemii",
      "description": "Naprowadza ucznia bez podawania od razu wyniku.",
      "tags": ["ai", "pomoc"]
    }
  }
}
```

Plik jest opcjonalny. Bez niego aplikacja użyje nazwy pliku.

### 9.8. Obrazy w publicznym repozytorium

1. Utwórz osobne publiczne repo obrazów albo użyj istniejącego.
2. Wgraj plik przez **Add file → Upload files**.
3. Zapisz commit.
4. Otwórz obraz i wybierz widok **Raw**.
5. Skopiuj pełny adres zaczynający się od `https://`.
6. W Lesson Builderze przeciągnij **Obraz z URL** i wklej adres.

Token prywatnego repo lekcji nie pobiera obrazów. Obrazy muszą być dostępne przez publiczny HTTPS.

## 10. Klucz Gemini

Aplikacja używa Gemini tylko po stronie Netlify Function. Kursant nie otrzymuje klucza.

### 10.1. Utworzenie klucza

1. Zaloguj się na konto Google.
2. Otwórz [Google AI Studio](https://aistudio.google.com/apikey).
3. Zaakceptuj warunki korzystania.
4. Otwórz sekcję **API Keys**.
5. Nowemu użytkownikowi Google może automatycznie utworzyć projekt i klucz.
6. Jeśli klucza nie ma, kliknij **Create API key**.
7. Wybierz istniejący projekt Google Cloud albo utwórz nowy.
8. Skopiuj wygenerowany klucz.
9. W Netlify dodaj:

   ```dotenv
   GEMINI_API_KEY=TUTAJ_WKLEJ_KLUCZ
   ```

10. Wykonaj nowy deploy.

Aktualne klucze tworzone w AI Studio mogą być kluczami autoryzacyjnymi powiązanymi z kontem usługi. Jest to prawidłowe. Oficjalna instrukcja: [klucze Gemini API](https://ai.google.dev/gemini-api/docs/api-key).

### 10.2. Limity i koszty

- Wywołania korzystają z limitów projektu Google.
- Kod używa modelu `gemini-2.5-flash`.
- Funkcja ma dodatkowy limit 12 żądań na minutę na użytkownika w danej instancji.
- Netlify nakłada również limit 30 żądań na minutę według IP i domeny.
- Włączenie płatnego poziomu Gemini może powodować koszty. Ustaw budżet i alerty w Google Cloud.
- W Google AI Studio sprawdzaj **Usage** oraz stan limitów.

### 10.3. Test

1. Utwórz prompt w `prompts/`.
2. Dodaj w dashboardzie kartę **Asystent AI**.
3. Zaloguj się kontem z aktywnym dostępem.
4. Wyślij krótkie pytanie.
5. Jeśli pojawia się błąd usługi:
   - sprawdź nazwę `GEMINI_API_KEY`;
   - sprawdź, czy klucz nie został cofnięty;
   - sprawdź limity i rozliczenia projektu Google;
   - sprawdź log funkcji `chat` w Netlify;
   - wykonaj deploy po zmianie klucza.

## 11. Token Netlify

`NETLIFY_API_TOKEN` pozwala funkcjom tej aplikacji odczytywać i usuwać zgłoszenia Forms oraz korzystać z magazynów Blobs ze wskazanej witryny.

W przeciwieństwie do fine-grained tokenu GitHub, osobisty token Netlify jest powiązany z kontem Netlify i jego dostępem do zespołów. Jeżeli chcesz ograniczyć skutki ewentualnego wycieku, użyj osobnego konta operatorskiego mającego dostęp tylko do potrzebnego zespołu lub projektu, ustaw datę wygaśnięcia i regularnie obracaj token.

### 11.1. Utworzenie

1. Zaloguj się do Netlify.
2. Kliknij ikonę użytkownika i otwórz **User settings**.
3. Przejdź do **Applications**.
4. Otwórz **Personal access tokens**.
5. Kliknij utworzenie nowego tokenu.
6. Nadaj nazwę, np. `ChemDisk produkcja`.
7. Ustaw rozsądną datę wygaśnięcia.
8. Jeśli Netlify pyta o zespół, przyznaj dostęp do zespołu będącego właścicielem projektu.
9. Wygeneruj token i od razu go skopiuj.
10. W projekcie Netlify dodaj:

   ```dotenv
   NETLIFY_API_TOKEN=TUTAJ_WKLEJ_TOKEN
   ```

11. Nie dodawaj produkcyjnego `SITE_ID` ręcznie w Netlify — jest zmienną systemową.
12. Wykonaj deploy.

Oficjalna instrukcja: [ustawienia użytkownika i tokeny Netlify](https://docs.netlify.com/manage/accounts-and-billing/user-settings/).

### 11.2. Do testów lokalnych

Do lokalnego `.env` wpisuje się także:

```dotenv
NETLIFY_API_TOKEN=token_witryny_testowej
SITE_ID=project_id_witryny_testowej
```

`Project ID` znajdziesz w **Project configuration → General → Project information**.

Używaj osobnej witryny testowej. Lokalny projekt z produkcyjnym tokenem i `SITE_ID` może zmienić prawdziwy dashboard, cennik lub historię płatności.

## 12. Stripe w sandboxie

Ta aplikacja sprzedaje jednorazowe okresy dostępu: godzinę, dzień, tydzień, miesiąc, pół roku lub rok. Nie tworzy automatycznie odnawianych subskrypcji.

Nie potrzebujesz:

- klucza `pk_test_` ani `pk_live_`;
- identyfikatorów produktów `prod_...`;
- identyfikatorów cen `price_...`.

Aplikacja tworzy cenę Checkout po stronie serwera na podstawie cennika ustawionego przez administratora.

### 12.1. Konto i sandbox

1. Otwórz [Stripe Dashboard](https://dashboard.stripe.com/).
2. Utwórz konto i potwierdź e-mail.
3. Uzupełnienie wszystkich danych firmy jest konieczne dopiero przed prawdziwymi płatnościami.
4. Kliknij wybór konta w Dashboardzie.
5. Wybierz **Switch to sandbox → Create sandbox**.
6. Nadaj nazwę, np. `ChemDisk test`.
7. Dla pierwszych testów możesz wybrać utworzenie sandboxa od zera.
8. Otwórz sandbox. U góry powinna być widoczna informacja, że pracujesz w środowisku testowym.

Stripe zaleca obecnie sandboxy jako izolowane środowiska testowe. Oficjalna instrukcja: [zarządzanie sandboxami Stripe](https://docs.stripe.com/sandboxes/dashboard/manage).

### 12.2. Tajny klucz testowy

1. Będąc we właściwym sandboxie, przejdź do **Developers → API keys**.
2. Znajdź **Secret key** zaczynający się od `sk_test_`.
3. Kliknij odsłonięcie i skopiuj klucz.
4. W Netlify dodaj:

   ```dotenv
   STRIPE_SECRET_KEY=sk_test_TUTAJ_DALSZA_CZESC
   ```

5. Ustaw kontekst produkcyjnego wdrożenia tej testowej instalacji, ale pamiętaj, że jest to nadal sandbox Stripe.
6. Uruchom deploy.

Oficjalna instrukcja: [klucze Stripe](https://docs.stripe.com/keys).

### 12.3. Webhook

Webhook jest najważniejszym mechanizmem przyznawania dostępu po płatności.

1. Najpierw wykonaj deploy aplikacji, aby publiczny adres funkcji istniał.
2. Skopiuj główny adres strony Netlify lub własnej domeny.
3. W sandboxie Stripe otwórz **Workbench → Webhooks** albo **Developers → Webhooks / Event destinations**.
4. Kliknij utworzenie endpointu lub event destination.
5. Wybierz zdarzenia z własnego konta Stripe.
6. Jako adres endpointu wpisz:

   ```text
   https://TWOJA-DOMENA/.netlify/functions/stripe-webhook
   ```

7. Wybierz dokładnie zdarzenia:

   ```text
   checkout.session.completed
   checkout.session.async_payment_succeeded
   ```

8. Zapisz endpoint.
9. Otwórz jego szczegóły.
10. Kliknij **Reveal** przy signing secret.
11. Skopiuj sekret zaczynający się od `whsec_`.
12. W Netlify dodaj:

   ```dotenv
   STRIPE_WEBHOOK_SECRET=whsec_TUTAJ_DALSZA_CZESC
   ```

13. Uruchom ponowny deploy.

Sekret webhooka sandboxa nie działa dla endpointu live i odwrotnie. Oficjalna instrukcja: [webhooki Stripe](https://docs.stripe.com/webhooks).

### 12.4. Ustawienie cennika

1. Zaloguj się jako administrator.
2. Otwórz **Panel administratora → Płatności**.
3. Wybierz walutę.
4. Wpisz ceny.
5. Zaznacz dostępne okresy.
6. Zdecyduj:
   - czy płatności są globalnie włączone;
   - czy można dokupić kolejny okres przed końcem obecnego.
7. Zapisz.
8. Panel powinien potwierdzić tryb testowy Stripe.

Zmiana waluty nie przelicza cen automatycznie. Po zmianie waluty wpisz wszystkie kwoty ponownie.

### 12.5. Test płatności

1. Utwórz lub zaproś zwykłego użytkownika.
2. Użytkownik musi być zalogowany.
3. Otwórz **Kup lub przedłuż**.
4. Wybierz pakiet.
5. W Stripe Checkout użyj:

   ```text
   Numer: 4242 4242 4242 4242
   Data: dowolna przyszła, np. 12/34
   CVC: dowolne 3 cyfry
   Pozostałe dane: dowolne poprawne wartości testowe
   ```

6. Po powrocie sprawdź, czy użytkownik dostał rolę i termin.
7. W panelu administratora sprawdź historię płatności.
8. W Stripe otwórz webhook i sprawdź, czy dostarczenie zakończyło się kodem `200`.
9. Sprawdź logi funkcji `stripe-webhook` w Netlify.

Do odrzucenia z powodu braku środków użyj `4000 0000 0000 9995`. Nie wpisuj prawdziwych danych kart w sandboxie. Oficjalne numery: [testowanie Stripe](https://docs.stripe.com/testing).

### 12.6. Przejście na prawdziwe płatności

1. Zakończ pełną aktywację konta Stripe.
2. Uzupełnij dane firmy, właściciela i rachunku wypłat.
3. Przejdź do środowiska live.
4. Skopiuj klucz `sk_live_...`.
5. Utwórz osobny webhook live z tymi samymi dwoma zdarzeniami.
6. Skopiuj nowy sekret `whsec_...`.
7. W Netlify ustaw produkcyjne wartości:

   ```dotenv
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

8. Ogranicz je do kontekstu **Production**.
9. Deploy Preview i testowa witryna powinny nadal używać wyłącznie sandboxa.
10. Wykonaj deploy.
11. Przeprowadź małą prawdziwą płatność kontrolną.
12. Sprawdź webhook, rolę i historię użytkownika.

Zwrot pieniędzy wykonuje się osobno w Stripe. Odebranie dostępu w ChemDisk nie zwraca płatności.

## 13. Panel kursanta

Po zalogowaniu kursant widzi:

- stronę Start;
- działy i harmonijki z materiałami;
- wyszukiwarkę;
- zmianę jasnego lub ciemnego motywu;
- profil i zmianę imienia/nazwiska;
- status i czas dostępu;
- zakup lub przedłużenie dostępu;
- formularz kontaktowy.

Użytkownik bez aktywnej roli może się zalogować i kupić dostęp, ale nie może otworzyć `/members/`.

Ikona biblioteki lekcji i Studio są przeznaczone wyłącznie dla administratora.

## 14. Role i długość dostępu

| Rola | Znaczenie |
| --- | --- |
| `admin` | Administrator i stały dostęp |
| `active` | Stały dostęp kursanta |
| `hour` | 1 godzina |
| `day` | 24 godziny |
| `week` | 7 dni |
| `month` | 30 dni |
| `halfyear` | 182 dni |
| `year` | 365 dni |

Ręcznie nadany okres czasowy zaczyna się przy pierwszym poprawnym logowaniu po przypisaniu. Okres kupiony przez Stripe zaczyna się po potwierdzeniu płatności.

Aplikacja dopuszcza jedną aktywną sesję konta. Nowe logowanie na innym urządzeniu zastępuje poprzednią sesję. Kilka kart w tej samej przeglądarce może działać równocześnie.

## 15. Dodawanie i obsługa użytkowników

### 15.1. Zaproszenie nowego użytkownika

1. Zaloguj się jako administrator.
2. Otwórz **Panel administratora**.
3. Wybierz zakładkę **Użytkownicy**.
4. Rozwiń **Zaproś nowego użytkownika**.
5. Wpisz e-mail, imię i nazwisko.
6. Wybierz dostęp:
   - brak;
   - stały;
   - jeden z okresów czasowych.
7. Opcjonalnie zaznacz **Administrator**.
8. Kliknij **Wyślij zaproszenie**.
9. Użytkownik dostanie e-mail i sam ustawi hasło.

### 15.2. Zmiana danych lub dostępu

1. Znajdź konto po e-mailu albo nazwisku.
2. Rozwiń konto.
3. Zmień imię, nazwisko, rodzaj dostępu albo rolę administratora.
4. Zapisz.
5. Poproś użytkownika o wylogowanie i ponowne logowanie.

Sama poprawka imienia lub nazwiska nie odnawia aktywnego okresu.

### 15.3. Odebranie dostępu

- Dla dostępu nadanego ręcznie wybierz **Brak dostępu** i zapisz.
- Dla płatnego dostępu użyj akcji odebrania dostępu w historii płatności.
- Odebranie dostępu nie wykonuje zwrotu pieniędzy.
- Refund wykonuje się w Stripe przy odpowiedniej płatności.

### 15.4. Usunięcie konta

1. Rozwiń użytkownika.
2. Kliknij **Usuń konto**.
3. Przeczytaj komunikat.
4. Potwierdź wyłącznie po sprawdzeniu e-maila.

Usunięcie konta jest trwałe dla Identity i historii ChemDisk. Dane transakcji pozostają w Stripe. Administrator nie może usunąć własnego aktualnie zalogowanego konta.

## 16. Panel administratora

Panel ma pięć zakładek.

### Użytkownicy

- zapraszanie;
- wyszukiwanie;
- zmiana profilu;
- nadawanie i odbieranie dostępu;
- nadawanie administratora;
- usuwanie kont.

### Formularze

- pokazuje odpowiedzi formularzy Netlify;
- obsługuje publiczny `contact` i kursowy `members-contact`;
- nie pokazuje odpowiedzi Google Forms;
- usunięcie zgłoszenia jest trwałe;
- odpowiedzi można również eksportować z zakładki Forms w Netlify.

### Dashboard

- bezpośrednia edycja Markdown;
- podgląd;
- publikacja do Netlify Blobs bez deployu;
- przywrócenie statycznego `public/members/dashboard.md` z ostatniego deployu.

### Materiały

- wybór repozytorium;
- kontrola połączenia;
- liczba lekcji i promptów;
- wymuszenie odświeżenia listy;
- token nie jest pokazywany w przeglądarce.

### Płatności

- ceny i waluta;
- dostępne pakiety;
- globalne wyłączenie płatności;
- blokada lub zezwolenie na sumowanie okresów;
- historia płatności i operacji administratora;
- odebranie płatnego dostępu.

## 17. Studio treści

Studio jest dostępne tylko dla konta z rolą `admin`. Zawiera:

1. **Dashboard Builder**
2. **Lesson Builder**
3. **Prompt Builder**

W każdym builderze:

- lewa biblioteka, górne narzędzia oraz prawy panel mogą być zwijane niezależnie;
- kolumny mają niezależne przewijanie;
- szkic zapisuje się lokalnie w przeglądarce;
- dostępne są cofanie i ponawianie;
- podgląd można oglądać po prawej albo otworzyć w osobnym, pełnym oknie.

## 18. Dashboard Builder — instrukcja

### 18.1. Zwykły sposób pracy

1. Otwórz **Studio treści → Dashboard**.
2. Kliknij wczytanie aktywnego dashboardu.
3. Zmień tytuł i opis powitalny.
4. Przeciągnij **Sekcję** na obszar roboczy.
5. Do sekcji dodaj tekst, komunikat, harmonijkę albo kartę modułu.
6. Kliknij klocek.
7. Uzupełnij ustawienia po prawej.
8. Sprawdź zakładkę **Podgląd**.
9. Opcjonalnie otwórz pełny podgląd w nowym oknie.
10. Kliknij publikację.
11. Odśwież panel kursanta.

Publikacja zapisuje dashboard w Netlify Blobs. Nie wymaga commitu ani deployu.

### 18.2. Klocki struktury

| Klocek | Zastosowanie | Jak uzupełnić |
| --- | --- | --- |
| Sekcja | Główny dział i pozycja menu | Wpisz tytuł i dodaj klocki |
| Harmonijka | Rozwijana grupa w sekcji | Wpisz tytuł, umieść treść i karty |
| Pole tekstowe | Opis działu | Wpisz krótki tekst |
| Komunikat | Wyróżniona informacja | Wpisz ostrzeżenie lub wskazówkę |

Sekcja **Pomoc i konto** jest wymagana. Jeśli jej zabraknie, aplikacja dołączy bezpieczny domyślny szablon.

## 19. Wszystkie karty i moduły dashboardu

Każdą kartę dodaje się tak samo:

1. Przeciągnij ją z lewej biblioteki do sekcji lub harmonijki.
2. Kliknij dodaną kartę.
3. Wpisz tytuł i opis.
4. Uzupełnij pola specyficzne dla modułu.
5. Sprawdź wygenerowany adres i podgląd.

### 19.1. Prezentacja Google

- Wklej pełny link albo ID prezentacji.
- Tryb `1` to zwykły podgląd.
- Tryb `2` ogranicza interfejs dostawcy.
- Prezentacja musi mieć uprawnienia pozwalające kursantowi ją otworzyć.

Przykład adresu:

```text
/members/module/slides/?id=ID_PREZENTACJI&type=2
```

### 19.2. Dokument PDF z Google Drive

- Wklej link albo ID pliku Drive.
- Tryb `1` to podgląd z ograniczonym interfejsem.
- Tryb `2` wymusza pobranie.
- Tryb `3` to zwykły podgląd.

```text
/members/module/pdf/?id=ID_PLIKU&type=1
```

Ograniczony interfejs nie jest DRM. Osoba mogąca obejrzeć dokument może użyć narzędzi przeglądarki lub wykonać zrzut.

### 19.3. Film

- `type=1` — YouTube z ograniczonym interfejsem;
- `type=2` — plik wideo z Google Drive;
- `type=3` — YouTube z pełniejszym odtwarzaczem.

```text
/members/module/film/?id=ID_FILMU&type=1
```

Usunięty moduł `filmv1` nie jest dostępny. Stare odnośniki są migrowane do modułu `film`.

### 19.4. Odtwarzacz YT

- Wklej ID albo pełny link YouTube.
- Odtwarzacz ma własne kontrolki ChemDisk.
- Film musi pozwalać na osadzanie.

```text
/members/module/yt/?id=ID_FILMU
```

### 19.5. Lekcja interaktywna

- Wybierz repozytorium.
- Wybierz plik `.md` z listy albo wpisz jego nazwę.
- Dla repo innego niż domyślne link zawiera `repo=identyfikator`.

```text
/members/module/lesson/?file=izotopy.md
/members/module/lesson/?repo=organiczna&file=alkany.md
```

### 19.6. Google Forms

- Wklej ID Formularza Google.
- Użyj testu lub ankiety udostępnionej właściwym odbiorcom.
- Wyniki trafiają do Google, a nie do Netlify Forms.

```text
/members/module/forms/?id=ID_FORMULARZA
```

### 19.7. Asystent AI

Wybierz:

- plik `.json` z jedną instrukcją; albo
- konkretny punkt pliku `.txt`.

```text
/members/module/chat/?prompt=korepetytor.json
/members/module/chat/?plik=zestaw.txt&punkt=2
/members/module/chat/?repo=organiczna&prompt=organiczna.json
```

Czat wymaga `GEMINI_API_KEY`, aktywnego dostępu użytkownika i poprawnego promptu.

### 19.8. Kalkulator naukowy

Moduł `kalkulator` osadza symulator NumWorks. Wymaga internetu i dostępności zewnętrznej usługi.

```text
/members/module/kalkulator/
```

### 19.9. Kalkulator klasyczny

Moduł `classic` działa lokalnie i obsługuje podstawowe działania, nawiasy, modulo oraz klawiaturę.

```text
/members/module/classic/
```

### 19.10. Biała tablica

Moduł `whiteboard` osadza tldraw. Dane i dostępność zależą od zewnętrznej usługi.

```text
/members/module/whiteboard/
```

### 19.11. BitPaper

Lokalna tablica ma:

- ołówek, gumkę i tekst;
- zaznaczanie i przesuwanie;
- cofanie i ponawianie;
- okna zadań i obrazy;
- eksport/import JSON;
- eksport PNG.

```text
/members/module/bitpaper/
```

Opcjonalny parametr `path=nazwa.json` automatycznie wczytuje planszę opublikowaną w katalogu modułu. BitPaper nie synchronizuje wielu osób w czasie rzeczywistym.

### 19.12. ATONOM

- Wpisz polską nazwę związku, np. `fenol`, `etanol` albo `cis-but-2-en`.
- Dashboard otwiera lokalny model.
- Link zawiera parametr `formula`.

```text
/members/module/atonom/?formula=kwas%20octowy
```

ATONOM pokazuje wzór, rodzinę, atomy, wiązania, przybliżoną masę molową oraz model do obracania.

### 19.13. Kontakt

- Ustaw stałą treść wewnętrzną, która opisuje, skąd otwarto formularz.
- Wiadomość trafia do Netlify Forms jako `members-contact`.

```text
/members/module/contact/?internal=Pytanie%20z%20dzialu%20stechiometria
```

### 19.14. Link zewnętrzny

- Wklej pełny bezpieczny adres HTTPS.
- Używaj do stron, których nie obsługuje gotowy moduł.
- Sprawdź, czy użytkownik nie potrzebuje osobnego konta lub zgody.

## 20. Lesson Builder — tworzenie lekcji

### 20.1. Nowa lekcja

1. Otwórz **Studio treści → Lekcja**.
2. Kliknij **Nowa lekcja**.
3. Wpisz nazwę pliku kończącą się `.md`, np. `stechiometria-1.md`.
4. Wpisz tytuł lekcji.
5. Edytuj pierwszy slajd.
6. Dodawaj kolejne slajdy.
7. Przeciągaj klocki na wybrany slajd.
8. Klikaj klocki i edytuj ich ustawienia po prawej.
9. Sprawdź podgląd po prawej i pełny podgląd w nowym oknie.
10. Wybierz repozytorium.
11. Kliknij **Utwórz plik w GitHubie**.

Jeżeli w GitHubie istnieje pusty plik `.md`, builder wczyta go jako startową lekcję gotową do edycji.

### 20.2. Edycja istniejącej lekcji

1. W lewej bibliotece wybierz repozytorium.
2. Wyszukaj lekcję.
3. Kliknij plik.
4. Edytuj.
5. Kliknij **Zapisz zmiany w GitHubie**.

Każdy zapis tworzy commit. Builder używa wersji SHA i nie nadpisuje po cichu nowszej zmiany wykonanej przez inną osobę.

### 20.3. Ręczny obieg pliku

Jeżeli nie chcesz dawać Studio prawa zapisu:

1. Twórz lekcję w builderze.
2. Kliknij **Pobierz .md**.
3. Otwórz repo materiałów.
4. Wejdź do `lessons`.
5. Kliknij **Add file → Upload files**.
6. Wgraj plik i zapisz commit.

Możesz też użyć **Importuj .md**, **Markdown** albo **Kopiuj**.

### 20.4. Usunięcie lekcji

1. Najpierw wczytaj plik z GitHuba.
2. Kliknij **Usuń z GitHuba**.
3. Sprawdź nazwę i potwierdź.

GitHub tworzy commit usuwający plik, dlatego zawartość można odzyskać z historii repo. Karta dashboardu wskazująca usunięty plik przestanie działać i trzeba ją poprawić lub usunąć.

## 21. Wszystkie klocki lekcji

Na jednym slajdzie można umieścić wiele klocków treści i najwyżej jedno zadanie sprawdzające.

### Nowy slajd

Tworzy kolejny krok lekcji. Kursant przechodzi między slajdami przyciskami i planem lekcji.

Po kliknięciu całego slajdu wybierz w prawym panelu jego przejście:

- **Brak przejścia** — slajd pojawia się natychmiast;
- **Łagodne zanikanie** — spokojne pojawienie się;
- **Subtelnie w górę** — niewielki ruch ku górze;
- **Delikatnie z boku** — krótki ruch poziomy;
- **Miękkie przybliżenie** — bardzo lekkie powiększenie.

Każdy slajd ma własne ustawienie. Domyślne jest łagodne zanikanie. Jeśli użytkownik w systemie włączy ograniczenie animacji, ChemDisk wyłączy ruch niezależnie od wybranej opcji.

### Nagłówek

Wybierz H1, H2 lub H3 i wpisz tytuł fragmentu.

### Tekst

Ustaw:

- treść;
- czcionkę: systemową, Arial, Verdana, szeryfową, Georgia, Times New Roman, zaokrągloną, monospace lub Courier New;
- rozmiar: mały, normalny, duży lub bardzo duży;
- wyrównanie do lewej, środka lub prawej;
- pogrubienie całego bloku;
- własny kolor tekstu;
- własny kolor tła.

W treści można używać:

```md
**pogrubienie**
*kursywa*
^indeks górny^
~indeks dolny~
```

### Obraz z URL

Wklej publiczny adres HTTPS i wpisz opis ALT. Plik nie jest kopiowany do repo lekcji.

### Lista

Wpisz jeden punkt w każdym wierszu i wybierz listę punktowaną albo numerowaną.

### Cytat

Użyj do definicji, reguły lub ważnego fragmentu.

### Callout

Wybierz: informacja, wskazówka, uwaga lub „zapamiętaj”. Dodaj tytuł i treść.

### Blok kodu

Służy do kodu albo fragmentu, który ma zachować odstępy i czcionkę monospace. Do estetycznych wzorów użyj osobnego klocka **Wzór chemiczny / matematyczny**.

### Wzór chemiczny / matematyczny

Ten klocek tworzy estetyczny, skalowalny zapis wzoru. Wybierz jeden z dwóch trybów.

#### Chemia — wzór lub reakcja

1. W polu **Wzór lub substraty** wpisz np. `2 H2 + O2`.
2. W polu **Produkty** wpisz np. `2 H2O`.
3. Wybierz strzałkę: w prawo, w lewo, odwracalną, równowagi albo podwójną.
4. W polu **Warunek nad strzałką** możesz wpisać np. `450 °C`, `Δ` albo `hν`.
5. W polu **Warunek pod strzałką** możesz wpisać np. `kat. Pt` albo `2 atm`.
6. Dodaj podpis pod wzorem, np. „Spalanie wodoru”.

Cyfry we wzorach są zamieniane na indeksy dolne automatycznie. Przydatne przykłady:

```text
H2O
Ca(OH)2
SO4^2-
^14C
Fe^{III}
NaCl (aq)
AgCl v
```

Jeśli chcesz pokazać tylko jeden wzór bez reakcji, wybierz **Bez strzałki — pojedynczy wzór** i pozostaw pole produktów puste.

#### Matematyka — równanie i symbole

Po przełączeniu trybu wpisz wzór albo użyj przycisków pod polem. Dostępne są między innymi:

- potęga: `x^{2}`;
- indeks dolny: `a_{n}`;
- ułamek: `\frac{a}{b}`;
- pierwiastek: `\sqrt{x}`;
- suma: `\sum_{i=1}^{n}`;
- całka: `\int_{a}^{b}`;
- wektor: `\vec{v}`;
- symbole `π`, `Δ`, `∂`, `→`, `×`, `±`, `≈`, `≤`, `≥` i `∞`.

Przykłady:

```text
E = mc^{2}
c = \frac{n}{V}
x_{1,2} = \frac{-b \pm \sqrt{b^{2} - 4ac}}{2a}
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
```

Kreator przyjmuje tylko bezpieczny zestaw poleceń matematycznych. Nie wklejaj całego dokumentu LaTeX ani kodu HTML.

### Kafelek z linkiem

Tworzy estetyczną kartę prowadzącą do dodatkowego materiału zamiast pokazywania zwykłego, długiego adresu.

1. Wpisz tytuł, np. „Tablica wzorów”.
2. Dodaj krótki opis.
3. Wklej adres strony albo modułu.
4. Wybierz ikonę: link, książka, film, chemia, matematyka, plik lub strona zewnętrzna.
5. Wybierz kolor akcentu.
6. Zaznacz **Otwieraj w nowej karcie**, jeżeli kursant nie powinien opuszczać lekcji.

Możesz użyć pełnego adresu `https://...`, adresu `http://...`, poczty `mailto:...`, kotwicy `#...` albo wewnętrznej ścieżki zaczynającej się od `/`, np. `/members/module/board/`. Adresy skryptowe, takie jak `javascript:...`, są odrzucane.

### Harmonijka

Dodaje rozwijane wyjaśnienie. Może być domyślnie otwarta. Do środka można przeciągnąć zwykłe klocki treści.

### Wideo YouTube

Wklej link albo 11-znakowe ID. Film jest osadzany z `youtube-nocookie.com`.

### ATONOM

Wpisz nazwę związku. Lekcja najpierw pokazuje estetyczny kafelek. Model ładuje się dopiero po kliknięciu **Pokaż związek**, dzięki czemu nie zajmuje od razu całego slajdu.

### Fiszki

Wpisuj jedną kartę w wierszu:

```text
Pojęcie => Wyjaśnienie
```

Dodaj co najmniej dwie fiszki i wybierz kolor. Kursant klika kartę, aby zobaczyć tył.

## 22. Wszystkie zadania interaktywne lekcji

Po dodaniu zadania kliknij je i skonfiguruj w prawym panelu. Zadanie może zablokować przejście dalej do chwili poprawnej odpowiedzi.

### 22.1. Quiz ABCD

1. Przeciągnij **Quiz ABCD**.
2. Wpisz pytanie.
3. Uzupełnij dokładnie cztery odpowiedzi.
4. Zaznacz ptaszkiem poprawną.
5. Dodaj podpowiedź i komunikat sukcesu.

### 22.2. Wybór jednej odpowiedzi

1. Przeciągnij **Wybór**.
2. Dodaj od 2 do 8 opcji.
3. Zaznacz poprawną.
4. Wpisz podpowiedź.

### 22.3. Pytanie tekstowe

1. Wpisz pytanie.
2. Wpisz każdą akceptowaną odpowiedź lub alias w osobnym wierszu.
3. Opcjonalnie włącz rozróżnianie wielkości liter.

Przykładowe aliasy:

```text
atom
Atom
atom węgla
```

Bez włączenia rozróżniania wielkości liter `atom` i `Atom` są traktowane tak samo.

### 22.4. Pytanie liczbowe

1. Wpisz polecenie.
2. Wpisz dokładny poprawny wynik.
3. Uczeń może użyć przecinka albo kropki dziesiętnej.

Moduł nie stosuje automatycznej tolerancji i nie rozpoznaje jednostek. Jeśli odpowiedzią jest `7`, nie wpisuj jako poprawnej wartości `7 mol`, chyba że używasz pytania tekstowego.

### 22.5. Luki z listy

1. Wpisz całe zdanie.
2. Ustaw kursor w miejscu luki.
3. Kliknij **Wstaw lukę**.
4. Powtórz dla kolejnych luk.
5. Dodaj listę możliwych opcji.
6. Przy każdej luce wybierz prawidłową odpowiedź.

Uczeń uzupełnia luki listami wyboru.

### 22.6. Luki wpisywane ręcznie

1. Wpisz zdanie.
2. Ustaw kursor i kliknij **Wstaw lukę**.
3. Przy każdej luce wpisz prawidłową odpowiedź.
4. Wybierz:
   - **Każda luka osobno** — uczeń sprawdza kolejne pola;
   - **Wszystkie luki naraz** — jeden przycisk sprawdza całe zadanie.
5. Opcjonalnie włącz rozróżnianie wielkości liter.

Nie trzeba ręcznie znać składni `{{luka}}`; builder wstawia ją sam.

## 23. Odtwarzacz lekcji

Odtwarzacz:

- pobiera `.md` z wybranego prywatnego repo;
- pokazuje plan lekcji w kompaktowym, zwijanym panelu po lewej;
- pokazuje dużą prezentację po prawej;
- pozwala zwinąć górny pasek;
- pamięta postęp w danej karcie przeglądarki;
- umożliwia powtórzenie lekcji;
- pokazuje bibliotekę plików wyłącznie administratorowi.

Odpowiedzi są zawarte w pliku pobieranym przez przeglądarkę. Lekcja służy do samosprawdzenia, a nie do tajnego egzaminu.

## 24. Prompt Builder

### 24.1. Prompt JSON

1. Otwórz **Studio treści → Prompt AI**.
2. Wybierz format **JSON — jedna instrukcja**.
3. Nadaj nazwę kończącą się `.json`.
4. Wpisz instrukcję dla asystenta.
5. Sprawdź walidację.
6. Zapisz w GitHubie albo pobierz plik ręcznie.

Wynik ma postać:

```json
{
  "prompt": "Jesteś korepetytorem chemii. Naprowadzaj ucznia krok po kroku..."
}
```

### 24.2. Prompt TXT z kilkoma punktami

1. Wybierz format **TXT — numerowane punkty**.
2. Nadaj nazwę kończącą się `.txt`.
3. Dodawaj punkty.
4. Każdy punkt może być niezależną instrukcją dla innej karty czatu.
5. Zapisz.

Plik wygląda tak:

```txt
::punkt 1
Naprowadzaj na rozwiązanie, ale nie podawaj od razu wyniku.

::punkt 2
Sprawdź odpowiedź, jednostki i cyfry znaczące.
```

Kartę do drugiego punktu tworzy się parametrem `punkt=2`.

### 24.3. Dostępne działania

- wybór repozytorium;
- wyszukiwanie promptów;
- import `.json` lub `.txt`;
- edycja kodu źródłowego;
- kopiowanie;
- pobranie;
- utworzenie i aktualizacja pliku na GitHubie;
- usunięcie z GitHuba.

Prompt Builder nie wysyła treści do Gemini. Tylko przygotowuje i waliduje pliki.

## 25. Ręczna edycja dashboardu

Jeśli nie chcesz używać buildera:

1. Otwórz **Panel administratora → Dashboard**.
2. Edytuj Markdown.
3. Kliknij podgląd.
4. Kliknij **Opublikuj zmiany**.

Podstawy:

```md
# Tytuł dashboardu

Opis powitalny.

## Nazwa działu

Opis działu.

### Rozwijana harmonijka

> Ważny komunikat.

- [Nazwa karty](/members/module/lesson/?file=lekcja.md) — Krótki opis.
```

HTML nie jest wykonywany.

Przycisk **Przywróć plik z wdrożenia** wyłącza wersję zapisaną w Blobs i przywraca `public/members/dashboard.md`.

## 26. Google Drive, Slides i Forms

Te usługi nie wymagają kluczy API w ChemDisk.

### Prezentacja

1. Utwórz prezentację.
2. Kliknij **Udostępnij**.
3. Ustaw dostęp właściwy dla kursantów.
4. Skopiuj link.
5. Wklej do karty Prezentacja.

### PDF lub film Drive

1. Wgraj plik na Dysk Google.
2. Ustaw udostępnianie.
3. Skopiuj link.
4. Wklej do PDF albo Film z `type=2`.

### Formularz Google

1. Utwórz formularz.
2. Ustaw zbieranie odpowiedzi i dostęp.
3. Skopiuj link lub ID.
4. Dodaj kartę Google Forms.
5. Odpowiedzi przeglądaj w Google Forms lub połączonym Arkuszu Google.

Jeżeli iframe jest pusty albo pyta o dostęp, problem zwykle dotyczy ustawień udostępniania Google, a nie kodu ChemDisk.

## 27. Formularze Netlify

Aplikacja ma:

- publiczny formularz `contact`;
- formularz kursanta `members-contact`;
- ochronę reCAPTCHA obsługiwaną przez Netlify.

Po deployu Netlify wykrywa formularze w HTML. Odpowiedzi znajdziesz:

- w **Panel administratora → Formularze**; albo
- w zakładce **Forms** projektu Netlify.

Usuwanie odpowiedzi jest trwałe. Przed większym czyszczeniem pobierz CSV. Oficjalna instrukcja: [zgłoszenia Netlify Forms](https://docs.netlify.com/manage/forms/submissions/).

## 28. Dane w Netlify Blobs

Blobs przechowują między deployami:

- opublikowany dashboard;
- konfigurację cen;
- historię płatności i operacji dostępu.

Nowy deploy nie usuwa tych danych. Deploy Preview tej samej witryny może mieć dostęp do tych samych site-wide stores, jeśli otrzyma produkcyjny token i identyfikator. Dlatego nie testuj operacji administracyjnych na podglądzie podłączonym do produkcji.

Oficjalny opis: [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/).

## 29. Testy lokalne

Ta część jest opcjonalna. Jest przydatna przed zmianą kodu.

### 29.1. Przygotowanie

1. Zainstaluj Node.js co najmniej `20.12.2`.
2. Pobierz repozytorium aplikacji przez GitHub Desktop albo `git clone`.
3. Otwórz terminal w katalogu projektu.
4. Uruchom:

   ```bash
   npm install
   ```

5. Zaloguj Netlify CLI:

   ```bash
   npx netlify login
   ```

6. Połącz katalog z osobną witryną testową:

   ```bash
   npx netlify link
   ```

### 29.2. Lokalny `.env`

Skopiuj `.env.example` jako `.env` i wpisz wyłącznie testowe dane:

```dotenv
GEMINI_API_KEY=klucz_testowego_projektu
GITHUB_CONTENT_TOKEN=github_pat_token_testowego_repo
GITHUB_CONTENT_REPOSITORY=LOGIN/testowe-materialy
GITHUB_CONTENT_REF=main
GITHUB_CONTENT_ROOT=
GITHUB_CONTENT_REPOSITORIES=
NETLIFY_API_TOKEN=token_testowej_witryny
SITE_ID=project_id_testowej_witryny
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Plik `.env` jest ignorowany przez Git i nie wolno go commitować.

### 29.3. Uruchomienie

```bash
npm run dev
```

Otwórz adres pokazany przez Netlify CLI, zwykle `http://localhost:8888`.

Nie otwieraj samego `public/index.html` z dysku. Identity i Functions wtedy nie działają.

### 29.4. Testy automatyczne

```bash
npm test
npm run build
```

W tym projekcie oba polecenia uruchamiają testy `node --test`. Netlify wykonuje `npm run build` przed publikacją.

## 30. Lista testów po wdrożeniu

Przed przyjęciem prawdziwej płatności sprawdź:

1. Publiczna strona się otwiera.
2. Rejestracja lub zaproszenie dochodzi e-mailem.
3. Reset hasła działa.
4. Konto bez roli nie otwiera `/members/`.
5. Konto z rolą `active` otwiera dashboard.
6. Konto `admin` widzi Panel administratora i Studio.
7. Zwykły kursant nie widzi Studio ani biblioteki lekcji.
8. Zmiana imienia i nazwiska pozostaje po odświeżeniu.
9. Drugie logowanie zastępuje sesję z innego urządzenia.
10. Dashboard Builder publikuje i pokazuje zmiany po odświeżeniu.
11. Przywrócenie pliku dashboardu działa.
12. Repo materiałów ma status gotowy.
13. Nowa lekcja pojawia się bez deployu.
14. Lekcja otwiera wszystkie użyte klocki.
15. Quiz ABCD sprawdza zaznaczoną odpowiedź.
16. Luki z listy działają.
17. Luki tekstowe działają osobno i wszystkie naraz.
18. Klocek wzoru pokazuje poprawne indeksy, reakcję ze strzałką i temperaturą oraz wzór matematyczny z ułamkiem i pierwiastkiem.
19. Kafelek z linkiem otwiera bezpieczny adres i nie pokazuje użytkownikowi surowego długiego linku.
20. Każdy slajd używa wybranego przejścia, a opcja **Brak przejścia** wyłącza animację.
21. ATONOM pokazuje kafelek, a model dopiero po kliknięciu.
22. Prompt JSON i wskazany punkt TXT działają w czacie.
23. Obraz można załączyć do czatu.
24. Formularz kontaktowy trafia do Netlify Forms.
25. Administrator widzi i może usunąć testowe zgłoszenie.
26. Prezentacja, PDF, film, YouTube i Google Forms działają przy docelowym udostępnianiu.
27. Kalkulatory i obie tablice się otwierają.
28. Stripe pokazuje tryb testowy.
27. Płatność `4242 4242 4242 4242` kończy się sukcesem.
28. Webhook ma odpowiedź `200`.
29. Płatność nadaje prawidłową rolę i termin.
30. Odebranie dostępu nie wykonuje przypadkowego refundu.
31. `npm test` i `npm run build` kończą się bez błędów.

## 31. Co można usuwać i jak to odzyskać

| Operacja | Skutek | Możliwość odzyskania |
| --- | --- | --- |
| Lekcja/prompt usunięty przez Studio | Commit usuwający w GitHubie | Tak, z historii Git |
| Aktywny dashboard przywrócony do wdrożenia | Wyłączenie wersji Blobs | Można ponownie opublikować posiadaną treść |
| Zgłoszenie Netlify Forms | Trwałe usunięcie odpowiedzi | Nie; wcześniej pobierz CSV |
| Konto Identity | Usunięcie konta i historii ChemDisk | Nie; Stripe zachowuje transakcje |
| Płatny dostęp | Użytkownik traci rolę | Można nadać nowy dostęp; nie jest to refund |
| Dane testowe Stripe | Usunięcie obiektów sandboxa | Nie; dotyczy tylko środowiska testowego |
| Deploy Netlify | Zmiana opublikowanej wersji kodu | Można opublikować wcześniejszy deploy |
| Token API | Unieważnienie integracji | Utwórz nowy token, zmień zmienną i wykonaj deploy |

## 32. Kopie bezpieczeństwa

Raz w miesiącu:

1. Pobierz lub sklonuj repozytorium aplikacji.
2. Pobierz lub sklonuj wszystkie repozytoria materiałów.
3. Eksportuj ważne zgłoszenia Forms do CSV.
4. Zanotuj konfigurację repozytoriów bez wartości tokenów.
5. Sprawdź daty wygaśnięcia tokenów.
6. Sprawdź, kto ma dostęp do GitHuba, Netlify, Google i Stripe.
7. Zachowaj kody odzyskiwania 2FA poza komputerem.

Nie kopiuj sekretów do zwykłego dokumentu udostępnionego wielu osobom.

## 33. Najczęstsze problemy

### „Brak poprawnej konfiguracji repozytorium”

- sam `GITHUB_CONTENT_TOKEN` nie wystarcza;
- dodaj `GITHUB_CONTENT_REPOSITORY` albo poprawny `GITHUB_CONTENT_REPOSITORIES`;
- sprawdź `owner/repo`, `main` i JSON;
- uruchom deploy.

### Repo jest wybrane, ale plików nie widać

- sprawdź foldery `lessons` i `prompts`;
- sprawdź rozszerzenia `.md`, `.json`, `.txt`;
- sprawdź uprawnienie tokenu **Contents: Read and write**;
- odśwież po około 20 sekundach;
- sprawdź, czy token organizacji nie czeka na zatwierdzenie.

### Nie mogę utworzyć nowej lekcji

- kliknij **Nowa lekcja**;
- podaj nazwę kończącą się `.md`;
- wybierz skonfigurowane repo;
- upewnij się, że token ma zapis;
- przy pustym pliku wczytaj go — builder przygotuje szablon.

### Administrator nie widzi Studio

- sprawdź rolę `admin` w `app_metadata`;
- wyloguj się i zaloguj ponownie;
- sprawdź, czy konto nie ma starego tokenu sesji;
- nie próbuj nadawać uprawnień przez `user_metadata`.

### Kursant widzi ekran logowania mimo nadanej roli

- użytkownik powinien ponownie się zalogować;
- sprawdź dokładną nazwę roli;
- sprawdź, czy okres nie wygasł;
- sprawdź reguły deployu z `netlify.toml`.

### Czat nie działa

- sprawdź `GEMINI_API_KEY`;
- sprawdź limit i billing Google;
- sprawdź poprawność promptu;
- sprawdź aktywny dostęp kursanta;
- sprawdź log funkcji `chat`.

### Stripe pokazuje brak konfiguracji

- wymagane są jednocześnie `STRIPE_SECRET_KEY` i `STRIPE_WEBHOOK_SECRET`;
- oba muszą pochodzić z tego samego sandboxa albo tego samego środowiska live;
- po zmianie wykonaj deploy.

### Płatność jest w Stripe, ale brak dostępu

- sprawdź zdarzenia webhooka;
- wymagane są `checkout.session.completed` i `checkout.session.async_payment_succeeded`;
- sprawdź URL endpointu;
- sprawdź odpowiedź HTTP i log `stripe-webhook`;
- sprawdź, czy sekret `whsec_` pochodzi z tego endpointu.

### Formularza nie ma w Netlify

- aplikacja musi zostać wdrożona przez Netlify;
- sprawdź, czy wykrywanie formularzy jest włączone;
- wyślij testowe zgłoszenie;
- sprawdź zakładkę Forms i filtr spamu.

### Google lub YouTube jest puste

- sprawdź udostępnianie pliku;
- sprawdź, czy film pozwala na osadzanie;
- sprawdź poprawność ID;
- wyłącz na próbę rozszerzenie blokujące skrypty lub cookies;
- sprawdź konsolę i ruch sieciowy przeglądarki.

### Zmiana zmiennej nie pomogła

- sprawdź pisownię;
- sprawdź zakres Functions;
- sprawdź kontekst Production;
- uruchom nowy deploy;
- upewnij się, że oglądasz właściwy projekt i domenę.

## 34. Bezpieczeństwo i ograniczenia

- Prywatne repo chroni pliki przed przypadkowym publicznym odczytem, ale kursant z dostępem musi otrzymać treść lekcji, aby ją zobaczyć.
- Maski PDF/YouTube utrudniają typowe kliknięcie lub pobranie, ale nie są DRM.
- Publiczne obrazy są dostępne dla każdego, kto zna ich adres.
- Prompt czatu jest pobierany serwerowo i nie jest wysyłany kursantowi jako konfiguracja.
- Każdy sekret przechowuj tylko po stronie Netlify Functions.
- Produkcja i testy powinny używać innych witryn Netlify, repo materiałów, tokenów oraz sandboxa Stripe.
- Tokeny ustawiaj z datą wygaśnięcia i regularnie je wymieniaj.
- Po odejściu administratora odbierz mu dostęp do GitHuba, Netlify, Google i Stripe.
- Włącz 2FA we wszystkich usługach.
- Nie publikuj danych osobowych kursantów w repozytoriach.

## 35. Lista przed uruchomieniem produkcji

- [ ] Mam dostęp do repozytorium aplikacji otrzymanego od właściciela.
- [ ] Netlify publikuje `public` i uruchamia `netlify/functions`.
- [ ] Identity jest włączone.
- [ ] Rejestracja ma właściwy tryb.
- [ ] Pierwszy administrator ma rolę `admin`.
- [ ] Prywatne repo materiałów ma `lessons` i `prompts`.
- [ ] Token GitHub ma dostęp tylko do wybranych repo.
- [ ] `GITHUB_CONTENT_REPOSITORY` albo `GITHUB_CONTENT_REPOSITORIES` jest ustawione.
- [ ] `GEMINI_API_KEY` działa.
- [ ] `NETLIFY_API_TOKEN` należy do konta z dostępem do projektu.
- [ ] Stripe sandbox i webhook przechodzą test.
- [ ] Wszystkie formularze są widoczne.
- [ ] Zwykły kursant nie widzi narzędzi administratora.
- [ ] Wszystkie moduły używane w dashboardzie zostały otwarte.
- [ ] Wykonano test płatności i dostępu.
- [ ] `npm test` i `npm run build` przechodzą.
- [ ] Produkcyjne sekrety są ograniczone do Production.
- [ ] Utworzono kopię materiałów i zapisano procedurę odzyskania.

## 36. Oficjalne źródła

- [Netlify — deploy z repozytorium](https://docs.netlify.com/start/quickstarts/deploy-from-repository/)
- [Netlify — zmienne środowiskowe](https://docs.netlify.com/build/environment-variables/get-started/)
- [Netlify — Identity](https://docs.netlify.com/manage/security/secure-access-to-sites/identity/get-started/)
- [Netlify — rejestracja i zaproszenia](https://docs.netlify.com/manage/security/secure-access-to-sites/identity/registration-login/)
- [Netlify — tokeny użytkownika](https://docs.netlify.com/manage/accounts-and-billing/user-settings/)
- [Netlify — Forms](https://docs.netlify.com/manage/forms/submissions/)
- [Netlify — Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)
- [GitHub — nowe repozytorium](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)
- [GitHub — fine-grained personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [Google — klucze Gemini API](https://ai.google.dev/gemini-api/docs/api-key)
- [Stripe — sandboxy](https://docs.stripe.com/sandboxes)
- [Stripe — klucze API](https://docs.stripe.com/keys)
- [Stripe — webhooki](https://docs.stripe.com/webhooks)
- [Stripe — karty testowe](https://docs.stripe.com/testing)
