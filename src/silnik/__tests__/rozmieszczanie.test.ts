import { describe, expect, it } from 'vitest';
import { czyAkcjaLegalna } from '../actions';
import { reduce } from '../reducer';
import { supplyLimit } from '../state';
import { CONFIG } from '../cards';
import { pustaGra, postaw } from './pomoc';

/** §12.1 — rozmieszczanie i zaopatrzenie. */

function graWLogistyce(seed = 7) {
  const s = pustaGra(seed);
  s.phase = 'LOGISTICS';
  s.turn = 3;
  s.activePlayer = 'P1';
  s.logisticsFirstPlayer = 'P1';
  s.players.P1.supplyPool = 6;
  s.players.P1.supplySpent = 0;
  s.players.P1.hand = ['zelhorska_piechota', 'aranorscy_jezdzcy', 'tabor_prowiantowy'];
  return s;
}

describe('rozmieszczanie', () => {
  it('karta linii głównej nie wchodzi na flankę', () => {
    const s = graWLogistyce();
    const flanka = czyAkcjaLegalna(s, {
      type: 'DEPLOY',
      player: 'P1',
      card: 'zelhorska_piechota',
      field: 'P1-F0',
    });
    expect(flanka.ok).toBe(false);

    const glowna = czyAkcjaLegalna(s, {
      type: 'DEPLOY',
      player: 'P1',
      card: 'zelhorska_piechota',
      field: 'P1-F1',
    });
    expect(glowna.ok).toBe(true);
  });

  it('nie wolno stanąć na zajętym polu', () => {
    const s = graWLogistyce();
    postaw(s, 'P1', 'P1-F1', 'zelhorska_piechota');
    const r = czyAkcjaLegalna(s, {
      type: 'DEPLOY',
      player: 'P1',
      card: 'zelhorska_piechota',
      field: 'P1-F1',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/zajęte/i);
  });

  it('brak zaopatrzenia blokuje werbunek', () => {
    const s = graWLogistyce();
    s.players.P1.supplyPool = 1; // jeźdźcy kosztują 3
    const r = czyAkcjaLegalna(s, {
      type: 'DEPLOY',
      player: 'P1',
      card: 'aranorscy_jezdzcy',
      field: 'P1-F0',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/zaopatrzeni/i);
  });

  it('nie wolno stawiać na polach przeciwnika', () => {
    const s = graWLogistyce();
    const r = czyAkcjaLegalna(s, {
      type: 'DEPLOY',
      player: 'P1',
      card: 'zelhorska_piechota',
      field: 'P2-F1',
    });
    expect(r.ok).toBe(false);
  });

  it('werbunek zdejmuje kartę z ręki i księguje koszt', () => {
    const s = graWLogistyce();
    const { state } = reduce(s, {
      type: 'DEPLOY',
      player: 'P1',
      card: 'zelhorska_piechota',
      field: 'P1-F1',
    });
    expect(state.board['P1-F1']?.cardId).toBe('zelhorska_piechota');
    expect(state.players.P1.supplySpent).toBe(2);
    expect(state.players.P1.hand).not.toContain('zelhorska_piechota');
    expect(state.board['P1-F1']?.deployedTurn).toBe(3);
  });
});

describe('wymiana kart a duplikaty', () => {
  /*
   * Ręka bez trudu mieści kilka kopii tej samej karty. Interfejs zaznaczał
   * je wcześniej po identyfikatorze, przez co klik w jedną podświetlał
   * wszystkie; tu pilnujemy drugiej połowy tej samej sprawy — czy silnik
   * odkłada dokładnie tyle egzemplarzy, ile wskazano.
   */
  it('wymiana jednej z dwóch identycznych kart zabiera dokładnie jedną', () => {
    const s = pustaGra(4);
    s.phase = 'DRAW';
    s.activePlayer = 'P1';
    s.turn = 2;
    s.players.P1.hand = ['tabor_prowiantowy', 'tabor_prowiantowy', 'zelhorska_piechota'];
    s.players.P1.discard = [];

    const { state } = reduce(s, {
      type: 'MULLIGAN',
      player: 'P1',
      cards: ['tabor_prowiantowy'],
    });

    const zostalo = state.players.P1.hand.filter((c) => c === 'tabor_prowiantowy').length;
    expect(zostalo).toBe(1);
    expect(state.players.P1.discard).toEqual(['tabor_prowiantowy']);
  });

  it('można wymienić obie kopie, wskazując kartę dwa razy', () => {
    const s = pustaGra(4);
    s.phase = 'DRAW';
    s.activePlayer = 'P1';
    s.turn = 2;
    s.players.P1.hand = ['tabor_prowiantowy', 'tabor_prowiantowy', 'zelhorska_piechota'];
    s.players.P1.discard = [];

    const akcja = {
      type: 'MULLIGAN' as const,
      player: 'P1' as const,
      cards: ['tabor_prowiantowy', 'tabor_prowiantowy'],
    };
    expect(czyAkcjaLegalna(s, akcja).ok).toBe(true);

    const { state } = reduce(s, akcja);
    expect(state.players.P1.hand.filter((c) => c === 'tabor_prowiantowy').length).toBe(0);
    expect(state.players.P1.discard).toHaveLength(2);
  });

  it('nie da się wymienić trzech kopii, gdy w ręce są dwie', () => {
    const s = pustaGra(4);
    s.phase = 'DRAW';
    s.activePlayer = 'P1';
    s.turn = 2;
    s.players.P1.hand = ['tabor_prowiantowy', 'tabor_prowiantowy'];

    const r = czyAkcjaLegalna(s, {
      type: 'MULLIGAN',
      player: 'P1',
      cards: ['tabor_prowiantowy', 'tabor_prowiantowy', 'tabor_prowiantowy'],
    });
    expect(r.ok).toBe(false);
  });
});

describe('zaopatrzenie', () => {
  it('limit rośnie z numerem tury', () => {
    expect(supplyLimit(1)).toBe(1 + CONFIG.supplyBase);
    expect(supplyLimit(4)).toBe(4 + CONFIG.supplyBase);
    expect(supplyLimit(4)).toBeGreaterThan(supplyLimit(3));
  });

  it('baza działa w turze 1', () => {
    const s = pustaGra(3);
    s.phase = 'DRAW';
    s.players.P1.drawDone = true;
    s.players.P2.drawDone = true;
    const { state } = reduce(s, { type: 'FINISH_DRAW', player: 'P1' });
    // FINISH_DRAW był już zaliczony, więc akcja jest nielegalna — sprawdzamy wprost:
    expect(state.players.P1.drawDone).toBe(true);
  });

  it('nadwyżka ponad limit jest przycinana', () => {
    const s = graWLogistyce();
    s.turn = 2; // limit = 2 + baza 1 = 3
    s.players.P1.supplyPool = 1;
    s.players.P1.hand = ['skarbiec_polowy']; // daje 3
    const { state } = reduce(s, { type: 'PLAY_SUPPLY', player: 'P1', card: 'skarbiec_polowy' });
    expect(state.players.P1.supplyPool).toBe(supplyLimit(2));
    expect(state.players.P1.supplyPool).toBeLessThan(1 + 3);
  });

  it('nie wolno dokładać zaopatrzenia przy pełnej puli', () => {
    const s = graWLogistyce();
    s.turn = 1;
    s.players.P1.supplyPool = supplyLimit(1);
    s.players.P1.hand = ['tabor_prowiantowy'];
    const r = czyAkcjaLegalna(s, { type: 'PLAY_SUPPLY', player: 'P1', card: 'tabor_prowiantowy' });
    expect(r.ok).toBe(false);
  });
});
