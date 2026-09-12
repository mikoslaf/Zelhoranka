/** Publiczne API silnika. UI i bot korzystają wyłącznie z tego pliku. */
export * from './types';
export { reduce } from './reducer';
export { czyAkcjaLegalna, canPerform, legalActions, legalFieldsForCard } from './actions';
export { createGame, cloneState, supplyLimit } from './state';
export { CARDS, RULES, CONFIG, card, ruleDef, isRecruit, recruit } from './cards';
export { assertRegistryComplete } from './rules';
export {
  effOffense,
  effDefense,
  baseOffense,
  baseDefense,
  legalTargets,
  livingUnitsOf,
  countUnits,
  unitAt,
  unitByUid,
  isScout,
} from './stats';
export { breakthroughScore, hasBreakthrough, totalOffense, checkVictory } from './victory';
export { available, canPay } from './phases/logistics';
export { orderFor } from './phases/strategy';
export {
  allFields,
  fieldsOf,
  fieldId,
  parseField,
  zoneOf,
  opponentOf,
  rowNeighbours,
  COLUMNS,
  ROWS,
  PLAYERS,
} from './board';
