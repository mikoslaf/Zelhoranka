import type {
  CombatDeath,
  CombatReport,
  DeathReason,
  FieldId,
  GameEvent,
  GameState,
  PlayerId,
  Reduced,
  Uid,
  Unit,
} from '../types';
import { card, CONFIG } from '../cards';
import { addLog, cloneState } from '../state';
import { effDefense, effOffense, livingUnitsOf, survivesDeath, unitAt } from '../stats';

/**
 * Faza walki (§6.6). Rozstrzygana JEDNOCZEŚNIE na zamrożonej migawce:
 * żadna śmierć nie wpływa na obliczenia w tej samej fazie.
 *
 * Kroki 5, 6 i 7 czytają tę samą migawkę statystyk. Jednostka może zostać
 * oznaczona jako martwa kilkoma drogami — to nie jest błąd.
 */

type Snapshot = {
  units: Unit[];
  offense: Record<Uid, number>;
  defense: Record<Uid, number>;
  /** pole → jednostki atakujące to pole */
  attackersOf: Record<FieldId, Unit[]>;
  /** uid → rozkaz ataku tej jednostki (pole docelowe) */
  attackTarget: Record<Uid, FieldId>;
  defending: Set<Uid>;
};

function snapshot(state: GameState): Snapshot {
  const units = [...livingUnitsOf(state, 'P1'), ...livingUnitsOf(state, 'P2')];
  const offense: Record<Uid, number> = {};
  const defense: Record<Uid, number> = {};
  const attackersOf: Record<FieldId, Unit[]> = {};
  const attackTarget: Record<Uid, FieldId> = {};
  const defending = new Set<Uid>();

  for (const u of units) {
    offense[u.uid] = effOffense(state, u);
    defense[u.uid] = effDefense(state, u);
  }

  for (const p of ['P1', 'P2'] as PlayerId[]) {
    for (const order of state.orders[p]) {
      const unit = units.find((u) => u.uid === order.unit);
      if (!unit) continue; // martwa lub zdjęta z planszy
      if (order.kind === 'ATTACK') {
        const victim = unitAt(state, order.target);
        if (!victim) continue; // cel zniknął — atak przepada
        attackTarget[unit.uid] = order.target;
        (attackersOf[order.target] ??= []).push(unit);
      } else if (order.kind === 'DEFEND') {
        defending.add(unit.uid);
      }
    }
  }

  // Determinizm: kolejność napastników nie może zależeć od kolejności wpisów.
  for (const field of Object.keys(attackersOf)) {
    attackersOf[field].sort(orderAttackers(offense, defense));
  }

  return { units, offense, defense, attackersOf, attackTarget, defending };
}

/** Ofensywa malejąco, potem defensywa malejąco, potem identyfikator pola (§6.6). */
function orderAttackers(offense: Record<Uid, number>, defense: Record<Uid, number>) {
  return (a: Unit, b: Unit): number => {
    if (offense[b.uid] !== offense[a.uid]) return offense[b.uid] - offense[a.uid];
    if (defense[b.uid] !== defense[a.uid]) return defense[b.uid] - defense[a.uid];
    return a.field.localeCompare(b.field);
  };
}

