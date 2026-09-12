import type { GameAction, GameState, Legality, Order, PlayerId, Reduced, Uid } from '../types';
import { opponentOf } from '../board';
import { card } from '../cards';
import { addLog, cloneState } from '../state';
import { legalTargets, livingUnitsOf, unitByUid } from '../stats';

/**
 * Faza strategii — deklaracja NAPRZEMIENNA I JAWNA.
 *
 * Pierwotna wersja zasad (§6.3) zakładała deklarację jednoczesną i tajną,
 * rozdzieloną ekranem zasłony. Po przejściu na jawne ręce zasłona odpadła,
 * a wraz z nią jedyna rzecz, która trzymała tamten wariant w ryzach: gracz
 * deklarujący jako drugi widziałby komplet cudzych rozkazów przed podjęciem
 * własnych decyzji. To nie byłaby drobna przewaga, tylko rozstrzygnięcie partii.
 *
 * Dlatego gracze deklarują NA PRZEMIAN, po jednym oddziale. Przewaga
 * informacyjna rozkłada się na całą fazę: zawsze widzisz to, co przeciwnik
 * już zadeklarował, ale i on widzi twoje wcześniejsze decyzje. Dopiero
 * ostatni oddział deklaruje się przy pełnej wiedzy — i to po obu stronach
 * dotyczy tak samo jednej jednostki.
 *
 * Oddział uznajemy za zadeklarowany, gdy ma wpis w `orders` — dlatego faza
 * startuje z pustymi listami, a nie z kompletem rozkazów `NONE`.
 */

export function enterStrategy(state: GameState): Reduced {
  let next = cloneState(state);
  next.phase = 'STRATEGY';
  // Rozkazy są jawne od pierwszej deklaracji — nie ma już czego odkrywać.
  next.revealed = true;
  next.activePlayer = next.firstPlayer;

  for (const p of ['P1', 'P2'] as PlayerId[]) {
    next.players[p].ordersReady = false;
    next.orders[p] = [];
  }

  next = addLog(next, 'Faza strategii. Rozkazy wydawane na przemian, jawnie.');
  return {
    state: next,
    events: [{ type: 'PHASE_CHANGED', phase: 'STRATEGY', player: next.activePlayer }],
  };
}

export function orderFor(state: GameState, player: PlayerId, uid: Uid): Order | undefined {
  return state.orders[player].find((o) => o.unit === uid);
}

/** Oddziały gracza, które wciąż czekają na rozkaz. */
export function bezRozkazu(state: GameState, player: PlayerId): Uid[] {
  const wydane = new Set(state.orders[player].map((o) => o.unit));
  return livingUnitsOf(state, player)
    .filter((u) => !wydane.has(u.uid))
    .map((u) => u.uid);
}

/** Czy gracz skończył — wszystkie jego oddziały mają rozkaz. */
export function zadeklarowalWszystko(state: GameState, player: PlayerId): boolean {
  return bezRozkazu(state, player).length === 0;
}

/**
 * Po deklaracji oddajemy głos przeciwnikowi, o ile ten ma jeszcze co
 * deklarować. Jeśli skończył, gracz dokańcza swoje oddziały sam.
 */
function oddajGlos(state: GameState, player: PlayerId): void {
  const other = opponentOf(player);
  if (!zadeklarowalWszystko(state, other)) state.activePlayer = other;
}

export function canSetOrder(
  state: GameState,
  action: Extract<GameAction, { type: 'SET_ORDER' }>,
): Legality {
  if (state.phase !== 'STRATEGY') return { ok: false, reason: 'To nie jest faza strategii.' };
  if (state.activePlayer !== action.player) return { ok: false, reason: 'Nie twoja kolej.' };

  const unit = unitByUid(state, action.order.unit);
  if (!unit || unit.dead) return { ok: false, reason: 'Nie ma takiej jednostki.' };
  if (unit.owner !== action.player) return { ok: false, reason: 'To jednostka przeciwnika.' };

  // Rozkaz wydaje się raz — inaczej gracz poprawiałby deklarację po ruchu
  // przeciwnika i cała naprzemienność traciłaby sens.
  if (state.orders[action.player].some((o) => o.unit === action.order.unit)) {
    return { ok: false, reason: 'Ten oddział ma już rozkaz.' };
  }

  if (action.order.kind === 'ATTACK') {
    const targets = legalTargets(state, unit);
    if (!targets.includes(action.order.target)) {
      return { ok: false, reason: 'Cel jest poza zasięgiem tej jednostki.' };
    }
  }
  return { ok: true };
}

export function applySetOrder(
  state: GameState,
  action: Extract<GameAction, { type: 'SET_ORDER' }>,
): Reduced {
  let next = cloneState(state);
  next.orders[action.player].push({ ...action.order });

  const unit = unitByUid(next, action.order.unit);
  const nazwa = unit ? card(unit.cardId).name : '?';
  const opis =
    action.order.kind === 'ATTACK'
      ? `atakuje ${action.order.target}`
      : action.order.kind === 'DEFEND'
        ? 'przechodzi do obrony'
        : 'zostaje na pozycji';
  next = addLog(next, `${nazwa}: ${opis}.`, action.player);

  oddajGlos(next, action.player);
  return { state: next, events: [] };
}

/**
 * Skrót: „reszta stoi". Wszystkim niezadeklarowanym oddziałom nadaje rozkaz
 * postoju naraz, żeby nie trzeba było klikać ośmiu razy tego samego.
 */
export function canConfirmOrders(
  state: GameState,
  action: Extract<GameAction, { type: 'CONFIRM_ORDERS' }>,
): Legality {
  if (state.phase !== 'STRATEGY') return { ok: false, reason: 'To nie jest faza strategii.' };
  if (state.activePlayer !== action.player) return { ok: false, reason: 'Nie twoja kolej.' };
  if (zadeklarowalWszystko(state, action.player)) {
    return { ok: false, reason: 'Wszystkie oddziały mają już rozkazy.' };
  }
  return { ok: true };
}

export function applyConfirmOrders(
  state: GameState,
  action: Extract<GameAction, { type: 'CONFIRM_ORDERS' }>,
): Reduced {
  let next = cloneState(state);
  const reszta = bezRozkazu(next, action.player);
  for (const uid of reszta) next.orders[action.player].push({ unit: uid, kind: 'NONE' });
  next.players[action.player].ordersReady = true;
  next = addLog(next, `Pozostałe oddziały (${reszta.length}) zostają na pozycjach.`, action.player);

  oddajGlos(next, action.player);
  return { state: next, events: [] };
}
