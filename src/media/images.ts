import type { Card, CardType } from '../silnik/types';

// Rewersów nie ma: od czasu przejścia na jawne ręce nic ich nie wyświetla.

/**
 * Ładowanie grafik i placeholdery (§8.4).
 * Żadna ścieżka do grafiki nie występuje w komponentach — wszystko idzie
 * przez `card.art` / `rules.json`. Brakująca grafika NIE psuje gry:
 * komponent chowa <img> po błędzie i zostaje placeholder proceduralny.
 */

const BASE = import.meta.env.BASE_URL ?? '/';

export function assetUrl(path: string): string {
  const clean = path.replace(/^\/+/, '');
  return `${BASE}assets/${clean}`.replace(/([^:])\/{2,}/g, '$1/');
}

export function cardArtUrl(card: Card): string | null {
  return card.art ? assetUrl(card.art) : null;
}

export function symbolUrl(symbol: string): string {
  return assetUrl(symbol);
}

/** Kolor placeholdera zależy od typu karty — czytelne bez ilustracji. */
export const TYPE_COLOR: Record<CardType, string> = {
  RECRUIT: 'var(--marzanna)',
  SUPPLY: 'var(--mosiadz)',
  AMBUSH: 'var(--inkaust)',
  INTERVENTION: 'var(--grynszpan)',
  MANEUVER: 'var(--sukno-jasne)',
};

/**
 * Deterministyczny wzór tła placeholdera — ten sam `id` zawsze daje ten sam
 * kąt i jasność, więc karty są rozróżnialne „na oko" przed narysowaniem grafik.
 */
export function placeholderStyle(id: string, type: CardType): {
  background: string;
} {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const angle = h % 360;
  const shift = 6 + (h % 11);
  return {
    background:
      `repeating-linear-gradient(${angle}deg, ` +
      `rgba(255,255,255,0.05) 0 6px, rgba(0,0,0,0.08) 6px ${shift + 6}px), ` +
      TYPE_COLOR[type],
  };
}

/** Wczytuje obrazek; `false` zamiast wyjątku, gdy pliku nie ma. */
export function loadImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/**
 * Kandydaci na plik grafiki: najpierw format docelowy z manifestu (`.webp`),
 * potem `.svg` — tam lądują placeholdery z `tools/make-placeholders.ts`.
 * Dzięki temu wygenerowane zastępniki widać w grze od razu, a wrzucenie
 * właściwego `.webp` je przesłania bez zmian w kodzie (§8.1, §8.4).
 */
export function warianty(url: string): string[] {
  const svg = url.replace(/\.(webp|png|jpg|jpeg)$/i, '.svg');
  return svg === url ? [url] : [url, svg];
}
