import type { Column, GameState, PlayerId } from './types';
import { COLUMNS, fieldId, opponentOf } from './board';
import { CONFIG } from './cards';
import { effOffense, livingUnitsOf, unitAt } from './stats';

/**
 * Warunki zwycięstwa (§6.7). Sprawdzane na koniec tury, po usunięciu martwych.
 *
 * „Wolna droga na tylną linię" = kolumna, w której przednie pole przeciwnika
 * jest puste; liczą się nasze jednostki z obu rzędów tej kolumny (§14.6).
 * To jedyne miejsce do podmiany, jeśli definicja się zmieni.
 */

export function breakthroughScore(state: GameState, player: PlayerId): number {
  const enemy = opponentOf(player);
  let total = 0;
  for (const c of COLUMNS) {
    const enemyFront = fieldId(enemy, 'F', c as Column);
    if (unitAt(state, enemyFront) !== null) continue; // kolumna zamknięta
    for (const row of ['F', 'R'] as const) {
      const own = unitAt(state, fieldId(player, row, c as Column));
      if (own) total += effOffense(state, own);
    }
  }
  return total;
}

export function hasBreakthrough(state: GameState, player: PlayerId): boolean {
  return breakthroughScore(state, player) >= CONFIG.breakthroughThreshold;
}

/** Łączna ofensywa żywych jednostek — rozstrzyga wyczerpanie talii. */
export function totalOffense(state: GameState, player: PlayerId): number {
  return livingUnitsOf(state, player).reduce((sum, u) => sum + effOffense(state, u), 0);
}

export type Outcome = { winner: PlayerId | 'DRAW'; reason: string } | null;

/**
 * Rozstrzygnięcie porównawcze: wygrywa większa łączna ofensywa żywych jednostek.
 * Używane przy wyczerpaniu talii i przy limicie tur.
 */
function porownanie(state: GameState, powod: string): Outcome {
  const o1 = totalOffense(state, 'P1');
  const o2 = totalOffense(state, 'P2');
  if (o1 > o2) return { winner: 'P1', reason: `${powod} — przewaga ofensywy P1 (${o1} vs ${o2}).` };
  if (o2 > o1) return { winner: 'P2', reason: `${powod} — przewaga ofensywy P2 (${o2} vs ${o1}).` };
  return { winner: 'DRAW', reason: `${powod} przy równej ofensywie (${o1}).` };
}

export function checkVictory(state: GameState): Outcome {
  const p1 = hasBreakthrough(state, 'P1');
  const p2 = hasBreakthrough(state, 'P2');

  if (p1 && p2) {
    const s1 = breakthroughScore(state, 'P1');
    const s2 = breakthroughScore(state, 'P2');
    if (s1 > s2) return { winner: 'P1', reason: `Obustronne przełamanie — silniejsze u P1 (${s1} vs ${s2}).` };
    if (s2 > s1) return { winner: 'P2', reason: `Obustronne przełamanie — silniejsze u P2 (${s2} vs ${s1}).` };
    return { winner: 'DRAW', reason: `Obustronne przełamanie o równej sile (${s1}).` };
  }
  if (p1) return { winner: 'P1', reason: `Przełamanie o sile ${breakthroughScore(state, 'P1')}.` };
  if (p2) return { winner: 'P2', reason: `Przełamanie o sile ${breakthroughScore(state, 'P2')}.` };

  // Wyczerpanie talii — rozstrzygnięcie porównawcze po zakończeniu bieżącej tury.
  if (state.players.P1.deckExhausted || state.players.P2.deckExhausted) {
    return porownanie(state, 'Wyczerpanie talii');
  }

  /*
   * Bezpiecznik: same zasady nie gwarantują końca partii. Gdy obaj gracze
   * przestaną cokolwiek zagrywać, ręka nie schodzi, talia się nie wyczerpuje
   * i przełamanie nigdy nie rośnie — gra biegłaby w nieskończoność.
   * W kiosku to niedopuszczalne, więc po `config.maxTurns` turach rozstrzygamy
   * tak samo jak przy wyczerpaniu talii.
   */
  if (state.turn >= CONFIG.maxTurns) {
    return porownanie(state, `Limit ${CONFIG.maxTurns} tur`);
  }

  return null;
}
