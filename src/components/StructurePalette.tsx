import { STRUCTURES } from '../game/constants'
import type { Structure, StructureKind } from '../game/types'

interface StructurePaletteProps {
  selected: StructureKind
  onSelect: (kind: StructureKind) => void
  placed: Structure[]
  disabled: boolean
}

export function StructurePalette({
  selected,
  onSelect,
  placed,
  disabled,
}: StructurePaletteProps) {
  return (
    <div className="w-64 shrink-0 space-y-3">
      <div>
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Construction
        </h2>
        <p className="mt-1 text-[11px] leading-snug text-slate-500">
          Pick a structure, then click a cell on your map. Click a placed
          structure to remove it.
        </p>
      </div>

      <div className="space-y-1.5">
        {STRUCTURES.map((def) => {
          const count = placed.filter((s) => s.kind === def.kind).length
          const isSelected = def.kind === selected
          return (
            <button
              key={def.kind}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(def.kind)}
              className={`flex w-full items-start gap-2.5 rounded border px-2.5 py-2 text-left transition disabled:opacity-40 ${
                isSelected
                  ? 'border-slate-400 bg-slate-700/70'
                  : 'border-slate-700 bg-slate-800/40 hover:border-slate-600 hover:bg-slate-800'
              }`}
            >
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-sm ${def.swatch}`} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-slate-100">
                    {def.label}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    ×{count}
                  </span>
                </span>
                <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">
                  {def.blurb}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <p className="border-t border-slate-800 pt-2.5 text-[10px] leading-snug text-slate-600">
        No budget yet — place as many as you like. The economy that constrains
        this arrives in Milestone 2.
      </p>
    </div>
  )
}
