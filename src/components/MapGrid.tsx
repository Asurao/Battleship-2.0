import { borderCrossing } from '../game/combat'
import { COLS, COL_LABELS, ROWS, ZONES, structureDef, zoneForRow } from '../game/constants'
import type { KnownCell, Ruin, Strike, Structure } from '../game/types'

const ZONE_TINT: Record<string, string> = {
  close: 'bg-rose-500/[0.07]',
  mid: 'bg-slate-400/[0.04]',
  long: 'bg-emerald-500/[0.06]',
}

const KNOWLEDGE_STYLE: Record<KnownCell['knowledge'], string> = {
  empty: 'bg-slate-700/40 text-slate-500',
  struck: 'bg-orange-500/30 text-orange-200 border border-orange-400/60',
  destroyed: 'bg-rose-600/30 text-rose-200 border border-rose-400/60',
}

const KNOWLEDGE_MARK: Record<KnownCell['knowledge'], string> = {
  empty: '·',
  struck: '✳',
  destroyed: '✕',
}

interface MapGridProps {
  /** `own` shows your assets; `enemy` shows only what you have learned. */
  mode: 'own' | 'enemy'
  structures?: Structure[]
  ruins?: Ruin[]
  known?: KnownCell[]
  /** "col,row" keys a selected airfield can actually reach. */
  reachable?: Set<string> | null
  /** Strikes to draw as flight paths over the grid. */
  paths?: Strike[]
  selectedSourceId?: string | null
  /** Ghost stamp shown on hover while building. */
  previewCode?: string | null
  interactive?: boolean
  onCellClick?: (col: number, row: number) => void
  onStructureClick?: (id: string) => void
}

