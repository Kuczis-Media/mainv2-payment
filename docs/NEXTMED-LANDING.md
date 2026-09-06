# Landing NextMed i wspólna marka

Otwórz **Studio → Landing Page Builder**. Zmień nazwę marki, firmę, logo, favicon, kolory i kontakt, a następnie treść poszczególnych sekcji. Podgląd reaguje podczas pisania; zmiana kolejności i wyłączenie sekcji nie wymagają edytowania kodu. Ciemny motyw panelu zachowuje własną paletę dla czytelności.

Samo pisanie i podgląd nie wywołują Functions. Szkic ma lokalną kopię w przeglądarce. **Zapisz szkic** zapisuje go na serwerze, a **Opublikuj** udostępnia nową wersję odwiedzającym. Edycja i eksport są dostępne również wtedy, gdy serwerowy zapis jest niedostępny.

## Publikacja i zmienne

W generatorze `.env` znajdziesz grupę **Logo i landing**. Ustaw `GITHUB_SITE_ASSETS_TOKEN`: fine-grained PAT z uprawnieniem **Contents: Read and write** do publicznego repozytorium `Kuczis-Media/logo` oraz repozytorium JSON, jeśli wybierzesz inne. Token pozostaje wyłącznie po stronie serwera. Plik domyślnie publikowany pod `landing/config.json` zawiera publiczną treść strony i informacje o marce, dlatego nie wpisuj tam sekretów.

`GITHUB_SITE_ASSETS_DIRECTORY` opcjonalnie wybiera katalog przesyłanych obrazów. Nie zmienia ścieżki konfiguracji strony. Serwerowy szkic wymaga też działającego magazynu Blobs (`SITE_ID` i `NETLIFY_API_TOKEN`). Po zmianie zmiennych środowiskowych wykonaj deploy aplikacji.

Publikacja zapisuje statyczną konfigurację w GitHubie. Jeśli zapis GitHuba się nie powiedzie, Studio zgłasza błąd publikacji; publiczna strona zachowuje poprzednią wersję. Skuteczna publikacja nie wymaga nowego deploya. Nazwa, logo i favicon z tej konfiguracji są także używane przez główne ekrany panelu, Studio, logowania, zakupów i statusu dostępu.

Odczyt wspólnej marki używa 15-minutowego cache w przeglądarce. Osoba, która wcześniej odwiedziła stronę, może więc zobaczyć zmianę z opóźnieniem do około 15 minut, dodatkowo zależnym od cache GitHuba. Odświeżenie strony wciąż korzysta z aktualnej kopii lokalnej. Obrazy przesłane w Studio mają linki CDN przypięte do wersji pliku, co umożliwia długie cache bez mylenia różnych wersji logo.

## Inna domena i własna ścieżka JSON

W **Panel admina → Landing** dostępne są:

- **Używaj landingu z innej domeny** i adres, np. `start.netlify.app`. Po zapisaniu wejście na stronę główną przekierowuje przeglądarkę na ten adres HTTPS. Wyłączenie przełącznika przywraca lokalny landing. Panel `/members/`, logowanie `/login/` i kurs nie są przekierowywane. Parametry i fragment wejściowego adresu, w tym tokeny logowania, nie są przekazywane obcej domenie.
- **Plik JSON** w formacie `właściciel/repozytorium/ścieżka.json`, np. `Kuczis-Media/repo/strona.json`, oraz **Gałąź GitHuba**, np. `main`. Repozytorium i gałąź muszą już istnieć, repozytorium musi być publiczne. Obok można skopiować gotowy publiczny URL. Nie trzeba zmieniać `.env` ani robić deploya po każdej zmianie ścieżki.

