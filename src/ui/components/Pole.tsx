import { memo } from 'react';
import type { FieldId, GameState, Order, Unit } from '../../silnik/types';
import { card } from '../../silnik/cards';
import { zoneOf } from '../../silnik/board';
import { baseDefense, baseOffense, effDefense, effOffense } from '../../silnik/stats';
import { assetUrl } from '../../media/images';
import { useObrazek } from '../../media/useObrazek';
import { T } from '../teksty';
import { SymbolReguly } from './Symbol';

/**
 * Pole planszy z żetonem jednostki (§5).
 * Klucz komponentu to `uid` jednostki, nigdy indeks — inaczej animacje
 * przy usuwaniu martwych gubiłyby się (§2.1).
 */

type Props = {
  field: FieldId;
  unit: Unit | null;
  state: GameState;
  /** rozkaz oddziału — `null`, gdy jeszcze go nie wydano */
  order: Order | null;
  dostepne?: boolean;
  cel?: boolean;
  zaznaczone?: boolean;
  uderzone?: boolean;
  obrazenia?: number | null;
  moje: boolean;
  onClick?: () => void;
};

const ZNAK_ROZKAZU: Record<Order['kind'], string> = {
  ATTACK: '↑',
  DEFEND: '⛊',
  NONE: '·',
};

export const Pole = memo(function Pole({
  field,
  unit,
  state,
  order,
  dostepne = false,
  cel = false,
  zaznaczone = false,
  uderzone = false,
  obrazenia = null,
  moje,
  onClick,
}: Props) {
  const strefa = zoneOf(field);
  const tlo = useObrazek(assetUrl(`board/field_${strefa.toLowerCase()}.webp`));

  const klasy = ['pole', `strefa-${strefa}`];
  if (dostepne) klasy.push('dostepne');
  if (cel) klasy.push('cel');
  if (zaznaczone) klasy.push('zaznaczone');
  if (uderzone) klasy.push('uderzone');

  const klikalne = Boolean(onClick) && (dostepne || cel || zaznaczone || unit !== null);

  return (
    <button
      type="button"
      className={klasy.join(' ')}
      onClick={klikalne ? onClick : undefined}
      disabled={!klikalne}
      style={tlo ? { backgroundImage: `url("${tlo}")` } : undefined}
      title={`${field} — ${T.strefy[strefa]}`}
    >
      <span className="etykieta-pola">{field.slice(3)}</span>
      {!unit && <span className="nazwa-strefy">{T.strefy[strefa]}</span>}

      {unit && <Zeton key={unit.uid} unit={unit} state={state} order={order} moje={moje} />}

      {obrazenia !== null && obrazenia > 0 && (
        <span className="dymek-obrazen" style={{ left: '50%', top: '30%' }}>
          −{obrazenia}
        </span>
      )}
    </button>
  );
});

function Zeton({
  unit,
  state,
  order,
  moje,
}: {
  unit: Unit;
  state: GameState;
  order: Order | null;
  moje: boolean;
}) {
  const def = card(unit.cardId);
  const grafika = useObrazek(assetUrl(`board/tokens/${unit.cardId}.webp`));

  // Statystyki zawsze przez funkcje efektywne — nigdy wprost z karty (§4.3).
  const ofn = effOffense(state, unit);
  const def_ = effDefense(state, unit);
  const ofnZmieniona = ofn !== baseOffense(unit);
  const defZmieniona = def_ !== baseDefense(unit);

  const klasy = ['zeton'];
  if (!moje) klasy.push('wrogi');
  if (unit.dead) klasy.push('martwy');

  return (
    <span className={klasy.join(' ')}>
      {grafika && <span className="ilustracja" style={{ backgroundImage: `url("${grafika}")` }} />}

      {order && (
        <span
          className={`znacznik-rozkazu ${order.kind}`}
          title={T.rozkazy[order.kind]}
        >
          {ZNAK_ROZKAZU[order.kind]}
        </span>
      )}

      <span className="nazwa">{def.name}</span>

      <span className="symbole">
        {def.rules.map((r) => (
          <SymbolReguly key={r} id={r} />
        ))}
      </span>

      <span className="statystyki">
        <span className={`stat ofn${ofnZmieniona ? ' zmodyfikowany' : ''}`} title={T.gra.ofensywa}>
          {ofn}
        </span>
        <span className={`stat def${defZmieniona ? ' zmodyfikowany' : ''}`} title={T.gra.defensywa}>
          {def_}
        </span>
      </span>
    </span>
  );
}
