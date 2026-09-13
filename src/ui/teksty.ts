import type { CardType, DeathReason, Phase, PlayerId, Zone } from '../silnik/types';

/**
 * Wszystkie teksty widoczne dla gracza (§2.6).
 * Identyfikatory w kodzie po angielsku, napisy po polsku — w jednym miejscu.
 */

export const T = {
  tytul: 'Zelhoranka',
  podtytul: 'Gra o linię bitewną',

  menu: {
    nowaGra: 'Nowa gra',
    nowaGraBot: 'Gra z komputerem',
    kontynuuj: 'Wróć do partii',
    zasady: 'Zasady',
    ziarno: 'Ziarno rozgrywki',
    ziarnoOpis: 'Ta sama wartość daje tę samą rozgrywkę — przydatne na pokazie.',
    losujZiarno: 'Losuj',
    dzwiek: 'Dźwięk',
    muzyka: 'Muzyka',
    efekty: 'Efekty',
    wyciszenie: 'Wycisz wszystko',
    wczytywanie: 'Wczytywanie zasobów',
    latwy: 'Łatwy',
    sredni: 'Średni',
    trudny: 'Trudny',
  },

  fazy: {
    SETUP: 'Przygotowanie',
    DRAW: 'Dobieranie',
    LOGISTICS: 'Logistyka',
    STRATEGY: 'Strategia',
    MANEUVERS: 'Manewry',
    COMBAT: 'Walka',
    END: 'Koniec partii',
  } satisfies Record<Phase, string>,

  fazyOpis: {
    SETUP: 'Rzut o inicjatywę.',
    DRAW: 'Uzupełnij rękę i wymień, co nie pasuje.',
    LOGISTICS: 'Zagrywajcie na przemian po jednej karcie. Pas kończy twój udział.',
    STRATEGY: 'Na przemian, po jednym oddziale. Rozkazy są jawne od razu.',
    MANEUVERS: 'Deklaracje zamknięte. Na przemian po jednej karcie manewru.',
    COMBAT: 'Starcie rozstrzyga się jednocześnie.',
    END: 'Partia rozstrzygnięta.',
  } satisfies Record<Phase, string>,

  typy: {
    RECRUIT: 'Werbunek',
    SUPPLY: 'Zaopatrzenie',
    AMBUSH: 'Zasadzka',
    INTERVENTION: 'Interwencja',
    MANEUVER: 'Manewr',
  } satisfies Record<CardType, string>,

  strefy: {
    MAIN: 'Linia główna',
    FLANK: 'Flanka',
    REAR: 'Tylna linia',
  } satisfies Record<Zone, string>,

  rozkazy: {
    ATTACK: 'Atak',
    DEFEND: 'Obrona',
    NONE: 'Postój',
  },

  powodySmierci: {
    DAMAGE: 'przewaga ofensywy',
    RETALIATION: 'odwet obrońcy',
    DUEL: 'pojedynek',
  } satisfies Record<DeathReason, string>,

  gra: {
    tura: 'Tura',
    zaopatrzenie: 'Zaopatrzenie',
    dziennik: 'Dziennik',
    talia: 'Talia',
    odrzucone: 'Odrzucone',
    reka: 'Twoja ręka',
    zasadzki: 'Zasadzki',
    liniaBitewna: 'Linia bitewna',
    pasuj: 'Pasuj',
    zakonczDobieranie: 'Gotowe',
    wymien: 'Wymień zaznaczone',
    odrzucIWymien: 'Odrzuć 1 i wymień resztę',
    dalej: 'Dalej',
    menu: 'Menu',
    ofensywa: 'OFN',
    defensywa: 'DEF',
    zaczyna: 'zaczyna',
    twojRuch: 'Twój ruch',
    ruchPrzeciwnika: 'Ruch przeciwnika',
    spasowal: 'spasował',
    przelamanie: 'Przełamanie',
    wybierzCel: 'Wybierz cel ataku',
    wybierzPole: 'Wybierz pole',
    anuluj: 'Anuluj',
    zwiadowca: 'Zwiad: możesz zmienić rozkaz',
    zwiadZmien: 'Koryguj rozkaz zwiadowcy',
    wydajRozkaz: 'Wydaj rozkaz jednemu oddziałowi',
    resztaStoi: 'Reszta stoi',
    zostalo: 'Bez rozkazu',
    kostka: 'Rzut o inicjatywę',
    przeciwnikMysli: 'Przeciwnik się zastanawia…',
  },

  koniec: {
    zwyciestwo: 'Zwycięstwo',
    remis: 'Remis',
    wygral: (gracz: string) => `Wygrywa ${gracz}`,
    turyRozegrane: 'Rozegrane tury',
    jeszczeRaz: 'Jeszcze raz',
    doMenu: 'Do menu',
  },

  gracze: {
    P1: 'Gracz 1',
    P2: 'Gracz 2',
  } satisfies Record<PlayerId, string>,

  bot: 'Komputer',

  blad: {
    naglowek: 'Coś poszło nie tak',
    opis: 'Silnik zgłosił błąd. Wróć do menu i zacznij nową partię.',
  },
} as const;

export function nazwaGracza(player: PlayerId, botPlayer: PlayerId | null): string {
  return botPlayer === player ? T.bot : T.gracze[player];
}
