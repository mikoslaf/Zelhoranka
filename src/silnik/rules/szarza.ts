import type { GameState, Unit } from '../types';
import type { RuleHooks } from './index';

/** Szarża — w turze rozmieszczenia ofensywa +2. */
export const szarza: RuleHooks = {
  modifyOffense(state: GameState, unit: Unit): number {
    return unit.deployedTurn === state.turn ? 2 : 0;
  },
};
