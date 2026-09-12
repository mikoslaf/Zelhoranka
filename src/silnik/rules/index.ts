import type { GameState, Unit } from '../types';
import { RULES } from '../cards';
import { oslona } from './oslona';
import { szarza } from './szarza';
import { ostrzal } from './ostrzal';
import { niezlomnosc } from './niezlomnosc';
import { zwiadowca } from './zwiadowca';
import { zaopatrzeniowiec } from './zaopatrzeniowiec';

/**
 * Rejestr reguł specjalnych (§7). Mapuje `id` reguły na zestaw hooków.
 * Wszystkie hooki są czyste. Brak implementacji dla zadeklarowanego `id`
 * rzuca błąd przy starcie — literówka ma boleć od razu, nie po cichu.
 */

export type RuleHooks = {
  /**
   * Reguła-aura działa na CUDZE jednostki (np. osłona podnosi defensywę sąsiadów).
   * Takie hooki liczymy dla każdej jednostki na planszy — sam hook rozstrzyga,
   * czy w danym przypadku coś dodaje. Reguły bez tej flagi działają wyłącznie
   * na jednostkę, która ma je wypisane na karcie.
   */
  aura?: boolean;
  /** dodaje do ofensywy efektywnej */
  modifyOffense?: (state: GameState, unit: Unit) => number;
  /** dodaje do defensywy efektywnej */
  modifyDefense?: (state: GameState, unit: Unit) => number;
  /** rozszerza/ogranicza listę celów */
  modifyRange?: (state: GameState, unit: Unit, targets: string[]) => string[];
  /** true = jednostka przeżywa to oznaczenie śmierci */
  onDeath?: (state: GameState, unit: Unit) => boolean;
  /** czy właściciel podgląda rozkaz przeciwnika po deklaracji */
  onOrderDeclared?: (state: GameState, unit: Unit) => boolean;
  /** czy zagrana karta zaopatrzenia wraca na rękę zamiast na stos odrzuconych */
  onDeploy?: (state: GameState, unit: Unit) => void;
  /** karta zaopatrzenia wraca na rękę właściciela */
  supplyReturnsToHand?: boolean;
};

export const REGISTRY: Record<string, RuleHooks> = {
  oslona,
  szarza,
  ostrzal,
  niezlomnosc,
  zwiadowca,
  zaopatrzeniowiec,
};

/** Wywoływane przy starcie aplikacji i w `tools/validate-cards.ts`. */
export function assertRegistryComplete(): void {
  const missing = RULES.filter((r) => !REGISTRY[r.id]).map((r) => r.id);
  if (missing.length > 0) {
    throw new Error(`Reguły bez implementacji w rules/index.ts: ${missing.join(', ')}`);
  }
  const orphan = Object.keys(REGISTRY).filter((id) => !RULES.some((r) => r.id === id));
  if (orphan.length > 0) {
    throw new Error(`Implementacje bez wpisu w rules.json: ${orphan.join(', ')}`);
  }
}

/** Hooki-aury ze wszystkich zarejestrowanych reguł. */
export function auraHooks(): RuleHooks[] {
  return Object.values(REGISTRY).filter((h) => h.aura);
}

export function hooksFor(ruleIds: readonly string[]): RuleHooks[] {
  return ruleIds.map((id) => {
    const h = REGISTRY[id];
    if (!h) throw new Error(`Reguła bez implementacji: ${id}`);
    return h;
  });
}
