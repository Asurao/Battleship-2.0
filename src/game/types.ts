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

/** What an attacker has learned about one enemy cell. */
export type CellKnowledge = 'empty' | 'scouted' | 'struck' | 'destroyed'

export interface KnownCell {
  col: number
  row: number
  knowledge: CellKnowledge
  /** What recon saw standing here, when the cell was scouted. */
  kind?: StructureKind
}

export interface QueuedRecon {
  id: string
  sourceId: string
  col: number
  row: number
}

export type ReconOutcome = 'scouted' | 'intercepted'

export interface ReconFlight {
  id: string
  attacker: PlayerId
  sourceId: string
  targetCol: number
  targetRow: number
  outcome: ReconOutcome
  from: Point
  to: Point
  /** Where an interceptor stopped it, when it was intercepted. */
  interceptedAt?: Point
  /** Cells the flight actually overflew before it ended. */
  revealed: number
}

export interface PlayerState {
  id: PlayerId
  name: string
  structures: Structure[]
  ruins: Ruin[]
  craters: Crater[]
  /** This player's picture of the ENEMY grid, built up by shooting at it. */
  known: KnownCell[]
  /**
   * Where this player's strikes were shot down, in enemy-map coordinates. A
   * battery sits within its engagement radius of each of these, so they can be
   * triangulated. Persists across turns until cleared by hand.
   */
  interceptions: Point[]
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

/** Build places structures; recon scouts; attack launches strikes. */
export type PlanMode = 'build' | 'recon' | 'attack'

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
  /** Recon flights planned this turn. They resolve before any strike does. */
  queuedRecon: QueuedRecon[]
  /** Strikes resolved this turn, newest last. Drives briefings and overlays. */
  log: Strike[]
  /** Recon flights resolved this turn. */
  reconLog: ReconFlight[]
  winner: PlayerId | null
}
