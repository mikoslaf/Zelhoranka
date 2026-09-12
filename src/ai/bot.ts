import type {
  FieldId,
  GameAction,
  GameState,
  Order,
  PlayerId,
  Uid,
} from '../silnik/types';
import { cloneState, supplyLimit } from '../silnik/state';
import { czyAkcjaLegalna, legalActions } from '../silnik/actions';
import { card } from '../silnik/cards';
import { effDefense, effOffense, legalTargets, livingUnitsOf, unitByUid } from '../silnik/stats';
import { enterCombat } from '../silnik/phases/combat';
import { mulliganAllowance } from '../silnik/phases/draw';
import { breakthroughScore } from '../silnik/victory';
import { COLUMNS, fieldId, opponentOf, parseField } from '../silnik/board';
import { createRng, nextFloat } from '../silnik/rng';
import type { Column } from '../silnik/types';

/**
 * Przeciwnik komputerowy (§11.2). Heurystyka, bez drzewa gry.
 *
 * Bot nie dotyka silnika i nie zagląda w ukryte informacje „po cichu":
 * korzysta z `legalActions()` tak samo jak interfejs, a rozkazy przeciwnika
 * ZGADUJE własnym modelem (`zgadnijRozkazyWroga`) zamiast je podejrzeć.
 */

export type Trudnosc = 'LATWY' | 'SREDNI' | 'TRUDNY';

const SZUM: Record<Trudnosc, number> = {
  LATWY: 6,
  SREDNI: 2,
  TRUDNY: 0.4,
};

/** Deterministyczny generator bota — nie rusza `state.rng`. */
function rngBota(state: GameState, sol: number) {
  return createRng((state.turn * 7919 + state.uidCounter * 104729 + sol) >>> 0);
}

function szum(state: GameState, trudnosc: Trudnosc, sol: number): number {
  const { value } = nextFloat(rngBota(state, sol));
  return (value - 0.5) * 2 * SZUM[trudnosc];
}

/* ---------- Ocena pozycji ---------- */

/** Siła kolumny: suma ofensywy i defensywy jednostek gracza w tej kolumnie. */
function silaKolumny(state: GameState, player: PlayerId, c: Column): number {
  let suma = 0;
  for (const row of ['F', 'R'] as const) {
    const u = state.board[fieldId(player, row, c)];
    if (u && !u.dead) suma += effOffense(state, u) + effDefense(state, u);
  }
  return suma;
}

function ocenaPozycji(state: GameState, player: PlayerId): number {
  const wrog = opponentOf(player);
  let wynik = 0;
  for (const u of livingUnitsOf(state, player)) wynik += effOffense(state, u) + effDefense(state, u);
  for (const u of livingUnitsOf(state, wrog)) wynik -= effOffense(state, u) + effDefense(state, u);
  // Premia za otwieranie kolumny — to jest warunek zwycięstwa.
  wynik += breakthroughScore(state, player) * 1.5;
  wynik -= breakthroughScore(state, wrog) * 1.5;
  return wynik;
}

/**
 * Model rozkazów przeciwnika.
 *
 * Po przejściu na jawną, naprzemienną deklarację część rozkazów wroga jest
 * już ZNANA — i bot ma prawo z nich korzystać, bo widzi je tak samo jak
 * człowiek. Zgadujemy wyłącznie oddziały, które jeszcze się nie zadeklarowały:
 * każdy uderza w najgroźniejszy cel w zasięgu, a bez celu przechodzi do obrony.
 */
function zgadnijRozkazyWroga(state: GameState, wrog: PlayerId): Order[] {
  const znane = new Map<string, Order>();
  for (const o of state.orders[wrog]) znane.set(o.unit, o);

  return livingUnitsOf(state, wrog).map((u) => {
    const juzWiadomo = znane.get(u.uid);
    if (juzWiadomo) return juzWiadomo;

    const cele = legalTargets(state, u);
    if (cele.length === 0) return { unit: u.uid, kind: 'DEFEND' } as Order;
    let najlepszy = cele[0];
    let najlepszaWartosc = -Infinity;
    for (const c of cele) {
      const ofiara = state.board[c];
      if (!ofiara) continue;
      const w = effOffense(state, ofiara) * 2 - effDefense(state, ofiara);
      if (w > najlepszaWartosc) {
        najlepszaWartosc = w;
        najlepszy = c;
      }
    }
    return { unit: u.uid, kind: 'ATTACK', target: najlepszy } as Order;
  });
}

