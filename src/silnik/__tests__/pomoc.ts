import type { CardId, FieldId, GameState, Order, PlayerId, Phase, Unit } from '../types';
import { createGame } from '../state';

/** Narzędzia do budowania stanów testowych. Omijają fazy — ustawiają planszę wprost. */

export function pustaGra(seed = 1): GameState {
  return createGame(seed);
}

export function postaw(
  state: GameState,
  player: PlayerId,
  field: FieldId,
  cardId: CardId,
  opts: Partial<Pick<Unit, 'deployedTurn' | 'modifiers' | 'savedThisTurn'>> = {},
): Unit {
  state.uidCounter += 1;
  const unit: Unit = {
    uid: `u${state.uidCounter}`,
    cardId,
    owner: player,
    field,
    modifiers: opts.modifiers ?? [],
    dead: false,
    deployedTurn: opts.deployedTurn ?? 0,
    savedThisTurn: opts.savedThisTurn ?? 0,
  };
  state.board[field] = unit;
  return unit;
}

export function rozkaz(state: GameState, player: PlayerId, order: Order): void {
  const list = state.orders[player];
  const idx = list.findIndex((o) => o.unit === order.unit);
  if (idx === -1) list.push(order);
  else list[idx] = order;
}

export function ustawFaze(state: GameState, phase: Phase): void {
  state.phase = phase;
}

/** Stan gotowy do fazy walki: rozkazy zadeklarowane, obaj gracze po manewrach. */
export function gotowaWalka(seed = 1): GameState {
  const s = pustaGra(seed);
  s.phase = 'MANEUVERS';
  s.revealed = true;
  s.turn = 3;
  return s;
}
