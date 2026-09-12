import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CardId, FieldId, GameAction, PlayerId, Uid } from '../../silnik/types';
import { card } from '../../silnik/cards';
import { czyAkcjaLegalna, legalFieldsForCard } from '../../silnik/actions';
import { isScout, legalTargets, livingUnitsOf, unitByUid } from '../../silnik/stats';
import { available } from '../../silnik/phases/logistics';
import { bezRozkazu } from '../../silnik/phases/strategy';
import { useGra } from '../GameProvider';
import { widokDla } from '../widok';
import { Plansza } from '../components/Plansza';
import { PasekPrzeciwnika, Reka, Stosy } from '../components/Reka';
import { Dziennik, KasetaFazy, KasetaLicznikow } from '../components/Panel';
import { T, nazwaGracza } from '../teksty';

/**
 * Ekran gry. Komponenty czytają wyłącznie stan i selektory silnika — żaden
 * nie liczy obrażeń ani nie sprawdza legalności samodzielnie (§2.1).
 *
 * Stan interfejsu (zaznaczona karta, podgląd zasięgu) trzymamy osobno od
 * `GameState`, żeby ten serializował się do JSON bez śmieci z UI.
 */

type Props = {
  viewPlayer: PlayerId;
  bot: PlayerId | null;
  onMenu: () => void;
};

type Tryb =
  | { rodzaj: 'BEZCZYNNY' }
  | { rodzaj: 'ROZMIESZCZANIE'; karta: CardId; indeks: number }
  | { rodzaj: 'ROZKAZ'; jednostka: Uid }
  | { rodzaj: 'ZWIAD'; jednostka: Uid }
  | { rodzaj: 'MANEWR'; karta: CardId; indeks: number; jednostka: Uid | null }
  | { rodzaj: 'ZASADZKA'; ambush: Uid };

