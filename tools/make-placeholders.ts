import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARDS, RULES } from '../src/silnik/cards';
import type { CardType } from '../src/silnik/types';

/**
 * Generator tymczasowych grafik (§8.3).
 *
 * Wypisuje pliki SVG pod dokładnie tymi ścieżkami, których oczekuje aplikacja,
 * więc od razu widać docelowy układ kadrów i pól bezpiecznych. Kiedy powstanie
 * właściwa ilustracja, wystarczy podmienić plik na .webp o tej samej nazwie.
 *
 * Uruchomienie: npm run placeholders
 * Istniejących plików NIE nadpisuje.
 */

const KORZEN = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(KORZEN, 'public', 'assets');

const PALETA: Record<CardType, string> = {
  RECRUIT: '#B04239',
  SUPPLY: '#C2974C',
  AMBUSH: '#171C26',
  INTERVENTION: '#568975',
  MANEUVER: '#33455F',
};


const KOSC = '#ECE4D0';

let zapisane = 0;
let pominiete = 0;

function zapisz(wzgledna: string, tresc: string): void {
  const pelna = join(PUBLIC, wzgledna);
  if (existsSync(pelna)) {
    pominiete++;
    return;
  }
  mkdirSync(dirname(pelna), { recursive: true });
  writeFileSync(pelna, tresc, 'utf8');
  zapisane++;
}

