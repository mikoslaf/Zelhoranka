import type { GameAction, GameEvent, GameState, Legality, PlayerId, Reduced } from '../types';
import { CONFIG } from '../cards';
import { addLog, cloneState } from '../state';

/**
 * Faza dobierania (§6.1).
 * Gracz uzupełnia rękę do `handSize`, może wymienić karty, potem potwierdza.
 * Wyczerpanie talii uzbraja warunek końca gry (§6.7).
 */

export function enterDraw(state: GameState): Reduced {
  let next = cloneState(state);
  const events: GameEvent[] = [];
  next.phase = 'DRAW';
  next.revealed = false;
  next.lastCombat = null;

  for (const p of ['P1', 'P2'] as PlayerId[]) {
    const ps = next.players[p];
    ps.drawDone = false;
    ps.mulligansUsed = 0;
    ps.deepMulligansUsed = 0;
    ps.scoutUsed = [];
    const drawn = fill(next, p, CONFIG.handSize);
    if (drawn > 0) events.push({ type: 'CARD_DRAWN', player: p, count: drawn });
  }

  next.activePlayer = next.firstPlayer;
  events.push({ type: 'PHASE_CHANGED', phase: 'DRAW', player: next.activePlayer });
  next = addLog(next, `Faza dobierania. Ręka uzupełniona do ${CONFIG.handSize} kart.`);
  return { state: next, events };
}

/** Uzupełnia rękę; oznacza wyczerpanie talii. */
export function fill(state: GameState, player: PlayerId, target: number): number {
  const ps = state.players[player];
  let drawn = 0;
  while (ps.hand.length < target && ps.deck.length > 0) {
    ps.hand.push(ps.deck.shift()!);
    drawn++;
  }
  if (ps.deck.length === 0) ps.deckExhausted = true;
  // Twardy limit ręki — nadmiar odrzucamy natychmiast (§6.1.1).
  while (ps.hand.length > CONFIG.handMax) ps.discard.push(ps.hand.pop()!);
  return drawn;
}

/** Ile kart wolno jeszcze wymienić w tej turze. */
export function mulliganAllowance(state: GameState, player: PlayerId): number {
  const ps = state.players[player];
  if (state.turn === 1 && CONFIG.mulliganFirstTurn === 'all') {
    return ps.mulligansUsed === 0 ? ps.hand.length : 0;
  }
  const limit = state.turn === 1 ? Number(CONFIG.mulliganFirstTurn) : CONFIG.mulliganLater;
  return Math.max(0, limit - ps.mulligansUsed);
}

export function canMulligan(state: GameState, action: Extract<GameAction, { type: 'MULLIGAN' }>): Legality {
  if (state.phase !== 'DRAW') return { ok: false, reason: 'To nie jest faza dobierania.' };
  if (state.activePlayer !== action.player) return { ok: false, reason: 'Nie twoja kolej.' };
  const ps = state.players[action.player];
  if (ps.drawDone) return { ok: false, reason: 'Fazę dobierania masz już zamkniętą.' };
  if (action.cards.length === 0) return { ok: false, reason: 'Nie wskazano kart do wymiany.' };
  const allowance = mulliganAllowance(state, action.player);
  if (action.cards.length > allowance) {
    return { ok: false, reason: `Możesz wymienić najwyżej ${allowance} kart.` };
  }
  const pool = ps.hand.slice();
  for (const c of action.cards) {
    const idx = pool.indexOf(c);
    if (idx === -1) return { ok: false, reason: 'Wskazanej karty nie ma na ręce.' };
    pool.splice(idx, 1);
  }
  return { ok: true };
}

export function applyMulligan(
  state: GameState,
  action: Extract<GameAction, { type: 'MULLIGAN' }>,
): Reduced {
  let next = cloneState(state);
  const ps = next.players[action.player];
  for (const c of action.cards) {
    const idx = ps.hand.indexOf(c);
    ps.hand.splice(idx, 1);
    ps.discard.push(c);
  }
  ps.mulligansUsed += action.cards.length;
  const drawn = fill(next, action.player, CONFIG.handSize);
  next = addLog(next, `Wymiana ${action.cards.length} kart.`, action.player);
  return {
    state: next,
    events: [{ type: 'CARD_DRAWN', player: action.player, count: drawn }],
  };
}

export function canDeepMulligan(
  state: GameState,
  action: Extract<GameAction, { type: 'DEEP_MULLIGAN' }>,
): Legality {
  if (!CONFIG.mulliganDiscardForRest) return { ok: false, reason: 'Wariant wyłączony w konfiguracji.' };
  if (state.phase !== 'DRAW') return { ok: false, reason: 'To nie jest faza dobierania.' };
  if (state.activePlayer !== action.player) return { ok: false, reason: 'Nie twoja kolej.' };
  const ps = state.players[action.player];
  if (ps.drawDone) return { ok: false, reason: 'Fazę dobierania masz już zamkniętą.' };
  if (ps.mulligansUsed < 2) return { ok: false, reason: 'Najpierw wymień dwie karty.' };
  if (!ps.hand.includes(action.discard)) return { ok: false, reason: 'Wskazanej karty nie ma na ręce.' };
  // Po operacji na ręce musi zostać co najmniej 1 karta (§6.1.2).
  if (ps.hand.length < 2) return { ok: false, reason: 'Za mało kart na ręce.' };
  return { ok: true };
}

export function applyDeepMulligan(
  state: GameState,
  action: Extract<GameAction, { type: 'DEEP_MULLIGAN' }>,
): Reduced {
  let next = cloneState(state);
  const ps = next.players[action.player];
  const idx = ps.hand.indexOf(action.discard);
  ps.hand.splice(idx, 1);
  ps.discard.push(action.discard);
  const rest = ps.hand.splice(0, ps.hand.length);
  ps.discard.push(...rest);
  ps.deepMulligansUsed += 1;
  const drawn = fill(next, action.player, CONFIG.handSize);
  next = addLog(
    next,
    `Odrzucenie karty i wymiana całej reszty (${rest.length} kart).`,
    action.player,
  );
  return {
    state: next,
    events: [{ type: 'CARD_DRAWN', player: action.player, count: drawn }],
  };
}

export function canFinishDraw(
  state: GameState,
  action: Extract<GameAction, { type: 'FINISH_DRAW' }>,
): Legality {
  if (state.phase !== 'DRAW') return { ok: false, reason: 'To nie jest faza dobierania.' };
  if (state.activePlayer !== action.player) return { ok: false, reason: 'Nie twoja kolej.' };
  if (state.players[action.player].drawDone) return { ok: false, reason: 'Już zakończone.' };
  return { ok: true };
}

export function applyFinishDraw(
  state: GameState,
  action: Extract<GameAction, { type: 'FINISH_DRAW' }>,
): Reduced {
  const next = cloneState(state);
  next.players[action.player].drawDone = true;
  const other = action.player === 'P1' ? 'P2' : 'P1';
  if (!next.players[other].drawDone) next.activePlayer = other;
  return { state: next, events: [] };
}
