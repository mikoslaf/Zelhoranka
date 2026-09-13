import type { GameAction, GameEvent, GameState, PlayerId, Reduced } from './types';
import { czyAkcjaLegalna } from './actions';
import { addLog, cloneState } from './state';
import { rollDie } from './rng';
import { CONFIG } from './cards';
import { countUnits } from './stats';
import { checkVictory } from './victory';
import {
  applyDeepMulligan,
  applyFinishDraw,
  applyMulligan,
  enterDraw,
} from './phases/draw';
import {
  applyDeploy,
  applyPassLogistics,
  applyPlayIntervention,
  applyPlaySupply,
  applySetAmbush,
  enterLogistics,
} from './phases/logistics';
import {
  applyConfirmOrders,
  applySetOrder,
  enterStrategy,
  zadeklarowalWszystko,
} from './phases/strategy';
import {
  applyPassManeuvers,
  applyPlayManeuver,
  applyScoutReorder,
  applyTriggerAmbush,
  enterManeuvers,
} from './phases/maneuvers';
import { enterCombat, sweepDead } from './phases/combat';

/**
 * Wejście silnika: `(stan, akcja) => (stan, zdarzenia)`. Funkcja czysta.
 * Zero DOM, zero Reacta, zero `Math.random()` (§2.1).
 */

export function reduce(state: GameState, action: GameAction): Reduced {
  const legal = czyAkcjaLegalna(state, action);
  if (!legal.ok) {
    return { state, events: [{ type: 'ILLEGAL_ACTION', reason: legal.reason }] };
  }

  const step = applyAction(state, action);
  return advance(step.state, step.events);
}

function applyAction(state: GameState, action: GameAction): Reduced {
  switch (action.type) {
    case 'ROLL_INITIATIVE':
      return rollInitiative(state);
    case 'MULLIGAN':
      return applyMulligan(state, action);
    case 'DEEP_MULLIGAN':
      return applyDeepMulligan(state, action);
    case 'FINISH_DRAW':
      return applyFinishDraw(state, action);
    case 'PLAY_SUPPLY':
      return applyPlaySupply(state, action);
    case 'DEPLOY':
      return applyDeploy(state, action);
    case 'SET_AMBUSH':
      return applySetAmbush(state, action);
    case 'PLAY_INTERVENTION':
      return applyPlayIntervention(state, action);
    case 'PASS_LOGISTICS':
      return applyPassLogistics(state, action);
    case 'SET_ORDER':
      return applySetOrder(state, action);
    case 'CONFIRM_ORDERS':
      return applyConfirmOrders(state, action);
    case 'SCOUT_REORDER':
      return applyScoutReorder(state, action);
    case 'PLAY_MANEUVER':
      return applyPlayManeuver(state, action);
    case 'TRIGGER_AMBUSH':
      return applyTriggerAmbush(state, action);
    case 'PASS_MANEUVERS':
      return applyPassManeuvers(state, action);
    case 'RESOLVE_COMBAT':
      return finishCombat(state);
  }
}

/** Rzut kostką na inicjatywę — spełnia wymóg „rzuty kostką" z wytycznych (§6.0). */
function rollInitiative(state: GameState): Reduced {
  let next = cloneState(state);
  let p1 = 0;
  let p2 = 0;
  // Powtarzamy aż do rozstrzygnięcia — remis nie może zawiesić startu.
  do {
    const r1 = rollDie(next.rng);
    next.rng = r1.rng;
    const r2 = rollDie(next.rng);
    next.rng = r2.rng;
    p1 = r1.value;
    p2 = r2.value;
  } while (p1 === p2);

  const winner: PlayerId = p1 > p2 ? 'P1' : 'P2';
  next.lastRoll = { p1, p2 };
  next.firstPlayer = winner;
  next.logisticsFirstPlayer = winner;
  next.turn = 1;
  next = addLog(next, `Rzut o inicjatywę: P1 ${p1}, P2 ${p2} — zaczyna ${winner}.`);

  const entered = enterDraw(next);
  return {
    state: entered.state,
    events: [{ type: 'DICE_ROLL', p1, p2, winner }, ...entered.events],
  };
}