export function EkranGry({ viewPlayer, bot, onMenu }: Props) {
  const { game, dispatch, inputLocked, efekty, ostatniBlad, wyczyscBlad } = useGra();
  const [tryb, setTryb] = useState<Tryb>({ rodzaj: 'BEZCZYNNY' });
  // Pozycje w ręce, nie identyfikatory — patrz komentarz w Reka.tsx.
  const [doWymiany, setDoWymiany] = useState<number[]>([]);

  const widok = useMemo(() => widokDla(game, viewPlayer), [game, viewPlayer]);
  const ja = viewPlayer;
  const mojRuch = game.activePlayer === ja && bot !== ja;

  // Zmiana fazy albo gracza kasuje zaznaczenia — inaczej zostają wskazania
  // odnoszące się do nieistniejącego już kontekstu.
  useEffect(() => {
    setTryb({ rodzaj: 'BEZCZYNNY' });
    setDoWymiany([]);
    wyczyscBlad();
  }, [game.phase, game.activePlayer, game.turn, wyczyscBlad]);

  const wyslij = useCallback(
    (action: GameAction) => {
      if (inputLocked) return; // kliknięcia w trakcie animacji: ignorowane (§2.1)
      wyczyscBlad();
      dispatch(action);
      setTryb({ rodzaj: 'BEZCZYNNY' });
    },
    [dispatch, inputLocked, wyczyscBlad],
  );

  /* ---------- Podświetlenia ---------- */

  const dostepnePola = useMemo<FieldId[]>(() => {
    if (!mojRuch) return [];
    if (tryb.rodzaj === 'ROZMIESZCZANIE') return legalFieldsForCard(game, ja, tryb.karta);
    return [];
  }, [tryb, game, ja, mojRuch]);

  const celePola = useMemo<FieldId[]>(() => {
    if (!mojRuch) return [];
    if (tryb.rodzaj === 'ROZKAZ' || tryb.rodzaj === 'ZWIAD') {
      const u = unitByUid(game, tryb.jednostka);
      return u ? legalTargets(game, u) : [];
    }
    if (tryb.rodzaj === 'MANEWR' && tryb.jednostka) {
      const u = unitByUid(game, tryb.jednostka);
      if (!u) return [];
      const def = card(tryb.karta);
      if (def.type === 'MANEUVER' && def.effect === 'retarget_one') return legalTargets(game, u);
    }
    if (tryb.rodzaj === 'ZASADZKA') {
      // Zasadzka celuje w jednostki przeciwnika — podświetlamy legalne cele.
      return Object.keys(game.board).filter((f) => {
        const u = game.board[f];
        return (
          u !== null &&
          !u.dead &&
          czyAkcjaLegalna(game, {
            type: 'TRIGGER_AMBUSH',
            player: ja,
            ambush: tryb.ambush,
            unit: u.uid,
          }).ok
        );
      });
    }
    return [];
  }, [tryb, game, ja, mojRuch]);

  const zaznaczonePole = useMemo<FieldId | null>(() => {
    const uid =
      tryb.rodzaj === 'ROZKAZ' || tryb.rodzaj === 'ZWIAD'
        ? tryb.jednostka
        : tryb.rodzaj === 'MANEWR'
          ? tryb.jednostka
          : null;
    if (!uid) return null;
    return unitByUid(game, uid)?.field ?? null;
  }, [tryb, game]);

  /* ---------- Grywalność kart ---------- */

  const grywalnosc = useCallback(
    (id: CardId): { ok: boolean; powod?: string } => {
      if (game.phase === 'DRAW') return { ok: true };
      if (!mojRuch) return { ok: false, powod: T.gra.ruchPrzeciwnika };
      const def = card(id);

      const sprawdz = (a: GameAction): { ok: boolean; powod?: string } => {
        const r = czyAkcjaLegalna(game, a);
        return r.ok ? { ok: true } : { ok: false, powod: r.reason };
      };

      switch (def.type) {
        case 'SUPPLY':
          return sprawdz({ type: 'PLAY_SUPPLY', player: ja, card: id });
        case 'AMBUSH':
          return sprawdz({ type: 'SET_AMBUSH', player: ja, card: id });
        case 'INTERVENTION':
          return sprawdz({ type: 'PLAY_INTERVENTION', player: ja, card: id });
        case 'RECRUIT': {
          if (game.phase !== 'LOGISTICS') return { ok: false, powod: T.fazyOpis.LOGISTICS };
          if (available(game, ja) < def.cost) {
            return { ok: false, powod: `Brakuje zaopatrzenia (koszt ${def.cost}).` };
          }
          const pola = legalFieldsForCard(game, ja, id);
          return pola.length > 0
            ? { ok: true }
            : { ok: false, powod: 'Brak wolnego pola w dozwolonej strefie.' };
        }
        case 'MANEUVER': {
          if (game.phase !== 'MANEUVERS') return { ok: false, powod: T.fazyOpis.MANEUVERS };
          const ktokolwiek = game.orders[ja].some((o) =>
            czyAkcjaLegalna(game, {
              type: 'PLAY_MANEUVER',
              player: ja,
              card: id,
              unit: o.unit,
              target: o.kind === 'ATTACK' ? o.target : undefined,
            }).ok,
          );
          return ktokolwiek
            ? { ok: true }
            : { ok: false, powod: 'Żaden oddział nie nadaje się do tego manewru.' };
        }
      }
    },
    [game, ja, mojRuch],
  );

  /** Karty wskazane do wymiany — rozwinięte z pozycji na identyfikatory. */
  const kartyDoWymiany = useMemo(
    () => doWymiany.map((i) => widok.mojaReka[i]).filter((c): c is CardId => Boolean(c)),
    [doWymiany, widok.mojaReka],
  );

  /* ---------- Kliknięcia ---------- */

  const naKarte = useCallback(
    (id: CardId, indeks: number) => {
      if (inputLocked) return;
      wyczyscBlad();

      if (game.phase === 'DRAW') {
        setDoWymiany((prev) =>
          prev.includes(indeks) ? prev.filter((i) => i !== indeks) : [...prev, indeks],
        );
        return;
      }

      if (!mojRuch) return;
      const def = card(id);

      switch (def.type) {
        case 'SUPPLY':
          wyslij({ type: 'PLAY_SUPPLY', player: ja, card: id });
          break;
        case 'AMBUSH':
          wyslij({ type: 'SET_AMBUSH', player: ja, card: id });
          break;
        case 'INTERVENTION':
          wyslij({ type: 'PLAY_INTERVENTION', player: ja, card: id });
          break;
        case 'RECRUIT':
          setTryb((t) =>
            t.rodzaj === 'ROZMIESZCZANIE' && t.indeks === indeks
              ? { rodzaj: 'BEZCZYNNY' }
              : { rodzaj: 'ROZMIESZCZANIE', karta: id, indeks },
          );
          break;
        case 'MANEUVER':
          setTryb((t) =>
            t.rodzaj === 'MANEWR' && t.indeks === indeks
              ? { rodzaj: 'BEZCZYNNY' }
              : { rodzaj: 'MANEWR', karta: id, indeks, jednostka: null },
          );
          break;
      }
    },
    [game.phase, ja, inputLocked, mojRuch, wyslij, wyczyscBlad],
  );

  const naPole = useCallback(
    (field: FieldId) => {
      if (inputLocked || !mojRuch) return;
      wyczyscBlad();
      const unit = game.board[field];

      switch (tryb.rodzaj) {
        case 'ROZMIESZCZANIE':
          if (dostepnePola.includes(field)) {
            wyslij({ type: 'DEPLOY', player: ja, card: tryb.karta, field });
          }
          return;

        case 'ROZKAZ':
          if (celePola.includes(field)) {
            wyslij({
              type: 'SET_ORDER',
              player: ja,
              order: { unit: tryb.jednostka, kind: 'ATTACK', target: field },
            });
            return;
          }
          // Kliknięcie w inną własną jednostkę przełącza zaznaczenie.
          if (unit && !unit.dead && unit.owner === ja) {
            setTryb({ rodzaj: 'ROZKAZ', jednostka: unit.uid });
            return;
          }
          setTryb({ rodzaj: 'BEZCZYNNY' });
          return;

        case 'MANEWR': {
          const def = card(tryb.karta);
          if (def.type !== 'MANEUVER') return;
          if (!tryb.jednostka) {
            if (unit && !unit.dead && unit.owner === ja) {
              if (def.effect === 'retarget_one') {
                setTryb({ ...tryb, jednostka: unit.uid });
              } else {
                wyslij({ type: 'PLAY_MANEUVER', player: ja, card: tryb.karta, unit: unit.uid });
              }
            }
            return;
          }
          if (celePola.includes(field)) {
            wyslij({
              type: 'PLAY_MANEUVER',
              player: ja,
              card: tryb.karta,
              unit: tryb.jednostka,
              target: field,
            });
          }
          return;
        }

        case 'ZWIAD':
          if (celePola.includes(field)) {
            wyslij({
              type: 'SCOUT_REORDER',
              player: ja,
              order: { unit: tryb.jednostka, kind: 'ATTACK', target: field },
            });
            return;
          }
          setTryb({ rodzaj: 'BEZCZYNNY' });
          return;

        case 'ZASADZKA':
          if (unit && celePola.includes(field)) {
            wyslij({ type: 'TRIGGER_AMBUSH', player: ja, ambush: tryb.ambush, unit: unit.uid });
          }
          return;

        case 'BEZCZYNNY':
          if (game.phase === 'STRATEGY' && unit && !unit.dead && unit.owner === ja) {
            setTryb({ rodzaj: 'ROZKAZ', jednostka: unit.uid });
            return;
          }
          // W manewrach klik we własnego zwiadowcę otwiera darmową korektę rozkazu.
          if (
            game.phase === 'MANEUVERS' &&
            unit &&
            !unit.dead &&
            unit.owner === ja &&
            isScout(game, unit) &&
            !game.players[ja].scoutUsed.includes(unit.uid)
          ) {
            setTryb({ rodzaj: 'ZWIAD', jednostka: unit.uid });
          }
          return;
      }
    },
    [tryb, game, ja, dostepnePola, celePola, inputLocked, mojRuch, wyslij, wyczyscBlad],
  );

  /* ---------- Przyciski fazy ---------- */

  const przyciski = useMemo(() => {
    if (!mojRuch) return null;
    const lista: { etykieta: string; akcja: () => void; glowny?: boolean; aktywny: boolean }[] = [];

    switch (game.phase) {
      case 'DRAW': {
        lista.push({
          etykieta: `${T.gra.wymien} (${kartyDoWymiany.length})`,
          akcja: () => {
            wyslij({ type: 'MULLIGAN', player: ja, cards: kartyDoWymiany });
            setDoWymiany([]);
          },
          aktywny:
            kartyDoWymiany.length > 0 &&
            czyAkcjaLegalna(game, { type: 'MULLIGAN', player: ja, cards: kartyDoWymiany }).ok,
        });
        lista.push({
          etykieta: T.gra.odrzucIWymien,
          akcja: () => {
            wyslij({ type: 'DEEP_MULLIGAN', player: ja, discard: kartyDoWymiany[0] });
            setDoWymiany([]);
          },
          aktywny:
            kartyDoWymiany.length === 1 &&
            czyAkcjaLegalna(game, {
              type: 'DEEP_MULLIGAN',
              player: ja,
              discard: kartyDoWymiany[0],
            }).ok,
        });
        lista.push({
          etykieta: T.gra.zakonczDobieranie,
          akcja: () => wyslij({ type: 'FINISH_DRAW', player: ja }),
          glowny: true,
          aktywny: true,
        });
        break;
      }
      case 'LOGISTICS':
        lista.push({
          etykieta: T.gra.pasuj,
          akcja: () => wyslij({ type: 'PASS_LOGISTICS', player: ja }),
          glowny: true,
          aktywny: czyAkcjaLegalna(game, { type: 'PASS_LOGISTICS', player: ja }).ok,
        });
        break;
      case 'STRATEGY':
        lista.push({
          etykieta: `${T.gra.resztaStoi} (${bezRozkazu(game, ja).length})`,
          akcja: () => wyslij({ type: 'CONFIRM_ORDERS', player: ja }),
          glowny: true,
          aktywny: czyAkcjaLegalna(game, { type: 'CONFIRM_ORDERS', player: ja }).ok,
        });
        break;
      case 'MANEUVERS':
        lista.push({
          etykieta: T.gra.pasuj,
          akcja: () => wyslij({ type: 'PASS_MANEUVERS', player: ja }),
          glowny: true,
          aktywny: czyAkcjaLegalna(game, { type: 'PASS_MANEUVERS', player: ja }).ok,
        });
        break;
      default:
        break;
    }
    return lista;
  }, [game, ja, kartyDoWymiany, mojRuch, wyslij]);

  /* ---------- Rozkazy dla zaznaczonej jednostki ---------- */

  // Ten sam panel obsługuje zwykłą deklarację i darmową korektę zwiadowcy —
  // różni je tylko typ wysyłanej akcji.
  const trybRozkazu =
    tryb.rodzaj === 'ROZKAZ' ? 'SET_ORDER' : tryb.rodzaj === 'ZWIAD' ? 'SCOUT_REORDER' : null;
  const jednostkaRozkazu =
    tryb.rodzaj === 'ROZKAZ' || tryb.rodzaj === 'ZWIAD' ? tryb.jednostka : null;

  const panelRozkazu =
    trybRozkazu && jednostkaRozkazu ? (
      <div className="akcje">
        <div className={`podpowiedz${trybRozkazu === 'SCOUT_REORDER' ? ' zwiad' : ''}`}>
          {trybRozkazu === 'SCOUT_REORDER' ? T.gra.zwiadZmien : T.gra.wybierzCel}
        </div>
        <div className="rzad-przyciskow">
          {(['DEFEND', 'NONE'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() =>
                wyslij(
                  trybRozkazu === 'SET_ORDER'
                    ? { type: 'SET_ORDER', player: ja, order: { unit: jednostkaRozkazu, kind } }
                    : {
                        type: 'SCOUT_REORDER',
                        player: ja,
                        order: { unit: jednostkaRozkazu, kind },
                      },
                )
              }
            >
              {T.rozkazy[kind]}
            </button>
          ))}
          <button type="button" onClick={() => setTryb({ rodzaj: 'BEZCZYNNY' })}>
            {T.gra.anuluj}
          </button>
        </div>
      </div>
    ) : null;

  /* ---------- Zasadzki gotowe do odpalenia ---------- */

  const zasadzkiDoOdpalenia = useMemo(() => {
    if (!mojRuch) return [];
    return game.players[ja].ambushes.filter((a) =>
      Object.keys(game.board).some((f) => {
        const u = game.board[f];
        return (
          u !== null &&
          czyAkcjaLegalna(game, { type: 'TRIGGER_AMBUSH', player: ja, ambush: a.uid, unit: u.uid })
            .ok
        );
      }),
    );
  }, [game, ja, mojRuch]);

  // Zwiadowcy, którzy nie wykorzystali jeszcze korekty rozkazu w tej turze.
  const zwiadowcyGotowi = useMemo(() => {
    if (!mojRuch || game.phase !== 'MANEUVERS') return [];
    return livingUnitsOf(game, ja).filter(
      (u) => isScout(game, u) && !game.players[ja].scoutUsed.includes(u.uid),
    );
  }, [game, ja, mojRuch]);

  const komunikat =
    ostatniBlad ??
    (game.phase === 'COMBAT'
      ? T.fazyOpis.COMBAT
      : !mojRuch
        ? bot === game.activePlayer
          ? T.gra.przeciwnikMysli
          : `${T.gra.ruchPrzeciwnika}: ${nazwaGracza(game.activePlayer, bot)}`
        : tryb.rodzaj === 'ROZMIESZCZANIE'
          ? T.gra.wybierzPole
          : tryb.rodzaj === 'ZASADZKA'
            ? T.gra.wybierzCel
            : tryb.rodzaj === 'MANEWR' && !tryb.jednostka
              ? 'Wskaż własny oddział.'
              : game.phase === 'STRATEGY'
                ? `${T.gra.wydajRozkaz}. ${T.gra.zostalo}: ${bezRozkazu(game, ja).length}.`
                : T.fazyOpis[game.phase]);

  return (
    <div className={`ekran-gry${inputLocked ? ' zablokowane' : ''}`}>
      <div className="kolumna-stolu">
        <PasekPrzeciwnika
          state={game}
          przeciwnik={widok.przeciwnik}
          reka={widok.rekaPrzeciwnika}
          bot={bot}
        />

        {/* Stosy obu graczy flankują blat — plansza dostaje ramę zamiast pustki. */}
        <div className="strefa-gry">
          <Stosy
            state={game}
            gracz={widok.przeciwnik}
            liczbaZasadzek={widok.zasadzkiPrzeciwnika.length}
            bot={bot}
          />

          <Plansza
            state={game}
            widok={widok}
            dostepnePola={dostepnePola}
            celePola={celePola}
            zaznaczonePole={zaznaczonePole}
            uderzone={efekty.uderzone}
            raport={efekty.raport}
            onPole={naPole}
          />

          <Stosy state={game} gracz={ja} liczbaZasadzek={widok.mojeZasadzki.length} bot={bot} />
        </div>

        <Reka
          karty={widok.mojaReka}
          wybranyIndeks={
            tryb.rodzaj === 'ROZMIESZCZANIE' || tryb.rodzaj === 'MANEWR' ? tryb.indeks : null
          }
          doWymiany={doWymiany}
          grywalnosc={grywalnosc}
          onKarta={naKarte}
          aktywny={!inputLocked && mojRuch}
        />
      </div>

      <div className="panel">
        <KasetaFazy state={game} bot={bot} />
        <KasetaLicznikow state={game} gracz={ja} />
        <Dziennik wpisy={widok.dziennik} bot={bot} />

        <div className="akcje">
          <div className={`podpowiedz${ostatniBlad ? ' blad' : ''}`}>{komunikat}</div>

          {game.phase === 'MANEUVERS' && zwiadowcyGotowi.length > 0 && (
            <div className="podpowiedz zwiad">
              {T.gra.zwiadowca} ({zwiadowcyGotowi.length})
            </div>
          )}

          {zasadzkiDoOdpalenia.length > 0 && tryb.rodzaj !== 'ZASADZKA' && (
            <div className="rzad-przyciskow">
              {zasadzkiDoOdpalenia.map((a) => (
                <button
                  key={a.uid}
                  type="button"
                  className="zagrozenie"
                  onClick={() => setTryb({ rodzaj: 'ZASADZKA', ambush: a.uid })}
                >
                  {card(a.cardId).name}
                </button>
              ))}
            </div>
          )}

          {panelRozkazu}

          {przyciski && przyciski.length > 0 && (
            <div className="rzad-przyciskow">
              {przyciski.map((p) => (
                <button
                  key={p.etykieta}
                  type="button"
                  className={p.glowny ? 'glowny' : undefined}
                  disabled={!p.aktywny || inputLocked}
                  onClick={p.akcja}
                >
                  {p.etykieta}
                </button>
              ))}
            </div>
          )}

          <div className="rzad-przyciskow">
            <button type="button" onClick={onMenu}>
              {T.gra.menu}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
