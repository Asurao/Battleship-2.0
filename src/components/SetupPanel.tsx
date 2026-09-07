import { REQUIRED_SETUP, STRUCTURE_COST, STRUCTURES } from '../game/constants'
import type { PlayerState, StructureKind } from '../game/types'

interface SetupPanelProps {
  player: PlayerState
  selected: StructureKind
  remaining: StructureKind[]
  onSelect: (kind: StructureKind) => void
  onReady: () => void
}

export function SetupPanel({
  player,
  selected,
  remaining,
  onSelect,
  onReady,
}: SetupPanelProps) {
  return (
    <div className="flex w-64 shrink-0 flex-col gap-3">
      <div>
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Initial Deployment
        </h2>
        <p className="mt-1 text-[11px] leading-snug text-slate-500">
          Field one of each required structure, then spend your starting budget
          on whatever else you want. Both sides deploy before anyone fires.
        </p>
      </div>

      <div className="space-y-1.5">
        {STRUCTURES.map((def) => {
          const required = REQUIRED_SETUP.includes(def.kind)
          const stillRequired = remaining.includes(def.kind)
          const cost = stillRequired ? 0 : STRUCTURE_COST[def.kind]
          const affordable = player.budget >= cost
          const count = player.structures.filter((s) => s.kind === def.kind).length
          return (
            <button
              key={def.kind}
              type="button"
              disabled={!affordable}
              onClick={() => onSelect(def.kind)}
              className={`flex w-full items-start gap-2.5 rounded border px-2.5 py-2 text-left transition disabled:opacity-40 ${
                def.kind === selected
                  ? 'border-slate-400 bg-slate-700/70'
                  : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
              }`}
            >
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-sm ${def.swatch}`} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-slate-100">
                    {def.label}
                  </span>
                  <span className="flex items-baseline gap-1.5">
                    <span className="font-mono text-[10px] text-slate-500">
                      ×{count}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                        stillRequired
                          ? 'bg-amber-500/20 text-amber-200'
                          : affordable
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-slate-800 text-slate-600'
                      }`}
                    >
                      {stillRequired ? 'free' : cost}
                    </span>
                  </span>
                </span>
                <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">
                  {stillRequired && required ? 'Required · ' : ''}
                  {def.blurb}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <p className="text-[10px] leading-snug text-slate-600">
        Click a structure you have placed to take it back and recover its cost.
      </p>

      <button
        type="button"
        disabled={remaining.length > 0}
        onClick={onReady}
        className="mt-auto w-full rounded border border-slate-500 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-slate-300 hover:bg-slate-700 disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-600"
      >
        {remaining.length > 0
          ? `${remaining.length} still to deploy`
          : `${player.name} ready`}
      </button>
    </div>
  )
}
