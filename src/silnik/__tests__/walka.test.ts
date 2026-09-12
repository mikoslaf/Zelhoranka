import { describe, expect, it } from 'vitest';
import { enterCombat } from '../phases/combat';
import { gotowaWalka, postaw, rozkaz } from './pomoc';

/** §12.1 — faza walki (§6.6). */

function martwi(state: ReturnType<typeof enterCombat>['state']): string[] {
  return (state.lastCombat?.deaths ?? []).map((d) => d.field).sort();
}

describe('walka — obrażenia', () => {
  it('suma ofensyw przekraczająca defensywę zabija', () => {
    const s = gotowaWalka();
    // Cel: piechota (def 5). Napastnicy: jeźdźcy (of 5) + łucznicy (of 3) = 8 > 5.
    const cel = postaw(s, 'P2', 'P2-F1', 'zelhorska_piechota');
    const a1 = postaw(s, 'P1', 'P1-F1', 'aranorscy_jezdzcy');
    const a2 = postaw(s, 'P1', 'P1-R1', 'desilvarscy_lucznicy');
    rozkaz(s, 'P1', { unit: a1.uid, kind: 'ATTACK', target: 'P2-F1' });
    rozkaz(s, 'P1', { unit: a2.uid, kind: 'ATTACK', target: 'P2-F1' });
    rozkaz(s, 'P2', { unit: cel.uid, kind: 'NONE' });

    const { state } = enterCombat(s);
    expect(martwi(state)).toEqual(['P2-F1']);
  });

  it('obrażenia równe defensywie NIE zabijają (porównanie ostre)', () => {
    const s = gotowaWalka();
    // Piechota def 5 (sąsiadów brak). Napastnicy: 5 = 5 → przeżywa.
    const cel = postaw(s, 'P2', 'P2-F1', 'zelhorska_piechota');
    const a1 = postaw(s, 'P1', 'P1-F1', 'aranorscy_jezdzcy'); // of 5
    rozkaz(s, 'P1', { unit: a1.uid, kind: 'ATTACK', target: 'P2-F1' });
    rozkaz(s, 'P2', { unit: cel.uid, kind: 'NONE' });

    const { state } = enterCombat(s);
    expect(martwi(state)).toEqual([]);
    expect(state.lastCombat?.incoming[cel.uid]).toBe(5);
  });

  it('atak w puste pole nie istnieje — cel zniknął, atak przepada', () => {
    const s = gotowaWalka();
    const a1 = postaw(s, 'P1', 'P1-F1', 'aranorscy_jezdzcy');
    rozkaz(s, 'P1', { unit: a1.uid, kind: 'ATTACK', target: 'P2-F1' }); // pole puste
    const { state } = enterCombat(s);
    expect(martwi(state)).toEqual([]);
    expect(state.lastCombat?.arrows).toEqual([]);
  });
});