/** Zdejmuje martwych z planszy, sprawdza zwycięstwo, otwiera kolejną turę. */
function finishCombat(state: GameState): Reduced {
  let next = sweepDead(state);
  const events: GameEvent[] = [];

  const outcome = checkVictory(next);
  if (outcome) {
    next.phase = 'END';
    next.winner = outcome.winner;
    next = addLog(next, `Koniec partii: ${outcome.reason}`);
    events.push({ type: 'GAME_WON', winner: outcome.winner, reason: outcome.reason });
    return { state: next, events };
  }

  next = beginNextTurn(next);
  events.push({ type: 'TURN_CHANGED', turn: next.turn, firstPlayer: next.firstPlayer });
  const entered = enterDraw(next);
  return { state: entered.state, events: [...events, ...entered.events] };
}

/**
 * Nowa tura: sprzątanie modyfikatorów, ustalenie kolejności (§14.5).
 * Pierwszeństwo ma gracz z mniejszą liczbą jednostek; remis → alternacja.
 * W fazie logistyki dodatkowo alternuje, kto zaczyna.
 */
function beginNextTurn(state: GameState): GameState {
  const next = cloneState(state);
  next.turn += 1;
  next.revealed = false;
  next.lastCombat = null;
  next.orders = { P1: [], P2: [] };

  for (const field of Object.keys(next.board)) {
    const u = next.board[field];
    if (!u) continue;
    u.modifiers = u.modifiers.filter((m) => m.expires !== 'END_OF_TURN');
    u.savedThisTurn = 0;
  }

  /*
   * Kto deklaruje pierwszy. Przy JAWNEJ deklaracji pierwszeństwo jest
   * obciążeniem, nie przywilejem: kto mówi pierwszy, ten odsłania plan.
   * Dlatego zaczyna gracz z WIĘKSZĄ liczbą oddziałów — przewaga na planszy
   * kosztuje przewagę informacyjną. To domyka §14.5 („wybiera gracz z mniejszą
   * liczbą jednostek": wybrałby drugą pozycję) i działa jak mechanizm
   * wyrównujący dla strony słabszej.
   */
  const c1 = countUnits(next, 'P1');
  const c2 = countUnits(next, 'P2');
  const poprzedni = next.firstPlayer;
  const rowneSily = c1 === c2;

  if (CONFIG.turnOrderMode === 'more_units_first' && !rowneSily) {
    next.firstPlayer = c1 > c2 ? 'P1' : 'P2';
  } else {
    // Remis liczebny albo tryb „alternate": po prostu zamiana stron.
    next.firstPlayer = poprzedni === 'P1' ? 'P2' : 'P1';
  }

  if (CONFIG.logisticsAlternates) {
    next.logisticsFirstPlayer = next.logisticsFirstPlayer === 'P1' ? 'P2' : 'P1';
  }

  return next;
}

/**
 * Przejścia między fazami. Trzymane w jednym miejscu, żeby moduły faz
 * nie importowały się nawzajem (i nie robiły cyklu).
 */
function advance(state: GameState, events: GameEvent[]): Reduced {
  let current = state;
  const all = [...events];

  // Pętla, bo jedno przejście może od razu odblokować kolejne
  // (np. obaj gracze bez jednostek → strategia kończy się natychmiast).
  for (let guard = 0; guard < 8; guard++) {
    const before = current.phase;
    const both = (fn: (p: PlayerId) => boolean): boolean => fn('P1') && fn('P2');

    if (current.phase === 'DRAW' && both((p) => current.players[p].drawDone)) {
      const r = enterLogistics(current);
      current = r.state;
      all.push(...r.events);
    } else if (current.phase === 'LOGISTICS' && both((p) => current.players[p].passedLogistics)) {
      const r = enterStrategy(current);
      current = r.state;
      all.push(...r.events);
    } else if (current.phase === 'STRATEGY' && both((p) => zadeklarowalWszystko(current, p))) {
      const r = enterManeuvers(current);
      current = r.state;
      all.push(...r.events);
    } else if (current.phase === 'MANEUVERS' && both((p) => current.players[p].passedManeuvers)) {
      const r = enterCombat(current);
      current = r.state;
      all.push(...r.events);
    }

    if (current.phase === before) break;
  }

  return { state: current, events: all };
}
