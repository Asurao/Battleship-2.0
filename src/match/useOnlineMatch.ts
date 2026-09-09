import { useCallback, useEffect, useRef, useState } from 'react'
import type { Action } from '../game/state'
import type { BoardId } from '../game/constants'
import type { MatchState, PlayerId } from '../game/types'
import type { Match, MatchStatus } from './types'

/**
 * Identifies this browser to a match, so a refresh — or coming back tomorrow —
 * resumes the same seat rather than finding the match full.
 *
 * Two tabs in one browser would otherwise share an identity and fight over one
 * seat, so `?seat=b` selects a second identity. That is what makes playing
 * yourself across two tabs possible, which is the quickest way to test.
 */
export function browserToken(): string {
  const seat = new URLSearchParams(location.search).get('seat')
  const key = `battleship20.token${seat ? `.${seat}` : ''}`
  let token = localStorage.getItem(key)
  if (!token) {
    token = crypto.randomUUID()
    localStorage.setItem(key, token)
  }
  return token
}

const RETRY_MS = 1500

interface OnlineState {
  state: MatchState | null
  you: PlayerId
  opponentHere: boolean
  status: MatchStatus
  full: boolean
}

/**
 * The networked half of the Match seam. The server holds the state and rolls
 * the dice; this only sends intent and renders what comes back.
 */
export function useOnlineMatch(code: string, boardId?: BoardId): Match | null {
  const socket = useRef<WebSocket | null>(null)
  const retry = useRef<number | undefined>(undefined)
  const [net, setNet] = useState<OnlineState>({
    state: null,
    you: 'p1',
    opponentHere: false,
    status: 'connecting',
    full: false,
  })

  useEffect(() => {
    let closed = false

    const connect = () => {
      if (closed) return
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${proto}://${location.host}/ws?code=${code}`)
      socket.current = ws

      ws.onopen = () => {
        ws.send(JSON.stringify({ t: 'join', token: browserToken(), boardId }))
      }
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string)
        if (msg.t === 'state') {
          setNet({
            state: msg.state,
            you: msg.you,
            opponentHere: msg.opponentHere,
            status: 'online',
            full: false,
          })
        } else if (msg.t === 'full') {
          setNet((n) => ({ ...n, status: 'online', full: true }))
        }
      }
      ws.onclose = () => {
        if (closed) return
        // Keep the last known board on screen while we come back.
        setNet((n) => ({ ...n, status: 'reconnecting' }))
        retry.current = window.setTimeout(connect, RETRY_MS)
      }
    }

    connect()
    return () => {
      closed = true
      window.clearTimeout(retry.current)
      socket.current?.close()
    }
  }, [code, boardId])

  const dispatch = useCallback((action: Action) => {
    const ws = socket.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ t: 'action', action }))
    }
  }, [])

  if (net.full) {
    return {
      state: null as unknown as MatchState,
      dispatch,
      you: 'p1',
      yourTurn: false,
      status: 'online',
      waitingOn: 'This match already has two players.',
    }
  }
  if (!net.state) return null

  const me = net.state.players[net.you]
  const deploying = net.state.phase === 'setup'
  // During deployment neither side is waiting on the other; you act until you
  // declare yourself ready, and the match starts when both have.
  const yourTurn =
    net.status === 'online' &&
    (deploying ? !me.setupDone : net.you === net.state.activePlayer)

  return {
    state: net.state,
    dispatch,
    you: net.you,
    yourTurn,
    status: net.status,
    waitingOn: !net.opponentHere
      ? 'Waiting for your opponent to join…'
      : deploying
        ? me.setupDone
          ? 'Waiting for your opponent to finish deploying…'
          : null
        : net.you !== net.state.activePlayer
          ? `${net.state.players[net.state.activePlayer].name} is taking their turn…`
          : null,
  }
}
