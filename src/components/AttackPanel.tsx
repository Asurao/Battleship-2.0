import { COMBAT, COL_LABELS } from '../game/constants'
import { strikeDistance } from '../game/combat'
import { ROWS } from '../game/constants'
import type { Structure } from '../game/types'

interface AttackPanelProps {
  airfields: Structure[]
  selectedSourceId: string | null
  actionPoints: number
  onSelectSource: (id: string) => void
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
  onSelectSource,
}: AttackPanelProps) {
  const affordable = actionPoints >= COMBAT.attackCost

  return (
    <div className="w-64 shrink-0 space-y-3">
      <div>
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Launch From
        </h2>
        <p className="mt-1 text-[11px] leading-snug text-slate-500">
          Pick an airfield, then click a target on the enemy map. Reach depends
          on how far forward the airfield sits.
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
                disabled={!affordable}
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
                <span className="font-mono text-[10px] text-slate-400">
                  {field.hp}/{field.maxHp}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {!affordable && (
        <p className="text-[10px] leading-snug text-amber-300/80">
          Not enough action points to strike. End your turn to refresh.
        </p>
      )}

      <p className="border-t border-slate-800 pt-2.5 text-[10px] leading-snug text-slate-600">
        Strikes fly a straight path. Any anti-air battery within{' '}
        {COMBAT.antiAirRadius} cells of that path gets a{' '}
        {Math.round(COMBAT.antiAirHitChance * 100)}% shot at bringing it down.
      </p>
    </div>
  )
}
