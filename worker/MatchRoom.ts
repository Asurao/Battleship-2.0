import { DurableObject } from 'cloudflare:workers'
import { initialState, reducer } from '../src/game/state'
import type { Action } from '../src/game/state'
import type { BoardId } from '../src/game/constants'
import type { MatchState, PlayerId } from '../src/game/types'
import type { ClientMessage, ServerMessage, SocketMeta } from './protocol'

/** Beat between operations during resolution, matching the local game. */
const RESOLVE_INTERVAL_MS = 850

interface Seats {
  p1?: string
  p2?: string
}

/**
 * One match. Holds the authoritative state and relays it to both players.
 *
 * The state lives in storage rather than memory because the WebSocket
 * hibernation API evicts the object while players are thinking — that is what
 * keeps an idle match free, and it means a match also survives a browser close.
 */
export class MatchRoom extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 })
    }
    const pair = new WebSocketPair()
    // Hibernatable: the socket stays open on Cloudflare's edge while this
    // object sleeps, so no compute is billed between moves.
    this.ctx.acceptWebSocket(pair[1])
    return new Response(null, { status: 101, webSocket: pair[0] })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    let msg: ClientMessage
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw))
    } catch {
      return this.send(ws, { t: 'error', reason: 'Malformed message' })
    }

    if (msg.t === 'join') return this.join(ws, msg.token, msg.boardId)
    if (msg.t === 'action') return this.act(ws, msg.action)
  }

  async webSocketClose(ws: WebSocket) {
    ws.close()
    await this.broadcast()
  }

  /**
   * Seats are claimed by browser token, not by arrival order, so a refresh
   * resumes the same side and a third viewer cannot take someone's army.
   */
  private async join(ws: WebSocket, token: string, boardId?: BoardId) {
    const seats = ((await this.ctx.storage.get<Seats>('seats')) ?? {}) as Seats

    let seat: PlayerId | null = null
    if (seats.p1 === token || !seats.p1) seat = 'p1'
    else if (seats.p2 === token || !seats.p2) seat = 'p2'

    if (!seat) {
      this.send(ws, { t: 'full' })
      return ws.close(1008, 'Match is full')
    }

    seats[seat] = token
    await this.ctx.storage.put('seats', seats)
    ws.serializeAttachment({ seat, token } satisfies SocketMeta)

    // The first player through the door decides the board; it cannot change
    // once a match is under way.
    if (!(await this.ctx.storage.get<MatchState>('state'))) {
      await this.ctx.storage.put('state', initialState(boardId))
    }
    await this.broadcast()
  }

  private async act(ws: WebSocket, action: Action) {
    const meta = ws.deserializeAttachment() as SocketMeta | null
    if (!meta) return this.send(ws, { t: 'error', reason: 'Join first' })

    const state = await this.ctx.storage.get<MatchState>('state')
    if (!state) return this.send(ws, { t: 'error', reason: 'No match yet' })

    // Deployment is simultaneous, so both seats may act during setup; each is
    // only ever touching their own territory. Once the war starts, actions are
    // gated on holding the turn — a guard against a stray click landing as the
    // turn changes hands, rather than against cheating.
    const openToBoth = state.phase === 'setup' || action.type === 'resetMatch'
    if (!openToBoth && meta.seat !== state.activePlayer) {
      return this.send(ws, { t: 'error', reason: 'Not your turn' })
    }

    await this.apply(state, action, meta.seat)
  }

  private async apply(state: MatchState, action: Action, actor: PlayerId) {
    let next = reducer(state, action, actor)
    // There is no device to hand over online, so the pass screen has nothing to
    // say. Step straight through it to the incoming player's briefing.
    while (next.phase === 'pass') next = reducer(next, { type: 'confirmPass' })
    await this.ctx.storage.put('state', next)
    await this.broadcast()
    if (next.phase === 'resolving') this.scheduleResolve()
  }

  /**
   * Paced here so both players watch the same beat. A plain timer is fine: it
   * keeps this object awake for the few seconds a resolution takes, which is
   * exactly when it should be awake.
   */
  private scheduleResolve() {
    setTimeout(async () => {
      const state = await this.ctx.storage.get<MatchState>('state')
      if (!state || state.phase !== 'resolving') return
      await this.apply(state, { type: 'resolveNext' }, state.activePlayer)
    }, RESOLVE_INTERVAL_MS)
  }

  private async broadcast() {
    const state = await this.ctx.storage.get<MatchState>('state')
    if (!state) return
    const sockets = this.ctx.getWebSockets()
    const seated = new Set(
      sockets
        .map((s) => (s.deserializeAttachment() as SocketMeta | null)?.seat)
        .filter(Boolean),
    )
    for (const ws of sockets) {
      const meta = ws.deserializeAttachment() as SocketMeta | null
      if (!meta) continue
      this.send(ws, {
        t: 'state',
        state,
        you: meta.seat,
        opponentHere: seated.has(meta.seat === 'p1' ? 'p2' : 'p1'),
      })
    }
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    try {
      ws.send(JSON.stringify(msg))
    } catch {
      // Socket already gone; the next broadcast will drop it.
    }
  }
}
