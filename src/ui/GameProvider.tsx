import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';
import type { CombatReport, FieldId, GameAction, GameEvent, GameState } from '../silnik/types';
import { reduce } from '../silnik/reducer';
import { createGame } from '../silnik/state';
import { audio, type SfxKey } from '../media/audio';

/**
 * Spięcie silnika z Reactem (§2.1).
 * Jeden `useReducer` na górze drzewa; reducer Reacta opakowuje czysty silnik
 * i odkłada zdarzenia do kolejki animacji. Komponenty czytają tylko stan
 * i selektory — nigdy nie liczą zasad samodzielnie.
 */

type Wrapped = { game: GameState; queue: GameEvent[] };

type WrappedAction =
  | { kind: 'silnik'; action: GameAction }
  | { kind: 'zdjecie' }
  | { kind: 'reset'; seed: number };

function wrapped(prev: Wrapped, action: WrappedAction): Wrapped {
  switch (action.kind) {
    case 'silnik': {
      const { state, events } = reduce(prev.game, action.action); // czysty silnik, zero Reacta
      return { game: state, queue: [...prev.queue, ...events] };
    }
    case 'zdjecie':
      return { game: prev.game, queue: prev.queue.slice(1) };
    case 'reset':
      return { game: createGame(action.seed), queue: [] };
  }
}

/** Efekty, które warstwa widoku rysuje na czas trwania animacji. */
export type Efekty = {
  uderzone: FieldId[];
  raport: CombatReport | null;
  rzutKostka: { p1: number; p2: number } | null;
};

type Kontekst = {
  game: GameState;
  dispatch: (action: GameAction) => void;
  nowaGra: (seed: number) => void;
  inputLocked: boolean;
  efekty: Efekty;
  ostatniBlad: string | null;
  wyczyscBlad: () => void;
};

const GameContext = createContext<Kontekst | null>(null);

/** Mapowanie zdarzeń silnika na dźwięki — manifest, nie `switch` w logice (§9). */
const DZWIEKI: Partial<Record<GameEvent['type'], SfxKey>> = {
  DICE_ROLL: 'DICE_ROLL',
  CARD_DRAWN: 'CARD_DRAWN',
  CARD_PLAYED: 'CARD_PLAYED',
  UNIT_DEPLOYED: 'UNIT_DEPLOYED',
  SUPPLY_SPENT: 'SUPPLY_SPENT',
  SUPPLY_GAINED: 'SUPPLY_GAINED',
  AMBUSH_TRIGGERED: 'AMBUSH_TRIGGERED',
  ORDERS_REVEALED: 'ORDERS_REVEALED',
  COMBAT_START: 'COMBAT_START',
  UNIT_DIED: 'UNIT_DIED',
  PHASE_CHANGED: 'PHASE_CHANGED',
  ILLEGAL_ACTION: 'ILLEGAL_ACTION',
};

const REDUKCJA_RUCHU =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Czas trwania animacji zdarzenia — sekwencja fazy walki z §10.2. */
function czasTrwania(event: GameEvent): number {
  if (REDUKCJA_RUCHU) return 0;
  switch (event.type) {
    case 'ORDERS_REVEALED':
      return 400;
    case 'COMBAT_START':
      return 600 + Math.min(event.report.arrows.length, 8) * 60 + 300;
    case 'UNIT_DIED':
      return 500;
    case 'DICE_ROLL':
      return 900;
    case 'UNIT_DEPLOYED':
      return 220;
    case 'GAME_WON':
      return 400;
    case 'PHASE_CHANGED':
    case 'TURN_CHANGED':
      return 160;
    default:
      return 120;
  }
}

export function GameProvider({
  seed,
  stanPoczatkowy,
  children,
}: {
  seed: number;
  /** Gotowy stan zamiast świeżego rozdania — wczytana partia albo test. */
  stanPoczatkowy?: GameState;
  children: ReactNode;
}) {
  const [stan, wyslij] = useReducer(wrapped, seed, (s) => ({
    game: stanPoczatkowy ?? createGame(s),
    queue: [],
  }));
  const [inputLocked, setInputLocked] = useState(false);
  const [efekty, setEfekty] = useState<Efekty>({ uderzone: [], raport: null, rzutKostka: null });
  const [ostatniBlad, setOstatniBlad] = useState<string | null>(null);

  const dispatch = useCallback((action: GameAction) => {
    audio.unlock(); // muzyka rusza dopiero po pierwszej interakcji (§9)
    wyslij({ kind: 'silnik', action });
  }, []);

  const nowaGra = useCallback((s: number) => {
    setEfekty({ uderzone: [], raport: null, rzutKostka: null });
    setOstatniBlad(null);
    wyslij({ kind: 'reset', seed: s });
  }, []);

  /**
   * AnimationRunner — jeden `useEffect`. Zdejmuje zdarzenia po kolei, odtwarza
   * dźwięk i animację, a na czas odtwarzania trzyma `inputLocked`. Kliknięcia
   * w tym czasie są ignorowane, nie kolejkowane (§2.1).
   */
  useEffect(() => {
    if (stan.queue.length === 0) {
      setInputLocked(false);
      return;
    }
    const event = stan.queue[0];
    setInputLocked(true);

    const klucz = DZWIEKI[event.type];
    if (klucz) audio.playSfx(klucz);

    switch (event.type) {
      case 'ILLEGAL_ACTION':
        setOstatniBlad(event.reason);
        break;
      case 'COMBAT_START':
        setEfekty((e) => ({
          ...e,
          raport: event.report,
          uderzone: event.report.arrows.map((a) => a.to),
        }));
        break;
      case 'DICE_ROLL':
        setEfekty((e) => ({ ...e, rzutKostka: { p1: event.p1, p2: event.p2 } }));
        break;
      case 'GAME_WON':
        audio.playSfx(event.winner === 'DRAW' ? 'GAME_LOST' : 'GAME_WON');
        break;
      case 'TURN_CHANGED':
        setEfekty({ uderzone: [], raport: null, rzutKostka: null });
        break;
      default:
        break;
    }

    const t = window.setTimeout(() => wyslij({ kind: 'zdjecie' }), czasTrwania(event));
    return () => window.clearTimeout(t);
  }, [stan.queue]);

  // Po wygaszeniu kolejki zamykamy fazę walki — UI zdążyło pokazać zgony.
  useEffect(() => {
    if (stan.queue.length > 0) return;
    if (stan.game.phase !== 'COMBAT') return;
    const t = window.setTimeout(() => {
      wyslij({ kind: 'silnik', action: { type: 'RESOLVE_COMBAT' } });
    }, REDUKCJA_RUCHU ? 0 : 700);
    return () => window.clearTimeout(t);
  }, [stan.queue.length, stan.game.phase]);

  const wyczyscBlad = useCallback(() => setOstatniBlad(null), []);

  const wartosc = useMemo<Kontekst>(
    () => ({
      game: stan.game,
      dispatch,
      nowaGra,
      inputLocked,
      efekty,
      ostatniBlad,
      wyczyscBlad,
    }),
    [stan.game, dispatch, nowaGra, inputLocked, efekty, ostatniBlad, wyczyscBlad],
  );

  return <GameContext.Provider value={wartosc}>{children}</GameContext.Provider>;
}

export function useGra(): Kontekst {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGra poza GameProvider');
  return ctx;
}
