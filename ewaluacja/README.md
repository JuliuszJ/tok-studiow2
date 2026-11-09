# Ewaluacja projektów Camunda

Otwórz `index.html` w przeglądarce (bez serwera, działa też offline). Student wczytuje pliki
`.bpmn`, `.dmn`, `.form`, folder `src/main/resources` albo archiwum `.zip`.
Strona pokazuje konstrukcje brakujące względem wzorca, konstrukcje dodatkowe, uwagi techniczne
(np. niepodpięte formularze, brakujące decyzje) i sugerowaną ocenę.

## Przygotowanie wzorca

Otwórz `edytor-wzorca.html`:
1. Wzorzec z `wzorzec.js` leżącego obok strony wczytuje się automatycznie. Inny plik otworzysz przyciskiem *Wczytaj wzorzec.js…*.
2. Dodaj lub usuń pliki modeli (`.bpmn`, `.dmn`, `.form`, folder, ZIP).
3. Zaznacz checkboxem konstrukcje **pomijane**. Takich konstrukcji `index.html` nie pokazuje, nie liczy do oceny
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
(odświeża pliki modeli, zachowuje nazwę i listę pomijanych z obecnego `wzorzec.js`).
Domyślny wzorzec pomija `caller.bpmn` (pomocniczy dla testu) i `AkcjaUzytkownika.form` (nieużywany).

## Pliki

- `wzorzec.js` – pliki modeli wzorca i lista pomijanych konstrukcji.
- `konfiguracja.js` – progi ocen (% pokrycia).
- `analizator.js` – wykrywanie konstrukcji; `wspolne.js` – wczytywanie plików/ZIP, odczyt i zapis wzorca.
- `app.js` – strona ewaluacji; `edytor-wzorca.js` – edytor wzorca; `style.css` – wspólne style.
