import { useEffect, useState } from 'react'
import App from './App'
import { Landing } from './Landing'
import type { BoardId } from './game/constants'
import { isMatchCode, normaliseCode } from './match/matchCode'
import { useLocalMatch } from './match/useLocalMatch'
import { useOnlineMatch } from './match/useOnlineMatch'

/**
 * Decides how this browser is playing. The match code lives in the URL hash, so
 * the link you send someone is the match — nothing else identifies it.
 */
export function Shell() {
  const [hash, setHash] = useState(() => normaliseCode(location.hash.slice(1)))
  const [hotSeat, setHotSeat] = useState(false)
  const [boardId, setBoardId] = useState<BoardId | undefined>(undefined)

  useEffect(() => {
    const onHashChange = () => setHash(normaliseCode(location.hash.slice(1)))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  if (isMatchCode(hash)) return <OnlineGame code={hash} boardId={boardId} />
  if (hotSeat) return <LocalGame />

  return (
    <div className="h-full overflow-auto bg-slate-950 text-slate-200">
      <Landing
        onHost={(code, board) => {
          setBoardId(board)
          location.hash = code
          setHash(code)
        }}
        onJoin={(code) => {
          location.hash = code
          setHash(code)
        }}
        onHotSeat={() => setHotSeat(true)}
      />
    </div>
  )
}

function LocalGame() {
  const match = useLocalMatch()
  return <App match={match} />
}

function OnlineGame({ code, boardId }: { code: string; boardId?: BoardId }) {
  const match = useOnlineMatch(code, boardId)

  if (!match) return <Waiting code={code} message="Connecting to the match…" />
  if (match.waitingOn && !match.state) {
    return <Waiting code={code} message={match.waitingOn} />
  }
  return <App match={match} />
}

function Waiting({ code, message }: { code: string; message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center text-slate-200">
      <div className="font-mono text-3xl tracking-[0.35em] text-slate-100">
        {code}
      </div>
      <p className="max-w-sm text-sm text-slate-400">{message}</p>
      <button
        type="button"
        onClick={() =>
          navigator.clipboard?.writeText(
            `${location.origin}${location.pathname}#${code}`,
          )
        }
        className="rounded border border-slate-600 bg-slate-800 px-4 py-2 text-xs text-slate-200 transition hover:bg-slate-700"
      >
        Copy invite link
      </button>
      {!new URLSearchParams(location.search).get('seat') && (
        <a
          href={`${location.pathname}?seat=b#${code}`}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] text-slate-600 underline underline-offset-2 hover:text-slate-400"
        >
          Open a second tab as the other player (for testing)
        </a>
      )}
    </div>
  )
}
