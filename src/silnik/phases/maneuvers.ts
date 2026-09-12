import type { GameAction, GameEvent, GameState, Legality, PlayerId, Reduced } from '../types';
import { opponentOf } from '../board';
import { card } from '../cards';
import { addLog, cloneState } from '../state';
import { isScout, legalTargets, unitByUid } from '../stats';

/**
 * Faza manewrów (§6.5). Manewr modyfikuje **deklaracje**, nie planszę.
 * Tu też odpalamy zasadzki z wyzwalaczem `ORDERS_REVEALED` — nazwa wyzwalacza
 * znaczy teraz „po zamknięciu deklaracji", bo rozkazy są jawne od początku.
 */

export function enterManeuvers(state: GameState): Reduced {
  let next = cloneState(state);
  next.phase = 'MANEUVERS';
  next.revealed = true; // deklaracja zamknięta; rozkazy i tak były jawne
  next.activePlayer = next.firstPlayer;
  for (const p of ['P1', 'P2'] as PlayerId[]) next.players[p].passedManeuvers = false;

  next = addLog(next, 'Deklaracje zamknięte. Faza manewrów.');
  return {
    state: next,
    events: [
      { type: 'ORDERS_REVEALED' },
      { type: 'PHASE_CHANGED', phase: 'MANEUVERS', player: next.activePlayer },
    ],
  };
}

function handOver(state: GameState, player: PlayerId): void {
  const other = opponentOf(player);
  // Zagranie karty przerywa serię pasów — obaj dostają świeże prawo odpowiedzi
  // („aż obaj spasują z rzędu", §6.5).
  state.players[player].passedManeuvers = false;
  state.players[other].passedManeuvers = false;
  state.activePlayer = other;
}

export function canPlayManeuver(
  state: GameState,
  action: Extract<GameAction, { type: 'PLAY_MANEUVER' }>,
): Legality {
  if (state.phase !== 'MANEUVERS') return { ok: false, reason: 'To nie jest faza manewrów.' };
  if (state.activePlayer !== action.player) return { ok: false, reason: 'Nie twoja kolej.' };
  if (!state.players[action.player].hand.includes(action.card)) {
    return { ok: false, reason: 'Tej karty nie ma na ręce.' };
  }
  const c = card(action.card);
  if (c.type !== 'MANEUVER') return { ok: false, reason: 'To nie jest karta manewru.' };

  const unit = unitByUid(state, action.unit);
  if (!unit || unit.dead) return { ok: false, reason: 'Nie ma takiej jednostki.' };
  if (unit.owner !== action.player) return { ok: false, reason: 'To jednostka przeciwnika.' };
  const order = state.orders[action.player].find((o) => o.unit === action.unit);

  switch (c.effect) {
    case 'retarget_one': {
      if (!order || order.kind !== 'ATTACK') {
        return { ok: false, reason: 'Ta jednostka nie ma rozkazu ataku.' };
      }
      if (!action.target) return { ok: false, reason: 'Nie wskazano nowego celu.' };
      const targets = legalTargets(state, unit);
      if (!targets.includes(action.target)) {
        return { ok: false, reason: 'Nowy cel jest poza zasięgiem.' };
      }
      if (action.target === order.target) return { ok: false, reason: 'To ten sam cel.' };
      return { ok: true };
    }
    case 'to_defend': {
      if (order && order.kind === 'DEFEND') return { ok: false, reason: 'Ta jednostka już broni.' };
      return { ok: true };
    }
    case 'buff_offense':
      return { ok: true };
    default:
      throw new Error(`Nieznany efekt manewru: ${c.effect}`);
  }
}

