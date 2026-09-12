import { useEffect, useState } from 'react';
import { loadImage, warianty } from './images';

/**
 * Zwraca pierwszy wariant pliku, który daje się wczytać, albo `null`.
 * `null` znaczy „rysuj placeholder proceduralny" — brak grafiki nigdy nie
 * przerywa gry (§8.4).
 */
export function useObrazek(url: string | null): string | null {
  const [gotowy, setGotowy] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setGotowy(null);
      return;
    }
    let anulowane = false;
    void (async () => {
      for (const kandydat of warianty(url)) {
        const ok = await loadImage(kandydat);
        if (anulowane) return;
        if (ok) {
          setGotowy(kandydat);
          return;
        }
      }
      if (!anulowane) setGotowy(null);
    })();
    return () => {
      anulowane = true;
    };
  }, [url]);

  return gotowy;
}