Przy zapisie do nieistniejącego pliku aplikacja najpierw kopiuje obecną publikację (lub domyślny landing, jeśli jeszcze nie ma publikacji), dopiero potem zmienia aktywne źródło. Poprzedni plik zostaje na miejscu. Istniejący poprawny landing jest używany bez nadpisania; niepowiązany lub uszkodzony JSON powoduje błąd. W razie konfliktu przy przełączeniu źródła nowa kopia może już istnieć, ale stary plik i aktywne ustawienia nie są usuwane. Po zmianie źródła odśwież otwarte Studio — publikacja ze starej karty zostanie zablokowana. Szkic edytora jest oddzielny od publikacji: sprawdź jego treść przed opublikowaniem w nowym miejscu.

Mały plik startowy `Kuczis-Media/logo@main/landing/route.json` przechowuje adres zewnętrzny i wskazanie wybranego JSON. Ta ścieżka jest stała i zarezerwowana, żeby wszystkie strony wiedziały, skąd odczytać ustawienia. Repozytorium obrazów pozostaje `Kuczis-Media/logo`; zmiana lokalizacji JSON nie przenosi obrazów. Token musi mieć dostęp zarówno do repozytorium ustawień, jak i do docelowego repozytorium JSON.

Strona główna najpierw ustala źródło, potem odczytuje JSON i renderuje treść. W czasie oczekiwania pokazuje krótki komunikat ładowania. Odczyty mają timeouty; przy awarii używana jest poprawna kopia z cache lub strona dołączona do wdrożenia. Plik startowy ma 1-minutowy cache przeglądarki, sama treść i marka — 15-minutowy. Cache treści jest przypisany do pełnego adresu JSON, więc zmiana repozytorium nie wczytuje poprzedniej marki. Dochodzi do tego czas odświeżenia cache GitHuba. Odczyt ustawień i treści nie wywołuje Functions; w panelu funkcja uruchamia się przy wczytaniu lub zapisie ustawień, bez cyklicznego odpytywania.

Zewnętrzny landing jest niezależną stroną, a nie ramką w aplikacji. Musi mieć własny kod odczytu i renderowania wybranego JSON; samo wpisanie domeny nie dodaje takiego kodu. Kopia tej aplikacji NextMed korzysta z tego samego pliku startowego i pomija przekierowanie na własną domenę. Eksport **Pobierz stronę HTML** pozostaje natomiast samodzielną migawką, nie odczytuje późniejszych zmian JSON.

## Samodzielny plik HTML

**Pobierz stronę HTML** tworzy gotową stronę z osadzonym stylem, skryptem animacji i bieżącą treścią. Można udostępnić ją na zwykłym hostingu statycznym, bez Node, Functions, tokenu GitHuba czy serwera aplikacji. Obrazy nadal korzystają ze swoich publicznych URL-i, więc do ich wyświetlenia potrzebny jest internet.

Linki do kursu, konta i zakupu prowadzą do oryginalnej aplikacji. Kontakt używa skonfigurowanego adresu e-mail lub odsyła do strony aplikacji. Plik eksportu jest migawką: późniejsza publikacja w Studio go nie zmieni. Pobierz i umieść nowy HTML, aby zaktualizować taką kopię. **Pobierz JSON** służy natomiast do kopii zapasowej i ponownego importu w edytorze.

## Koszt odczytów

Statyczna konfiguracja, marka i animacje przewijania nie uruchamiają Functions. Zapis szkicu i publikacja wykonują pojedyncze żądanie do funkcji administracyjnej; publikacja może wewnątrz wykonać kilka operacji GitHuba lub magazynu.

Na głównej stronie aplikacji aktualne pakiety pobierają się po kliknięciu przycisku pokazania oferty. Ten odczyt ma cache, ale może wywołać funkcję płatności. Logowanie, checkout, sprawdzanie uprawnień i działanie samego kursu pozostają funkcjami aplikacji, a nie statycznej strony. Nie należy więc interpretować statycznego landingu jako wyłączenia kosztu całego backendu.

Techniczne nazwy istniejących repozytoriów, magazynów danych i kluczy sesji nie zostały przemianowane: zmiana widocznej marki nie wymaga migracji kont ani materiałów.
