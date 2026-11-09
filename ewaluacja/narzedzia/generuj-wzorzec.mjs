// Generuje plik ../wzorzec.js z plików projektu wzorcowego (prowadzącego).
// Użycie (z katalogu repozytorium):  node ewaluacja/narzedzia/generuj-wzorzec.mjs
// Lista pomijanych konstrukcji jest zachowywana z istniejącego wzorzec.js
// (ustawia się ją w edytor-wzorca.html). Tę samą pracę można wykonać w całości w edytorze.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const resources = join(here, '..', '..', 'zaliczenie-semestru', 'src', 'main', 'resources');
const target = join(here, '..', 'wzorzec.js');

// Pliki pomocnicze pominięte celowo:
//  - caller.bpmn          (proces uruchamiany tylko w OdwolanieTest)
//  - AkcjaUzytkownika.form (formularz niepodpięty pod żadne zadanie)
const files = [
  'ZaliczenieSemestru.bpmn',
  'Odwolanie.bpmn',
  'PobranieOplaty.bpmn',
  'OcenaPodania.dmn',
  'ZlozeniePodania.form',
  'OdebranieDecyzji.form',
  'DanePlatnosci.form',
];

let nazwa = 'Projekt wzorcowy: Zaliczenie semestru';
let pomijane = ['dmn.hit.UNIQUE'];
let wagi = {};
if (existsSync(target)) {
  const text = readFileSync(target, 'utf8');
  const start = text.indexOf('{', text.indexOf('window.WZORZEC'));
  const old = JSON.parse(text.slice(start, text.lastIndexOf('}') + 1));
  if (Array.isArray(old.pomijane)) pomijane = old.pomijane;
  if (old.wagi && typeof old.wagi === 'object') wagi = old.wagi;
  if (old.nazwa) nazwa = old.nazwa;
}

const pliki = files.map(f => ({ name: basename(f), content: readFileSync(join(resources, f), 'utf8') }));
const out = '// Wzorzec projektu dla strony ewaluacji (index.html).\n' +
  '// Edytuj za pomocą edytor-wzorca.html albo wygeneruj: node ewaluacja/narzedzia/generuj-wzorzec.mjs\n' +
  '// Zapisano: ' + new Date().toISOString() + '\n' +
  'window.WZORZEC = ' + JSON.stringify({ nazwa, pomijane, wagi, pliki }, null, 1) + ';\n';
writeFileSync(target, out, 'utf8');
console.log(`Zapisano wzorzec.js (${pliki.length} plików, pomijanych konstrukcji: ${pomijane.length}, wag innych niż 1,0: ${Object.keys(wagi).length})`);
