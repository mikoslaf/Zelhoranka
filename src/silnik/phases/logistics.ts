import type {
  FieldId,
  GameAction,
  GameEvent,
  GameState,
  Legality,
  PlayerId,
  Reduced,
  Unit,
} from '../types';
import { opponentOf, parseField, zoneOf } from '../board';
import { card, CONFIG } from '../cards';
import { addLog, cloneState, opponent, supplyLimit } from '../state';
import { hooksFor } from '../rules';
import { supplyReturnsToHand, unitAt } from '../stats';
import { fill } from './draw';

/**
 * Faza logistyki (§6.2). Naprzemiennie, po jednej karcie.
 * Model zaopatrzenia: pula (`config.supplyModel`). `canPay` to jedyne miejsce,
 * które o tym decyduje — przełączenie na `"exact"` nie dotyka reszty silnika.
 */

export function available(state: GameState, player: PlayerId): number {
  const ps = state.players[player];
  return ps.supplyPool - ps.supplySpent;
}

export function canPay(state: GameState, player: PlayerId, cost: number): boolean {
  if (CONFIG.supplyModel === 'exact') {
    // Wariant 1:1 — potrzebna karta zaopatrzenia o dokładnie takiej wartości.
    return state.players[player].hand.some((id) => {
      const c = card(id);
      return c.type === 'SUPPLY' && c.supply === cost;
    });
  }
  return available(state, player) >= cost;
}

export function enterLogistics(state: GameState): Reduced {
  let next = cloneState(state);
  const limit = supplyLimit(next.turn);
  for (const p of ['P1', 'P2'] as PlayerId[]) {
    const ps = next.players[p];
    ps.supplyPool = Math.min(CONFIG.supplyBase, limit);
    ps.supplySpent = 0;
    ps.passedLogistics = false;
  }
  next.phase = 'LOGISTICS';
  next.activePlayer = next.logisticsFirstPlayer;
  next = addLog(next, `Faza logistyki. Limit zaopatrzenia: ${limit}.`);
  return {
    state: next,
    events: [{ type: 'PHASE_CHANGED', phase: 'LOGISTICS', player: next.activePlayer }],
  };
}

/** Po zagraniu karty oddajemy inicjatywę przeciwnikowi, o ile ten nie spasował. */
function handOver(state: GameState, player: PlayerId): void {
  const other = opponent(player);
  if (!state.players[other].passedLogistics) state.activePlayer = other;
}

function guard(state: GameState, player: PlayerId, cardId: string): Legality {
  if (state.phase !== 'LOGISTICS') return { ok: false, reason: 'To nie jest faza logistyki.' };
  if (state.activePlayer !== player) return { ok: false, reason: 'Nie twoja kolej.' };
  if (state.players[player].passedLogistics) return { ok: false, reason: 'Już spasowałeś.' };
  if (!state.players[player].hand.includes(cardId)) {
    return { ok: false, reason: 'Tej karty nie ma na ręce.' };
  }
  return { ok: true };
}

/* ---------- Zaopatrzenie ---------- */

export function canPlaySupply(
  state: GameState,
  action: Extract<GameAction, { type: 'PLAY_SUPPLY' }>,
): Legality {
  const g = guard(state, action.player, action.card);
  if (!g.ok) return g;
  const c = card(action.card);
  if (c.type !== 'SUPPLY') return { ok: false, reason: 'To nie jest karta zaopatrzenia.' };
  const ps = state.players[action.player];
  const limit = supplyLimit(state.turn);
  if (ps.supplyPool >= limit) {
    return { ok: false, reason: `Pula zaopatrzenia jest pełna (limit ${limit}).` };
  }
  return { ok: true };
}

