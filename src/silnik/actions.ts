import type { FieldId, GameAction, GameState, Legality, PlayerId } from './types';
import { allFields } from './board';
import { card } from './cards';
import {
  canDeploy,
  canPassLogistics,
  canPlayIntervention,
  canPlaySupply,
  canSetAmbush,
} from './phases/logistics';
import { canConfirmOrders, canSetOrder } from './phases/strategy';
import {
  canPassManeuvers,
  canPlayManeuver,
  canScoutReorder,
  canTriggerAmbush,
} from './phases/maneuvers';
import { canDeepMulligan, canFinishDraw, canMulligan } from './phases/draw';
import { isScout, legalTargets, livingUnitsOf } from './stats';

/**
 * Jedno miejsce, w którym rozstrzyga się legalność akcji.
 * UI nigdy nie sprawdza zasad samodzielnie — pyta tutaj (§2.3).
 */

export function czyAkcjaLegalna(state: GameState, action: GameAction): Legality {
  if (state.winner !== null && action.type !== 'ROLL_INITIATIVE') {
    return { ok: false, reason: 'Partia jest zakończona.' };
  }
  switch (action.type) {
    case 'ROLL_INITIATIVE':
      return state.phase === 'SETUP'
        ? { ok: true }
        : { ok: false, reason: 'Inicjatywę losujemy tylko na starcie.' };
    case 'MULLIGAN':
      return canMulligan(state, action);
    case 'DEEP_MULLIGAN':
      return canDeepMulligan(state, action);
    case 'FINISH_DRAW':
      return canFinishDraw(state, action);
    case 'PLAY_SUPPLY':
      return canPlaySupply(state, action);
    case 'DEPLOY':
      return canDeploy(state, action);
    case 'SET_AMBUSH':
      return canSetAmbush(state, action);
    case 'PLAY_INTERVENTION':
      return canPlayIntervention(state, action);
    case 'PASS_LOGISTICS':
      return canPassLogistics(state, action);
    case 'SET_ORDER':
      return canSetOrder(state, action);
    case 'CONFIRM_ORDERS':
      return canConfirmOrders(state, action);
    case 'SCOUT_REORDER':
      return canScoutReorder(state, action);
    case 'PLAY_MANEUVER':
      return canPlayManeuver(state, action);
    case 'TRIGGER_AMBUSH':
      return canTriggerAmbush(state, action);
    case 'PASS_MANEUVERS':
      return canPassManeuvers(state, action);
    case 'RESOLVE_COMBAT':
      return state.phase === 'COMBAT'
        ? { ok: true }
        : { ok: false, reason: 'To nie jest faza walki.' };
  }
}

/** Alias dla warstwy widoku i bota. */
export const canPerform = czyAkcjaLegalna;

/**
 * Pełna lista legalnych akcji gracza w bieżącym stanie.
 * Bot (§11.2) korzysta z tego samego publicznego API co interfejs — nie ma
 * dostępu do ukrytych informacji „po cichu".
 */
export function legalActions(state: GameState, player: PlayerId): GameAction[] {
  const out: GameAction[] = [];
  const push = (a: GameAction): void => {
    if (czyAkcjaLegalna(state, a).ok) out.push(a);
  };
  const hand = Array.from(new Set(state.players[player].hand));

  switch (state.phase) {
    case 'SETUP':
      push({ type: 'ROLL_INITIATIVE' });
      break;

    case 'DRAW':
      push({ type: 'FINISH_DRAW', player });
      for (const c of hand) push({ type: 'MULLIGAN', player, cards: [c] });
      for (const c of hand) push({ type: 'DEEP_MULLIGAN', player, discard: c });
      break;

    case 'LOGISTICS': {
      push({ type: 'PASS_LOGISTICS', player });
      for (const c of hand) {
        const def = card(c);
        switch (def.type) {
          case 'SUPPLY':
            push({ type: 'PLAY_SUPPLY', player, card: c });
            break;
          case 'RECRUIT':
            for (const f of allFields()) push({ type: 'DEPLOY', player, card: c, field: f });
            break;
          case 'AMBUSH':
            push({ type: 'SET_AMBUSH', player, card: c });
            break;
          case 'INTERVENTION':
            push({ type: 'PLAY_INTERVENTION', player, card: c });
            break;
          case 'MANEUVER':
            break;
        }
      }
      for (const a of state.players[player].ambushes) {
        for (const u of livingUnitsOf(state, player === 'P1' ? 'P2' : 'P1')) {
          push({ type: 'TRIGGER_AMBUSH', player, ambush: a.uid, unit: u.uid });
        }
      }
      break;
    }

    case 'STRATEGY': {
      push({ type: 'CONFIRM_ORDERS', player });
      // Deklaracja jest naprzemienna i jednorazowa — `canSetOrder` odsieje
      // oddziały, które rozkaz już dostały.
      for (const u of livingUnitsOf(state, player)) {
        push({ type: 'SET_ORDER', player, order: { unit: u.uid, kind: 'NONE' } });
        push({ type: 'SET_ORDER', player, order: { unit: u.uid, kind: 'DEFEND' } });
        for (const t of legalTargets(state, u)) {
          push({ type: 'SET_ORDER', player, order: { unit: u.uid, kind: 'ATTACK', target: t } });
        }
      }
      break;
    }

    case 'MANEUVERS': {
      push({ type: 'PASS_MANEUVERS', player });
      // Zwiadowcy: darmowa korekta własnego rozkazu, raz na turę.
      for (const u of livingUnitsOf(state, player)) {
        if (!isScout(state, u)) continue;
        push({ type: 'SCOUT_REORDER', player, order: { unit: u.uid, kind: 'DEFEND' } });
        push({ type: 'SCOUT_REORDER', player, order: { unit: u.uid, kind: 'NONE' } });
        for (const t of legalTargets(state, u)) {
          push({ type: 'SCOUT_REORDER', player, order: { unit: u.uid, kind: 'ATTACK', target: t } });
        }
      }
      for (const c of hand) {
        if (card(c).type !== 'MANEUVER') continue;
        for (const u of livingUnitsOf(state, player)) {
          push({ type: 'PLAY_MANEUVER', player, card: c, unit: u.uid });
          for (const t of legalTargets(state, u)) {
            push({ type: 'PLAY_MANEUVER', player, card: c, unit: u.uid, target: t });
          }
        }
      }
      for (const a of state.players[player].ambushes) {
        for (const u of livingUnitsOf(state, player === 'P1' ? 'P2' : 'P1')) {
          push({ type: 'TRIGGER_AMBUSH', player, ambush: a.uid, unit: u.uid });
        }
      }
      break;
    }

    case 'COMBAT':
      push({ type: 'RESOLVE_COMBAT' });
      break;

    case 'END':
      break;
  }
  return out;
}

/** Pola, na które wolno zagrać wskazaną kartę werbunku — podświetlenie w UI. */
export function legalFieldsForCard(
  state: GameState,
  player: PlayerId,
  cardId: string,
): FieldId[] {
  return allFields().filter(
    (f) => czyAkcjaLegalna(state, { type: 'DEPLOY', player, card: cardId, field: f }).ok,
  );
}
