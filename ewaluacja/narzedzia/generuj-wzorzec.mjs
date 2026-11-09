// Generuje plik ../wzorzec.js z plików projektu wzorcowego (prowadzącego).
// Użycie (z katalogu repozytorium):  node ewaluacja/narzedzia/generuj-wzorzec.mjs
// Strona działa bez serwera (file://), więc pliki wzorca muszą być osadzone w JS.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const resources = join(here, '..', '..', 'zaliczenie-semestru', 'src', 'main', 'resources');

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

const data = files.map(f => ({ name: basename(f), content: readFileSync(join(resources, f), 'utf8') }));
const out = '// PLIK GENEROWANY przez narzedzia/generuj-wzorzec.mjs — nie edytuj ręcznie.\n' +
  '// Wygenerowano: ' + new Date().toISOString() + '\n' +
  'window.WZORZEC = ' + JSON.stringify({ nazwa: 'Projekt wzorcowy: Zaliczenie semestru', pliki: data }, null, 1) + ';\n';
writeFileSync(join(here, '..', 'wzorzec.js'), out, 'utf8');
console.log('Zapisano wzorzec.js (' + data.length + ' plików)');
