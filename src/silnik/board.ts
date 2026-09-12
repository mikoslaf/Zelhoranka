import type { Column, FieldId, PlayerId, Row, Zone } from './types';

/**
 * Geometria planszy. 16 pól, 8 na gracza.
 * Kolumny liczone tak samo dla obu graczy, więc `P1-F2` stoi naprzeciw `P2-F2` (§4.2).
 */

export const COLUMNS: Column[] = [0, 1, 2, 3];
export const ROWS: Row[] = ['F', 'R'];
export const PLAYERS: PlayerId[] = ['P1', 'P2'];

export function fieldId(player: PlayerId, row: Row, column: Column): FieldId {
  return `${player}-${row}${column}`;
}

export function parseField(id: FieldId): { player: PlayerId; row: Row; column: Column } {
  const player = id.slice(0, 2) as PlayerId;
  const row = id[3] as Row;
  const column = Number(id[4]) as Column;
  return { player, row, column };
}

export function allFields(): FieldId[] {
  const out: FieldId[] = [];
  for (const p of PLAYERS) for (const r of ROWS) for (const c of COLUMNS) out.push(fieldId(p, r, c));
  return out;
}

export function fieldsOf(player: PlayerId): FieldId[] {
  const out: FieldId[] = [];
  for (const r of ROWS) for (const c of COLUMNS) out.push(fieldId(player, r, c));
  return out;
}

export function zoneOf(id: FieldId): Zone {
  const { row, column } = parseField(id);
  if (row === 'R') return 'REAR';
  return column === 0 || column === 3 ? 'FLANK' : 'MAIN';
}

export function opponentOf(player: PlayerId): PlayerId {
  return player === 'P1' ? 'P2' : 'P1';
}

/** Sąsiedzi w tym samym rzędzie tego samego gracza — używane przez regułę „osłona". */
export function rowNeighbours(id: FieldId): FieldId[] {
  const { player, row, column } = parseField(id);
  const out: FieldId[] = [];
  if (column > 0) out.push(fieldId(player, row, (column - 1) as Column));
  if (column < 3) out.push(fieldId(player, row, (column + 1) as Column));
  return out;
}

export function isColumn(value: number): value is Column {
  return value === 0 || value === 1 || value === 2 || value === 3;
}