/**
 * Symulacja starcia na kopii stanu. Silnik jest czysty, więc to darmowa
 * funkcja — dokładnie jak zakłada §11.2.
 */
function symuluj(state: GameState, player: PlayerId, moje: Order[]): number {
  const kopia = cloneState(state);
  const wrog = opponentOf(player);
  kopia.orders[player] = moje;
  kopia.orders[wrog] = zgadnijRozkazyWroga(kopia, wrog);
  kopia.phase = 'MANEUVERS';
  kopia.revealed = true;

  const { state: po } = enterCombat(kopia);
  let bilans = 0;
  for (const d of po.lastCombat?.deaths ?? []) {
    const u = unitByUid(po, d.uid);
    const waga = u ? effOffense(kopia, u) + effDefense(kopia, u) : 4;
    bilans += d.owner === player ? -waga : waga;
  }
  // Otwarcie kolumny liczy się nawet bez zabójstwa.
  bilans += (breakthroughScore(po, player) - breakthroughScore(kopia, player)) * 1.2;
  // Delikatna korekta o ogólną wartość pozycji po starciu.
  bilans += ocenaPozycji(po, player) * 0.05;
  return bilans;
}

/* ---------- Wybór akcji w poszczególnych fazach ---------- */

function akcjaDobierania(state: GameState, player: PlayerId): GameAction {
  const reka = state.players[player].hand;
  const limit = supplyLimit(state.turn);
  const maRekrutow = reka.some((id) => card(id).type === 'RECRUIT');
  const maJednostki = livingUnitsOf(state, player).length > 0;

  /*
   * Wymiana to jedyny sposób, w jaki bot może ruszyć zablokowaną rękę.
   * Bez tego ręka pełna samego zaopatrzenia znaczy „pas w każdej turze",
   * talia przestaje schodzić i partia nigdy się nie kończy.
   */
  const bezuzyteczne = reka.filter((id) => {
    const c = card(id);
    switch (c.type) {
      case 'RECRUIT':
        return c.cost > limit; // i tak nie do opłacenia w tej turze
      case 'MANEUVER':
        return !maJednostki; // nie ma czym manewrować
      case 'SUPPLY':
        return !maRekrutow; // zaopatrzenie bez celu, na który je wydać
      default:
        return false;
    }
  });

  const ile = Math.min(bezuzyteczne.length, mulliganAllowance(state, player));
  if (ile > 0) {
    const akcja: GameAction = { type: 'MULLIGAN', player, cards: bezuzyteczne.slice(0, ile) };
    if (czyAkcjaLegalna(state, akcja).ok) return akcja;
  }
  return { type: 'FINISH_DRAW', player };
}

function akcjaLogistyki(state: GameState, player: PlayerId, trudnosc: Trudnosc): GameAction {
  const dostepne = legalActions(state, player);
  const wrog = opponentOf(player);

  // 1. Dokładaj zaopatrzenie, jeśli w ręce czeka droższy werbunek niż pula.
  const pula = state.players[player].supplyPool - state.players[player].supplySpent;
  const najdrozszy = Math.max(
    0,
    ...state.players[player].hand.map((id) => {
      const c = card(id);
      return c.type === 'RECRUIT' ? c.cost : 0;
    }),
  );
  if (najdrozszy > pula) {
    const supply = dostepne.find((a) => a.type === 'PLAY_SUPPLY');
    if (supply) return supply;
  }

  // 2. Rozmieszczaj tam, gdzie własna kolumna jest najsłabsza względem wrogiej.
  const deploye = dostepne.filter((a) => a.type === 'DEPLOY');
  if (deploye.length > 0) {
    let najlepsza: GameAction = deploye[0];
    let najlepszyWynik = -Infinity;
    for (const a of deploye) {
      if (a.type !== 'DEPLOY') continue;
      const { column } = parseField(a.field);
      const przewaga = silaKolumny(state, wrog, column) - silaKolumny(state, player, column);
      const c = card(a.card);
      const jakosc = c.type === 'RECRUIT' ? c.offense + c.defense - c.cost : 0;
      const wynik = przewaga * 1.5 + jakosc + szum(state, trudnosc, a.field.charCodeAt(4));
      if (wynik > najlepszyWynik) {
        najlepszyWynik = wynik;
        najlepsza = a;
      }
    }
    return najlepsza;
  }

  // 3. Zasadzki i interwencje są tanie — zagrywamy, gdy nie ma co rozstawiać.
  const zasadzka = dostepne.find((a) => a.type === 'SET_AMBUSH');
  if (zasadzka) return zasadzka;
  const interwencja = dostepne.find((a) => a.type === 'PLAY_INTERVENTION');
  if (interwencja) return interwencja;

  return { type: 'PASS_LOGISTICS', player };
}

