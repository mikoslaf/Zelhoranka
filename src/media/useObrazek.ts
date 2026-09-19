import { useEffect, useState } from 'react';
import { loadImage, warianty } from './images';

/**
 * Zwraca pierwszy wariant pliku, który daje się wczytać, albo `null`.
 * `null` znaczy „rysuj placeholder proceduralny" — brak grafiki nigdy nie
 * przerywa gry (§8.4).
 *
 * Pojedynczy adres rozwija się w warianty (`.webp` → `.svg`). Tablica to jawna
 * lista kandydatów w kolejności — potrzebna, gdy trzeba przeplatać źródła,
 * np. żeton: własna grafika → ilustracja karty → placeholder żetonu.
 */
export function useObrazek(zrodlo: string | readonly string[] | null): string | null {
  const [gotowy, setGotowy] = useState<string | null>(null);

  const kandydaci =
    zrodlo === null ? [] : typeof zrodlo === 'string' ? warianty(zrodlo) : zrodlo;
  // Tablica powstaje na nowo przy każdym renderze — efekt musi zależeć
  // od treści listy, a nie od referencji, inaczej ładowałby się w kółko.
  const klucz = kandydaci.join('\n');

  useEffect(() => {
    if (!klucz) {
      setGotowy(null);
      return;
    }
    let anulowane = false;
    void (async () => {
      for (const kandydat of klucz.split('\n')) {
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
  }, [klucz]);

  return gotowy;
}
