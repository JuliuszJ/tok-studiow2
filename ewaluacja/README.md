# Ewaluacja projektów Camunda

Otwórz `index.html` w przeglądarce (bez serwera, działa też offline). Student wczytuje pliki
`.bpmn`, `.dmn`, `.form`, folder `src/main/resources` albo archiwum `.zip`.
Strona pokazuje konstrukcje brakujące względem wzorca, konstrukcje dodatkowe, uwagi techniczne
(np. niepodpięte formularze, brakujące decyzje) i sugerowaną ocenę.

## Przygotowanie wzorca

Otwórz `edytor-wzorca.html`:
1. Wzorzec z `wzorzec.js` leżącego obok strony wczytuje się automatycznie. Inny plik otworzysz przyciskiem *Wczytaj wzorzec.js…*.
2. Dodaj lub usuń pliki modeli (`.bpmn`, `.dmn`, `.form`, folder, ZIP).
3. Ustaw **punkty** za konstrukcje w formacie `99,9` (0,0–99,9, domyślnie 1,0). Wynik = (punkty za konstrukcje wzorca
   obecne u studenta + punkty przyznane w `index.html` za konstrukcje dodatkowe) / suma punktów wzorca, najwyżej 100%.
   W `wzorzec.js` zapisywane są tylko punkty różne od 1,0. Punkty za konstrukcje dodatkowe wpisuje się w zakładce
   „Dodatkowe” na stronie ewaluacji (domyślnie 0,0, tylko dla bieżącego projektu — nie są zapisywane).
   W sekcji *Pokrycie testami* ustaw maksymalne punkty za testy (0,0 = testy niepunktowane). Na stronie ewaluacji
   wpisuje się pokrycie testami w % (np. z raportu Camunda Process Test / JaCoCo); student dostaje maks. pkt × pokrycie,
   a maks. pkt za testy doliczają się do sumy punktów wzorca.
   Zaznacz checkboxem konstrukcje **pomijane**. Takich konstrukcji `index.html` nie pokazuje, nie liczy do oceny
   i nie wymienia wśród dodatkowych u studenta.
4. *Zapisz wzorzec.js…* i nadpisz plik `ewaluacja/wzorzec.js`. W Chrome/Edge pojawi się okno wyboru miejsca:
   przy pierwszym użyciu wskaż katalog `ewaluacja`, potem okno otwiera się już w katalogu ostatnio
   wczytanego/zapisanego wzorca (zapamiętane w przeglądarce). Firefox/Safari zapisują do Pobranych
   (albo pytają o miejsce, jeśli tak ustawiono w przeglądarce) — wtedy przenieś plik ręcznie.
   Firefox: `about:preferences#general` → Pliki i aplikacje → Pobieranie → „Pytaj, gdzie zapisać każdy plik”
   (zaznacz, aby wybrać miejsce; odznacz, aby wrócić do zapisu w Pobranych). Firefox nie pozwala stronie
   ustawić katalogu okna zapisu, więc edytor przy zapisie kopiuje do schowka pełną ścieżkę
   `...\ewaluacja\wzorzec.js` — wklej ją w pole „Nazwa pliku”. Instrukcja jest też w edytorze.

Alternatywnie, po zmianie modeli w projekcie: `node ewaluacja/narzedzia/generuj-wzorzec.mjs`
(odświeża pliki modeli, zachowuje nazwę, listę pomijanych i punkty z obecnego `wzorzec.js`).
Domyślny wzorzec pomija `caller.bpmn` (pomocniczy dla testu) i `AkcjaUzytkownika.form` (nieużywany).

## Pliki

- `wzorzec.js` – pliki modeli wzorca, lista pomijanych konstrukcji i punkty.
- `konfiguracja.js` – progi ocen (% pokrycia).
- `analizator.js` – wykrywanie konstrukcji; `wspolne.js` – wczytywanie plików/ZIP, odczyt i zapis wzorca.
- `app.js` – strona ewaluacji; `edytor-wzorca.js` – edytor wzorca; `style.css` – wspólne style.
