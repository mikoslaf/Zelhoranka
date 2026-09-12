import type { RngState } from './types';

/**
 * Mulberry32 — jeden generator z ziarnem, całkowicie deterministyczny.
 * Nigdzie w silniku nie wolno użyć `Math.random()` (§2.2).
 * Wszystkie funkcje są czyste: przyjmują stan RNG i zwracają nowy.
 */

export function createRng(seed: number): RngState {
  return { seed: seed >>> 0 };
}

export function nextFloat(rng: RngState): { rng: RngState; value: number } {
  let t = (rng.seed + 0x6d2b79f5) >>> 0;
  const next: RngState = { seed: t };
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { rng: next, value };
}

/** Liczba całkowita z przedziału [min, max] włącznie. */
export function nextInt(rng: RngState, min: number, max: number): { rng: RngState; value: number } {
  const r = nextFloat(rng);
  return { rng: r.rng, value: min + Math.floor(r.value * (max - min + 1)) };
}

export function rollDie(rng: RngState): { rng: RngState; value: number } {
  return nextInt(rng, 1, 6);
}

/** Tasowanie Fishera-Yatesa — deterministyczne, nie modyfikuje wejścia. */
export function shuffle<T>(rng: RngState, items: readonly T[]): { rng: RngState; items: T[] } {
  const out = items.slice();
  let cur = rng;
  for (let i = out.length - 1; i > 0; i--) {
    const r = nextInt(cur, 0, i);
    cur = r.rng;
    const j = r.value;
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return { rng: cur, items: out };
}
