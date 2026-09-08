import { deepestReach } from '../game/combat'
import { COMBAT, colLabels, structureDef } from '../game/constants'
import type { BoardPreset } from '../game/constants'
import type { QueuedStrike, Strike, Structure } from '../game/types'

interface AttackPanelProps {
  board: BoardPreset
  airfields: Structure[]
  /** Missions each airfield has left this turn, keyed by structure id. */
  sorties: Record<string, number>
  selectedSourceId: string | null
  actionPoints: number
  queued: QueuedStrike[]
  /** Strikes already flown this turn, newest last. */
  results: Strike[]
  resolving: boolean
  onSelectSource: (id: string) => void
  onRemoveTarget: (id: string) => void
}

export function AttackPanel({
  board,
  airfields,
  sorties,
  selectedSourceId,
  actionPoints,
  queued,
  results,
  resolving,
  onSelectSource,
  onRemoveTarget,
}: AttackPanelProps) {
  const canQueue = actionPoints >= COMBAT.attackCost
  const cols = colLabels(board)

  return (
    <div className="flex w-full flex-col gap-3">
      <div>
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Launch From
        </h2>
        <p className="mt-1 text-[11px] leading-snug text-slate-500">
          Pick an airfield, mark targets on the enemy map, then commit. Reach
          depends on how far forward the airfield sits.
        </p>
      </div>

      {airfields.length === 0 ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-snug text-amber-200">
          No airfields standing. Build one before you can strike.
        </p>
      ) : (
        <div className="space-y-1.5">
          {airfields.map((field) => {
            const deepest = deepestReach(board, field)
            const selected = field.id === selectedSourceId
            const left = sorties[field.id] ?? 0
            const grounded = left <= 0 || deepest === null
            return (
              <button
                key={field.id}
                type="button"
                disabled={resolving || grounded}
                onClick={() => onSelectSource(field.id)}
                className={`flex w-full items-center justify-between gap-2 rounded border px-2.5 py-2 text-left transition disabled:opacity-40 ${
                  selected
                    ? 'border-slate-400 bg-slate-700/70'
                    : 'border-slate-700 bg-slate-800/40 hover:border-slate-600 hover:bg-slate-800'
                }`}
              >
                <span>
                  <span className="block font-mono text-xs text-slate-100">
                    Airfield {cols[field.col]}
                    {field.row + 1}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-slate-500">
                    {deepest === null
                      ? 'Too far back to reach the enemy'
                      : `Reaches enemy row ${deepest + 1} ahead`}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded bg-slate-900/80 px-1.5 py-0.5 font-mono text-[9px] text-slate-400">
                    {field.hp}/{field.maxHp} HP
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[9px] ${
                      left > 0
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-slate-800 text-slate-600'
                    }`}
                  >
                    {left > 0 ? `${left} sortie` : 'flown'}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {results.length > 0 && (
        <div className="border-t border-slate-800 pt-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Strikes Flown
          </h2>
          <ol className="mt-2 space-y-1">
            {results.map((strike, i) => {
              const tone = OUTCOME_TONE[strike.outcome]
              return (
                <li
                  key={strike.id}
                  className={`flex items-baseline gap-2 rounded border px-2.5 py-1.5 ${tone.box}`}
                >
                  <span className="font-mono text-[11px] text-slate-400">
                    {i + 1}.
                  </span>
                  <span className="font-mono text-[11px] text-slate-200">
                    {cols[strike.targetCol]}
                    {strike.targetRow + 1}
                  </span>
                  <span className={`ml-auto text-[10px] ${tone.text}`}>
                    {describeOutcome(strike)}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      )}

      <div className="border-t border-slate-800 pt-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Strike Plan
          </h2>
          <span className="font-mono text-[10px] text-slate-500">
            {queued.length * COMBAT.attackCost} AP committed
          </span>
        </div>

        {queued.length === 0 ? (
          <p className="mt-2 text-[11px] leading-snug text-slate-600">
            No targets marked. Click cells on the enemy map to plan a strike;
            nothing flies until you commit.
          </p>
        ) : (
          <ol className="mt-2 space-y-1">
            {queued.map((order, i) => (
              <li key={order.id}>
                <button
                  type="button"
                  disabled={resolving}
                  onClick={() => onRemoveTarget(order.id)}
                  className="group flex w-full items-center justify-between gap-2 rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-left transition hover:border-rose-400/60 disabled:opacity-40"
                >
                  <span className="font-mono text-[11px] text-rose-100">
                    {results.length + i + 1}. {cols[order.col]}
                    {order.row + 1}
                  </span>
                  <span className="text-[10px] text-slate-500 group-hover:text-rose-300">
                    remove
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}

      </div>

      {!canQueue && queued.length === 0 && (
        <p className="text-[10px] leading-snug text-amber-300/80">
          Not enough action points to strike. End your turn to refresh.
        </p>
      )}

      <p className="mt-auto border-t border-slate-800 pt-2.5 text-[10px] leading-snug text-slate-600">
        Each airfield flies {COMBAT.sortiesPerAirfield} mission per turn and each
        strike costs {COMBAT.attackCost} AP, so reaching further means building
        both. Any battery within {board.antiAirRadius} cells of the flight path
        gets a {Math.round(COMBAT.antiAirHitChance * 100)}% shot at downing it.
      </p>
    </div>
  )
}


const OUTCOME_TONE: Record<Strike['outcome'], { box: string; text: string }> = {
  destroyed: { box: 'border-rose-500/50 bg-rose-500/15', text: 'text-rose-200' },
  hit: { box: 'border-orange-500/50 bg-orange-500/15', text: 'text-orange-200' },
  miss: { box: 'border-slate-700 bg-slate-800/40', text: 'text-slate-400' },
  intercepted: { box: 'border-sky-500/50 bg-sky-500/15', text: 'text-sky-200' },
}

function describeOutcome(strike: Strike): string {
  switch (strike.outcome) {
    case 'destroyed':
      return `${label(strike)} destroyed`
    case 'hit':
      return `${label(strike)} damaged`
    case 'miss':
      return 'Empty ground'
    case 'intercepted':
      return 'Shot down en route'
  }
}

function label(strike: Strike): string {
  return strike.struckKind ? structureDef(strike.struckKind).label : 'Structure'
}