describe('walka — odwet obrońcy', () => {
  it('obrońca odwzajemnia cios z priorytetem dla największego napastnika', () => {
    const s = gotowaWalka();
    // Obrońca: gwardia def 6. Napastnicy: jeźdźcy of 5 i zwiadowcy of 2.
    // Pula 6 > 5 → jeźdźcy giną, pula 6-6=0; 0 > 2 fałsz → zwiadowcy żyją.
    const obronca = postaw(s, 'P2', 'P2-F1', 'gwardia_zelhoru');
    const duzy = postaw(s, 'P1', 'P1-F1', 'aranorscy_jezdzcy');
    const maly = postaw(s, 'P1', 'P1-F0', 'zwiadowcy_desilvaru');
    rozkaz(s, 'P1', { unit: duzy.uid, kind: 'ATTACK', target: 'P2-F1' });
    rozkaz(s, 'P1', { unit: maly.uid, kind: 'ATTACK', target: 'P2-F1' });
    rozkaz(s, 'P2', { unit: obronca.uid, kind: 'DEFEND' });

    const { state } = enterCombat(s);
    const zgony = state.lastCombat!.deaths;
    expect(zgony.map((d) => d.field)).toEqual(['P1-F1']);
    expect(zgony[0].reason).toBe('RETALIATION');
  });

  it('przy puli niewystarczającej na największego odwet się zatrzymuje', () => {
    const s = gotowaWalka();
    // Obrońca: łucznicy def 2. Największy napastnik of 5 → 2 > 5 fałsz → przerwa.
    const obronca = postaw(s, 'P2', 'P2-F1', 'desilvarscy_lucznicy');
    const duzy = postaw(s, 'P1', 'P1-F1', 'aranorscy_jezdzcy'); // of 5
    const maly = postaw(s, 'P1', 'P1-F0', 'zwiadowcy_desilvaru'); // of 2 — dałoby się zabić
    rozkaz(s, 'P1', { unit: duzy.uid, kind: 'ATTACK', target: 'P2-F1' });
    rozkaz(s, 'P1', { unit: maly.uid, kind: 'ATTACK', target: 'P2-F1' });
    rozkaz(s, 'P2', { unit: obronca.uid, kind: 'DEFEND' });

    const { state } = enterCombat(s);
    // Obrońca ginie (5+2=7 > 2), ale nikogo nie zabiera ze sobą.
    expect(martwi(state)).toEqual(['P2-F1']);
  });
});

describe('walka — wsparcie obrońców (zasada dodatkowa 3)', () => {
  it('obrońca dokłada defensywę napastnikowi, który sam jest atakowany', () => {
    const s = gotowaWalka();
    // P1-F1 jeźdźcy (of 5, def 2) atakują P2-F1.
    // P2-F1 piechota (def 5) BRONI i jest atakowana przez jeźdźców.
    // P2-F2 jeźdźcy atakują P1-F1 (of 5) → jeźdźcy P1 są atakowani.
    // Wsparcie: piechota dokłada swoje def 5 do obrażeń jeźdźców P1.
    // Obrażenia na P1-F1 = 5 (atak) + 5 (wsparcie) = 10 > def 2 → giną.
    const obronca = postaw(s, 'P2', 'P2-F1', 'zelhorska_piechota');
    const kontra = postaw(s, 'P2', 'P2-F2', 'aranorscy_jezdzcy');
    const napastnik = postaw(s, 'P1', 'P1-F1', 'aranorscy_jezdzcy');

    rozkaz(s, 'P1', { unit: napastnik.uid, kind: 'ATTACK', target: 'P2-F1' });
    rozkaz(s, 'P2', { unit: obronca.uid, kind: 'DEFEND' });
    rozkaz(s, 'P2', { unit: kontra.uid, kind: 'ATTACK', target: 'P1-F1' });

    const { state } = enterCombat(s);
    expect(state.lastCombat!.incoming[napastnik.uid]).toBe(10);
    expect(martwi(state)).toContain('P1-F1');
  });

  it('bez ataku na napastnika wsparcie się nie nalicza', () => {
    const s = gotowaWalka();
    const obronca = postaw(s, 'P2', 'P2-F1', 'zelhorska_piechota');
    const napastnik = postaw(s, 'P1', 'P1-F1', 'aranorscy_jezdzcy');
    rozkaz(s, 'P1', { unit: napastnik.uid, kind: 'ATTACK', target: 'P2-F1' });
    rozkaz(s, 'P2', { unit: obronca.uid, kind: 'DEFEND' });

    const { state } = enterCombat(s);
    expect(state.lastCombat!.incoming[napastnik.uid]).toBe(0);
  });
});