export function applyPlayManeuver(
  state: GameState,
  action: Extract<GameAction, { type: 'PLAY_MANEUVER' }>,
): Reduced {
  let next = cloneState(state);
  const ps = next.players[action.player];
  const c = card(action.card);
  ps.hand.splice(ps.hand.indexOf(action.card), 1);
  ps.discard.push(action.card);

  const orders = next.orders[action.player];
  const idx = orders.findIndex((o) => o.unit === action.unit);
  const unit = unitByUid(next, action.unit)!;
  const unitName = card(unit.cardId).name;

  if (c.type === 'MANEUVER') {
    switch (c.effect) {
      case 'retarget_one':
        orders[idx] = { unit: action.unit, kind: 'ATTACK', target: action.target! };
        next = addLog(next, `${c.name}: ${unitName} atakuje teraz ${action.target}.`, action.player);
        break;
      case 'to_defend':
        if (idx === -1) orders.push({ unit: action.unit, kind: 'DEFEND' });
        else orders[idx] = { unit: action.unit, kind: 'DEFEND' };
        next = addLog(next, `${c.name}: ${unitName} przechodzi do obrony.`, action.player);
        break;
      case 'buff_offense':
        unit.modifiers.push({ source: c.id, offense: 3, expires: 'END_OF_TURN' });
        next = addLog(next, `${c.name}: ${unitName} ma ofensywę +3.`, action.player);
        break;
    }
  }

  handOver(next, action.player);
  return {
    state: next,
    events: [{ type: 'CARD_PLAYED', player: action.player, card: action.card }],
  };
}

/* ---------- Zwiadowca: darmowa korekta rozkazu ---------- */

/**
 * Reguła „zwiadowca" (§7). Oddział z tą regułą może raz w turze zmienić swój
 * rozkaz — bez karty i bez kosztu. To przeciwwaga dla naprzemiennej deklaracji:
 * ktoś musi zadeklarować się pierwszy, a zwiadowca pozwala to odrobić.
 */
export function canScoutReorder(
  state: GameState,
  action: Extract<GameAction, { type: 'SCOUT_REORDER' }>,
): Legality {
  if (state.phase !== 'MANEUVERS') return { ok: false, reason: 'To nie jest faza manewrów.' };
  if (state.activePlayer !== action.player) return { ok: false, reason: 'Nie twoja kolej.' };

  const unit = unitByUid(state, action.order.unit);
  if (!unit || unit.dead) return { ok: false, reason: 'Nie ma takiej jednostki.' };
  if (unit.owner !== action.player) return { ok: false, reason: 'To jednostka przeciwnika.' };
  if (!isScout(state, unit)) return { ok: false, reason: 'Ten oddział nie jest zwiadowcą.' };
  if (state.players[action.player].scoutUsed.includes(unit.uid)) {
    return { ok: false, reason: 'Ten zwiadowca już skorygował rozkaz w tej turze.' };
  }

  const obecny = state.orders[action.player].find((o) => o.unit === unit.uid);
  if (obecny && obecny.kind === action.order.kind) {
    const tenSamCel =
      obecny.kind !== 'ATTACK' ||
      (action.order.kind === 'ATTACK' && obecny.target === action.order.target);
    if (tenSamCel) return { ok: false, reason: 'To ten sam rozkaz.' };
  }

  if (action.order.kind === 'ATTACK') {
    if (!legalTargets(state, unit).includes(action.order.target)) {
      return { ok: false, reason: 'Cel jest poza zasięgiem tej jednostki.' };
    }
  }
  return { ok: true };
}

export function applyScoutReorder(
  state: GameState,
  action: Extract<GameAction, { type: 'SCOUT_REORDER' }>,
): Reduced {
  let next = cloneState(state);
  const lista = next.orders[action.player];
  const idx = lista.findIndex((o) => o.unit === action.order.unit);
  if (idx === -1) lista.push({ ...action.order });
  else lista[idx] = { ...action.order };

  next.players[action.player].scoutUsed.push(action.order.unit);

  const unit = unitByUid(next, action.order.unit)!;
  const nazwa = card(unit.cardId).name;
  const opis =
    action.order.kind === 'ATTACK'
      ? `atakuje teraz ${action.order.target}`
      : action.order.kind === 'DEFEND'
        ? 'przechodzi do obrony'
        : 'zostaje na pozycji';
  next = addLog(next, `Zwiad: ${nazwa} ${opis}.`, action.player);

  handOver(next, action.player);
  return { state: next, events: [] };
}