export function MapGrid({
  mode,
  structures = [],
  ruins = [],
  known = [],
  reachable = null,
  paths = [],
  selectedSourceId = null,
  previewCode = null,
  interactive = true,
  onCellClick,
  onStructureClick,
}: MapGridProps) {
  const structureAt = new Map<string, Structure>()
  for (const s of structures) structureAt.set(`${s.col},${s.row}`, s)
  const ruinAt = new Map<string, Ruin>()
  for (const r of ruins) ruinAt.set(`${r.col},${r.row}`, r)
  const knownAt = new Map<string, KnownCell>()
  for (const k of known) knownAt.set(`${k.col},${k.row}`, k)

  const fogged = mode === 'enemy'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-[10px] uppercase tracking-[0.3em] text-rose-300/70">
        ◤ Enemy Border ◥
      </div>

      <div className="flex gap-1.5">
        <div
          className="grid w-6 shrink-0"
          style={{ gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))` }}
        >
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
          <div
            className="grid gap-px"
            style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
          >
            {COL_LABELS.map((label) => (
              <div key={label} className="text-center font-mono text-[10px] text-slate-500">
                {label}
              </div>
            ))}
          </div>

          <div className="relative">
            <div
              className="grid gap-px rounded-sm bg-slate-800/60 p-px"
              style={{
                gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
                // 12x16 cells => 3:4 aspect. Cap by height so all 16 rows stay on screen.
                width: 'min(42vw, 30rem, calc((100vh - 13rem) * 0.75))',
              }}
            >
              {Array.from({ length: ROWS }, (_, row) =>
                Array.from({ length: COLS }, (_, col) => {
                  const key = `${col},${row}`
                  const zone = zoneForRow(row)
                  const edge = row === 4 || row === 12 ? 'border-t-2 border-t-slate-500/50' : ''
                  const label = `${COL_LABELS[col]}${row + 1}`

                  if (fogged) {
                    const seen = knownAt.get(key)
                    const inRange = reachable?.has(key) ?? false
                    const dimmed = reachable && !inRange
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={!interactive || !!dimmed}
                        onClick={() => onCellClick?.(col, row)}
                        title={
                          dimmed
                            ? `${label} — out of range`
                            : `${label}${seen ? ` — ${seen.knowledge}` : ''}`
                        }
                        className={`aspect-square font-mono text-[9px] transition ${edge} ${
                          seen ? KNOWLEDGE_STYLE[seen.knowledge] : 'bg-slate-800/90'
                        } ${
                          dimmed
                            ? 'opacity-20'
                            : inRange
                              ? 'bg-sky-500/10 ring-1 ring-inset ring-sky-400/40 hover:bg-sky-500/50'
                              : ''
                        }`}
                      >
                        {seen ? KNOWLEDGE_MARK[seen.knowledge] : ''}
                      </button>
                    )
                  }

                  const structure = structureAt.get(key)
                  if (structure) {
                    const def = structureDef(structure.kind)
                    const damaged = structure.hp < structure.maxHp
                    const isSource = structure.id === selectedSourceId
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={!interactive}
                        onClick={() => onStructureClick?.(structure.id)}
                        title={`${def.label} at ${label} — ${structure.hp}/${structure.maxHp} HP`}
                        className={`relative aspect-square border font-mono text-[9px] font-semibold transition ${def.tone} ${edge} ${
                          isSource ? 'ring-2 ring-inset ring-slate-100' : ''
                        } ${interactive ? 'hover:brightness-150' : ''}`}
                      >
                        {def.code}
                        {damaged && (
                          <span className="absolute inset-x-0.5 bottom-0.5 h-0.5 bg-slate-900/70">
                            <span
                              className="block h-full bg-rose-400"
                              style={{ width: `${(structure.hp / structure.maxHp) * 100}%` }}
                            />
                          </span>
                        )}
                      </button>
                    )
                  }

                  const ruin = ruinAt.get(key)
                  if (ruin) {
                    return (
                      <div
                        key={key}
                        title={`Ruins of ${structureDef(ruin.kind).label} at ${label}`}
                        className={`flex aspect-square items-center justify-center bg-slate-700/50 font-mono text-[9px] text-slate-500 ${edge}`}
                      >
                        ▨
                      </div>
                    )
                  }

                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!interactive}
                      onClick={() => onCellClick?.(col, row)}
                      title={`${label} — ${zone.label}`}
                      className={`group aspect-square transition ${ZONE_TINT[zone.id]} ${edge} ${
                        interactive ? 'hover:bg-slate-600/60' : ''
                      }`}
                    >
                      {previewCode && (
                        <span className="hidden font-mono text-[9px] text-slate-300/70 group-hover:inline">
                          {previewCode}
                        </span>
                      )}
                    </button>
                  )
                }),
              )}
            </div>

            <FlightPaths paths={paths} />
          </div>
        </div>

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
              <div className="mt-0.5 text-[9px] leading-snug text-slate-500">{zone.blurb}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Strike paths are stored in stacked space, where the defender's half already
 * shares the grid's coordinates — so the defended leg draws straight into the
 * SVG with no conversion.
 */
function FlightPaths({ paths }: { paths: Strike[] }) {
  if (paths.length === 0) return null

  return (
    <svg
      viewBox={`0 0 ${COLS} ${ROWS}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
    >
      {paths.map((strike) => {
        const entry = borderCrossing(strike.from, strike.to)
        const end = strike.interceptedAt ?? strike.to
        const downed = strike.outcome === 'intercepted'
        return (
          <g key={strike.id}>
            <line
              x1={entry.x}
              y1={entry.y}
              x2={end.x}
              y2={end.y}
              stroke={downed ? '#38bdf8' : '#fb7185'}
              strokeWidth={0.08}
              strokeDasharray={downed ? '0.3 0.2' : undefined}
              vectorEffect="non-scaling-stroke"
              opacity={0.9}
            />
            <circle
              cx={end.x}
              cy={end.y}
              r={0.28}
              fill="none"
              stroke={downed ? '#38bdf8' : '#fb7185'}
              strokeWidth={0.08}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )
      })}
    </svg>
  )
}
