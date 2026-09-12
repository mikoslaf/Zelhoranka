import type {
  CardId,
  Column,
  FieldId,
  GameState,
  LogEntry,
  Order,
  PlayerId,
  Uid,
} from '../silnik/types';
import { COLUMNS, fieldId, opponentOf } from '../silnik/board';

/**
 * Model widoku dla jednego gracza.
 *
 * Gra jest teraz grą pełnej informacji: ręce są jawne, rozkazy deklarowane
 * na przemian i od razu widoczne. Zniknęła zasłona hot-seat i cała maszyneria
 * wycinania cudzych danych — ten moduł tylko porządkuje stan pod render,
 * nie pilnuje już tajemnic.
 *
 * Jedyne, co pozostaje zakryte, to ZAWARTOŚĆ TALII — i to symetrycznie
 * dla obu stron, bo nikt jej nie zna. Dzięki temu w grze zostaje element
 * niepewności, bez przewagi którejkolwiek strony.
 */

export type WidokGracza = {
  ja: PlayerId;
  przeciwnik: PlayerId;
  /** Rzędy od góry ekranu: tył przeciwnika, przód przeciwnika, przód mój, tył mój. */
  rzedy: { klucz: string; pola: FieldId[] }[];
  mojaReka: CardId[];
  rekaPrzeciwnika: CardId[];
  mojeRozkazy: Order[];
  rozkazyPrzeciwnika: Order[];
  mojeZasadzki: { uid: Uid; cardId: CardId }[];
  zasadzkiPrzeciwnika: { uid: Uid; cardId: CardId }[];
  dziennik: LogEntry[];
};

/** Kolejność rzędów na ekranie: przeciwnik u góry, gracz na dole (§5). */
export function rzedyDla(viewPlayer: PlayerId): { klucz: string; pola: FieldId[] }[] {
  const wrog = opponentOf(viewPlayer);
  const rzad = (p: PlayerId, r: 'F' | 'R'): FieldId[] =>
    COLUMNS.map((c) => fieldId(p, r, c as Column));
  return [
    { klucz: `${wrog}-R`, pola: rzad(wrog, 'R') },
    { klucz: `${wrog}-F`, pola: rzad(wrog, 'F') },
    { klucz: `${viewPlayer}-F`, pola: rzad(viewPlayer, 'F') },
    { klucz: `${viewPlayer}-R`, pola: rzad(viewPlayer, 'R') },
  ];
}

export function widokDla(state: GameState, viewPlayer: PlayerId): WidokGracza {
  const przeciwnik = opponentOf(viewPlayer);

  return {
    ja: viewPlayer,
    przeciwnik,
    rzedy: rzedyDla(viewPlayer),
    mojaReka: state.players[viewPlayer].hand,
    rekaPrzeciwnika: state.players[przeciwnik].hand,
    mojeRozkazy: state.orders[viewPlayer],
    rozkazyPrzeciwnika: state.orders[przeciwnik],
    mojeZasadzki: state.players[viewPlayer].ambushes.map((a) => ({
      uid: a.uid,
      cardId: a.cardId,
    })),
    zasadzkiPrzeciwnika: state.players[przeciwnik].ambushes.map((a) => ({
      uid: a.uid,
      cardId: a.cardId,
    })),
    dziennik: state.log,
  };
}

/** Rozkaz widoczny dla danego pola — wszystkie rozkazy są jawne. */
export function rozkazDla(widok: WidokGracza, uid: Uid, wlasciciel: PlayerId): Order | null {
  const lista = wlasciciel === widok.ja ? widok.mojeRozkazy : widok.rozkazyPrzeciwnika;
  return lista.find((o) => o.unit === uid) ?? null;
}
