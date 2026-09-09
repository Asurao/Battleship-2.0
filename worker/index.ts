export { MatchRoom } from './MatchRoom'

interface Env {
  MATCH: DurableObjectNamespace
}

/**
 * Static assets are served ahead of this Worker, so the only thing reaching
 * here is the socket for a match. The match code names the Durable Object, so
 * a shared link resolves to the same room for both players.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname !== '/ws') return new Response('Not found', { status: 404 })

    const code = (url.searchParams.get('code') ?? '').toUpperCase()
    if (!/^[A-Z0-9]{4,8}$/.test(code)) {
      return new Response('Bad match code', { status: 400 })
    }

    const room = env.MATCH.get(env.MATCH.idFromName(code))
    return room.fetch(request)
  },
}