function akcjaStrategii(state: GameState, player: PlayerId, trudnosc: Trudnosc): GameAction {
  const jednostki = livingUnitsOf(state, player);
  const przypisane = new Map<Uid, Order>();
  for (const o of state.orders[player]) przypisane.set(o.unit, o);

  // Pierwsza jednostka bez decyzji — resztę bierzemy z dotychczasowych rozkazów.
  const doDecyzji = jednostki.find((u) => (przypisane.get(u.uid)?.kind ?? 'NONE') === 'NONE');
  if (!doDecyzji) return { type: 'CONFIRM_ORDERS', player };

  const bazowe = (): Order[] => jednostki.map((u) => przypisane.get(u.uid) ?? { unit: u.uid, kind: 'NONE' });

  const kandydaci: Order[] = [
    { unit: doDecyzji.uid, kind: 'DEFEND' },
    ...legalTargets(state, doDecyzji).map(
      (t): Order => ({ unit: doDecyzji.uid, kind: 'ATTACK', target: t as FieldId }),
    ),
  ];
  // „Postój" tylko wtedy, gdy nie ma nic lepszego — inaczej bot stoi bezczynnie.
  if (kandydaci.length === 0) {
    return { type: 'SET_ORDER', player, order: { unit: doDecyzji.uid, kind: 'NONE' } };
  }

  let najlepszy = kandydaci[0];
  let najlepszyWynik = -Infinity;
  kandydaci.forEach((k, i) => {
    const zestaw = bazowe().map((o) => (o.unit === k.unit ? k : o));
    const wynik = symuluj(state, player, zestaw) + szum(state, trudnosc, i * 31 + 5);
    if (wynik > najlepszyWynik) {
      najlepszyWynik = wynik;
      najlepszy = k;
    }
  });

  return { type: 'SET_ORDER', player, order: najlepszy };
}

function akcjaManewrow(state: GameState, player: PlayerId, trudnosc: Trudnosc): GameAction {
  const dostepne = legalActions(state, player);
  const manewry = dostepne.filter((a) => a.type === 'PLAY_MANEUVER');
  const zwiady = dostepne.filter((a) => a.type === 'SCOUT_REORDER');
  const zasadzki = dostepne.filter((a) => a.type === 'TRIGGER_AMBUSH');

  const bazowy = symuluj(state, player, state.orders[player]);
  let najlepsza: GameAction = { type: 'PASS_MANEUVERS', player };
  let najlepszyWynik = bazowy;

  [...manewry, ...zwiady, ...zasadzki].forEach((a, i) => {
    // Manewry zmieniają deklaracje — oceniamy je tą samą symulacją.
    const kopia = cloneState(state);
    const probne =
      a.type === 'PLAY_MANEUVER' && a.target
        ? state.orders[player].map((o) =>
            o.unit === a.unit ? ({ unit: a.unit, kind: 'ATTACK', target: a.target! } as Order) : o,
          )
        : a.type === 'SCOUT_REORDER'
          ? state.orders[player].map((o) => (o.unit === a.order.unit ? a.order : o))
          : state.orders[player];
    const wynik = symuluj(kopia, player, probne) + 0.5 + szum(state, trudnosc, i * 17 + 9);
    if (wynik > najlepszyWynik) {
      najlepszyWynik = wynik;
      najlepsza = a;
    }
  });

  return najlepsza;
}

/**
 * Jedna decyzja bota. Zwraca `null`, gdy nie ma nic do zrobienia —
 * wywołujący (hook w UI) po prostu czeka.
 */
export function wybierzAkcje(
  state: GameState,
  player: PlayerId,
  trudnosc: Trudnosc,
): GameAction | null {
  if (state.winner !== null) return null;
  if (state.activePlayer !== player && state.phase !== 'COMBAT') return null;

  switch (state.phase) {
    case 'SETUP':
      return { type: 'ROLL_INITIATIVE' };
    case 'DRAW':
      return akcjaDobierania(state, player);
    case 'LOGISTICS':
      return akcjaLogistyki(state, player, trudnosc);
    case 'STRATEGY':
      return akcjaStrategii(state, player, trudnosc);
    case 'MANEUVERS':
      return akcjaManewrow(state, player, trudnosc);
    case 'COMBAT':
    case 'END':
      return null;
  }
}

/** Pomocnicze — używane w testach bota. */
export { silaKolumny, zgadnijRozkazyWroga, COLUMNS };
