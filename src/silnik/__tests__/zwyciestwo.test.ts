import { describe, expect, it } from 'vitest';
import { breakthroughScore, checkVictory, hasBreakthrough } from '../victory';
import { CONFIG } from '../cards';
import { postaw, pustaGra } from './pomoc';

/** §12.1 — warunki zwycięstwa (§6.7). */

describe('przełamanie', () => {
  it('liczy tylko kolumny z pustym przednim polem przeciwnika', () => {
    const s = pustaGra();
    postaw(s, 'P1', 'P1-F0', 'aranorscy_jezdzcy'); // of 5, kolumna 0 otwarta
    postaw(s, 'P1', 'P1-F1', 'aranorscy_jezdzcy'); // of 5, kolumna 1 ZAMKNIĘTA
    postaw(s, 'P2', 'P2-F1', 'zelhorska_piechota');
    expect(breakthroughScore(s, 'P1')).toBe(5);
  });

  it('liczą się jednostki z obu rzędów otwartej kolumny', () => {
    const s = pustaGra();
    postaw(s, 'P1', 'P1-F0', 'aranorscy_jezdzcy'); // 5
    postaw(s, 'P1', 'P1-R0', 'desilvarscy_lucznicy'); // 3
    expect(breakthroughScore(s, 'P1')).toBe(8);
  });

  it('dokładnie 15 wygrywa', () => {
    const s = pustaGra();
    postaw(s, 'P1', 'P1-F0', 'aranorscy_jezdzcy'); // 5
    postaw(s, 'P1', 'P1-F1', 'aranorscy_jezdzcy'); // 5
    postaw(s, 'P1', 'P1-F2', 'aranorscy_jezdzcy'); // 5
    expect(breakthroughScore(s, 'P1')).toBe(CONFIG.breakthroughThreshold);
    expect(hasBreakthrough(s, 'P1')).toBe(true);
    expect(checkVictory(s)?.winner).toBe('P1');
  });

  it('14 nie wygrywa', () => {
    const s = pustaGra();
    postaw(s, 'P1', 'P1-F0', 'aranorscy_jezdzcy'); // 5
    postaw(s, 'P1', 'P1-F1', 'aranorscy_jezdzcy'); // 5
    postaw(s, 'P1', 'P1-F2', 'zelhorska_piechota'); // 3
    postaw(s, 'P1', 'P1-R2', 'kwatermistrz_taboru'); // 1
    expect(breakthroughScore(s, 'P1')).toBe(14);
    expect(hasBreakthrough(s, 'P1')).toBe(false);
    expect(checkVictory(s)).toBeNull();
  });

  it('obustronne przełamanie rozstrzyga wyższa suma', () => {
    const s = pustaGra();
    for (const f of ['P1-F0', 'P1-F1', 'P1-F2', 'P1-F3'] as const) {
      postaw(s, 'P1', f, 'aranorscy_jezdzcy'); // 4 × 5 = 20
    }
    for (const f of ['P2-R0', 'P2-R1', 'P2-R2'] as const) {
      postaw(s, 'P2', f, 'desilvarscy_lucznicy'); // 3 × 3 = 9 — za mało
    }
    // P2 ma przednie pola puste, więc kolumny P1 są otwarte; P1 ma też puste F → obie strony.
    const wynik = checkVictory(s);
    expect(wynik?.winner).toBe('P1');
  });
});

describe('limit tur (bezpiecznik)', () => {
  it('po config.maxTurns rozstrzyga porównanie ofensyw', () => {
    const s = pustaGra();
    s.turn = CONFIG.maxTurns;
    postaw(s, 'P1', 'P1-F1', 'aranorscy_jezdzcy'); // of 5
    postaw(s, 'P2', 'P2-F1', 'zelhorska_piechota'); // of 3
    const wynik = checkVictory(s);
    expect(wynik?.winner).toBe('P1');
    expect(wynik?.reason).toMatch(/Limit \d+ tur/);
  });

  it('tuż przed limitem partia jeszcze trwa', () => {
    const s = pustaGra();
    s.turn = CONFIG.maxTurns - 1;
    postaw(s, 'P1', 'P1-F1', 'aranorscy_jezdzcy');
    postaw(s, 'P2', 'P2-F1', 'zelhorska_piechota');
    expect(checkVictory(s)).toBeNull();
  });
});

describe('wyczerpanie talii', () => {
  it('rozstrzyga porównaniem łącznej ofensywy', () => {
    const s = pustaGra();
    s.players.P1.deckExhausted = true;
    postaw(s, 'P1', 'P1-F1', 'zelhorska_piechota'); // of 3
    postaw(s, 'P2', 'P2-F1', 'aranorscy_jezdzcy'); // of 5
    // Kolumny są wzajemnie zamknięte → brak przełamania, decyduje ofensywa.
    const wynik = checkVictory(s);
    expect(wynik?.winner).toBe('P2');
    expect(wynik?.reason).toMatch(/[Ww]yczerpanie talii/);
  });

  it('równa ofensywa przy wyczerpanej talii to remis', () => {
    const s = pustaGra();
    s.players.P2.deckExhausted = true;
    postaw(s, 'P1', 'P1-F1', 'zelhorska_piechota');
    postaw(s, 'P2', 'P2-F1', 'zelhorska_piechota');
    expect(checkVictory(s)?.winner).toBe('DRAW');
  });
});
