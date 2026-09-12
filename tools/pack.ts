import { existsSync, readdirSync, statSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

/**
 * Pakowanie projektu do oddania (§12.2).
 *
 * Z archiwum wysyłanego na uploader wypada `node_modules/` i `dist/`.
 * Uwaga z wytycznych: na maszynie wirtualnej aplikacja ma być ZBUDOWANA
 * i działająca — `dist/` usuwamy tylko z paczki, nie z dysku.
 */

const KORZEN = join(dirname(fileURLToPath(import.meta.url)), '..');
const WYKLUCZONE = new Set([
  'node_modules',
  'dist',
  'build',
  '.vite',
  'coverage',
  '.git',
  'paczka',
]);

const DOCELOWY = join(KORZEN, 'paczka');
const NAZWA = `zelhoranka-${new Date().toISOString().slice(0, 10)}`;

function kopiuj(zrodlo: string, cel: string): number {
  let ile = 0;
  for (const wpis of readdirSync(zrodlo)) {
    if (WYKLUCZONE.has(wpis)) continue;
    if (wpis.endsWith('.zip')) continue;
    const sciezkaZ = join(zrodlo, wpis);
    const sciezkaC = join(cel, wpis);
    if (statSync(sciezkaZ).isDirectory()) {
      mkdirSync(sciezkaC, { recursive: true });
      ile += kopiuj(sciezkaZ, sciezkaC);
    } else {
      cpSync(sciezkaZ, sciezkaC);
      ile++;
    }
  }
  return ile;
}

console.log('\n=== Zelhoranka — pakowanie ===\n');

if (existsSync(DOCELOWY)) rmSync(DOCELOWY, { recursive: true, force: true });
const katalog = join(DOCELOWY, NAZWA);
mkdirSync(katalog, { recursive: true });

const ile = kopiuj(KORZEN, katalog);
console.log(`Skopiowano ${ile} plików do paczka/${NAZWA}`);
console.log(`Pominięto: ${[...WYKLUCZONE].join(', ')}`);

// Archiwum ZIP — PowerShell jest na każdej maszynie z Windows, bez zależności.
const zip = join(DOCELOWY, `${NAZWA}.zip`);
try {
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${katalog}' -DestinationPath '${zip}' -Force"`,
    { stdio: 'inherit' },
  );
  console.log(`\nArchiwum: ${relative(KORZEN, zip)}`);
} catch {
  console.log('\nNie udało się zbudować ZIP-a automatycznie.');
  console.log(`Spakuj ręcznie katalog: ${relative(KORZEN, katalog)}`);
}

console.log('\nPrzed oddaniem sprawdź: npm run build && npm test && npm run validate\n');
