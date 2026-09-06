# Landing NextMed i wspólna marka

Otwórz **Studio → Landing Page Builder**. Zmień nazwę marki, firmę, logo, favicon, kolory i kontakt, a następnie treść poszczególnych sekcji. Podgląd reaguje podczas pisania; zmiana kolejności i wyłączenie sekcji nie wymagają edytowania kodu. Ciemny motyw panelu zachowuje własną paletę dla czytelności.

Samo pisanie i podgląd nie wywołują Functions. Szkic ma lokalną kopię w przeglądarce. **Zapisz szkic** zapisuje go na serwerze, a **Opublikuj** udostępnia nową wersję odwiedzającym. Edycja i eksport są dostępne również wtedy, gdy serwerowy zapis jest niedostępny.

## Publikacja i zmienne

W generatorze `.env` znajdziesz grupę **Logo i landing**. Ustaw `GITHUB_SITE_ASSETS_TOKEN`: fine-grained PAT z uprawnieniem **Contents: Read and write** do publicznego repozytorium `Kuczis-Media/logo`. Token pozostaje wyłącznie po stronie serwera. Plik publikowany pod `landing/config.json` zawiera publiczną treść strony i informacje o marce, dlatego nie wpisuj tam sekretów.

`GITHUB_SITE_ASSETS_DIRECTORY` opcjonalnie wybiera katalog przesyłanych obrazów. Nie zmienia ścieżki konfiguracji strony. Serwerowy szkic wymaga też działającego magazynu Blobs (`SITE_ID` i `NETLIFY_API_TOKEN`). Po zmianie zmiennych środowiskowych wykonaj deploy aplikacji.

Publikacja zapisuje statyczną konfigurację w GitHubie. Jeśli zapis GitHuba się nie powiedzie, Studio zgłasza błąd publikacji; publiczna strona zachowuje poprzednią wersję. Skuteczna publikacja nie wymaga nowego deploya. Nazwa, logo i favicon z tej konfiguracji są także używane przez główne ekrany panelu, Studio, logowania, zakupów i statusu dostępu.

Odczyt wspólnej marki używa 15-minutowego cache w przeglądarce. Osoba, która wcześniej odwiedziła stronę, może więc zobaczyć zmianę z opóźnieniem do około 15 minut, dodatkowo zależnym od cache GitHuba. Odświeżenie strony wciąż korzysta z aktualnej kopii lokalnej. Obrazy przesłane w Studio mają linki CDN przypięte do wersji pliku, co umożliwia długie cache bez mylenia różnych wersji logo.

## Samodzielny plik HTML

**Pobierz stronę HTML** tworzy gotową stronę z osadzonym stylem, skryptem animacji i bieżącą treścią. Można udostępnić ją na zwykłym hostingu statycznym, bez Node, Functions, tokenu GitHuba czy serwera aplikacji. Obrazy nadal korzystają ze swoich publicznych URL-i, więc do ich wyświetlenia potrzebny jest internet.

Linki do kursu, konta i zakupu prowadzą do oryginalnej aplikacji. Kontakt używa skonfigurowanego adresu e-mail lub odsyła do strony aplikacji. Plik eksportu jest migawką: późniejsza publikacja w Studio go nie zmieni. Pobierz i umieść nowy HTML, aby zaktualizować taką kopię. **Pobierz JSON** służy natomiast do kopii zapasowej i ponownego importu w edytorze.

## Koszt odczytów

Statyczna konfiguracja, marka i animacje przewijania nie uruchamiają Functions. Zapis szkicu i publikacja wykonują pojedyncze żądanie do funkcji administracyjnej; publikacja może wewnątrz wykonać kilka operacji GitHuba lub magazynu.

Na głównej stronie aplikacji aktualne pakiety pobierają się po kliknięciu przycisku pokazania oferty. Ten odczyt ma cache, ale może wywołać funkcję płatności. Logowanie, checkout, sprawdzanie uprawnień i działanie samego kursu pozostają funkcjami aplikacji, a nie statycznej strony. Nie należy więc interpretować statycznego landingu jako wyłączenia kosztu całego backendu.

Techniczne nazwy istniejących repozytoriów, magazynów danych i kluczy sesji nie zostały przemianowane: zmiana widocznej marki nie wymaga migracji kont ani materiałów.
