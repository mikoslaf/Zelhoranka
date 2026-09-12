import { describe, expect, it } from 'vitest';
import { widokDla, rozkazDla, rzedyDla } from '../../ui/widok';
import { reduce } from '../reducer';
import { czyAkcjaLegalna } from '../actions';
import { bezRozkazu, zadeklarowalWszystko } from '../phases/strategy';
import { createGame } from '../state';
import { countUnits } from '../stats';
import { postaw, pustaGra } from './pomoc';

/**
 * Naprzemienna, jawna deklaracja rozkazów.
 *
 * To jest sedno przebudowy: gra przestała mieć ukrytą informację, więc trzeba
 * pilnować, żeby przewaga „kto deklaruje później" nie rozstrzygała partii.
 */

function gotowaStrategia(seed = 5) {
  const s = pustaGra(seed);
  s.phase = 'STRATEGY';
  s.revealed = true;
  s.turn = 2;
  s.orders = { P1: [], P2: [] };
  return s;
}

describe('deklaracja jest naprzemienna', () => {
  it('po wydaniu rozkazu głos przechodzi do przeciwnika', () => {
    const s = gotowaStrategia();
    s.activePlayer = 'P1';
    const a1 = postaw(s, 'P1', 'P1-F1', 'zelhorska_piechota');
    postaw(s, 'P1', 'P1-F2', 'zelhorska_piechota');
    postaw(s, 'P2', 'P2-F1', 'zelhorska_piechota');
    postaw(s, 'P2', 'P2-F2', 'zelhorska_piechota');

    const { state } = reduce(s, {
      type: 'SET_ORDER',
      player: 'P1',
      order: { unit: a1.uid, kind: 'DEFEND' },
    });
    expect(state.activePlayer).toBe('P2');
  });

  it('gracz nie może wydać dwóch rozkazów z rzędu', () => {
    const s = gotowaStrategia();
    s.activePlayer = 'P1';
    const a1 = postaw(s, 'P1', 'P1-F1', 'zelhorska_piechota');
    const a2 = postaw(s, 'P1', 'P1-F2', 'zelhorska_piechota');
    postaw(s, 'P2', 'P2-F1', 'zelhorska_piechota');

    const { state } = reduce(s, {
      type: 'SET_ORDER',
      player: 'P1',
      order: { unit: a1.uid, kind: 'DEFEND' },
    });
    const druga = czyAkcjaLegalna(state, {
      type: 'SET_ORDER',
      player: 'P1',
      order: { unit: a2.uid, kind: 'DEFEND' },
    });
    expect(druga.ok).toBe(false);
  });

  it('rozkazu nie można zmienić po wydaniu', () => {
    const s = gotowaStrategia();
    s.activePlayer = 'P1';
    const a1 = postaw(s, 'P1', 'P1-F1', 'zelhorska_piechota');
    postaw(s, 'P2', 'P2-F1', 'zelhorska_piechota');

    let { state } = reduce(s, {
      type: 'SET_ORDER',
      player: 'P1',
      order: { unit: a1.uid, kind: 'DEFEND' },
    });
    state = { ...state, activePlayer: 'P1' };
    const powtorka = czyAkcjaLegalna(state, {
      type: 'SET_ORDER',
      player: 'P1',
      order: { unit: a1.uid, kind: 'NONE' },
    });
    expect(powtorka.ok).toBe(false);
    if (!powtorka.ok) expect(powtorka.reason).toMatch(/ma już rozkaz/i);
  });

  it('gdy przeciwnik skończył, gracz dokańcza swoje oddziały sam', () => {
    const s = gotowaStrategia();
    s.activePlayer = 'P1';
    const a1 = postaw(s, 'P1', 'P1-F1', 'zelhorska_piechota');
    const a2 = postaw(s, 'P1', 'P1-F2', 'zelhorska_piechota');
    const b1 = postaw(s, 'P2', 'P2-F1', 'zelhorska_piechota');
    s.orders.P2 = [{ unit: b1.uid, kind: 'DEFEND' }];

    expect(zadeklarowalWszystko(s, 'P2')).toBe(true);
    const { state } = reduce(s, {
      type: 'SET_ORDER',
      player: 'P1',
      order: { unit: a1.uid, kind: 'DEFEND' },
    });
    // P2 nie ma już nic do wydania, więc głos zostaje przy P1.
    expect(state.activePlayer).toBe('P1');
    expect(bezRozkazu(state, 'P1')).toEqual([a2.uid]);
  });

  it('„reszta stoi" nadaje postój wszystkim pozostałym naraz', () => {
    const s = gotowaStrategia();
    s.activePlayer = 'P1';
    postaw(s, 'P1', 'P1-F1', 'zelhorska_piechota');
    postaw(s, 'P1', 'P1-F2', 'zelhorska_piechota');
    postaw(s, 'P2', 'P2-F1', 'zelhorska_piechota');

    const { state } = reduce(s, { type: 'CONFIRM_ORDERS', player: 'P1' });
    expect(zadeklarowalWszystko(state, 'P1')).toBe(true);
    expect(state.orders.P1.every((o) => o.kind === 'NONE')).toBe(true);
  });

  it('komplet rozkazów po obu stronach otwiera fazę manewrów', () => {
    const s = gotowaStrategia();
    s.activePlayer = 'P1';
    postaw(s, 'P1', 'P1-F1', 'zelhorska_piechota');
    postaw(s, 'P2', 'P2-F1', 'zelhorska_piechota');

    let state = reduce(s, { type: 'CONFIRM_ORDERS', player: 'P1' }).state;
    expect(state.phase).toBe('STRATEGY');
    state = reduce(state, { type: 'CONFIRM_ORDERS', player: 'P2' }).state;
    expect(state.phase).toBe('MANEUVERS');
  });
});

