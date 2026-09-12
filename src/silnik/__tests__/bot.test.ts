import { describe, expect, it } from 'vitest';
import type { GameState, PlayerId } from '../types';
import { createGame } from '../state';
import { reduce } from '../reducer';
import { czyAkcjaLegalna } from '../actions';
import { wybierzAkcje, type Trudnosc } from '../../ai/bot';

/**
 * Przeciwnik komputerowy (§11.2).
 *
 * Najważniejszy test to ten ostatni: dwa boty rozgrywają pełną partię.
 * Sprawdza naraz bota, wszystkie fazy i to, że maszyna faz nie ma zakleszczenia.
 */

type Wynik = { state: GameState; kroki: number };

function partiaBotow(seed: number, trudnosc: Trudnosc = 'SREDNI', limit = 4000): Wynik {
  let state = createGame(seed);
  let kroki = 0;

  while (state.winner === null && kroki < limit) {
    // Faza walki nie ma aktywnego gracza — zamyka ją silnik.
    if (state.phase === 'COMBAT') {
      state = reduce(state, { type: 'RESOLVE_COMBAT' }).state;
      kroki++;
      continue;
    }
    const gracz: PlayerId = state.activePlayer;
    const akcja = wybierzAkcje(state, gracz, trudnosc);
    if (!akcja) break;
    // Bot ma prawo proponować tylko legalne akcje — inaczej to błąd bota.
    expect(
      czyAkcjaLegalna(state, akcja).ok,
      `bot zaproponował nielegalną akcję ${akcja.type} w fazie ${state.phase}`,
    ).toBe(true);
    state = reduce(state, akcja).state;
    kroki++;
  }
  return { state, kroki };
}

describe('bot', () => {
  it('proponuje wyłącznie legalne akcje przez całą partię', () => {
    // Asercja legalności siedzi wewnątrz partiaBotow.
    const { state } = partiaBotow(11);
    expect(state.turn).toBeGreaterThan(1);
  });

  it('dwa boty dogrywają partię do rozstrzygnięcia', () => {
    for (const seed of [1, 7, 42, 2024]) {
      const { state, kroki } = partiaBotow(seed);
      expect(state.winner, `ziarno ${seed} nie dało rozstrzygnięcia`).not.toBeNull();
      expect(state.phase).toBe('END');
      expect(kroki).toBeLessThan(4000);
    }
  });

  it('partia bota jest powtarzalna przy tym samym ziarnie', () => {
    const a = partiaBotow(99);
    const b = partiaBotow(99);
    expect(JSON.stringify(a.state)).toEqual(JSON.stringify(b.state));
    expect(a.kroki).toBe(b.kroki);
  });

  it('poziomy trudności prowadzą do różnych rozgrywek', () => {
    const latwy = partiaBotow(5, 'LATWY');
    const trudny = partiaBotow(5, 'TRUDNY');
    expect(JSON.stringify(latwy.state)).not.toEqual(JSON.stringify(trudny.state));
  });

  it('bot rozstawia oddziały, zamiast pasować w nieskończoność', () => {
    const { state } = partiaBotow(3, 'TRUDNY', 600);
    const wszystkieKarty = [
      ...state.players.P1.discard,
      ...state.players.P2.discard,
    ];
    expect(wszystkieKarty.length).toBeGreaterThan(0);
  });
});
