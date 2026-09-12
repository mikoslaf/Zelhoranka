import { Fragment, useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { CombatReport, FieldId, GameState, PlayerId } from '../../silnik/types';
import { Pole } from './Pole';
import { rozkazDla, type WidokGracza } from '../widok';
import { T } from '../teksty';

/**
 * Plansza 4×4 na gracza, widok prostopadle z góry, rysowana płasko (§5, §10.3).
 * Zero perspektywy, zero rotacji 3D — dozwolone tylko przesunięcia, skala,
 * obrót w płaszczyźnie ekranu i przezroczystość.
 */

type Props = {
  state: GameState;
  widok: WidokGracza;
  dostepnePola: FieldId[];
  celePola: FieldId[];
  zaznaczonePole: FieldId | null;
  uderzone: FieldId[];
  raport: CombatReport | null;
  onPole: (field: FieldId) => void;
};

type Strzalka = {
  klucz: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  moja: boolean;
  opoznienie: number;
};

export function Plansza({
  state,
  widok,
  dostepnePola,
  celePola,
  zaznaczonePole,
  uderzone,
  raport,
  onPole,
}: Props) {
  const kontenerRef = useRef<HTMLDivElement>(null);
  const polaRef = useRef(new Map<FieldId, HTMLElement>());
  const [strzalki, setStrzalki] = useState<Strzalka[]>([]);

  const zapiszPole = useCallback((field: FieldId, el: HTMLElement | null) => {
    if (el) polaRef.current.set(field, el);
    else polaRef.current.delete(field);
  }, []);

  /**
   * Strzałki ataków liczymy z rzeczywistych pozycji pól, nie ze sztywnych
   * współrzędnych — układ może się przeskalować razem ze sceną.
   */
  useLayoutEffect(() => {
    if (!raport || raport.arrows.length === 0) {
      setStrzalki([]);
      return;
    }
    const kontener = kontenerRef.current;
    if (!kontener) return;
    const baza = kontener.getBoundingClientRect();
    const skala = baza.width === 0 ? 1 : kontener.offsetWidth / baza.width;

    const srodek = (field: FieldId): { x: number; y: number } | null => {
      const el = polaRef.current.get(field);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: (r.left + r.width / 2 - baza.left) * skala,
        y: (r.top + r.height / 2 - baza.top) * skala,
      };
    };

    const out: Strzalka[] = [];
    raport.arrows.forEach((a, i) => {
      const od = srodek(a.from);
      const doo = srodek(a.to);
      if (!od || !doo) return;
      out.push({
        klucz: `${a.from}->${a.to}`,
        x1: od.x,
        y1: od.y,
        x2: doo.x,
        y2: doo.y,
        moja: a.owner === widok.ja,
        opoznienie: i * 60,
      });
    });
    setStrzalki(out);
  }, [raport, widok.ja]);

  const obrazeniaNa = (field: FieldId): number | null => {
    if (!raport) return null;
    const u = state.board[field];
    if (!u) return null;
    const v = raport.incoming[u.uid];
    return v ?? null;
  };

  const rozmiar = kontenerRef.current;
  const szer = rozmiar?.offsetWidth ?? 0;
  const wys = rozmiar?.offsetHeight ?? 0;

  return (
    <div className="plansza" ref={kontenerRef}>
      {/*
        Linia bitewna jest rodzeństwem rzędów, nie ich dzieckiem — dzięki temu
        cztery rzędy mogą równo dzielić wysokość (`flex: 1 1 0`), a pola biorą
        rozmiar z `aspect-ratio`. Plansza dopasowuje się do miejsca, które
        dostanie, więc żadna arytmetyka pikseli nie może jej wypchnąć z kadru.
      */}
      {widok.rzedy.map((rzad, idx) => (
        <Fragment key={rzad.klucz}>
          {idx === 2 && <div className="linia-bitewna">{T.gra.liniaBitewna}</div>}
          <div className="rzad">
            {rzad.pola.map((field) => {
              const unit = state.board[field];
              const wlasciciel: PlayerId = field.slice(0, 2) as PlayerId;
              return (
                <div key={field} className="komorka" ref={(el) => zapiszPole(field, el)}>
                  <Pole
                    field={field}
                    unit={unit}
                    state={state}
                    order={unit ? rozkazDla(widok, unit.uid, wlasciciel) : null}
                    dostepne={dostepnePola.includes(field)}
                    cel={celePola.includes(field)}
                    zaznaczone={zaznaczonePole === field}
                    uderzone={uderzone.includes(field)}
                    obrazenia={obrazeniaNa(field)}
                    moje={wlasciciel === widok.ja}
                    onClick={() => onPole(field)}
                  />
                </div>
              );
            })}
          </div>
        </Fragment>
      ))}

      {strzalki.length > 0 && szer > 0 && (
        <svg className="warstwa-strzalek" viewBox={`0 0 ${szer} ${wys}`} width={szer} height={wys}>
          {strzalki.map((s) => (
            <Grot key={s.klucz} s={s} />
          ))}
        </svg>
      )}
    </div>
  );
}

/** Linia z grotem — rysowana od atakującego do celu (§10.2). */
function Grot({ s }: { s: Strzalka }) {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const dlugosc = Math.hypot(dx, dy) || 1;
  // Skracamy o promień żetonu, żeby grot nie chował się pod kafelkiem.
  const skrot = 52;
  const ux = dx / dlugosc;
  const uy = dy / dlugosc;
  const x1 = s.x1 + ux * skrot;
  const y1 = s.y1 + uy * skrot;
  const x2 = s.x2 - ux * skrot;
  const y2 = s.y2 - uy * skrot;
  const kat = (Math.atan2(dy, dx) * 180) / Math.PI;

  return (
    <g style={{ animationDelay: `${s.opoznienie}ms` }}>
      <line
        className={`strzalka${s.moja ? '' : ' wroga'}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        style={{ animationDelay: `${s.opoznienie}ms` }}
      />
      <polygon
        className={`strzalka-grot${s.moja ? '' : ' wroga'}`}
        points="0,-6 12,0 0,6"
        transform={`translate(${x2} ${y2}) rotate(${kat})`}
      />
    </g>
  );
}