function escapuj(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Deterministyczny kąt kreskowania — każda karta wygląda inaczej. */
function kat(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 180;
}

/* ---------- Awersy kart: 750 × 1050 (5:7), z pasami z §8.2 ---------- */

for (const c of CARDS) {
  const kolor = PALETA[c.type];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="1050" viewBox="0 0 750 1050">
  <defs>
    <pattern id="kreski" width="16" height="16" patternUnits="userSpaceOnUse"
             patternTransform="rotate(${kat(c.id)})">
      <rect width="16" height="16" fill="${kolor}"/>
      <line x1="0" y1="0" x2="0" y2="16" stroke="#000" stroke-opacity="0.12" stroke-width="6"/>
    </pattern>
  </defs>

  <rect width="750" height="1050" fill="url(#kreski)"/>

  <!-- pas górny: koszt + nazwa, wys. 120 -->
  <rect x="0" y="0" width="750" height="120" fill="#1E2430" fill-opacity="0.92"/>
  <text x="30" y="76" font-family="serif" font-size="44" fill="${KOSC}">${escapuj(c.name)}</text>

  <!-- obszar ilustracji: 750 × 620 -->
  <rect x="0" y="120" width="750" height="620" fill="none" stroke="${KOSC}"
        stroke-opacity="0.25" stroke-dasharray="12 10"/>
  <text x="375" y="440" font-family="sans-serif" font-size="30" fill="${KOSC}"
        fill-opacity="0.55" text-anchor="middle">ILUSTRACJA</text>
  <text x="375" y="482" font-family="sans-serif" font-size="22" fill="${KOSC}"
        fill-opacity="0.4" text-anchor="middle">750 × 620 — pełna swoboda kompozycji</text>

  <!-- tekst karty, wys. 180 -->
  <rect x="0" y="740" width="750" height="180" fill="${KOSC}" fill-opacity="0.88"/>
  <text x="30" y="800" font-family="serif" font-size="28" fill="#1E2430">${escapuj(c.text.slice(0, 46))}</text>

  <!-- pas dolny: OFN / symbole / DEF, wys. 130 -->
  <rect x="0" y="920" width="750" height="130" fill="#1E2430" fill-opacity="0.92"/>
  <text x="375" y="1000" font-family="sans-serif" font-size="26" fill="${KOSC}"
        fill-opacity="0.6" text-anchor="middle">OFN · symbole · DEF — rysuje aplikacja</text>

  <text x="720" y="76" font-family="sans-serif" font-size="24" fill="${KOSC}"
        fill-opacity="0.55" text-anchor="end">${c.type}</text>
</svg>
`;
  zapisz(`cards/${c.id}.svg`, svg);
}

/* ---------- Żetony jednostek: 512 × 512, kadr bez tekstu ---------- */

for (const c of CARDS) {
  if (c.type !== 'RECRUIT') continue;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${PALETA.RECRUIT}"/>
  <g stroke="#000" stroke-opacity="0.15" stroke-width="18"
     transform="rotate(${kat(c.id)} 256 256)">
    ${Array.from({ length: 12 }, (_, i) => `<line x1="${i * 48 - 120}" y1="-120" x2="${i * 48 - 120}" y2="632"/>`).join('\n    ')}
  </g>
  <circle cx="256" cy="256" r="120" fill="${KOSC}" fill-opacity="0.18"/>
  <text x="256" y="272" font-family="serif" font-size="96" fill="${KOSC}"
        fill-opacity="0.8" text-anchor="middle">${escapuj(c.name.charAt(0))}</text>
</svg>
`;
  zapisz(`board/tokens/${c.id}.svg`, svg);
}

/* ---------- Pola planszy: 512 × 512, trzy warianty stref ---------- */

const STREFY: Record<string, string> = {
  main: '#568975',
  flank: '#C2974C',
  rear: '#3B4F70',
};

/*
 * Bez podpisu strefy w grafice — nazwę rysuje aplikacja warstwą DOM (§8.1, §8.3).
 * Wypalony tekst dublowałby się z etykietą z interfejsu.
 */
for (const [klucz, kolor] of Object.entries(STREFY)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#2B3A56"/>
  <rect width="512" height="512" fill="${kolor}" fill-opacity="0.22"/>
  <rect x="10" y="10" width="492" height="492" fill="none" stroke="#0F1520"
        stroke-opacity="0.55" stroke-width="14"/>
</svg>
`;
  zapisz(`board/field_${klucz}.svg`, svg);
}

/* ---------- Tło stołu ---------- */

zapisz(
  'board/table.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="1440" viewBox="0 0 2560 1440">
  <defs>
    <radialGradient id="swiatlo" cx="50%" cy="45%" r="65%">
      <stop offset="0%" stop-color="#3B4F70"/>
      <stop offset="100%" stop-color="#1B2639"/>
    </radialGradient>
    <pattern id="len" width="10" height="10" patternUnits="userSpaceOnUse">
      <rect width="10" height="10" fill="none"/>
      <line x1="0" y1="0" x2="10" y2="10" stroke="#000" stroke-opacity="0.05" stroke-width="2"/>
    </pattern>
  </defs>
  <rect width="2560" height="1440" fill="url(#swiatlo)"/>
  <rect width="2560" height="1440" fill="url(#len)"/>
</svg>
`,
);

/* ---------- Symbole reguł: kanwa 64 × 64, jednobarwne (currentColor) ---------- */

const KSZTALTY: Record<string, string> = {
  oslona: '<path d="M32 6 L54 16 V34 C54 46 44 55 32 58 C20 55 10 46 10 34 V16 Z" />',
  szarza: '<path d="M6 40 L34 40 L26 24 L52 44 L24 44 L32 58 Z" />',
  ostrzal: '<path d="M8 56 L56 8 M38 8 H56 V26 M8 40 L24 56" stroke="currentColor" stroke-width="6" fill="none" stroke-linecap="round"/>',
  niezlomnosc: '<path d="M32 4 L58 18 V36 C58 48 46 58 32 62 C18 58 6 48 6 36 V18 Z M24 32 l6 8 12 -16" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
  zwiadowca: '<path d="M32 14 C16 14 6 32 6 32 s10 18 26 18 26-18 26-18-10-18-26-18 Z" fill="none" stroke="currentColor" stroke-width="6"/><circle cx="32" cy="32" r="8"/>',
  zaopatrzeniowiec: '<rect x="10" y="22" width="44" height="28" rx="3" fill="none" stroke="currentColor" stroke-width="6"/><path d="M20 22 V14 h24 v8" fill="none" stroke="currentColor" stroke-width="6"/>',
};

for (const r of RULES) {
  const ksztalt = KSZTALTY[r.id] ?? '<circle cx="32" cy="32" r="22" />';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="currentColor">
  <title>${escapuj(r.name)}</title>
  ${ksztalt}
</svg>
`;
  zapisz(r.symbol.replace(/\.svg$/, '.svg'), svg);
}

/* ---------- Raport ---------- */

console.log('\n=== Zelhoranka — placeholdery ===\n');
console.log(`Zapisane pliki: ${zapisane}`);
console.log(`Pominięte (już istnieją): ${pominiete}`);
console.log(`Katalog: ${PUBLIC}\n`);
console.log('Placeholdery to SVG. Aplikacja szuka .webp, więc dopóki ich nie ma,');
console.log('rysuje własne tła proceduralne — to normalne i nie psuje gry (§8.4).');
console.log('Podmiana oprawy = wrzucenie plików .webp o tych samych nazwach.\n');