export function enterCombat(state: GameState): Reduced {
  let next = cloneState(state);
  next.phase = 'COMBAT';
  const events: GameEvent[] = [{ type: 'PHASE_CHANGED', phase: 'COMBAT', player: next.firstPlayer }];

  const snap = snapshot(next);
  const marked = new Map<Uid, { reason: DeathReason; detail: string }>();
  // Ile razy jednostkę uratowała „niezłomność" w tym rozstrzygnięciu.
  const saves = new Map<Uid, number>();

  /** Oznacza jednostkę jako martwą, o ile żadna reguła jej nie uratuje. */
  const mark = (unit: Unit, reason: DeathReason, detail: string): void => {
    if (marked.has(unit.uid)) return; // już martwa — pierwszy powód zostaje w dzienniku
    const saved = saves.get(unit.uid) ?? 0;
    const probe: Unit = { ...unit, savedThisTurn: unit.savedThisTurn + saved };
    if (survivesDeath(next, probe)) {
      saves.set(unit.uid, saved + 1);
      next = addLog(next, `${card(unit.cardId).name} (${unit.field}): niezłomność — cios zignorowany.`, unit.owner);
      return;
    }
    marked.set(unit.uid, { reason, detail });
  };

  /* 4. Wsparcie obrońców (zasada dodatkowa 3):
        obrońca dokłada swoją defensywę jako obrażenia napastnikowi,
        który sam jest przez kogoś atakowany. */
  const support: Record<Uid, number> = {};
  for (const defender of snap.units) {
    if (!snap.defending.has(defender.uid)) continue;
    for (const attacker of snap.attackersOf[defender.field] ?? []) {
      const attackerIsAttacked = (snap.attackersOf[attacker.field] ?? []).length > 0;
      if (attackerIsAttacked) {
        support[attacker.uid] = (support[attacker.uid] ?? 0) + snap.defense[defender.uid];
      }
    }
  }

  /* 5. Obrażenia: suma ofensyw napastników + wsparcie. Porównanie jest ostre. */
  const incoming: Record<Uid, number> = {};
  for (const unit of snap.units) {
    const attackers = snap.attackersOf[unit.field] ?? [];
    let total = 0;
    for (const a of attackers) total += snap.offense[a.uid];
    total += support[unit.uid] ?? 0;
    incoming[unit.uid] = total;
    if (total > snap.defense[unit.uid]) {
      mark(unit, 'DAMAGE', `przewaga ofensywy ${total} > ${snap.defense[unit.uid]}`);
    }
  }

  /* 6. Odwet obrońców: pula = defensywa, priorytet dla największych napastników. */
  for (const defender of snap.units) {
    if (!snap.defending.has(defender.uid)) continue;
    let pool = snap.defense[defender.uid];
    for (const attacker of snap.attackersOf[defender.field] ?? []) {
      const off = snap.offense[attacker.uid];
      if (pool > off) {
        mark(attacker, 'RETALIATION', `odwet obrońcy ${pool} > ${off}`);
        pool -= off + 1;
      } else if (!CONFIG.retaliationSkipUnaffordable) {
        break; // „priorytet dla największych" czytany dosłownie (§14.8)
      }
    }
  }

  /* 7. Pojedynki wzajemne (zasada dodatkowa 6). Uzupełniają, nie zastępują kroku 5. */
  if (CONFIG.duelSupplementsDamage) {
    const seen = new Set<string>();
    for (const a of snap.units) {
      const aTarget = snap.attackTarget[a.uid];
      if (!aTarget) continue;
      const b = unitAt(next, aTarget);
      if (!b) continue;
      if (snap.attackTarget[b.uid] !== a.field) continue; // B nie odwzajemnia ataku
      const key = [a.uid, b.uid].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);

      const offA = snap.offense[a.uid];
      const offB = snap.offense[b.uid];
      if (offA > offB) mark(b, 'DUEL', `pojedynek ${offA} > ${offB}`);
      else if (offB > offA) mark(a, 'DUEL', `pojedynek ${offB} > ${offA}`);
      else if (CONFIG.duelTie === 'both_die') {
        mark(a, 'DUEL', 'pojedynek — remis ofensyw');
        mark(b, 'DUEL', 'pojedynek — remis ofensyw');
      }
    }
  }

  /* 8. Oznaczenie martwych. Z planszy zdejmiemy je dopiero w RESOLVE_COMBAT,
        żeby UI zdążyło je pokazać gasnące. */
  const deaths: CombatDeath[] = [];
  for (const unit of snap.units) {
    const hit = marked.get(unit.uid);
    if (!hit) {
      // Zapamiętaj uratowania, żeby przetrwały do końca tury.
      const saved = saves.get(unit.uid) ?? 0;
      if (saved > 0) next.board[unit.field]!.savedThisTurn += saved;
      continue;
    }
    next.board[unit.field]!.dead = true;
    deaths.push({
      uid: unit.uid,
      owner: unit.owner,
      cardId: unit.cardId,
      field: unit.field,
      reason: hit.reason,
      detail: hit.detail,
    });
  }

  const arrows = snap.units
    .filter((u) => snap.attackTarget[u.uid])
    .map((u) => ({
      from: u.field,
      to: snap.attackTarget[u.uid],
      owner: u.owner,
      offense: snap.offense[u.uid],
    }));

  const report: CombatReport = { deaths, incoming, arrows };
  next.lastCombat = report;

  events.push({ type: 'COMBAT_START', report });
  next = addLog(next, 'Starcie rozstrzygnięte.');
  for (const d of deaths) {
    events.push({
      type: 'UNIT_DIED',
      uid: d.uid,
      owner: d.owner,
      field: d.field,
      reason: d.reason,
      detail: d.detail,
    });
    next = addLog(next, `${card(d.cardId).name} (${d.field}) ginie — ${d.detail}.`, d.owner);
  }
  if (deaths.length === 0) next = addLog(next, 'Nikt nie poległ.');

  return { state: next, events };
}

/** Zdejmuje oznaczone jednostki z planszy i odkłada karty na stos odrzuconych. */
export function sweepDead(state: GameState): GameState {
  const next = cloneState(state);
  for (const field of Object.keys(next.board)) {
    const u = next.board[field];
    if (u && u.dead) {
      next.players[u.owner].discard.push(u.cardId);
      next.board[field] = null;
    }
  }
  return next;
}
