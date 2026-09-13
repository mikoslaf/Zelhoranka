import cardsJson from '../data/cards.json';
import rulesJson from '../data/rules.json';
import configJson from '../data/config.json';
import type { Card, CardId, RecruitCard, RuleDef } from './types';

/**
 * Dostęp do danych. Karty, reguły i konfiguracja są danymi, nie kodem (§2.5) —
 * dodanie karty nie wymaga dotykania silnika ani komponentów.
 */

export const CARDS: Card[] = cardsJson as unknown as Card[];
export const RULES: RuleDef[] = rulesJson as unknown as RuleDef[];

export type GameConfig = {
  handSize: number;
  handMax: number;
  mulliganFirstTurn: 'all' | number;
  mulliganLater: number;
  mulliganDiscardForRest: boolean;
  supplyBase: number;
  supplyLimitMode: 'turn' | 'turn_plus_base';
  supplyModel: 'pool' | 'exact';
  breakthroughThreshold: number;
  duelTie: 'both_live' | 'both_die';
  duelSupplementsDamage: boolean;
  retaliationSkipUnaffordable: boolean;
  reshuffleDiscard: boolean;
  maxTurns: number;
  turnOrderMode: 'more_units_first' | 'alternate';
  logisticsAlternates: boolean;
  idleResetSeconds: number;
  deckSize: number;
};

export const CONFIG: GameConfig = configJson as unknown as GameConfig;

const CARD_INDEX: Map<CardId, Card> = new Map(CARDS.map((c) => [c.id, c]));
const RULE_INDEX: Map<string, RuleDef> = new Map(RULES.map((r) => [r.id, r]));

export function card(id: CardId): Card {
  const found = CARD_INDEX.get(id);
  if (!found) throw new Error(`Nieznana karta: ${id}`);
  return found;
}

export function ruleDef(id: string): RuleDef {
  const found = RULE_INDEX.get(id);
  if (!found) throw new Error(`Nieznana reguła: ${id}`);
  return found;
}

export function isRecruit(c: Card): c is RecruitCard {
  return c.type === 'RECRUIT';
}

export function recruit(id: CardId): RecruitCard {
  const c = card(id);
  if (!isRecruit(c)) throw new Error(`Karta ${id} nie jest werbunkiem`);
  return c;
}

/** Jedna talia = każda karta ×`copies`. Obaj gracze grają identycznymi taliami (§14.1). */
export function buildDeckList(): CardId[] {
  const out: CardId[] = [];
  for (const c of CARDS) for (let i = 0; i < c.copies; i++) out.push(c.id);
  return out;
}