describe('walka — pojedynek wzajemny (zasada dodatkowa 6)', () => {
  it('wyższa ofensywa zabija niższą', () => {
    const s = gotowaWalka();
    // Jeźdźcy (of 5, def 2) kontra zwiadowcy (of 2, def 2), atak wzajemny.
    const a = postaw(s, 'P1', 'P1-F1', 'aranorscy_jezdzcy');
    const b = postaw(s, 'P2', 'P2-F1', 'zwiadowcy_desilvaru');
    rozkaz(s, 'P1', { unit: a.uid, kind: 'ATTACK', target: 'P2-F1' });
    rozkaz(s, 'P2', { unit: b.uid, kind: 'ATTACK', target: 'P1-F1' });

    const { state } = enterCombat(s);
    expect(martwi(state)).toEqual(['P2-F1']);
  });

  it('remis ofensyw — obaj przeżywają (config.duelTie = both_live)', () => {
    const s = gotowaWalka();
    // Dwie takie same piechoty (of 3, def 5) atakują się wzajemnie.
    const a = postaw(s, 'P1', 'P1-F1', 'zelhorska_piechota');
    const b = postaw(s, 'P2', 'P2-F1', 'zelhorska_piechota');
    rozkaz(s, 'P1', { unit: a.uid, kind: 'ATTACK', target: 'P2-F1' });
    rozkaz(s, 'P2', { unit: b.uid, kind: 'ATTACK', target: 'P1-F1' });

    const { state } = enterCombat(s);
    expect(martwi(state)).toEqual([]);
  });
});

describe('walka — reguły specjalne', () => {
  it('niezłomność ignoruje pierwsze oznaczenie śmierci', () => {
    const s = gotowaWalka();
    // Gwardia (def 6, niezłomność) pod ostrzałem 5+3 = 8 > 6 → oznaczona, ale przeżywa.
    const cel = postaw(s, 'P2', 'P2-F1', 'gwardia_zelhoru');
    const a1 = postaw(s, 'P1', 'P1-F1', 'aranorscy_jezdzcy');
    const a2 = postaw(s, 'P1', 'P1-R1', 'desilvarscy_lucznicy');
    rozkaz(s, 'P1', { unit: a1.uid, kind: 'ATTACK', target: 'P2-F1' });
    rozkaz(s, 'P1', { unit: a2.uid, kind: 'ATTACK', target: 'P2-F1' });

    const { state } = enterCombat(s);
    expect(martwi(state)).toEqual([]);
    expect(state.lastCombat!.incoming[cel.uid]).toBe(8);
    expect(state.board['P2-F1']?.savedThisTurn).toBe(1);
  });

  it('osłona podnosi defensywę sąsiada w tym samym rzędzie', () => {
    const s = gotowaWalka();
    // Zwiadowcy def 2, obok piechota z osłoną → def 3. Obrażenia 3 → 3 > 3 fałsz, przeżywa.
    const cel = postaw(s, 'P2', 'P2-F1', 'zwiadowcy_desilvaru');
    postaw(s, 'P2', 'P2-F2', 'zelhorska_piechota'); // osłona
    const a = postaw(s, 'P1', 'P1-R1', 'desilvarscy_lucznicy'); // of 3
    rozkaz(s, 'P1', { unit: a.uid, kind: 'ATTACK', target: 'P2-F1' });

    const { state } = enterCombat(s);
    expect(state.lastCombat!.incoming[cel.uid]).toBe(3);
    expect(martwi(state)).toEqual([]);
  });

  it('szarża daje +2 ofensywy w turze rozmieszczenia', () => {
    const s = gotowaWalka(); // turn = 3
    const cel = postaw(s, 'P2', 'P2-F1', 'zelhorska_piechota'); // def 5
    const a = postaw(s, 'P1', 'P1-F1', 'aranorscy_jezdzcy', { deployedTurn: 3 }); // of 5 + 2
    rozkaz(s, 'P1', { unit: a.uid, kind: 'ATTACK', target: 'P2-F1' });

    const { state } = enterCombat(s);
    expect(state.lastCombat!.incoming[cel.uid]).toBe(7);
    expect(martwi(state)).toEqual(['P2-F1']);
  });
});
