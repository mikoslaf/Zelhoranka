/**
 * Typy silnika. Ten plik (i cały katalog `silnik/`) nie zna DOM-u, Reacta
 * ani `Math.random()` — patrz §2 instrukcji.
 */

export type PlayerId = 'P1' | 'P2';

export type Phase = 'SETUP' | 'DRAW' | 'LOGISTICS' | 'STRATEGY' | 'MANEUVERS' | 'COMBAT' | 'END';

export type Zone = 'MAIN' | 'FLANK' | 'REAR';
export type Row = 'F' | 'R';
export type Column = 0 | 1 | 2 | 3;

/** `P1-F0` … `P2-R3` */
export type FieldId = string;
export type CardId = string;
export type Uid = string;

export type Reach = 'FRONT' | 'DEEP' | 'RANGED';

export type CardType = 'RECRUIT' | 'SUPPLY' | 'AMBUSH' | 'INTERVENTION' | 'MANEUVER';

export type AmbushTrigger = 'ENEMY_DEPLOYED' | 'ORDERS_REVEALED';

export type InterventionRequirement =
  | 'PHASE_LOGISTICS'
  | 'PHASE_MANEUVERS'
  | 'HAND_BELOW_MAX'
  | 'HAS_UNIT_ON_BOARD';

export type AttackProfile = {
  offsets: number[];
  reach: Reach;
  fromRear: boolean;
};

export type CardBase = {
  id: CardId;
  name: string;
  type: CardType;
  text: string;
  rules: string[];
  copies: number;
  art?: string;
};

export type RecruitCard = CardBase & {
  type: 'RECRUIT';
  offense: number;
  defense: number;
  cost: number;
  zones: Zone[];
  attack: AttackProfile;
};

export type SupplyCard = CardBase & { type: 'SUPPLY'; supply: number };

export type AmbushCard = CardBase & {
  type: 'AMBUSH';
  trigger: AmbushTrigger;
  cost: number;
};

export type InterventionCard = CardBase & {
  type: 'INTERVENTION';
  requirements: InterventionRequirement[];
  effect: string;
};

export type ManeuverCard = CardBase & { type: 'MANEUVER'; effect: string };

export type Card = RecruitCard | SupplyCard | AmbushCard | InterventionCard | ManeuverCard;

export type RuleDef = {
  id: string;
  name: string;
  symbol: string;
  text: string;
  hooks: string[];
};

/** Modyfikator statystyk. `expires` mówi, kiedy silnik go sprząta. */
export type Modifier = {
  source: string;
  offense?: number;
  defense?: number;
  expires: 'END_OF_TURN' | 'NEVER';
};

export type Unit = {
  uid: Uid;
  cardId: CardId;
  owner: PlayerId;
  field: FieldId;
  modifiers: Modifier[];
  dead: boolean;
  /** numer tury, w której jednostka weszła na planszę (dla „szarży") */
  deployedTurn: number;
  /** ile razy „niezłomność" uratowała jednostkę w tej turze */
  savedThisTurn: number;
};

export type Order =
  | { unit: Uid; kind: 'ATTACK'; target: FieldId }
  | { unit: Uid; kind: 'DEFEND' }
  | { unit: Uid; kind: 'NONE' };

export type AmbushInPlay = {
  uid: Uid;
  cardId: CardId;
  owner: PlayerId;
  trigger: AmbushTrigger;
};

export type PlayerState = {
  deck: CardId[];
  hand: CardId[];
  discard: CardId[];
  ambushes: AmbushInPlay[];
  supplyPool: number;
  supplySpent: number;
  mulligansUsed: number;
  /** ile razy w tej turze użyto „odrzuć 1, wymień resztę" */
  deepMulligansUsed: number;
  passedLogistics: boolean;
  passedManeuvers: boolean;
  drawDone: boolean;
  /** zwiadowcy, którzy wykorzystali już zmianę rozkazu w tej turze */
  scoutUsed: Uid[];
  deckExhausted: boolean;
};

export type LogEntry = {
  turn: number;
  phase: Phase;
  text: string;
  player?: PlayerId;
};

export type RngState = { seed: number };

