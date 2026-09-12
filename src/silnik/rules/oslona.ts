import type { GameState, Unit } from '../types';
import { rowNeighbours } from '../board';
import { card } from '../cards';
import type { RuleHooks } from './index';

/**
 * Osłona — jednostka podnosi defensywę sąsiadów w swoim rzędzie o +1.
 * Hook liczy premię *dla jednostki `unit`*, więc szukamy sąsiadów z tą regułą.
 */
export const oslona: RuleHooks = {
  aura: true,
  modifyDefense(state: GameState, unit: Unit): number {
    let bonus = 0;
    for (const nb of rowNeighbours(unit.field)) {
      const other = state.board[nb];
      if (!other || other.dead || other.owner !== unit.owner) continue;
      if (card(other.cardId).rules.includes('oslona')) bonus += 1;
    }
    return bonus;
  },
};
