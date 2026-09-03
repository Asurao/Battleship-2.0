import { strikeDistance } from '../game/combat'
import { COL_LABELS, COMBAT, ROWS } from '../game/constants'
import type { QueuedStrike, Structure } from '../game/types'

interface AttackPanelProps {
  airfields: Structure[]
  selectedSourceId: string | null
  actionPoints: number
  queued: QueuedStrike[]
  resolving: boolean
  onSelectSource: (id: string) => void
  onRemoveTarget: (id: string) => void
  onCommit: () => void
}

/** Deepest enemy row an airfield can reach straight ahead of itself. */
function deepestReach(source: Structure): number | null {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (strikeDistance(source, source.col, row) <= COMBAT.bomberRange) return row
  }
  return null
}

export function AttackPanel({
  airfields,
  selectedSourceId,
  actionPoints,
  queued,
  resolving,
  onSelectSource,
  onRemoveTarget,
  onCommit,
}: AttackPanelProps) {
  const canQueue = actionPoints >= COMBAT.attackCost

  return (
    <div className="flex w-64 shrink-0 flex-col gap-3">
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
            const deepest = deepestReach(field)
            const selected = field.id === selectedSourceId
            return (
              <button
                key={field.id}
                type="button"
                disabled={resolving}
                onClick={() => onSelectSource(field.id)}
                className={`flex w-full items-center justify-between gap-2 rounded border px-2.5 py-2 text-left transition disabled:opacity-40 ${
                  selected
                    ? 'border-slate-400 bg-slate-700/70'
                    : 'border-slate-700 bg-slate-800/40 hover:border-slate-600 hover:bg-slate-800'
                }`}
              >
                <span>
                  <span className="block font-mono text-xs text-slate-100">
                    Airfield {COL_LABELS[field.col]}
                    {field.row + 1}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-slate-500">
                    {deepest === null
                      ? 'Too far back to reach the enemy'
                      : `Reaches enemy row ${deepest + 1} ahead`}
                  </span>
                </span>
                <span className="shrink-0 rounded bg-slate-900/80 px-1.5 py-0.5 font-mono text-[9px] text-slate-400">
                  {field.hp}/{field.maxHp} HP
                </span>
              </button>
            )
          })}
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
                    {i + 1}. {COL_LABELS[order.col]}
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

        <button
          type="button"
          disabled={queued.length === 0 || resolving}
          onClick={onCommit}
          className="mt-3 w-full rounded border border-rose-400/70 bg-rose-500/20 px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/40 disabled:border-slate-700 disabled:bg-slate-800/40 disabled:text-slate-600"
        >
          {resolving
            ? 'Strikes away…'
            : `Go — launch ${queued.length} strike${queued.length === 1 ? '' : 's'}`}
        </button>
      </div>

      {!canQueue && queued.length === 0 && (
        <p className="text-[10px] leading-snug text-amber-300/80">
          Not enough action points to strike. End your turn to refresh.
        </p>
      )}

      <p className="mt-auto border-t border-slate-800 pt-2.5 text-[10px] leading-snug text-slate-600">
        Each strike costs {COMBAT.attackCost} AP. Any battery within{' '}
        {COMBAT.antiAirRadius} cells of the flight path gets a{' '}
        {Math.round(COMBAT.antiAirHitChance * 100)}% shot at downing it.
      </p>
    </div>
  )
}
