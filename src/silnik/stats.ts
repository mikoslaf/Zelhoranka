import type { Column, FieldId, GameState, PlayerId, Unit } from './types';
import { fieldId, isColumn, opponentOf, parseField } from './board';
import { card, recruit } from './cards';
import { auraHooks, hooksFor } from './rules';

/**
 * Statystyki efektywne i zasięgi. UI ani faza walki nigdy nie czytają
 * `card.offense` wprost — zawsze przez te funkcje (§4.3).
 */

function sumModifiers(unit: Unit, key: 'offense' | 'defense'): number {
  let total = 0;
  for (const m of unit.modifiers) total += m[key] ?? 0;
  return total;
}

export function baseOffense(unit: Unit): number {
  return recruit(unit.cardId).offense;
}

export function baseDefense(unit: Unit): number {
  return recruit(unit.cardId).defense;
}

/**
 * Hooki liczące statystyki jednostki: własne reguły karty (bez aur) plus
 * wszystkie aury z rejestru — aura z definicji działa na cudze jednostki,
 * więc musi zostać sprawdzona dla każdej jednostki na planszy.
 */
function statHooks(unit: Unit) {
  const own = hooksFor(card(unit.cardId).rules).filter((h) => !h.aura);
  return [...own, ...auraHooks()];
}

export function effOffense(state: GameState, unit: Unit): number {
  let value = baseOffense(unit) + sumModifiers(unit, 'offense');
  for (const hook of statHooks(unit)) {
    if (hook.modifyOffense) value += hook.modifyOffense(state, unit);
  }
  return Math.max(0, value);
}

export function effDefense(state: GameState, unit: Unit): number {
  let value = baseDefense(unit) + sumModifiers(unit, 'defense');
  for (const hook of statHooks(unit)) {
    if (hook.modifyDefense) value += hook.modifyDefense(state, unit);
  }
  return Math.max(0, value);
}

export function unitAt(state: GameState, field: FieldId): Unit | null {
  const u = state.board[field];
  return u && !u.dead ? u : null;
}

export function unitByUid(state: GameState, uid: string): Unit | null {
  for (const field of Object.keys(state.board)) {
    const u = state.board[field];
    if (u && u.uid === uid) return u;
  }
  return null;
}

export function livingUnitsOf(state: GameState, player: PlayerId): Unit[] {
  const out: Unit[] = [];
  for (const field of Object.keys(state.board)) {
    const u = state.board[field];
    if (u && !u.dead && u.owner === player) out.push(u);
  }
  return out.sort((a, b) => a.field.localeCompare(b.field));
}

export function countUnits(state: GameState, player: PlayerId): number {
  return livingUnitsOf(state, player).length;
}

/**
 * Dozwolone cele ataku (§6.4). Zwraca wyłącznie pola zajęte przez żywe
 * jednostki przeciwnika — atak w puste pole nie istnieje.
 */
export function legalTargets(state: GameState, unit: Unit): FieldId[] {
  if (unit.dead) return [];
  const def = recruit(unit.cardId);
  const { row, column } = parseField(unit.field);

  // Jednostka w tylnej linii atakuje tylko z `fromRear`.
  if (row === 'R' && !def.attack.fromRear) return [];

  const enemy = opponentOf(unit.owner);
  const targets: FieldId[] = [];

  for (const offset of def.attack.offsets) {
    const col = column + offset;
    if (!isColumn(col)) continue;
    const front = fieldId(enemy, 'F', col as Column);
    const rear = fieldId(enemy, 'R', col as Column);
    const frontOccupied = unitAt(state, front) !== null;
    const rearOccupied = unitAt(state, rear) !== null;

    switch (def.attack.reach) {
      case 'FRONT':
        if (frontOccupied) targets.push(front);
        break;
      case 'DEEP':
        if (frontOccupied) targets.push(front);
        else if (rearOccupied) targets.push(rear);
        break;
      case 'RANGED':
        if (frontOccupied) targets.push(front);
        if (rearOccupied) targets.push(rear);
        break;
    }
  }

  let result = Array.from(new Set(targets));
  for (const hook of hooksFor(card(unit.cardId).rules)) {
    if (hook.modifyRange) result = hook.modifyRange(state, unit, result);
  }
  return result.sort();
}

/** Czy karta zaopatrzenia zagrana przez gracza wraca na rękę (reguła „zaopatrzeniowiec"). */
export function supplyReturnsToHand(state: GameState, player: PlayerId): boolean {
  for (const u of livingUnitsOf(state, player)) {
    for (const hook of hooksFor(card(u.cardId).rules)) {
      if (hook.supplyReturnsToHand) return true;
    }
  }
  return false;
}

/** Czy dany oddział jest zwiadowcą (może raz zmienić swój rozkaz). */
export function isScout(state: GameState, unit: Unit): boolean {
  for (const hook of hooksFor(card(unit.cardId).rules)) {
    if (hook.canReorder && hook.canReorder(state, unit)) return true;
  }
  return false;
}

/** Czy jednostka przeżywa oznaczenie śmierci (reguła „niezłomność"). */
export function survivesDeath(state: GameState, unit: Unit): boolean {
  for (const hook of hooksFor(card(unit.cardId).rules)) {
    if (hook.onDeath && hook.onDeath(state, unit)) return true;
  }
  return false;
}
