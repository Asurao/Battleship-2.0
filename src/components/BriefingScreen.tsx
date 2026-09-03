import { COL_LABELS, structureDef } from '../game/constants'
import type { Strike } from '../game/types'

interface BriefingScreenProps {
  playerName: string
  turn: number
  incoming: Strike[]
  onContinue: () => void
}

export function BriefingScreen({
  playerName,
  turn,
  incoming,
  onContinue,
}: BriefingScreenProps) {
  const intercepted = incoming.filter((s) => s.outcome === 'intercepted').length
  const missed = incoming.filter((s) => s.outcome === 'miss').length
  const landed = incoming.filter(
    (s) => s.outcome === 'hit' || s.outcome === 'destroyed',
  )

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 px-6 py-10">
      <div className="w-full max-w-lg space-y-5">
        <div className="space-y-1 text-center">
          <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500">
            Turn {turn} · Intelligence Briefing
          </div>
          <h1 className="text-2xl font-semibold text-slate-100">
            {playerName}, here is what hit you
          </h1>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Landed" value={landed.length} tone="text-rose-300" />
          <Stat label="Intercepted" value={intercepted} tone="text-sky-300" />
          <Stat label="Missed" value={missed} tone="text-slate-400" />
        </div>

        <ul className="space-y-1.5">
          {incoming.map((strike) => {
            const where = `${COL_LABELS[strike.targetCol]}${strike.targetRow + 1}`
            return (
              <li
                key={strike.id}
                className="flex items-baseline justify-between gap-3 rounded border border-slate-800 bg-slate-900/60 px-3 py-2 text-[11px]"
              >
                <span className="font-mono text-slate-400">{where}</span>
                <span className="flex-1 text-slate-300">
                  {describe(strike)}
                </span>
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          onClick={onContinue}
          className="w-full rounded border border-slate-500 bg-slate-800 px-6 py-3 text-sm font-medium text-slate-100 transition hover:border-slate-300 hover:bg-slate-700"
        >
          Begin turn
        </button>
      </div>
    </div>
  )
}

function describe(strike: Strike): string {
  switch (strike.outcome) {
    case 'intercepted':
      return 'Incoming strike shot down by anti-air before it reached its target.'
    case 'miss':
      return 'Strike landed on empty ground. Nothing damaged.'
    case 'hit':
      return `Your ${label(strike)} was damaged.`
    case 'destroyed':
      return `Your ${label(strike)} was destroyed.`
  }
}

function label(strike: Strike): string {
  return strike.struckKind ? structureDef(strike.struckKind).label : 'structure'
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: string
}) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900/60 px-3 py-2 text-center">
      <div className={`font-mono text-lg ${tone}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
    </div>
  )
}
