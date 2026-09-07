import type { BoardId } from './constants'

export type PlayerId = 'p1' | 'p2'

/** Distance bands from the enemy border, which sits at the top of the map. */
export type ZoneId = 'close' | 'mid' | 'long'

export type StructureKind = 'airfield' | 'antiair' | 'command'

export interface Structure {
  id: string
  kind: StructureKind
  owner: PlayerId
  col: number
  row: number
  hp: number
  maxHp: number
  /**
   * True until the turn is handed over. Only a structure raised this turn can
   * be taken back for a refund; older ones would let a player relocate their
   * whole base for free every turn.
   */
  refundable: boolean
}

/** What a destroyed structure leaves behind on its owner's map. */
export interface Ruin {
  col: number
  row: number
  kind: StructureKind
}

/** Ground scarred by a strike that landed. See COMBAT.cratersBlockBuilding. */
export interface Crater {
  col: number
  row: number
}

/**
 * A point in "stacked" space, where the two grids face each other across the
 * border at y = 0. See game/combat.ts.
 */
export interface Point {
  x: number
  y: number
}

export type StrikeOutcome = 'intercepted' | 'miss' | 'hit' | 'destroyed'

export interface Strike {
  id: string
  attacker: PlayerId
  sourceId: string
  targetCol: number
  targetRow: number
  outcome: StrikeOutcome
  /** Flight path in stacked space, for drawing on both maps. */
  from: Point
  to: Point
  /** Where an interceptor stopped it, when it was intercepted. */
  interceptedAt?: Point
  /** Which battery made the kill — the defender is told, the attacker is not. */
  interceptorId?: string
  /** Kind of structure struck, when the strike connected. */
  struckKind?: StructureKind
}

/** What an attacker has learned about one enemy cell by shooting at it. */
export type CellKnowledge = 'empty' | 'struck' | 'destroyed'

export interface KnownCell {
  col: number
  row: number
  knowledge: CellKnowledge
}

export interface PlayerState {
  id: PlayerId
  name: string
  structures: Structure[]
  ruins: Ruin[]
  craters: Crater[]
  /** This player's picture of the ENEMY grid, built up by shooting at it. */
  known: KnownCell[]
  /** Defense budget. Carries over between turns. */
  budget: number
  actionPoints: number
  /** Guards against an instant win when a player has simply never built one. */
  hasBuiltAirfield: boolean
  /** Set once the required starting structures are down. */
  setupDone: boolean
}

/** A target marked during planning, not yet fired. */
export interface QueuedStrike {
  id: string
  sourceId: string
  col: number
  row: number
}

/**
 * `setup`     — placing required starting structures, before turn 1.
 * `briefing`  — what happened to you since your last turn.
 * `planning`  — build, and mark targets.
 * `resolving` — the committed queue is flying, one strike at a time.
 * `pass`      — hand-off screen.
 * `gameover`  — a winner has been declared.
 */
export type Phase =
  | 'setup'
  | 'briefing'
  | 'planning'
  | 'resolving'
  | 'pass'
  | 'gameover'

/** Which map the active player is currently looking at. */
export type MapView = 'own' | 'enemy'

/** Build places structures; attack launches strikes from a chosen airfield. */
export type PlanMode = 'build' | 'attack'

export interface MatchState {
  /** Chosen at match start; changing it mid-match would invalidate placements. */
  boardId: BoardId
  turn: number
  activePlayer: PlayerId
  phase: Phase
  view: MapView
  mode: PlanMode
  selectedKind: StructureKind
  /** Airfield the next strike launches from. */
  selectedSourceId: string | null
  players: Record<PlayerId, PlayerState>
  /** Whether the hand-off screen was reached from setup or from a played turn. */
  passOrigin: 'setup' | 'turn'
  /** Targets marked but not yet fired. Action points are reserved on queueing. */
  queued: QueuedStrike[]
  /** Strikes resolved this turn, newest last. Drives briefings and overlays. */
  log: Strike[]
  winner: PlayerId | null
}
