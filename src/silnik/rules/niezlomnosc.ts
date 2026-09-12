import type { GameState, Unit } from '../types';
import type { RuleHooks } from './index';

/**
 * Niezłomność — pierwsze oznaczenie śmierci w danej turze zostaje zignorowane.
 * Zwraca `true`, gdy jednostka ma przeżyć. Licznik `savedThisTurn` zwiększa
 * faza walki, nie ten hook (hooki są czyste).
 */
export const niezlomnosc: RuleHooks = {
  onDeath(_state: GameState, unit: Unit): boolean {
    return unit.savedThisTurn < 1;
  },
};
