# Przykładowa lekcja — wszystkie możliwości

Ta lekcja pokazuje wszystkie najważniejsze bloki i interakcje obsługiwane przez Lesson Builder.

Możesz stosować **pogrubienie**, *kursywę*, `kod w linii`, [bezpieczne linki](https://pl.wikipedia.org/wiki/Chemia), indeks górny ^13^C oraz indeks dolny H~2~O.

---

## Nagłówki, listy i cytaty

### Nagłówek trzeciego poziomu

Lista punktowana:

- atom
- cząsteczka
- jon

Lista numerowana:

1. Przeczytaj teorię.
2. Obejrzyj przykład.
3. Rozwiąż zadanie.

> Nauka chemii jest łatwiejsza, gdy łączysz teorię z ćwiczeniami.

> **Wskazówka:** Zwracaj uwagę na jednostki, indeksy i współczynniki stechiometryczne.

---

## Obraz HTTPS

Poniższa ilustracja demonstruje bezpieczny obraz pobierany z publicznego adresu HTTPS.

![Przykładowy schemat do lekcji](https://placehold.co/1200x675/0e665a/ffffff.png?text=Schemat+lekcji+ChemDisk)

---

## Rozmiar i wyrównanie tekstu

:::style font=sans size=small align=left
To jest mały tekst wyrównany do lewej.
:::

:::style font=sans size=normal align=center
To jest tekst normalny wyśrodkowany.
:::

:::style font=sans size=large align=right
To jest duży tekst wyrównany do prawej.
:::

:::style font=sans bold=true size=xlarge align=center
To jest bardzo duży i pogrubiony tekst.
:::

---

## Podstawowe czcionki — część 1

:::style font=sans size=normal align=left
Czcionka systemowa Inter / sans.
:::

:::style font=arial size=normal align=left
Czcionka Arial.
:::

:::style font=verdana size=normal align=left
Czcionka Verdana.
:::

:::style font=serif size=normal align=left
Domyślna czcionka szeryfowa.
:::

:::style font=georgia size=normal align=left
Czcionka Georgia.
:::

---

## Podstawowe czcionki — część 2

:::style font=times size=normal align=left
Czcionka Times New Roman.
:::

:::style font=rounded size=normal align=left
Czcionka zaokrąglona.
:::

:::style font=mono size=normal align=left
Czcionka monospace.
:::

:::style font=courier size=normal align=left
Czcionka Courier New.
:::

---

## Kolory, tło i pogrubienie

:::style font=georgia color=#173f35 background=#dff7ed bold=true size=large align=center
Ten blok ma własną czcionkę, kolor tekstu, kolor tła, pogrubienie, rozmiar i wyrównanie.
:::

:::style font=arial color=#7c3aed background=#eeeafd size=normal align=left
Drugi blok pokazuje niezależną kombinację kolorów.
:::

---

## Harmonijki i kod

:::accordion Pokaż dodatkowe wyjaśnienie
Harmonijka może zawierać akapity, listy i inne zwykłe bloki Markdown.

- pierwszy szczegół
- drugi szczegół
:::

:::accordion Przykład domyślnie otwarty open=true
Ta harmonijka jest rozwinięta od razu po otwarciu slajdu.
:::

Przykładowy blok kodu:

```text
n = m / M
c = n / V
---
Separator wewnątrz bloku kodu nie tworzy nowego slajdu.
```

---

## Film YouTube

Film zostanie osadzony w bezpiecznym odtwarzaczu YouTube bez ciasteczek.

:::youtube
id: M7lc1UVf-VE
title: Przykładowy film osadzony w lekcji
:::

---

## Interaktywny model ATONOM

ATONOM najpierw pokaże kafelek. Model kwasu octowego załaduje się dopiero po kliknięciu przycisku.

:::atonom
formula: kwas octowy
title: Model 3D kwasu octowego
:::

---

## Fiszki do utrwalenia

Klikaj fiszki, aby odwracać je i odkrywać odpowiedzi.

:::flashcards
title: Grupy funkcyjne
color: #7c3aed
–OH => grupa hydroksylowa
–CHO => grupa aldehydowa
–COOH => grupa karboksylowa
–NH2 => grupa aminowa
:::

---

## Zadanie tekstowe

Podaj symbol chemiczny tlenu.

:::task
type: text
label: Symbol tlenu
placeholder: Wpisz symbol pierwiastka
answer: O
case_sensitive: true
hint: Jest to jedna wielka litera.
success: Poprawnie — symbolem tlenu jest O.
:::

---

## Zadanie liczbowe

Ile wynosi w przybliżeniu masa molowa wody w g/mol?

:::task
type: number
label: Masa molowa H2O
placeholder: Wpisz liczbę
answer: 18
hint: Dodaj masy dwóch atomów wodoru i jednego atomu tlenu.
success: Dobrze — masa molowa wody wynosi około 18 g/mol.
:::

---

## Jedna odpowiedź z listy

Wybierz pierwiastek należący do fluorowców.

:::task
type: choice
label: Wybierz jedną odpowiedź
options: chlor | tlen | sód | węgiel
answer: chlor
hint: Fluorowce znajdują się w 17. grupie układu okresowego.
success: Poprawnie — chlor jest fluorowcem.
:::

---

## Quiz ABCD z rozbudowanym pytaniem

:::question
Który zapis przedstawia **cząsteczkę wody**?

Zwróć uwagę na symbole pierwiastków i indeks dolny.
:::

:::task
type: abcd
label: Zaznacz poprawną odpowiedź
options: CO2 | H2O | O2 | NaCl
answer: B
hint: Woda zawiera wodór i tlen w stosunku 2:1.
success: Brawo — poprawna odpowiedź to H2O.
:::

---

## Luki z odpowiedziami wybieranymi z listy

Uzupełnij oba miejsca, korzystając z przygotowanych opcji.

:::task
type: gaps
label: Uzupełnij zdanie
text: Etanol należy do {{grupy związków}}, a jego grupą funkcyjną jest grupa {{nazwa grupy}}.
options: alkoholi | aldehydów | hydroksylowa | karboksylowa
answer: alkoholi | hydroksylowa
hint: Sprawdź końcówkę nazwy związku oraz obecność grupy –OH.
success: Wszystkie odpowiedzi z listy są poprawne.
:::

---

## Luki tekstowe sprawdzane pojedynczo

Wpisz odpowiedzi ręcznie. Każdą lukę możesz sprawdzić osobnym przyciskiem.

:::task
type: gaps-text
label: Uzupełnij wzór i masę molową
text: Woda ma wzór {{wzór sumaryczny}}, a jej masa molowa wynosi około {{masa molowa}} g/mol.
answer: H2O | 18
check_mode: each
case_sensitive: true
hint: Sprawdź wielkość liter w symbolach oraz obliczenie masy molowej.
success: Obie luki są poprawne.
:::

---

## Luki tekstowe sprawdzane wszystkie naraz

W tym wariancie jeden przycisk sprawdza całe zadanie.

:::task
type: gaps-text
label: Uzupełnij nazwy cząstek
text: Dodatnio naładowana cząstka w jądrze to {{pierwsza cząstka}}, a obojętna to {{druga cząstka}}.
answer: proton | neutron
check_mode: all
hint: Obie cząstki znajdują się w jądrze atomowym.
success: Świetnie — proton jest dodatni, a neutron elektrycznie obojętny.
:::

---

## Podsumowanie możliwości

W tej lekcji wykorzystano:

1. formatowanie Markdown, nagłówki, listy, cytaty, link, obraz, indeksy i kod;
2. rozmiary, wyrównanie, kolory, tła, pogrubienie i wszystkie dostępne czcionki;
3. harmonijki, film YouTube, ATONOM oraz fiszki;
4. odpowiedź tekstową, liczbową, wybór, ABCD i oba rodzaje luk.

Możesz zaimportować ten plik do Lesson Buildera, zmieniać klocki i ponownie pobierać go jako Markdown.