export function applyPlaySupply(
  state: GameState,
  action: Extract<GameAction, { type: 'PLAY_SUPPLY' }>,
): Reduced {
  let next = cloneState(state);
  const ps = next.players[action.player];
  const c = card(action.card);
  const supply = c.type === 'SUPPLY' ? c.supply : 0;
  const limit = supplyLimit(next.turn);

  ps.hand.splice(ps.hand.indexOf(action.card), 1);
  const before = ps.supplyPool;
  ps.supplyPool = Math.min(limit, ps.supplyPool + supply);
  const gained = ps.supplyPool - before;

  // Reguła „zaopatrzeniowiec": karta wraca na rękę zamiast na stos odrzuconych.
  if (supplyReturnsToHand(next, action.player)) ps.hand.push(action.card);
  else ps.discard.push(action.card);

  handOver(next, action.player);
  next = addLog(
    next,
    `${c.name}: +${gained} zaopatrzenia (pula ${ps.supplyPool}/${limit}).`,
    action.player,
  );
  return {
    state: next,
    events: [
      { type: 'CARD_PLAYED', player: action.player, card: action.card },
      { type: 'SUPPLY_GAINED', player: action.player, amount: gained },
    ],
  };
}

/* ---------- Werbunek ---------- */

export function canDeploy(
  state: GameState,
  action: Extract<GameAction, { type: 'DEPLOY' }>,
): Legality {
  const g = guard(state, action.player, action.card);
  if (!g.ok) return g;
  const c = card(action.card);
  if (c.type !== 'RECRUIT') return { ok: false, reason: 'To nie jest karta werbunku.' };
  if (!(action.field in state.board)) return { ok: false, reason: 'Nie ma takiego pola.' };
  if (parseField(action.field).player !== action.player) {
    return { ok: false, reason: 'To pole należy do przeciwnika.' };
  }
  if (state.board[action.field] !== null) return { ok: false, reason: 'Pole jest zajęte.' };
  const zone = zoneOf(action.field);
  if (!c.zones.includes(zone)) {
    return { ok: false, reason: `Ta karta nie wchodzi na strefę ${zone}.` };
  }
  if (!canPay(state, action.player, c.cost)) {
    return { ok: false, reason: `Brakuje zaopatrzenia (koszt ${c.cost}).` };
  }
  return { ok: true };
}

export function applyDeploy(
  state: GameState,
  action: Extract<GameAction, { type: 'DEPLOY' }>,
): Reduced {
  let next = cloneState(state);
  const ps = next.players[action.player];
  const c = card(action.card);
  const cost = c.type === 'RECRUIT' ? c.cost : 0;

  ps.hand.splice(ps.hand.indexOf(action.card), 1);
  next.uidCounter += 1;
  const unit: Unit = {
    uid: `u${next.uidCounter}`,
    cardId: action.card,
    owner: action.player,
    field: action.field,
    modifiers: [],
    dead: false,
    deployedTurn: next.turn,
    savedThisTurn: 0,
  };
  next.board[action.field] = unit;
  ps.supplySpent += cost;

  for (const hook of hooksFor(c.rules)) hook.onDeploy?.(next, unit);

  handOver(next, action.player);
  next = addLog(next, `${c.name} staje na ${action.field} (koszt ${cost}).`, action.player);
  const events: GameEvent[] = [
    { type: 'CARD_PLAYED', player: action.player, card: action.card },
    { type: 'UNIT_DEPLOYED', player: action.player, uid: unit.uid, field: action.field },
  ];
  if (cost > 0) events.push({ type: 'SUPPLY_SPENT', player: action.player, amount: cost });
  return { state: next, events };
}

/* ---------- Zasadzki ---------- */

export function canSetAmbush(
  state: GameState,
  action: Extract<GameAction, { type: 'SET_AMBUSH' }>,
): Legality {
  const g = guard(state, action.player, action.card);
  if (!g.ok) return g;
  const c = card(action.card);
  if (c.type !== 'AMBUSH') return { ok: false, reason: 'To nie jest karta zasadzki.' };
  if (!canPay(state, action.player, c.cost)) {
    return { ok: false, reason: `Brakuje zaopatrzenia (koszt ${c.cost}).` };
  }
  return { ok: true };
}

