import { mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { CARDS } from '../src/silnik/cards';

/**
 * Konwerter grafik roboczych na format docelowy (§8.1, §8.5).
 *
 * Rysunki powstają jako PNG/JPG o nazwach czytelnych dla człowieka
 * („Piechota zelhorska.png"), a aplikacja oczekuje `<id>.webp`. Ten skrypt
 * robi oba kroki naraz: dopasowuje plik do karty po nazwie albo po `id`
 * i zapisuje WebP pod ścieżką z manifestu.
 *
 * Źródła leżą w `zrodla/` poza `public/`, żeby wielomegabajtowe oryginały
 * nie trafiały do builda — Vite kopiuje `public/` w całości.
 *
 * Uruchomienie: npm run webp
 * Istniejące pliki nadpisuje (to jest sens ponownej konwersji).
 */

const KORZEN = join(dirname(fileURLToPath(import.meta.url)), '..');
const ZRODLA = join(KORZEN, 'zrodla', 'karty');
const CEL = join(KORZEN, 'public', 'assets', 'cards');

/** Limit z kontraktu: żaden plik graficzny nie przekracza 500 kB. */
const LIMIT_KB = 500;
const JAKOSC = 82;

/** „Łucznicy desilvarscy" → „lucznicy_desilvarscy" — tak samo jak `id` kart. */
function normalizuj(tekst: string): string {
  return tekst
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/* ---------- 1. Indeks: znormalizowana nazwa i id → id karty ---------- */

const doId = new Map<string, string>();
for (const c of CARDS) {
  doId.set(normalizuj(c.name), c.id);
  doId.set(c.id, c.id);
}

/* ---------- 2. Konwersja ---------- */

if (!existsSync(ZRODLA)) {
  console.error(`Brak katalogu źródłowego: ${ZRODLA}`);
  process.exit(1);
}

const nieznane: string[] = [];
const zaciezkie: string[] = [];
let zrobione = 0;

mkdirSync(CEL, { recursive: true });

const pliki = readdirSync(ZRODLA).filter((f: string) =>
  /\.(png|jpe?g|tiff?|webp)$/i.test(f),
);

console.log('\n=== Zelhoranka — konwersja grafik kart ===\n');

for (const plik of pliki) {
  const klucz = normalizuj(basename(plik, extname(plik)));
  const id = doId.get(klucz);

  if (!id) {
    nieznane.push(plik);
    continue;
  }

  const wyjscie = join(CEL, `${id}.webp`);
  await sharp(join(ZRODLA, plik)).webp({ quality: JAKOSC }).toFile(wyjscie);

  const kb = Math.round(statSync(wyjscie).size / 1024);
  const zrodlowe = Math.round(statSync(join(ZRODLA, plik)).size / 1024);
  if (kb > LIMIT_KB) zaciezkie.push(`${id}.webp (${kb} kB)`);

  console.log(
    `  ${plik.padEnd(28)} → ${`${id}.webp`.padEnd(28)} ${String(zrodlowe).padStart(5)} kB → ${String(kb).padStart(4)} kB`,
  );
  zrobione++;
}

/* ---------- 3. Raport ---------- */

console.log(`\nPrzekonwertowano: ${zrobione} z ${pliki.length}\n`);

if (nieznane.length > 0) {
  console.log('NIEROZPOZNANE (nazwa nie pasuje do żadnej karty):');
  for (const n of nieznane) console.log(`  ? ${n}`);
  console.log('');
}

if (zaciezkie.length > 0) {
  console.log(`PONAD LIMIT ${LIMIT_KB} kB — obniż jakość albo rozmiar:`);
  for (const z of zaciezkie) console.log(`  ! ${z}`);
  console.log('');
}

if (nieznane.length > 0) process.exit(1);