export type GameState = {
  turn: number;
  phase: Phase;
  activePlayer: PlayerId;
  firstPlayer: PlayerId;
  logisticsFirstPlayer: PlayerId;
  players: Record<PlayerId, PlayerState>;
  board: Record<FieldId, Unit | null>;
  orders: Record<PlayerId, Order[]>;
  revealed: boolean;
  log: LogEntry[];
  rng: RngState;
  winner: PlayerId | 'DRAW' | null;
  /** ostatni rzut kostką (inicjatywa) — UI animuje, silnik tylko zapisuje */
  lastRoll: { p1: number; p2: number } | null;
  uidCounter: number;
  /** ustawiane w fazie walki, czyszczone na starcie kolejnej tury */
  lastCombat: CombatReport | null;
};

export type DeathReason = 'DAMAGE' | 'RETALIATION' | 'DUEL';

export type CombatDeath = {
  uid: Uid;
  owner: PlayerId;
  cardId: CardId;
  field: FieldId;
  reason: DeathReason;
  detail: string;
};

export type CombatReport = {
  deaths: CombatDeath[];
  /** ile obrażeń przyszło na każde pole — do dymków z liczbami */
  incoming: Record<Uid, number>;
  arrows: { from: FieldId; to: FieldId; owner: PlayerId; offense: number }[];
};

/* ---------- Akcje ---------- */

export type GameAction =
  | { type: 'ROLL_INITIATIVE' }
  | { type: 'MULLIGAN'; player: PlayerId; cards: CardId[] }
  | { type: 'DEEP_MULLIGAN'; player: PlayerId; discard: CardId }
  | { type: 'FINISH_DRAW'; player: PlayerId }
  | { type: 'PLAY_SUPPLY'; player: PlayerId; card: CardId }
  | { type: 'DEPLOY'; player: PlayerId; card: CardId; field: FieldId }
  | { type: 'SET_AMBUSH'; player: PlayerId; card: CardId }
  | { type: 'PLAY_INTERVENTION'; player: PlayerId; card: CardId }
  | { type: 'PASS_LOGISTICS'; player: PlayerId }
  | { type: 'SET_ORDER'; player: PlayerId; order: Order }
  | { type: 'CONFIRM_ORDERS'; player: PlayerId }
  | { type: 'SCOUT_REORDER'; player: PlayerId; order: Order }
  | { type: 'PLAY_MANEUVER'; player: PlayerId; card: CardId; unit: Uid; target?: FieldId }
  | { type: 'TRIGGER_AMBUSH'; player: PlayerId; ambush: Uid; unit: Uid }
  | { type: 'PASS_MANEUVERS'; player: PlayerId }
  | { type: 'RESOLVE_COMBAT' };

/* ---------- Zdarzenia (napędzają animacje i dźwięk) ---------- */

export type GameEvent =
  | { type: 'DICE_ROLL'; p1: number; p2: number; winner: PlayerId }
  | { type: 'CARD_DRAWN'; player: PlayerId; count: number }
  | { type: 'CARD_PLAYED'; player: PlayerId; card: CardId }
  | { type: 'UNIT_DEPLOYED'; player: PlayerId; uid: Uid; field: FieldId }
  | { type: 'SUPPLY_SPENT'; player: PlayerId; amount: number }
  | { type: 'SUPPLY_GAINED'; player: PlayerId; amount: number }
  | { type: 'AMBUSH_TRIGGERED'; player: PlayerId; card: CardId; unit: Uid }
  | { type: 'ORDERS_REVEALED' }
  | { type: 'COMBAT_START'; report: CombatReport }
  | { type: 'UNIT_DIED'; uid: Uid; owner: PlayerId; field: FieldId; reason: DeathReason; detail: string }
  | { type: 'PHASE_CHANGED'; phase: Phase; player: PlayerId }
  | { type: 'TURN_CHANGED'; turn: number; firstPlayer: PlayerId }
  | { type: 'ILLEGAL_ACTION'; reason: string }
  | { type: 'GAME_WON'; winner: PlayerId | 'DRAW'; reason: string };

export type Reduced = { state: GameState; events: GameEvent[] };

export type Legality = { ok: true } | { ok: false; reason: string };
