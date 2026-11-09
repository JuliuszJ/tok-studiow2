# Ewaluacja projektów Camunda

Otwórz `index.html` w przeglądarce (bez serwera, działa też offline). Student wczytuje pliki
`.bpmn`, `.dmn`, `.form`, folder `src/main/resources` albo archiwum `.zip`.
Strona pokazuje konstrukcje brakujące względem wzorca, konstrukcje dodatkowe, uwagi techniczne
(np. niepodpięte formularze, brakujące decyzje) i sugerowaną ocenę.

- `wzorzec.js` – osadzone pliki projektu wzorcowego (generowane, nie edytować ręcznie).
  Po zmianie modeli wzorca: `node ewaluacja/narzedzia/generuj-wzorzec.mjs`.
  Pominięte celowo: `caller.bpmn` (pomocniczy dla testu) i `AkcjaUzytkownika.form` (nieużywany).
- `konfiguracja.js` – progi ocen (% pokrycia) i konstrukcje niewliczane do oceny.
- `analizator.js` – wykrywanie konstrukcji; `app.js` – interfejs (w tym czytnik ZIP).
