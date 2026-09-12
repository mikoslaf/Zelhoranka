import { describe, expect, it } from 'vitest';
import { legalTargets } from '../stats';
import { postaw, pustaGra } from './pomoc';

/** §12.1 — zasięgi ataku (§6.4). */

describe('zasięgi', () => {
  it('FRONT nie sięga tylnej linii', () => {
    const s = pustaGra();
    const piechota = postaw(s, 'P1', 'P1-F1', 'zelhorska_piechota'); // FRONT, offsets [0]
    postaw(s, 'P2', 'P2-R1', 'zelhorska_piechota');
    // przednie pole przeciwnika puste → atak w tę kolumnę niemożliwy
    expect(legalTargets(s, piechota)).toEqual([]);

    postaw(s, 'P2', 'P2-F1', 'zelhorska_piechota');
    expect(legalTargets(s, piechota)).toEqual(['P2-F1']);
  });

  it('DEEP sięga tylnego pola dopiero po opróżnieniu przedniego', () => {
    const s = pustaGra();
    const jezdzcy = postaw(s, 'P1', 'P1-F0', 'aranorscy_jezdzcy'); // DEEP, offsets [0,-1,1]
    postaw(s, 'P2', 'P2-F0', 'zelhorska_piechota');
    postaw(s, 'P2', 'P2-R0', 'zelhorska_piechota');

    // Przednie pole zajęte → celem jest ono, nie tylne.
    expect(legalTargets(s, jezdzcy)).toEqual(['P2-F0']);

    // Po opróżnieniu przedniego pola DEEP wchodzi na tylne.
    s.board['P2-F0'] = null;
    expect(legalTargets(s, jezdzcy)).toEqual(['P2-R0']);
  });

  it('RANGED sięga obu rzędów niezależnie od zajętości', () => {
    const s = pustaGra();
    const lucznicy = postaw(s, 'P1', 'P1-R2', 'desilvarscy_lucznicy'); // RANGED, fromRear
    postaw(s, 'P2', 'P2-F2', 'zelhorska_piechota');
    postaw(s, 'P2', 'P2-R2', 'zelhorska_piechota');
    expect(legalTargets(s, lucznicy)).toEqual(['P2-F2', 'P2-R2']);
  });

  it('fromRear=false blokuje atak z własnej tylnej linii', () => {
    const s = pustaGra();
    const piechota = postaw(s, 'P1', 'P1-R1', 'zelhorska_piechota'); // fromRear: false
    postaw(s, 'P2', 'P2-F1', 'zelhorska_piechota');
    expect(legalTargets(s, piechota)).toEqual([]);
  });

  it('fromRear=true pozwala strzelać z tyłu', () => {
    const s = pustaGra();
    const lucznicy = postaw(s, 'P1', 'P1-R1', 'desilvarscy_lucznicy');
    postaw(s, 'P2', 'P2-F1', 'zelhorska_piechota');
    expect(legalTargets(s, lucznicy)).toContain('P2-F1');
  });

  it('kolumny spoza planszy są odrzucane', () => {
    const s = pustaGra();
    const jezdzcy = postaw(s, 'P1', 'P1-F0', 'aranorscy_jezdzcy'); // offset -1 wypada poza planszę
    postaw(s, 'P2', 'P2-F0', 'zelhorska_piechota');
    postaw(s, 'P2', 'P2-F1', 'zelhorska_piechota');
    const cele = legalTargets(s, jezdzcy);
    expect(cele).toEqual(['P2-F0', 'P2-F1']);
    expect(cele.every((f) => /P2-[FR][0-3]/.test(f))).toBe(true);
  });

  it('strefa ogranicza rozmieszczanie, nie celowanie — flanka bije na ukos w linię główną', () => {
    const s = pustaGra();
    const jezdzcy = postaw(s, 'P1', 'P1-F0', 'aranorscy_jezdzcy');
    postaw(s, 'P2', 'P2-F1', 'zelhorska_piechota'); // pole strefy MAIN
    expect(legalTargets(s, jezdzcy)).toContain('P2-F1');
  });
});
