import type { FieldId, GameState, LogEntry, PlayerId, PlayerState, Unit } from './types';
import { allFields, opponentOf } from './board';
import { buildDeckList, CONFIG } from './cards';
import { createRng, shuffle } from './rng';

/**
 * Tworzenie i klonowanie stanu. `GameState` musi serializować się do JSON
 * bez śmieci z UI — to warunek zapisu partii i testów migawkowych (§2.1).
 */

function emptyPlayer(deck: string[], hand: string[]): PlayerState {
  return {
    deck,
    hand,
    discard: [],
    ambushes: [],
    supplyPool: 0,
    supplySpent: 0,
    mulligansUsed: 0,
    deepMulligansUsed: 0,
    passedLogistics: false,
    passedManeuvers: false,
    ordersReady: false,
    drawDone: false,
    scoutUsed: [],
    deckExhausted: false,
  };
}

export function createGame(seed: number): GameState {
  let rng = createRng(seed);
  const board: Record<FieldId, Unit | null> = {};
  for (const f of allFields()) board[f] = null;

  const players: Record<PlayerId, PlayerState> = {} as Record<PlayerId, PlayerState>;
  for (const p of ['P1', 'P2'] as PlayerId[]) {
    const shuffled = shuffle(rng, buildDeckList());
    rng = shuffled.rng;
    const deck = shuffled.items;
    const hand = deck.splice(0, CONFIG.handSize);
    players[p] = emptyPlayer(deck, hand);
  }

  return {
    turn: 1,
    phase: 'SETUP',
    activePlayer: 'P1',
    firstPlayer: 'P1',
    logisticsFirstPlayer: 'P1',
    players,
    board,
    orders: { P1: [], P2: [] },
    revealed: false,
    log: [],
    rng,
    winner: null,
    lastRoll: null,
    uidCounter: 0,
    lastCombat: null,
  };
}

/** Głęboka kopia — silnik nigdy nie mutuje stanu wejściowego. */
export function cloneState(state: GameState): GameState {
  const board: Record<FieldId, Unit | null> = {};
  for (const f of Object.keys(state.board)) {
    const u = state.board[f];
    board[f] = u ? { ...u, modifiers: u.modifiers.map((m) => ({ ...m })) } : null;
  }
  return {
    ...state,
    players: {
      P1: clonePlayer(state.players.P1),
      P2: clonePlayer(state.players.P2),
    },
    board,
    orders: {
      P1: state.orders.P1.map((o) => ({ ...o })),
      P2: state.orders.P2.map((o) => ({ ...o })),
    },
    log: state.log.slice(),
    rng: { ...state.rng },
    lastRoll: state.lastRoll ? { ...state.lastRoll } : null,
    lastCombat: state.lastCombat
      ? {
          deaths: state.lastCombat.deaths.map((d) => ({ ...d })),
          incoming: { ...state.lastCombat.incoming },
          arrows: state.lastCombat.arrows.map((a) => ({ ...a })),
        }
      : null,
  };
}

function clonePlayer(p: PlayerState): PlayerState {
  return {
    ...p,
    deck: p.deck.slice(),
    hand: p.hand.slice(),
    discard: p.discard.slice(),
    ambushes: p.ambushes.map((a) => ({ ...a })),
    scoutUsed: p.scoutUsed.slice(),
  };
}

export function nextUid(state: GameState, prefix: string): { state: GameState; uid: string } {
  const counter = state.uidCounter + 1;
  return { state: { ...state, uidCounter: counter }, uid: `${prefix}${counter}` };
}

export function addLog(state: GameState, text: string, player?: PlayerId): GameState {
  const entry: LogEntry = { turn: state.turn, phase: state.phase, text, player };
  return { ...state, log: [...state.log, entry] };
}

export function opponent(player: PlayerId): PlayerId {
  return opponentOf(player);
}

/** Limit zaopatrzenia w danej turze (§6.2, §14.3). */
export function supplyLimit(turn: number): number {
  return CONFIG.supplyLimitMode === 'turn_plus_base' ? turn + CONFIG.supplyBase : turn;
}