export function applySetAmbush(
  state: GameState,
  action: Extract<GameAction, { type: 'SET_AMBUSH' }>,
): Reduced {
  let next = cloneState(state);
  const ps = next.players[action.player];
  const c = card(action.card);
  if (c.type !== 'AMBUSH') return { state: next, events: [] };

  ps.hand.splice(ps.hand.indexOf(action.card), 1);
  next.uidCounter += 1;
  ps.ambushes.push({
    uid: `a${next.uidCounter}`,
    cardId: action.card,
    owner: action.player,
    trigger: c.trigger,
  });
  ps.supplySpent += c.cost;

  handOver(next, action.player);
  next = addLog(next, 'Zasadzka przygotowana (zakryta).', action.player);
  const events: GameEvent[] = [{ type: 'CARD_PLAYED', player: action.player, card: action.card }];
  if (c.cost > 0) events.push({ type: 'SUPPLY_SPENT', player: action.player, amount: c.cost });
  return { state: next, events };
}

/* ---------- Interwencje ---------- */

export function requirementMet(state: GameState, player: PlayerId, requirement: string): boolean {
  switch (requirement) {
    case 'PHASE_LOGISTICS':
      return state.phase === 'LOGISTICS';
    case 'PHASE_MANEUVERS':
      return state.phase === 'MANEUVERS';
    case 'HAND_BELOW_MAX':
      return state.players[player].hand.length < CONFIG.handMax;
    case 'HAS_UNIT_ON_BOARD':
      return Object.keys(state.board).some((f) => {
        const u = unitAt(state, f as FieldId);
        return u !== null && u.owner === player;
      });
    default:
      throw new Error(`Nieznany warunek interwencji: ${requirement}`);
  }
}

export function canPlayIntervention(
  state: GameState,
  action: Extract<GameAction, { type: 'PLAY_INTERVENTION' }>,
): Legality {
  const g = guard(state, action.player, action.card);
  if (!g.ok) return g;
  const c = card(action.card);
  if (c.type !== 'INTERVENTION') return { ok: false, reason: 'To nie jest karta interwencji.' };
  for (const req of c.requirements) {
    if (!requirementMet(state, action.player, req)) {
      return { ok: false, reason: 'Warunki zagrania nie są spełnione.' };
    }
  }
  return { ok: true };
}

export function applyPlayIntervention(
  state: GameState,
  action: Extract<GameAction, { type: 'PLAY_INTERVENTION' }>,
): Reduced {
  let next = cloneState(state);
  const ps = next.players[action.player];
  const c = card(action.card);
  if (c.type !== 'INTERVENTION') return { state: next, events: [] };

  ps.hand.splice(ps.hand.indexOf(action.card), 1);
  ps.discard.push(action.card);
  const events: GameEvent[] = [{ type: 'CARD_PLAYED', player: action.player, card: action.card }];

  switch (c.effect) {
    case 'draw_two': {
      const drawn = fill(next, action.player, ps.hand.length + 2);
      events.push({ type: 'CARD_DRAWN', player: action.player, count: drawn });
      next = addLog(next, `${c.name}: dobranie ${drawn} kart.`, action.player);
      break;
    }
    case 'supply_over_limit': {
      ps.supplyPool += 2;
      events.push({ type: 'SUPPLY_GAINED', player: action.player, amount: 2 });
      next = addLog(next, `${c.name}: +2 zaopatrzenia ponad limit.`, action.player);
      break;
    }
    default:
      throw new Error(`Nieznany efekt interwencji: ${c.effect}`);
  }

  handOver(next, action.player);
  return { state: next, events };
}

/* ---------- Pas ---------- */

export function canPassLogistics(
  state: GameState,
  action: Extract<GameAction, { type: 'PASS_LOGISTICS' }>,
): Legality {
  if (state.phase !== 'LOGISTICS') return { ok: false, reason: 'To nie jest faza logistyki.' };
  if (state.activePlayer !== action.player) return { ok: false, reason: 'Nie twoja kolej.' };
  if (state.players[action.player].passedLogistics) return { ok: false, reason: 'Już spasowałeś.' };
  return { ok: true };
}

export function applyPassLogistics(
  state: GameState,
  action: Extract<GameAction, { type: 'PASS_LOGISTICS' }>,
): Reduced {
  let next = cloneState(state);
  next.players[action.player].passedLogistics = true;
  const other = opponentOf(action.player);
  if (!next.players[other].passedLogistics) next.activePlayer = other;
  next = addLog(next, 'Pas w logistyce.', action.player);
  return { state: next, events: [] };
}
