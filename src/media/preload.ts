import { CARDS, RULES } from '../silnik/cards';
import { assetUrl, cardArtUrl, loadImage, warianty } from './images';
import { audio } from './audio';

/**
 * Wstępne wczytanie zasobów z paskiem postępu — kiosk ma ruszyć bez zacięć (§9).
 * Brakujące pliki nie są błędem: zwracamy je na liście `missing`, a gra rusza
 * na placeholderach.
 */

export type PreloadResult = { total: number; loaded: number; missing: string[] };

function loadAudioFile(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    const el = new Audio();
    const done = (ok: boolean): void => {
      el.oncanplaythrough = null;
      el.onerror = null;
      resolve(ok);
    };
    el.oncanplaythrough = () => done(true);
    el.onerror = () => done(false);
    el.preload = 'auto';
    el.src = assetUrl(path);
    // Nie czekamy w nieskończoność na plik, którego nie ma.
    setTimeout(() => done(false), 4000);
  });
}

export async function preloadAll(
  onProgress?: (done: number, total: number) => void,
): Promise<PreloadResult> {
  const images: string[] = [];
  for (const c of CARDS) {
    const url = cardArtUrl(c);
    if (url) images.push(url);
  }
  for (const r of RULES) images.push(assetUrl(r.symbol));

  const sounds = audio.allPaths();
  const total = images.length + sounds.length;
  const missing: string[] = [];
  let done = 0;

  const bump = (): void => {
    done += 1;
    onProgress?.(done, total);
  };

  await Promise.all([
    ...images.map(async (url) => {
      // Wystarczy, że wczyta się którykolwiek wariant (.webp albo placeholder .svg).
      let ok = false;
      for (const kandydat of warianty(url)) {
        ok = await loadImage(kandydat);
        if (ok) break;
      }
      if (!ok) missing.push(url);
      bump();
    }),
    ...sounds.map(async (path) => {
      const ok = await loadAudioFile(path);
      if (!ok) missing.push(assetUrl(path));
      bump();
    }),
  ]);

  return { total, loaded: total - missing.length, missing };
}
