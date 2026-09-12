import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { GameAction, GameState } from '../types';
import { createGame } from '../state';
import { reduce } from '../reducer';
import { legalActions } from '../actions';
import { GameProvider } from '../../ui/GameProvider';
import { EkranGry } from '../../ui/screens/Gra';
import { EkranMenu } from '../../ui/screens/Menu';
import { EkranPodsumowania } from '../../ui/screens/Podsumowanie';
import { ModalZasad } from '../../ui/components/Zasady';
import { Scena } from '../../ui/screens/Scena';

/**
 * Test dymny warstwy widoku. Nie sprawdza wyglądu — sprawdza, że żaden ekran
 * nie wysypuje się przy renderowaniu w dowolnej fazie partii.
 *
 * Świadomie bez jsdom i biblioteki testującej: `renderToString` jest częścią
 * `react-dom`, które i tak jest w projekcie. Zależności trzymamy przy ziemi (§2).
 */

/**
 * Prowadzi partię naprzód. Wybór musi być zależny od fazy: w fazie strategii
 * `SET_ORDER` jest legalne bez końca, więc ślepe „bierz pierwszą akcję"
 * zapętliłoby się na deklarowaniu rozkazów w kółko.
 */
function nastepnaAkcja(state: GameState): GameAction | null {
  const p = state.activePlayer;
  const akcje = legalActions(state, p);
  if (akcje.length === 0) return null;

  switch (state.phase) {
    case 'SETUP':
      return { type: 'ROLL_INITIATIVE' };
    case 'DRAW':
      return { type: 'FINISH_DRAW', player: p };
    case 'LOGISTICS':
      return akcje.find((a) => a.type === 'DEPLOY') ?? { type: 'PASS_LOGISTICS', player: p };
    case 'STRATEGY': {
      const bezRozkazu = state.orders[p].find((o) => o.kind === 'NONE');
      if (bezRozkazu) {
        const wybor = akcje.find(
          (a) =>
            a.type === 'SET_ORDER' &&
            a.order.unit === bezRozkazu.unit &&
            a.order.kind === 'ATTACK',
        );
        if (wybor) return wybor;
        return { type: 'SET_ORDER', player: p, order: { unit: bezRozkazu.unit, kind: 'DEFEND' } };
      }
      return { type: 'CONFIRM_ORDERS', player: p };
    }
    case 'MANEUVERS':
      return { type: 'PASS_MANEUVERS', player: p };
    case 'COMBAT':
      return { type: 'RESOLVE_COMBAT' };
    case 'END':
      return null;
  }
}

/** Rozgrywa partię do wskazanej fazy. */
function doFazy(faza: GameState['phase'], maks = 400): GameState {
  let state = createGame(2024);
  for (let i = 0; i < maks; i++) {
    if (state.phase === faza) return state;
    if (state.winner !== null) break;
    const akcja = nastepnaAkcja(state);
    if (!akcja) break;
    state = reduce(state, akcja).state;
  }
  return state;
}

function render(state: GameState, element: React.ReactElement): string {
  return renderToString(
    <GameProvider seed={1} stanPoczatkowy={state}>
      <Scena>{element}</Scena>
    </GameProvider>,
  );
}

const USTAWIENIA = {
  ziarno: 1,
  zaslonaPelna: true,
  bot: false,
  trudnosc: 'SREDNI' as const,
};

describe('render — ekrany nie wysypują się', () => {
  it('menu', () => {
    const html = renderToString(
      <EkranMenu
        ustawienia={USTAWIENIA}
        onZmiana={() => undefined}
        onStart={() => undefined}
        onZasady={() => undefined}
        wPartii={false}
        onWroc={() => undefined}
      />,
    );
    expect(html).toContain('Zelhoranka');
  });

  it('modal zasad', () => {
    const html = renderToString(<ModalZasad onZamknij={() => undefined} />);
    expect(html).toContain('Rozstrzyganie starcia');
  });

  it('ekran gry w każdej fazie', () => {
    for (const faza of ['DRAW', 'LOGISTICS', 'STRATEGY', 'MANEUVERS'] as const) {
      const state = doFazy(faza);
      expect(state.phase, `nie udało się dojść do fazy ${faza}`).toBe(faza);
      for (const widok of ['P1', 'P2'] as const) {
        const html = render(state, <EkranGry viewPlayer={widok} bot={null} onMenu={() => undefined} />);
        expect(html.length).toBeGreaterThan(500);
      }
    }
  });

  it('ekran gry z rozstrzygniętym starciem i raportem', () => {
    // Faza COMBAT trzyma zgony na planszy i niesie `lastCombat` ze strzałkami.
    const state = doFazy('COMBAT');
    expect(state.phase).toBe('COMBAT');
    const html = render(state, <EkranGry viewPlayer="P1" bot={null} onMenu={() => undefined} />);
    expect(html.length).toBeGreaterThan(500);
  });

  it('podsumowanie dla zwycięstwa i dla remisu', () => {
    const podstawa = doFazy('LOGISTICS');
    for (const winner of ['P1', 'DRAW'] as const) {
      const state: GameState = { ...podstawa, phase: 'END', winner };
      const html = renderToString(
        <EkranPodsumowania
          game={state}
          bot={null}
          onJeszczeRaz={() => undefined}
          onMenu={() => undefined}
        />,
      );
      expect(html).toContain(winner === 'DRAW' ? 'Remis' : 'Zwycięstwo');
    }
  });

  it('ekran gry z botem po stronie P2', () => {
    const state = doFazy('LOGISTICS');
    const html = render(state, <EkranGry viewPlayer="P1" bot="P2" onMenu={() => undefined} />);
    expect(html).toContain('Komputer');
  });
});
