import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { assetUrl } from '../../media/images';
import { useObrazek } from '../../media/useObrazek';

/**
 * Stała proporcja 16:9 przeskalowana do okna (§5).
 *
 * Uwaga na pułapkę: `transform: scale()` zmienia tylko wygląd, nie rozmiar
 * w układzie. Scena skalowana „w miejscu" dalej zajmuje 1600×900, więc przy
 * mniejszym oknie przepełnia kontener, a centrowanie przepełnionego elementu
 * ucina go przy krawędzi — gra nie mieści się na ekranie.
 *
 * Dlatego scena siedzi w RAMCE o wymiarach już przeskalowanych, a sama skaluje
 * się od lewego górnego rogu. Ramka ma prawdziwy rozmiar, więc zwykłe
 * centrowanie flexem działa dokładnie, nic nie wystaje i nic nie trzeba
 * przewijać. Margines pojawia się sam tam, gdzie zostaje miejsce (listwy
 * po bokach albo nad i pod — zależnie od proporcji okna).
 */

const SZER = 1600;
const WYS = 900;

export function Scena({ children }: { children: ReactNode }) {
  const kontenerRef = useRef<HTMLDivElement>(null);
  const [skala, setSkala] = useState(0);
  // Tło stołu jest opcjonalne — brak pliku znaczy tylko, że zostaje sukno z CSS.
  const tlo = useObrazek(assetUrl('board/table.webp'));

  useLayoutEffect(() => {
    const el = kontenerRef.current;
    if (!el) return;

    const przelicz = (): void => {
      // Mierzymy kontener, nie `window` — to odporne na pasek przewijania,
      // powiększenie strony i otwarte narzędzia deweloperskie.
      const szer = el.clientWidth;
      const wys = el.clientHeight;
      if (szer === 0 || wys === 0) return;
      setSkala(Math.min(szer / SZER, wys / WYS));
    };

    przelicz();
    const obserwator = new ResizeObserver(przelicz);
    obserwator.observe(el);
    return () => obserwator.disconnect();
  }, []);

  return (
    <div className="scena-kontener" ref={kontenerRef}>
      <div
        className="scena-ramka"
        style={{ width: SZER * skala, height: WYS * skala }}
        // Do pierwszego pomiaru skala wynosi 0 — nie pokazujemy sceny
        // w złym rozmiarze, tylko czekamy jedną klatkę.
        hidden={skala === 0}
      >
        <div
          className={`scena${tlo ? ' z-tlem' : ''}`}
          style={{
            transform: `scale(${skala})`,
            backgroundImage: tlo ? `url("${tlo}")` : undefined,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
