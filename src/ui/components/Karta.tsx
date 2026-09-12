import { memo } from 'react';
import type { CardId } from '../../silnik/types';
import { card } from '../../silnik/cards';
import { cardArtUrl, placeholderStyle } from '../../media/images';
import { useObrazek } from '../../media/useObrazek';
import { T } from '../teksty';
import { SymbolReguly } from './Symbol';

/**
 * Awers karty (§8.2). Statystyki NIE są wypalone w grafice — rysujemy je
 * warstwą DOM nad ilustracją, więc liczby są ostre w każdej skali,
 * a modyfikatory da się pokazać na żywo.
 */

type Props = {
  id: CardId;
  wybrana?: boolean;
  doWymiany?: boolean;
  grywalna?: boolean;
  powod?: string;
  onClick?: () => void;
};

export const Karta = memo(function Karta({
  id,
  wybrana = false,
  doWymiany = false,
  grywalna = true,
  powod,
  onClick,
}: Props) {
  const def = card(id);
  const grafika = useObrazek(cardArtUrl(def));

  const klasy = ['karta'];
  if (wybrana) klasy.push('wybrana');
  if (doWymiany) klasy.push('zaznaczona-do-wymiany');
  if (!grywalna) klasy.push('niegrywalna');

  const koszt =
    def.type === 'RECRUIT' || def.type === 'AMBUSH' ? def.cost : null;

  return (
    <button
      type="button"
      className={klasy.join(' ')}
      onClick={onClick}
      disabled={!onClick}
      title={powod ?? `${def.name} — ${T.typy[def.type]}`}
    >
      <div className="pas-gorny">
        {koszt !== null && <span className="koszt">{koszt}</span>}
        <span className="nazwa">{def.name}</span>
      </div>

      <div className="pole-ilustracji">
        <div
          className="ilustracja"
          style={
            grafika
              ? { backgroundImage: `url("${grafika}")` }
              : placeholderStyle(def.id, def.type)
          }
        />
        <span className="typ">{T.typy[def.type]}</span>
      </div>

      <div className="tekst">{def.text}</div>

      <div className="pas-dolny">
        {def.type === 'RECRUIT' ? (
          <>
            <span className="stat ofn" title={T.gra.ofensywa}>
              {def.offense}
            </span>
            <span className="symbole">
              {def.rules.map((r) => (
                <SymbolReguly key={r} id={r} />
              ))}
            </span>
            <span className="stat def" title={T.gra.defensywa}>
              {def.defense}
            </span>
          </>
        ) : def.type === 'SUPPLY' ? (
          <span className="wartosc-zaopatrzenia">+{def.supply}</span>
        ) : (
          <span className="symbole">
            {def.rules.length > 0 ? (
              def.rules.map((r) => <SymbolReguly key={r} id={r} />)
            ) : (
              <span className="etykieta-typu">{T.typy[def.type].toUpperCase()}</span>
            )}
          </span>
        )}
      </div>
    </button>
  );
});
