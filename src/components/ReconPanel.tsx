import { deepestReach } from '../game/combat'
import { COMBAT, colLabels, structureDef } from '../game/constants'
import type { BoardPreset } from '../game/constants'
import type { QueuedRecon, ReconFlight, Structure } from '../game/types'

interface ReconPanelProps {
  board: BoardPreset
  airfields: Structure[]
  /** Recon missions each airfield has left this turn, keyed by structure id. */
  reconSorties: Record<string, number>
  selectedSourceId: string | null
  queued: QueuedRecon[]
  results: ReconFlight[]
  resolving: boolean
  onSelectSource: (id: string) => void
  onRemoveTarget: (id: string) => void
}

export function ReconPanel({
  board,
  airfields,
  reconSorties,
  selectedSourceId,
  queued,
  results,
  resolving,
  onSelectSource,
  onRemoveTarget,
}: ReconPanelProps) {
  const cols = colLabels(board)

  return (
    <div className="flex w-full flex-col gap-3">
      <div>
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Reconnaissance
        </h2>
        <p className="mt-1 text-[11px] leading-snug text-slate-500">
          A flight reveals every cell it passes over, so a diagonal course
          uncovers far more ground than a straight one.
        </p>
      </div>

      {airfields.length === 0 ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-snug text-amber-200">
          No airfields standing. Recon aircraft fly from airfields.
        </p>
      ) : (
        <div className="space-y-1.5">
          {airfields.map((field) => {
            const left = reconSorties[field.id] ?? 0
            const selected = field.id === selectedSourceId
            return (
              <button
                key={field.id}
                type="button"
                disabled={resolving || left <= 0}
                onClick={() => onSelectSource(field.id)}
                className={`flex w-full items-center justify-between gap-2 rounded border px-2.5 py-2 text-left transition disabled:opacity-40 ${
                  selected
                    ? 'border-slate-400 bg-slate-700/70'
                    : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
                }`}
              >
                <span>
                  <span className="block font-mono text-xs text-slate-100">
                    Airfield {cols[field.col]}
                    {field.row + 1}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-slate-500">
                    Scouts to enemy row{' '}
                    {(deepestReach(board, field, board.reconRange) ?? 0) + 1}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] ${
                    left > 0
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-slate-800 text-slate-600'
                  }`}
                >
                  {left > 0 ? `${left} flight` : 'flown'}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {results.length > 0 && (
        <div className="border-t border-slate-800 pt-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Flights Flown
          </h2>
          <ol className="mt-2 space-y-1">
            {results.map((flight, i) => (
              <li
                key={flight.id}
                className={`flex items-baseline gap-2 rounded border px-2.5 py-1.5 ${
                  flight.outcome === 'intercepted'
                    ? 'border-sky-500/50 bg-sky-500/15'
                    : 'border-emerald-500/40 bg-emerald-500/10'
                }`}
              >
                <span className="font-mono text-[11px] text-slate-400">
                  {i + 1}.
                </span>
                <span className="font-mono text-[11px] text-slate-200">
                  {cols[flight.targetCol]}
                  {flight.targetRow + 1}
                </span>
                <span className="ml-auto text-[10px] text-slate-300">
                  {flight.revealed} cell{flight.revealed === 1 ? '' : 's'}
                  {flight.outcome === 'intercepted' ? ' · downed' : ''}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="border-t border-slate-800 pt-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Flight Plan
          </h2>
          <span className="font-mono text-[10px] text-slate-500">
            {queued.length * COMBAT.reconCost} AP committed
          </span>
        </div>

        {queued.length === 0 ? (
          <p className="mt-2 text-[11px] leading-snug text-slate-600">
            No flights planned. Pick an airfield, then click where you want the
            aircraft to fly.
          </p>
        ) : (
          <ol className="mt-2 space-y-1">
            {queued.map((order, i) => (
              <li key={order.id}>
                <button
                  type="button"
                  disabled={resolving}
                  onClick={() => onRemoveTarget(order.id)}
                  className="group flex w-full items-center justify-between gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-left transition hover:border-emerald-400/60 disabled:opacity-40"
                >
                  <span className="font-mono text-[11px] text-emerald-100">
                    {results.length + i + 1}. {cols[order.col]}
                    {order.row + 1}
                  </span>
                  <span className="text-[10px] text-slate-500 group-hover:text-emerald-300">
                    remove
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <p className="border-t border-slate-800 pt-2.5 text-[10px] leading-snug text-slate-600">
        Each flight costs {COMBAT.reconCost} AP and uses that airfield&rsquo;s
        recon mission for the turn, separate from its strike. Aircraft are
        engaged by anti-air just as strikes are; a downed flight keeps whatever
        it saw before it fell. {structureDef('airfield').label}s scout further
        than they bomb.
      </p>
    </div>
  )
}
