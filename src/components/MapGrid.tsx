import { COLS, COL_LABELS, ROWS, ZONES, structureDef, zoneForRow } from '../game/constants'
import type { Structure, StructureKind } from '../game/types'

const ZONE_TINT: Record<string, string> = {
  close: 'bg-rose-500/[0.07]',
  mid: 'bg-slate-400/[0.04]',
  long: 'bg-emerald-500/[0.06]',
}

interface MapGridProps {
  structures: Structure[]
  /** Enemy territory in M1 is solid fog — nothing is rendered through it. */
  fogged: boolean
  selectedKind: StructureKind
  onPlace: (col: number, row: number) => void
  onRemove: (id: string) => void
}

export function MapGrid({
  structures,
  fogged,
  selectedKind,
  onPlace,
  onRemove,
}: MapGridProps) {
  const byCell = new Map<string, Structure>()
  if (!fogged) {
    for (const s of structures) byCell.set(`${s.col},${s.row}`, s)
  }
  const preview = structureDef(selectedKind)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-[10px] uppercase tracking-[0.3em] text-rose-300/70">
        ◤ Enemy Border ◥
      </div>

      <div className="flex gap-1.5">
        {/* Row numbers */}
        <div className="grid w-6 shrink-0" style={{ gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))` }}>
          {Array.from({ length: ROWS }, (_, row) => (
            <div
              key={row}
              className="flex items-center justify-end pr-1 font-mono text-[10px] text-slate-500"
            >
              {row + 1}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          {/* Column letters */}
          <div
            className="grid gap-px"
            style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
          >
            {COL_LABELS.map((label) => (
              <div
                key={label}
                className="text-center font-mono text-[10px] text-slate-500"
              >
                {label}
              </div>
            ))}
          </div>

          {/* The grid itself */}
          <div className="relative">
            <div
              className="grid gap-px rounded-sm bg-slate-800/60 p-px"
              style={{
                gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
                // 12x16 cells => 3:4 aspect. Cap by height so all 16 rows stay on screen.
                width: 'min(42vw, 30rem, calc((100vh - 11rem) * 0.75))',
              }}
            >
              {Array.from({ length: ROWS }, (_, row) =>
                Array.from({ length: COLS }, (_, col) => {
                  const zone = zoneForRow(row)
                  const existing = byCell.get(`${col},${row}`)
                  const zoneBoundary =
                    row === 4 || row === 12 ? 'border-t-2 border-t-slate-500/50' : ''

                  if (fogged) {
                    return (
                      <div
                        key={`${col},${row}`}
                        className={`aspect-square bg-slate-800/90 ${zoneBoundary}`}
                      />
                    )
                  }

                  if (existing) {
                    const def = structureDef(existing.kind)
                    return (
                      <button
                        key={`${col},${row}`}
                        type="button"
                        onClick={() => onRemove(existing.id)}
                        title={`${def.label} at ${COL_LABELS[col]}${row + 1} — click to remove`}
                        className={`group aspect-square border font-mono text-[9px] font-semibold transition ${def.tone} ${zoneBoundary} hover:brightness-150`}
                      >
                        <span className="group-hover:hidden">{def.code}</span>
                        <span className="hidden text-rose-200 group-hover:inline">✕</span>
                      </button>
                    )
                  }

                  return (
                    <button
                      key={`${col},${row}`}
                      type="button"
                      onClick={() => onPlace(col, row)}
                      title={`${COL_LABELS[col]}${row + 1} — ${zone.label}`}
                      className={`group aspect-square transition hover:bg-slate-600/60 ${ZONE_TINT[zone.id]} ${zoneBoundary}`}
                    >
                      <span className="hidden font-mono text-[9px] text-slate-300/70 group-hover:inline">
                        {preview.code}
                      </span>
                    </button>
                  )
                }),
              )}
            </div>

            {fogged && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
                <div className="text-xs uppercase tracking-[0.35em] text-slate-400">
                  No Intelligence
                </div>
                <div className="max-w-[16rem] text-[11px] leading-relaxed text-slate-500">
                  Enemy territory is unobserved. Reconnaissance arrives in Milestone 3.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Zone rail */}
        <div
          className="grid w-24 shrink-0 gap-px"
          style={{ gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))` }}
        >
          {ZONES.map((zone) => (
            <div
              key={zone.id}
              style={{ gridRow: `span ${zone.endRow - zone.startRow + 1}` }}
              className="flex flex-col justify-center border-l border-slate-700 pl-2"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                {zone.label}
              </div>
              <div className="mt-0.5 text-[9px] leading-snug text-slate-500">
                {zone.blurb}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
