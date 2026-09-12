import { describe, expect, it } from 'vitest';
import { createGame } from '../state';
import { reduce } from '../reducer';
import { legalActions } from '../actions';
import { assertRegistryComplete } from '../rules';
import { buildDeckList, CONFIG } from '../cards';
import { shuffle, createRng, rollDie } from '../rng';
import type { GameAction, GameState } from '../types';

/** §12.1 — determinizm i spójność danych. */

/** Rozgrywa partię „na ślepo", zawsze wybierając akcję o danym indeksie. */
function rozegraj(seed: number, kroki = 400): GameState {
  let state = createGame(seed);
  let rng = createRng(seed ^ 0x9e3779b9);
  let n = 0;
  while (state.winner === null && n < kroki) {
    const akcje: GameAction[] = legalActions(state, state.activePlayer);
    if (akcje.length === 0) break;
    const r = rollDie(rng);
    rng = r.rng;
    // Deterministyczny wybór: pseudolosowy indeks z własnego generatora.
    const akcja = akcje[(r.value * 7 + n) % akcje.length];
    const out = reduce(state, akcja);
    state = out.state;
    n++;
  }
  return state;
}

describe('determinizm', () => {
  it('to samo ziarno daje identyczną talię startową', () => {
    const a = createGame(12345);
    const b = createGame(12345);
    expect(a.players.P1.deck).toEqual(b.players.P1.deck);
    expect(a.players.P1.hand).toEqual(b.players.P1.hand);
    expect(a.players.P2.deck).toEqual(b.players.P2.deck);
  });

  it('różne ziarna dają różne talie', () => {
    const a = createGame(1);
    const b = createGame(2);
    expect(a.players.P1.deck).not.toEqual(b.players.P1.deck);
  });

  it('ta sama sekwencja akcji przy tym samym ziarnie daje identyczny stan końcowy', () => {
    const a = rozegraj(777);
    const b = rozegraj(777);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('stan serializuje się do JSON bez utraty informacji', () => {
    const s = rozegraj(42, 120);
    const kopia = JSON.parse(JSON.stringify(s)) as GameState;
    expect(kopia).toEqual(s);
  });

  it('tasowanie nie gubi ani nie duplikuje kart', () => {
    const talia = buildDeckList();
    const { items } = shuffle(createRng(99), talia);
    expect(items.length).toBe(talia.length);
    expect(items.slice().sort()).toEqual(talia.slice().sort());
  });

  it('rzut kostką mieści się w 1..6', () => {
    let rng = createRng(5);
    for (let i = 0; i < 200; i++) {
      const r = rollDie(rng);
      rng = r.rng;
      expect(r.value).toBeGreaterThanOrEqual(1);
      expect(r.value).toBeLessThanOrEqual(6);
    }
  });
});

describe('dane', () => {
  it('każda reguła użyta na kartach ma implementację', () => {
    expect(() => assertRegistryComplete()).not.toThrow();
  });

  it('talia ma rozmiar z konfiguracji', () => {
    expect(buildDeckList().length).toBe(CONFIG.deckSize);
  });

  it('nielegalna akcja nie zmienia stanu i zgłasza powód', () => {
    const s = createGame(3);
    const out = reduce(s, { type: 'DEPLOY', player: 'P1', card: 'nieistniejaca', field: 'P1-F1' });
    expect(out.state).toBe(s);
    expect(out.events[0].type).toBe('ILLEGAL_ACTION');
  });

  it('partia rozgrywa się do rozstrzygnięcia albo do limitu kroków bez wyjątku', () => {
    for (const seed of [1, 2, 3, 11, 101]) {
      const s = rozegraj(seed, 600);
      expect(['SETUP', 'DRAW', 'LOGISTICS', 'STRATEGY', 'MANEUVERS', 'COMBAT', 'END']).toContain(
        s.phase,
      );
      expect(s.turn).toBeGreaterThanOrEqual(1);
    }
  });
});
