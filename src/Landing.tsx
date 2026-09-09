import { useState } from 'react'
import { BOARDS } from './game/constants'
import type { BoardId } from './game/constants'
import { isMatchCode, newMatchCode, normaliseCode } from './match/matchCode'

interface LandingProps {
  onHost: (code: string, boardId: BoardId) => void
  onJoin: (code: string) => void
  onHotSeat: () => void
}

export function Landing({ onHost, onJoin, onHotSeat }: LandingProps) {
  const [boardId, setBoardId] = useState<BoardId>('standard')
  const [code, setCode] = useState('')
  const joinable = isMatchCode(normaliseCode(code))

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-slate-100">Battleship 2.0</h1>
          <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-slate-600">
            Prototype
          </p>
        </div>

        <section className="space-y-3 rounded border border-slate-700 bg-slate-900/60 p-4">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Host a match
          </h2>
          <p className="text-[11px] leading-snug text-slate-500">
            You get a link to send your opponent. The board size is fixed once
            the match starts, so choose it now.
          </p>
          <div className="space-y-1">
            {Object.values(BOARDS).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setBoardId(preset.id)}
                className={`w-full rounded border px-2.5 py-1.5 text-left transition ${
                  preset.id === boardId
                    ? 'border-slate-400 bg-slate-700/70'
                    : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
                }`}
              >
                <span className="block text-[11px] text-slate-100">
                  {preset.label}
                </span>
                <span className="block text-[9px] text-slate-500">
                  {preset.note}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onHost(newMatchCode(), boardId)}
            className="w-full rounded border border-rose-400/70 bg-rose-500/20 px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/40"
          >
            Create match
          </button>
        </section>

        <section className="space-y-3 rounded border border-slate-700 bg-slate-900/60 p-4">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Join a match
          </h2>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (joinable) onJoin(normaliseCode(code))
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Match code"
              spellCheck={false}
              className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm uppercase tracking-[0.2em] text-slate-100 outline-none focus:border-slate-500"
            />
            <button
              type="submit"
              disabled={!joinable}
              className="rounded border border-slate-500 bg-slate-800 px-4 py-2 text-sm text-slate-100 transition hover:bg-slate-700 disabled:opacity-40"
            >
              Join
            </button>
          </form>
        </section>

        <button
          type="button"
          onClick={onHotSeat}
          className="w-full rounded border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
        >
          Play hot-seat on this device
        </button>
      </div>
    </div>
  )
}