/* ---------- Zasadzki ---------- */

export function canTriggerAmbush(
  state: GameState,
  action: Extract<GameAction, { type: 'TRIGGER_AMBUSH' }>,
): Legality {
  const ps = state.players[action.player];
  const ambush = ps.ambushes.find((a) => a.uid === action.ambush);
  if (!ambush) return { ok: false, reason: 'Nie masz takiej zasadzki.' };

  const unit = unitByUid(state, action.unit);
  if (!unit || unit.dead) return { ok: false, reason: 'Nie ma takiej jednostki.' };
  if (unit.owner === action.player) return { ok: false, reason: 'Zasadzka trafia w przeciwnika.' };

  if (ambush.trigger === 'ENEMY_DEPLOYED') {
    if (state.phase !== 'LOGISTICS') return { ok: false, reason: 'Ta zasadzka czeka na rozmieszczenie.' };
    if (state.activePlayer !== action.player) return { ok: false, reason: 'Nie twoja kolej.' };
    if (unit.deployedTurn !== state.turn) {
      return { ok: false, reason: 'Ten oddział nie wszedł na planszę w tej turze.' };
    }
    return { ok: true };
  }

  // ORDERS_REVEALED
  if (state.phase !== 'MANEUVERS') return { ok: false, reason: 'Ta zasadzka czeka na odkrycie rozkazów.' };
  if (state.activePlayer !== action.player) return { ok: false, reason: 'Nie twoja kolej.' };
  const enemy = opponentOf(action.player);
  const order = state.orders[enemy].find((o) => o.unit === action.unit);
  if (!order || order.kind !== 'ATTACK') {
    return { ok: false, reason: 'Ten oddział nie atakuje.' };
  }
  return { ok: true };
}

export function applyTriggerAmbush(
  state: GameState,
  action: Extract<GameAction, { type: 'TRIGGER_AMBUSH' }>,
): Reduced {
  let next = cloneState(state);
  const ps = next.players[action.player];
  const i = ps.ambushes.findIndex((a) => a.uid === action.ambush);
  const ambush = ps.ambushes[i];
  ps.ambushes.splice(i, 1);
  ps.discard.push(ambush.cardId);

  const unit = unitByUid(next, action.unit)!;
  const c = card(ambush.cardId);
  const unitName = card(unit.cardId).name;

  if (ambush.trigger === 'ENEMY_DEPLOYED') {
    unit.modifiers.push({ source: ambush.cardId, defense: -2, expires: 'NEVER' });
    next = addLog(next, `${c.name}: ${unitName} ma defensywę -2 na stałe.`, action.player);
  } else {
    unit.modifiers.push({ source: ambush.cardId, offense: -3, expires: 'END_OF_TURN' });
    next = addLog(next, `${c.name}: ${unitName} ma ofensywę -3 w tej turze.`, action.player);
  }

  if (next.phase === 'MANEUVERS') handOver(next, action.player);

  const events: GameEvent[] = [
    { type: 'AMBUSH_TRIGGERED', player: action.player, card: ambush.cardId, unit: action.unit },
  ];
  return { state: next, events };
}

/* ---------- Pas ---------- */

export function canPassManeuvers(
  state: GameState,
  action: Extract<GameAction, { type: 'PASS_MANEUVERS' }>,
): Legality {
  if (state.phase !== 'MANEUVERS') return { ok: false, reason: 'To nie jest faza manewrów.' };
  if (state.activePlayer !== action.player) return { ok: false, reason: 'Nie twoja kolej.' };
  if (state.players[action.player].passedManeuvers) return { ok: false, reason: 'Już spasowałeś.' };
  return { ok: true };
}

export function applyPassManeuvers(
  state: GameState,
  action: Extract<GameAction, { type: 'PASS_MANEUVERS' }>,
): Reduced {
  const next = cloneState(state);
  next.players[action.player].passedManeuvers = true;
  const other = opponentOf(action.player);
  if (!next.players[other].passedManeuvers) next.activePlayer = other;
  return { state: next, events: [] };
}
