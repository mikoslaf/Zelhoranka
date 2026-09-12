import { useEffect, useState } from 'react';
import type { PlayerId } from '../../silnik/types';
import { T, nazwaGracza } from '../teksty';

/**
 * Rzut kostką o inicjatywę (§6.0) — spełnia wymóg „rzuty kostką" z wytycznych.
 * Animacja to obrót w płaszczyźnie ekranu i skala; żadnej transformacji 3D (§10.3).
 */

const UKLADY: Record<number, [number, number][]> = {
  1: [[2, 2]],
  2: [
    [1, 1],
    [3, 3],
  ],
  3: [
    [1, 1],
    [2, 2],
    [3, 3],
  ],
  4: [
    [1, 1],
    [1, 3],
    [3, 1],
    [3, 3],
  ],
  5: [
    [1, 1],
    [1, 3],
    [2, 2],
    [3, 1],
    [3, 3],
  ],
  6: [
    [1, 1],
    [1, 3],
    [2, 1],
    [2, 3],
    [3, 1],
    [3, 3],
  ],
};

export function Kostka({ wartosc, turla }: { wartosc: number; turla: boolean }) {
  const oczka = UKLADY[Math.min(6, Math.max(1, wartosc))] ?? UKLADY[1];
  return (
    <div className={`kostka${turla ? ' turla' : ''}`} aria-label={`Kostka: ${wartosc}`}>
      {oczka.map(([r, c], i) => (
        <span key={i} className="oczko" style={{ gridRow: r, gridColumn: c }} />
      ))}
    </div>
  );
}

/** Pełnoekranowa scena rzutu — pokazywana raz, na starcie partii. */
export function EkranKostki({
  p1,
  p2,
  bot,
  onKoniec,
}: {
  p1: number;
  p2: number;
  bot: PlayerId | null;
  onKoniec: () => void;
}) {
  const [turla, setTurla] = useState(true);

  useEffect(() => {
    const t1 = window.setTimeout(() => setTurla(false), 900);
    const t2 = window.setTimeout(onKoniec, 2100);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [onKoniec]);

  const zwyciezca: PlayerId = p1 > p2 ? 'P1' : 'P2';

  return (
    <div className="kostka-ekran">
      <div className="tura-info">{T.gra.kostka}</div>
      <div className="kostki">
        <div>
          <Kostka wartosc={turla ? 3 : p1} turla={turla} />
          <div className="kostka-podpis">{nazwaGracza('P1', bot)}</div>
        </div>
        <div>
          <Kostka wartosc={turla ? 5 : p2} turla={turla} />
          <div className="kostka-podpis">{nazwaGracza('P2', bot)}</div>
        </div>
      </div>
      {!turla && (
        <div className="kto" style={{ fontSize: 'var(--stopien-xl)', color: 'var(--mosiadz-jasny)' }}>
          {nazwaGracza(zwyciezca, bot)} {T.gra.zaczyna}
        </div>
      )}
    </div>
  );
}
