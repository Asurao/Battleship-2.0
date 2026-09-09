import type { Action } from '../game/state'
import type { MatchState, PlayerId } from '../game/types'

/** How this client is talking to the match. */
export type MatchStatus = 'local' | 'connecting' | 'online' | 'reconnecting'

/**
 * The seam between the game and how it is being played.
 *
 * Hot-seat and networked play differ in exactly one idea: hot-seat assumes you
 * are always whoever's turn it is, and networked play does not. Everything the
 * UI needs to stop assuming that lives here, so the same screens serve both.
 */
export interface Match {
  state: MatchState
  dispatch: (action: Action) => void
  /** The seat this client occupies. In hot-seat it follows the active player. */
  you: PlayerId
  /** Whether this client may act right now. */
  yourTurn: boolean
  status: MatchStatus
  /** Set when the other seat is empty or has dropped. Null while playing. */
  waitingOn: string | null
}
