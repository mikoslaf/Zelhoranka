import { memo } from 'react';
import type { CardId, GameState, PlayerId } from '../../silnik/types';
import { card } from '../../silnik/cards';
import { Karta } from './Karta';
import { T, nazwaGracza } from '../teksty';

/**
 * Ręka gracza (§5) — karty trzymane nad stołem, w dolnej krawędzi ekranu.
 * Ręka przeciwnika to wyłącznie rewersy; liczba kart jest jawna, treść nie.
 */

/*
 * Zaznaczenie identyfikujemy POZYCJĄ w ręce, nie identyfikatorem karty.
 * Ręka bez trudu mieści kilka kopii tej samej karty (np. cztery „Piechoty
 * zelhorskie"), a porównanie po `id` podświetlałoby je wszystkie naraz.
 */
type Props = {
  karty: CardId[];
  wybranyIndeks: number | null;
  doWymiany: number[];
  grywalnosc: (id: CardId) => { ok: boolean; powod?: string };
  onKarta: (id: CardId, indeks: number) => void;
  aktywny: boolean;
};

export const Reka = memo(function Reka({
  karty,
  wybranyIndeks,
  doWymiany,
  grywalnosc,
  onKarta,
  aktywny,
}: Props) {
  return (
    <div className="reka">
      <div className="naglowek">
        <span>{T.gra.reka}</span>
        <span>{karty.length}</span>
      </div>
      <div className={`karty${karty.length > 7 ? ' ciasno' : ''}`}>
        {karty.map((id, i) => {
          const g = grywalnosc(id);
          return (
            <Karta
              // Karty się powtarzają (kopie), więc klucz musi zawierać pozycję.
              key={`${id}-${i}`}
              id={id}
              wybrana={wybranyIndeks === i}
              doWymiany={doWymiany.includes(i)}
              grywalna={g.ok}
              powod={g.ok ? undefined : g.powod}
              onClick={aktywny ? () => onKarta(id, i) : undefined}
            />
          );
        })}
        {karty.length === 0 && <span style={{ alignSelf: 'center' }}>—</span>}
      </div>
    </div>
  );
});

/**
 * Pasek nad planszą: kto siedzi naprzeciwko i CO trzyma na ręce.
 * Karty przeciwnika są jawne, więc pokazujemy ich nazwy zamiast rewersów —
 * to jedyny sposób, żeby gracz mógł faktycznie planować pod cudzą rękę.
 */
export const PasekPrzeciwnika = memo(function PasekPrzeciwnika({
  state,
  przeciwnik,
  reka,
  bot,
}: {
  state: GameState;
  przeciwnik: PlayerId;
  reka: CardId[];
  bot: PlayerId | null;
}) {
  const ps = state.players[przeciwnik];
  const spasowal =
    (state.phase === 'LOGISTICS' && ps.passedLogistics) ||
    (state.phase === 'MANEUVERS' && ps.passedManeuvers);

  return (
    <div className="pasek-przeciwnika">
      <span className="etykieta">{nazwaGracza(przeciwnik, bot)}</span>
      <div className="reka-jawna">
        {reka.map((id, i) => (
          <span key={`${id}-${i}`} className={`mini-karta typ-${card(id).type}`}>
            {card(id).name}
          </span>
        ))}
        {reka.length === 0 && <span className="stan">pusta ręka</span>}
      </div>
      <span style={{ flex: 1 }} />
      {spasowal && <span className="stan pilne">{T.gra.spasowal}</span>}
      {state.activePlayer === przeciwnik && !spasowal && (
        <span className="stan pilne">{T.gra.twojRuch.toLowerCase()}</span>
      )}
    </div>
  );
});

/**
 * Stosy kart leżące obok stołu. Zagospodarowują przestrzeń po bokach planszy
 * i dają blatowi ramę — bez nich plansza ginie pośrodku pustego sukna.
 */
export const Stosy = memo(function Stosy({
  state,
  gracz,
  liczbaZasadzek,
  bot,
}: {
  state: GameState;
  gracz: PlayerId;
  liczbaZasadzek: number;
  bot: PlayerId | null;
}) {
  const ps = state.players[gracz];
  const pozycje: { klucz: string; ile: number; opis: string; wariant: string }[] = [
    { klucz: 'talia', ile: ps.deck.length, opis: T.gra.talia, wariant: '' },
    { klucz: 'odrzucone', ile: ps.discard.length, opis: T.gra.odrzucone, wariant: 'odrzucone' },
    { klucz: 'zasadzki', ile: liczbaZasadzek, opis: T.gra.zasadzki, wariant: 'zasadzki' },
  ];

  return (
    <div className="stosy">
      <div className="naglowek-stosow">{nazwaGracza(gracz, bot)}</div>
      {pozycje.map((p) => (
        <div key={p.klucz} className="stos">
          <span
            className={`plecek ${p.wariant} ${p.ile === 0 ? 'pusty' : ''}`.trim()}
            aria-hidden="true"
          />
          <span className="opis-stosu">
            <span className="wartosc">{p.ile}</span>
            <span className="opis">{p.opis}</span>
          </span>
        </div>
      ))}
    </div>
  );
});
