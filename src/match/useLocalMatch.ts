import { useEffect, useReducer } from 'react'
import { initialState, reducer } from '../game/state'
import type { Match } from './types'

/** Beat between operations during resolution, so each reads as its own event. */
const RESOLVE_INTERVAL_MS = 850

/**
 * Hot-seat: one device, one reducer, and whoever holds it is the active player.
 * Resolution is paced here rather than in the UI because networked play will
 * pace it from the server, and both need the same seam.
 */
export function useLocalMatch(): Match {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  useEffect(() => {
    if (state.phase !== 'resolving') return
    const timer = setTimeout(
      () => dispatch({ type: 'resolveNext' }),
      RESOLVE_INTERVAL_MS,
    )
    return () => clearTimeout(timer)
    // Both queues drain here, so both lengths must retrigger the timer —
    // watching only the strike queue stalls the run after the last recon.
  }, [state.phase, state.queued.length, state.queuedRecon.length])

  return {
    state,
    dispatch,
    you: state.activePlayer,
    yourTurn: true,
    status: 'local',
    waitingOn: null,
  }
}
