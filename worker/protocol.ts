import type { Action } from '../src/game/state'
import type { BoardId } from '../src/game/constants'
import type { MatchState, PlayerId } from '../src/game/types'

export type ClientMessage =
  | { t: 'join'; token: string; boardId?: BoardId }
  | { t: 'action'; action: Action }

export type ServerMessage =
  | {
      t: 'state'
      state: MatchState
      you: PlayerId
      opponentHere: boolean
    }
  /** Both seats belong to other browsers. */
  | { t: 'full' }
  | { t: 'error'; reason: string }

/** Stored on each socket so a seat survives hibernation. */
export interface SocketMeta {
  seat: PlayerId
  token: string
}
