import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARDS, CONFIG, RULES } from '../src/silnik/cards';
import { REGISTRY } from '../src/silnik/rules';
import type { Card, Zone } from '../src/silnik/types';

/**
 * Walidacja danych przed commitem (§8.3).
 *
 * Sprawdza unikalność `id`, kompletność pól wymaganych dla typu, zgodność
 * `zones` z profilem ataku, istnienie plików `art` i `symbol` oraz to, czy
 * każda reguła użyta na kartach ma implementację.
 *
 * Wypisuje listę brakujących grafik — to jest lista zadań rysunkowych.
 */

const KORZEN = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(KORZEN, 'public', 'assets');

const bledy: string[] = [];
const ostrzezenia: string[] = [];
const brakujaceGrafiki: string[] = [];

function blad(msg: string): void {
  bledy.push(msg);
}

/* ---------- 1. Unikalność identyfikatorów ---------- */

const widziane = new Set<string>();
for (const c of CARDS) {
  if (widziane.has(c.id)) blad(`Zduplikowany id karty: ${c.id}`);
  widziane.add(c.id);
  if (!/^[a-z0-9_]+$/.test(c.id)) {
    blad(`Id karty musi być w snake_case bez znaków diakrytycznych: ${c.id}`);
  }
}

/* ---------- 2. Pola wymagane dla typu ---------- */

function wymagaj(c: Card, pole: string, warunek: boolean): void {
  if (!warunek) blad(`${c.id}: brak albo błędne pole "${pole}" dla typu ${c.type}`);
}

for (const c of CARDS) {
  wymagaj(c, 'name', typeof c.name === 'string' && c.name.length > 0);
  wymagaj(c, 'text', typeof c.text === 'string');
  wymagaj(c, 'copies', Number.isInteger(c.copies) && c.copies > 0);
  wymagaj(c, 'rules', Array.isArray(c.rules));

  switch (c.type) {
    case 'RECRUIT':
      wymagaj(c, 'offense', Number.isInteger(c.offense) && c.offense >= 0);
      wymagaj(c, 'defense', Number.isInteger(c.defense) && c.defense >= 0);
      wymagaj(c, 'cost', Number.isInteger(c.cost) && c.cost >= 0);
      wymagaj(c, 'zones', Array.isArray(c.zones) && c.zones.length > 0);
      wymagaj(c, 'attack', Boolean(c.attack) && Array.isArray(c.attack.offsets));
      if (c.attack) {
        wymagaj(
          c,
          'attack.reach',
          ['FRONT', 'DEEP', 'RANGED'].includes(c.attack.reach),
        );
        wymagaj(c, 'attack.fromRear', typeof c.attack.fromRear === 'boolean');
        for (const o of c.attack.offsets) {
          if (!Number.isInteger(o) || Math.abs(o) > 3) {
            blad(`${c.id}: offset ${o} poza sensownym zakresem -3..3`);
          }
        }
      }
      break;
    case 'SUPPLY':
      wymagaj(c, 'supply', Number.isInteger(c.supply) && c.supply > 0);
      break;
    case 'AMBUSH':
      wymagaj(c, 'trigger', ['ENEMY_DEPLOYED', 'ORDERS_REVEALED'].includes(c.trigger));
      wymagaj(c, 'cost', Number.isInteger(c.cost) && c.cost >= 0);
      break;
    case 'INTERVENTION':
      wymagaj(c, 'requirements', Array.isArray(c.requirements));
      wymagaj(c, 'effect', typeof c.effect === 'string' && c.effect.length > 0);
      break;
    case 'MANEUVER':
      wymagaj(c, 'effect', typeof c.effect === 'string' && c.effect.length > 0);
      break;
    default:
      blad(`${(c as Card).id}: nieznany typ karty "${(c as Card).type}"`);
  }
}

/* ---------- 3. Spójność zones ↔ attack ---------- */