describe('równoważenie jawnej deklaracji', () => {
  it('pierwszy deklaruje gracz z większą liczbą oddziałów', () => {
    // Deklarowanie pierwszym jest obciążeniem — odsłania plan. Silniejszy
    // gracz płaci tym za przewagę na planszy.
    const s = pustaGra(3);
    s.phase = 'MANEUVERS';
    s.turn = 2;
    s.firstPlayer = 'P1';
    s.players.P1.passedManeuvers = true;
    s.players.P2.passedManeuvers = true;
    postaw(s, 'P1', 'P1-F1', 'zelhorska_piechota');
    postaw(s, 'P1', 'P1-F2', 'zelhorska_piechota');
    postaw(s, 'P2', 'P2-R0', 'kwatermistrz_taboru');

    const { state } = reduce(s, { type: 'PASS_MANEUVERS', player: 'P1' });
    // P1 ma 2 oddziały, P2 ma 1 → w nowej turze zaczyna P1.
    expect(countUnits(state, 'P1')).toBeGreaterThan(countUnits(state, 'P2'));
    expect(state.firstPlayer).toBe('P1');
  });

  it('zwiadowca może raz skorygować rozkaz, ale nie dwa razy', () => {
    const s = pustaGra(9);
    s.phase = 'MANEUVERS';
    s.revealed = true;
    s.turn = 2;
    s.activePlayer = 'P1';
    const zwiad = postaw(s, 'P1', 'P1-F0', 'zwiadowcy_desilvaru');
    postaw(s, 'P2', 'P2-F0', 'zelhorska_piechota');
    s.orders.P1 = [{ unit: zwiad.uid, kind: 'NONE' }];
    s.orders.P2 = [];

    let { state } = reduce(s, {
      type: 'SCOUT_REORDER',
      player: 'P1',
      order: { unit: zwiad.uid, kind: 'ATTACK', target: 'P2-F0' },
    });
    expect(state.orders.P1[0].kind).toBe('ATTACK');
    expect(state.players.P1.scoutUsed).toContain(zwiad.uid);

    state = { ...state, activePlayer: 'P1' };
    const druga = czyAkcjaLegalna(state, {
      type: 'SCOUT_REORDER',
      player: 'P1',
      order: { unit: zwiad.uid, kind: 'DEFEND' },
    });
    expect(druga.ok).toBe(false);
  });

  it('zwykły oddział nie korzysta z korekty zwiadowcy', () => {
    const s = pustaGra(9);
    s.phase = 'MANEUVERS';
    s.revealed = true;
    s.activePlayer = 'P1';
    const zwykly = postaw(s, 'P1', 'P1-F1', 'zelhorska_piechota');
    s.orders.P1 = [{ unit: zwykly.uid, kind: 'NONE' }];

    const r = czyAkcjaLegalna(s, {
      type: 'SCOUT_REORDER',
      player: 'P1',
      order: { unit: zwykly.uid, kind: 'DEFEND' },
    });
    expect(r.ok).toBe(false);
  });
});

describe('model widoku — pełna informacja', () => {
  it('ręka przeciwnika jest jawna', () => {
    const s = createGame(11);
    const w = widokDla(s, 'P1');
    expect(w.rekaPrzeciwnika).toEqual(s.players.P2.hand);
    expect(w.rekaPrzeciwnika.length).toBeGreaterThan(0);
  });

  it('rozkazy przeciwnika są widoczne od razu po wydaniu', () => {
    const s = gotowaStrategia();
    const wrog = postaw(s, 'P2', 'P2-F1', 'aranorscy_jezdzcy');
    postaw(s, 'P1', 'P1-F1', 'zelhorska_piechota');
    s.orders.P2 = [{ unit: wrog.uid, kind: 'ATTACK', target: 'P1-F1' }];

    const w = widokDla(s, 'P1');
    expect(rozkazDla(w, wrog.uid, 'P2')?.kind).toBe('ATTACK');
  });

  it('przeciwnik jest u góry, gracz na dole — dla obu perspektyw', () => {
    expect(rzedyDla('P1').map((r) => r.klucz)).toEqual(['P2-R', 'P2-F', 'P1-F', 'P1-R']);
    expect(rzedyDla('P2').map((r) => r.klucz)).toEqual(['P1-R', 'P1-F', 'P2-F', 'P2-R']);
  });
});
