import { useEffect, useReducer } from 'react'
import { initialState, reducer } from '../game/state'
import type { Action } from '../game/state'
import type { MatchState } from '../game/types'
import type { Match } from './types'

/** Beat between operations during resolution, so each reads as its own event. */
const RESOLVE_INTERVAL_MS = 850

/**
 * Hot-seat: one device, one reducer, and whoever holds it is the active player.
 * Resolution is paced here rather than in the UI because networked play will
 * pace it from the server, and both need the same seam.
 */
export function useLocalMatch(): Match {
  // Whoever holds the device is the active player, so the actor is implied.
  const [state, dispatch] = useReducer(
    (prev: MatchState, action: Action) => reducer(prev, action),
    undefined,
    initialState,
  )

  // Both queues drain during resolution, so both must retrigger the timer —
  // watching only the strike queue stalls the run after the last recon.
  const active = state.players[state.activePlayer]
  const pending = active.queued.length + active.queuedRecon.length

  useEffect(() => {
    if (state.phase !== 'resolving') return
    const timer = setTimeout(
      () => dispatch({ type: 'resolveNext' }),
      RESOLVE_INTERVAL_MS,
    )
    return () => clearTimeout(timer)
  }, [state.phase, pending])

  return {
    state,
    dispatch,
    you: state.activePlayer,
    yourTurn: true,
    status: 'local',
    waitingOn: null,
  }
}