for (const c of CARDS) {
  if (c.type !== 'RECRUIT') continue;
  const tylkoTyl = c.zones.length === 1 && c.zones[0] === 'REAR';
  if (tylkoTyl && !c.attack.fromRear && c.offense > 1) {
    ostrzezenia.push(
      `${c.id}: stoi wyłącznie w tylnej linii i nie ma "fromRear", więc jego ofensywa ${c.offense} nigdy nie zadziała.`,
    );
  }
  const dozwolone: Zone[] = ['MAIN', 'FLANK', 'REAR'];
  for (const z of c.zones) {
    if (!dozwolone.includes(z)) blad(`${c.id}: nieznana strefa "${z}"`);
  }
}

/* ---------- 4. Reguły: deklaracja ↔ implementacja ---------- */

const idReguł = new Set(RULES.map((r) => r.id));
for (const c of CARDS) {
  for (const r of c.rules) {
    if (!idReguł.has(r)) blad(`${c.id}: reguła "${r}" nie istnieje w rules.json`);
    else if (!REGISTRY[r]) blad(`${c.id}: reguła "${r}" nie ma implementacji w silnik/rules/`);
  }
}
for (const r of RULES) {
  if (!REGISTRY[r.id]) blad(`rules.json: reguła "${r.id}" nie ma implementacji`);
  const uzyta = CARDS.some((c) => c.rules.includes(r.id));
  if (!uzyta) ostrzezenia.push(`Reguła "${r.id}" nie jest użyta na żadnej karcie.`);
}

/* ---------- 5. Pliki graficzne ---------- */

function sprawdzPlik(sciezka: string, opis: string): void {
  if (!existsSync(join(PUBLIC, sciezka))) brakujaceGrafiki.push(`${sciezka}  ← ${opis}`);
}

for (const c of CARDS) {
  if (c.art) sprawdzPlik(c.art, `awers: ${c.name}`);
  if (c.type === 'RECRUIT') sprawdzPlik(`board/tokens/${c.id}.webp`, `żeton: ${c.name}`);
}
for (const r of RULES) sprawdzPlik(r.symbol, `symbol reguły: ${r.name}`);
for (const t of ['recruit', 'supply', 'ambush', 'intervention', 'maneuver']) {
  sprawdzPlik(`cards/backs/back_${t}.webp`, `rewers typu ${t}`);
}
for (const s of ['main', 'flank', 'rear']) {
  sprawdzPlik(`board/field_${s}.webp`, `pole planszy: ${s}`);
}
sprawdzPlik('board/table.webp', 'tło stołu');

/* ---------- 6. Rozmiar talii ---------- */

const wgTypu = new Map<string, number>();
let razem = 0;
for (const c of CARDS) {
  wgTypu.set(c.type, (wgTypu.get(c.type) ?? 0) + c.copies);
  razem += c.copies;
}
if (razem !== CONFIG.deckSize) {
  blad(`Talia liczy ${razem} kart, a config.deckSize mówi ${CONFIG.deckSize}.`);
}

/* ---------- Raport ---------- */

console.log('\n=== Zelhoranka — walidacja danych ===\n');
console.log(`Definicji kart: ${CARDS.length}   Kart w talii: ${razem}`);
for (const [typ, ile] of [...wgTypu].sort()) console.log(`  ${typ.padEnd(13)} ${ile}`);
console.log(`Reguł specjalnych: ${RULES.length}\n`);

if (ostrzezenia.length > 0) {
  console.log('OSTRZEŻENIA:');
  for (const o of ostrzezenia) console.log(`  ! ${o}`);
  console.log('');
}

if (brakujaceGrafiki.length > 0) {
  console.log(`BRAKUJĄCE GRAFIKI (${brakujaceGrafiki.length}) — lista zadań rysunkowych:`);
  for (const g of brakujaceGrafiki) console.log(`  · ${g}`);
  console.log('\n  Gra działa bez nich na placeholderach proceduralnych (§8.4).\n');
}

if (bledy.length > 0) {
  console.error(`BŁĘDY (${bledy.length}):`);
  for (const b of bledy) console.error(`  ✗ ${b}`);
  console.error('');
  process.exit(1);
}

console.log('Dane poprawne.\n');
