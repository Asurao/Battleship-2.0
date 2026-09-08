import { useLayoutEffect, useRef, useState } from 'react'
import { colLabels, structureDef, zoneForRow } from '../game/constants'
import type { BoardPreset, ZoneDef } from '../game/constants'
import type {
  Crater,
  KnownCell,
  Point,
  QueuedRecon,
  ReconFlight,
  QueuedStrike,
  Ruin,
  Strike,
  Structure,
  StructureKind,
} from '../game/types'

const ZONE_TINT: Record<string, string> = {
  close: 'bg-rose-500/[0.07]',
  mid: 'bg-slate-400/[0.04]',
  long: 'bg-emerald-500/[0.06]',
}

const KNOWLEDGE_STYLE: Record<KnownCell['knowledge'], string> = {
  empty: 'bg-slate-600/70 text-slate-300',
  scouted: 'bg-emerald-500/70 text-emerald-50 font-bold',
  struck: 'bg-orange-500/80 text-orange-50 font-bold',
  destroyed: 'bg-rose-600/90 text-rose-50 font-bold',
}

const KNOWLEDGE_MARK: Record<KnownCell['knowledge'], string> = {
  empty: '·',
  scouted: '',
  struck: '◈',
  destroyed: '✕',
}

const KNOWLEDGE_WORD: Record<KnownCell['knowledge'], string> = {
  empty: 'confirmed empty',
  scouted: 'spotted',
  struck: 'structure damaged',
  destroyed: 'structure destroyed',
}

interface CellSpec {
  content?: React.ReactNode
  title?: string
  disabled?: boolean
  className?: string
  /**
   * Set when the cell supplies its own background. The zone tint is another
   * `bg-` utility, and when two land on one element CSS source order decides
   * the winner — which silently reduced struck tiles to a 4% wash.
   */
  opaque?: boolean
}

interface MapStackProps {
  board: BoardPreset
  mode: 'build' | 'recon' | 'attack'
  own: { structures: Structure[]; ruins: Ruin[]; craters: Crater[] }
  enemyKnown: KnownCell[]
  /** Where past strikes were shot down, for triangulating enemy batteries. */
  interceptions: Point[]
  reachable: Set<string> | null
  queued: QueuedStrike[]
  queuedRecon: QueuedRecon[]
  strikes: Strike[]
  flights: ReconFlight[]
  selectedSourceId: string | null
  selectedKind: StructureKind
  previewCode: string | null
  interactive: boolean
  onEnemyCellClick: (col: number, row: number) => void
  /** Fires for every cell on your half; the caller decides place vs remove. */
  onOwnCellClick: (col: number, row: number) => void
  onClearInterceptions: () => void
}

export function MapStack({
  board,
  mode,
  own,
  enemyKnown,
  interceptions,
  reachable,
  queued,
  queuedRecon,
  strikes,
  flights,
  selectedSourceId,
  selectedKind,
  previewCode,
  interactive,
  onEnemyCellClick,
  onOwnCellClick,
  onClearInterceptions,
}: MapStackProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const seam = useRef<HTMLDivElement>(null)
  const anim = useRef(0)
  const [hover, setHover] = useState<{ col: number; row: number } | null>(null)

  /**
   * Attack mode pulls the seam into view; build mode sits on your own half.
   * The easing is done by hand because neither `scrollTo({behavior:'smooth'})`
   * nor the `scroll-behavior` property is reliable in every embedded browser —
   * both can swallow the scroll outright.
   */
  const scrollTo = (target: 'seam' | 'own') => {
    const box = scroller.current
    const mark = seam.current
    if (!box || !mark) return

    const seamTop =
      mark.getBoundingClientRect().top -
      box.getBoundingClientRect().top +
      box.scrollTop
    const wanted =
      target === 'seam' ? seamTop - box.clientHeight * 0.42 : seamTop - 8
    const limit = box.scrollHeight - box.clientHeight
    const to = Math.max(0, Math.min(limit, wanted))

    cancelAnimationFrame(anim.current)
    // Animation frames are suspended while the tab is hidden, so jump straight
    // to the destination rather than leaving the view stranded.
    if (
      document.hidden ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      box.scrollTop = to
      return
    }

    const from = box.scrollTop
    const started = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / 320)
      box.scrollTop = from + (to - from) * (1 - Math.pow(1 - t, 3))
      if (t < 1) anim.current = requestAnimationFrame(step)
    }
    anim.current = requestAnimationFrame(step)
  }

  // Measurements happen after layout but before paint, so there is no
  // first-frame jump and no dependence on an animation frame.
  useLayoutEffect(() => {
    scrollTo(mode === 'attack' ? 'seam' : 'own')
    return () => cancelAnimationFrame(anim.current)
  }, [mode])

  const structureAt = new Map<string, Structure>()
  for (const s of own.structures) structureAt.set(`${s.col},${s.row}`, s)
  const ruinAt = new Map<string, Ruin>()
  for (const r of own.ruins) ruinAt.set(`${r.col},${r.row}`, r)
  const craterAt = new Set(own.craters.map((c) => `${c.col},${c.row}`))
  const knownAt = new Map<string, KnownCell>()
  for (const k of enemyKnown) knownAt.set(`${k.col},${k.row}`, k)
  /** Strikes marked per cell — several may stack on a well-defended target. */
  const queuedAt = new Map<string, number[]>()
  queued.forEach((q, i) => {
    const key = `${q.col},${q.row}`
    queuedAt.set(key, [...(queuedAt.get(key) ?? []), i + 1])
  })
  const reconAt = new Map<string, number>()
  queuedRecon.forEach((q, i) => reconAt.set(`${q.col},${q.row}`, i + 1))

  const cols = colLabels(board)
  const enemyRows = Array.from({ length: board.rows }, (_, i) => board.rows - 1 - i)
  const ownRows = Array.from({ length: board.rows }, (_, i) => i)
  const source = own.structures.find((s) => s.id === selectedSourceId) ?? null

  const hoveredStructure = hover ? structureAt.get(`${hover.col},${hover.row}`) : null
  /** Whichever envelope the cursor is asking about, if any. */
  const preview =
    mode === 'build' && hover
      ? hoveredStructure
        ? hoveredStructure.kind === 'antiair' || hoveredStructure.kind === 'airfield'
          ? { kind: hoveredStructure.kind, cell: hover }
          : null
        : selectedKind === 'antiair' || selectedKind === 'airfield'
          ? { kind: selectedKind, cell: hover }
          : null
      : null
  const envelope = preview?.kind === 'antiair' ? preview.cell : null
  /** Reach circle: the selected launch airfield, or one being hovered/placed. */
  const reachAt =
    preview?.kind === 'airfield'
      ? preview.cell
      : source
        ? { col: source.col, row: source.row }
        : null

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-2">
        <ViewButton onClick={() => scrollTo('seam')}>↑ Front line</ViewButton>
        <ViewButton onClick={() => scrollTo('own')}>↓ Your map</ViewButton>
        {interceptions.length > 0 && (
          <ViewButton onClick={onClearInterceptions}>
            ✕ Clear {interceptions.length} mark
            {interceptions.length === 1 ? '' : 's'}
          </ViewButton>
        )}
      </div>

      <div
        ref={scroller}
        className="overflow-y-auto rounded border border-slate-800"
        style={{
          // One unit for the whole 32-row stack. No gaps anywhere, so the SVG
          // overlay and the label gutters line up exactly with the cells.
          ['--cell' as string]: board.cellSize,
          height: 'calc(100vh - 11rem)',
        }}
      >
        <div className="w-max p-2">
          <ColumnLetters cols={cols} />

          <div className="flex gap-1.5">
            <div className="flex w-6 shrink-0 flex-col">
              {enemyRows.map((r) => (
                <RowLabel key={`e${r}`} n={r + 1} tone="text-rose-300/50" />
              ))}
              {ownRows.map((r) => (
                <RowLabel key={`o${r}`} n={r + 1} tone="text-slate-500" />
              ))}
            </div>

            <div className="relative">
              {/* Enemy half, mirrored so its close range meets the border. */}
              <CellGrid
                board={board}
                rows={enemyRows}
                onClick={onEnemyCellClick}
                render={(col, row) => {
                  const key = `${col},${row}`
                  const seen = knownAt.get(key)
                  const order = queuedAt.get(key)
                  const inRange = reachable?.has(key) ?? false
                  const dimmed = reachable !== null && !inRange
                  const label = `${cols[col]}${row + 1}`
                  if (order) {
                    return {
                      content: order.length > 1 ? `×${order.length}` : order[0],
                      title:
                        order.length > 1
                          ? `${label} — ${order.length} strikes marked (${order.join(', ')})`
                          : `${label} — target ${order[0]}`,
                      disabled: !interactive || mode === 'build',
                      opaque: true,
                      className:
                        'bg-rose-500/70 text-rose-50 font-bold ring-2 ring-inset ring-rose-300',
                    }
                  }
                  const scout = reconAt.get(key)
                  if (scout) {
                    return {
                      content: scout,
                      title: `${label} — recon destination ${scout}`,
                      disabled: !interactive || mode === 'build',
                      opaque: true,
                      className:
                        'bg-emerald-500/60 text-emerald-50 font-bold ring-2 ring-inset ring-emerald-300',
                    }
                  }
                  if (seen) {
                    const spotted = seen.knowledge === 'scouted' && seen.kind
                    return {
                      content: spotted
                        ? structureDef(seen.kind!).code
                        : KNOWLEDGE_MARK[seen.knowledge],
                      title: spotted
                        ? `${label} — ${structureDef(seen.kind!).label} spotted`
                        : `${label} — ${KNOWLEDGE_WORD[seen.knowledge]}`,
                      disabled: !interactive || dimmed || mode === 'build',
                      opaque: true,
                      className: `${KNOWLEDGE_STYLE[seen.knowledge]} ${dimmed ? 'opacity-40' : ''}`,
                    }
                  }
                  return {
                    title: dimmed ? `${label} — out of range` : label,
                    disabled: !interactive || dimmed || mode === 'build',
                    opaque: true,
                    className: dimmed
                      ? 'bg-slate-900 opacity-30'
                      : inRange
                        ? 'bg-sky-950 ring-1 ring-inset ring-sky-400/40 hover:bg-sky-700'
                        : 'bg-slate-800',
                  }
                }}
              />

              {/* Zero-height on purpose: the flight-path overlay maps stacked
                  coordinates onto this stack assuming the halves touch. */}
              <div ref={seam} className="relative z-20 h-0">
                <div className="pointer-events-none absolute inset-x-0 -top-[2px] h-[4px] bg-rose-500" />
                <div className="pointer-events-none absolute inset-x-0 -top-[9px] flex justify-center">
                  <span className="rounded-full border border-rose-400 bg-slate-950 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.3em] text-rose-300">
                    Border
                  </span>
                </div>
              </div>

              {/* Your half. */}
              <CellGrid
                board={board}
                rows={ownRows}
                onClick={onOwnCellClick}
                onHover={setHover}
                render={(col, row) => {
                  const key = `${col},${row}`
                  const label = `${cols[col]}${row + 1}`
                  const structure = structureAt.get(key)
                  if (structure) {
                    const def = structureDef(structure.kind)
                    return {
                      content: (
                        <span className="relative flex h-full w-full items-center justify-center font-semibold">
                          {def.code}
                          {structure.hp < structure.maxHp && (
                            <span className="absolute inset-x-0.5 bottom-0.5 h-0.5 bg-slate-900/70">
                              <span
                                className="block h-full bg-rose-400"
                                style={{
                                  width: `${(structure.hp / structure.maxHp) * 100}%`,
                                }}
                              />
                            </span>
                          )}
                        </span>
                      ),
                      title: `${def.label} at ${label} — ${structure.hp} of ${structure.maxHp} HP`,
                      disabled: !interactive || mode !== 'build',
                      opaque: true,
                      className: `${def.tone} ${
                        structure.id === selectedSourceId
                          ? 'ring-2 ring-inset ring-slate-100'
                          : ''
                      }`,
                    }
                  }
                  const ruin = ruinAt.get(key)
                  if (ruin) {
                    return {
                      content: '▨',
                      title: `Ruins of ${structureDef(ruin.kind).label} at ${label}`,
                      disabled: true,
                      opaque: true,
                      className: 'bg-slate-700 text-slate-400',
                    }
                  }
                  const cratered = craterAt.has(key)
                  return {
                    content: cratered ? (
                      <span className="text-slate-600">◌</span>
                    ) : previewCode ? (
                      <span className="hidden text-slate-300/70 group-hover:inline">
                        {previewCode}
                      </span>
                    ) : null,
                    title: cratered
                      ? `${label} — struck ground`
                      : `${label} — ${zoneForRow(board, row).label}`,
                    disabled: !interactive || mode !== 'build',
                    opaque: cratered,
                    className: `group ${cratered ? 'bg-slate-800' : ''} hover:bg-slate-600/60`,
                  }
                }}
              />

              <Envelopes
                board={board}
                interceptions={interceptions}
                strikes={strikes}
                flights={flights}
                reachAt={reachAt}
                antiAirAt={envelope}
              />
            </div>

            <ZoneRail board={board} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ColumnLetters({ cols }: { cols: string[] }) {
  return (
    <div className="sticky top-0 z-30 mb-0.5 flex gap-1.5 bg-slate-950/95 pb-0.5">
      <div className="w-6 shrink-0" />
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${cols.length}, var(--cell))` }}
      >
        {cols.map((l) => (
          <div key={l} className="text-center font-mono text-[10px] text-slate-400">
            {l}
          </div>
        ))}
      </div>
      <div className="w-24 shrink-0" />
    </div>
  )
}

function ZoneRail({ board }: { board: BoardPreset }) {
  return (
    <div className="flex w-24 shrink-0 flex-col">
      {[...board.zones].reverse().map((z) => (
        <ZoneBand key={`e${z.id}`} zone={z} tone="text-rose-200/70" />
      ))}
      {board.zones.map((z) => (
        <ZoneBand key={`o${z.id}`} zone={z} tone="text-slate-300" blurb />
      ))}
    </div>
  )
}

function CellGrid({
  board,
  rows,
  render,
  onClick,
  onHover,
}: {
  board: BoardPreset
  rows: number[]
  render: (col: number, row: number) => CellSpec
  onClick: (col: number, row: number) => void
  onHover?: (cell: { col: number; row: number } | null) => void
}) {
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${board.cols}, var(--cell))`,
        gridAutoRows: 'var(--cell)',
      }}
      onMouseLeave={() => onHover?.(null)}
    >
      {rows.map((row) =>
        Array.from({ length: board.cols }, (_, col) => {
          const spec = render(col, row)
          const zone = zoneForRow(board, row)
          return (
            <button
              key={`${col},${row}`}
              type="button"
              disabled={spec.disabled}
              title={spec.title}
              onClick={() => onClick(col, row)}
              onMouseEnter={() => onHover?.({ col, row })}
              className={`flex items-center justify-center border border-slate-800/70 font-mono text-[9px] transition ${
                spec.opaque ? '' : ZONE_TINT[zone.id]
              } ${spec.className ?? ''}`}
            >
              {spec.content}
            </button>
          )
        }),
      )}
    </div>
  )
}

/**
 * Flight paths, an airfield's reach, and an anti-air engagement envelope — all
 * in stacked space, where the border is y = 0. The stack draws both halves with
 * the enemy's deepest row at the top, so visual y = rows − stacked y, and your
 * own half sits at visual y = rows + row.
 */
function Envelopes({
  board,
  strikes,
  flights,
  interceptions,
  reachAt,
  antiAirAt,
}: {
  board: BoardPreset
  strikes: Strike[]
  flights: ReconFlight[]
  interceptions: Point[]
  reachAt: { col: number; row: number } | null
  antiAirAt: { col: number; row: number } | null
}) {
  const flip = (y: number) => board.rows - y
  const ownY = (row: number) => board.rows + row + 0.5

  return (
    <svg
      viewBox={`0 0 ${board.cols} ${board.rows * 2}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <defs>
        <clipPath id="enemy-half">
          <rect x={0} y={0} width={board.cols} height={board.rows} />
        </clipPath>
        <clipPath id="own-half">
          <rect x={0} y={board.rows} width={board.cols} height={board.rows} />
        </clipPath>
      </defs>

      {/* Airfield reach, drawn across both halves so its shape is visible
          rather than inferred from the enemy side alone. The half over your own
          ground is dimmed: it shows the envelope, not targets. */}
      {reachAt && (
        <>
          <circle
            cx={reachAt.col + 0.5}
            cy={ownY(reachAt.row)}
            r={board.bomberRange}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={0.14}
            strokeDasharray="0.6 0.4"
            opacity={0.8}
            clipPath="url(#enemy-half)"
          />
          <circle
            cx={reachAt.col + 0.5}
            cy={ownY(reachAt.row)}
            r={board.bomberRange}
            fill="none"
            stroke="#64748b"
            strokeWidth={0.12}
            strokeDasharray="0.3 0.45"
            opacity={0.7}
            clipPath="url(#own-half)"
          />
        </>
      )}

      {/* Anti-air engagement envelope: anything whose path crosses this circle
          gets engaged, including strikes aimed well beyond it. */}
      {antiAirAt && (
        <g>
          <circle
            cx={antiAirAt.col + 0.5}
            cy={ownY(antiAirAt.row)}
            r={board.antiAirRadius}
            fill="#38bdf8"
            opacity={0.12}
          />
          <circle
            cx={antiAirAt.col + 0.5}
            cy={ownY(antiAirAt.row)}
            r={board.antiAirRadius}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={0.12}
            opacity={0.8}
          />
        </g>
      )}

      {/* Where earlier strikes were downed. A battery lies within its
          engagement radius of each of these. */}
      {interceptions.map((mark, i) => (
        <g key={`x${i}`} opacity={0.75}>
          <circle
            cx={mark.x}
            cy={flip(mark.y)}
            r={0.3}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={0.1}
            strokeDasharray="0.16 0.12"
          />
          <text
            x={mark.x}
            y={flip(mark.y) + 0.17}
            textAnchor="middle"
            fontSize={0.46}
            fill="#38bdf8"
          >
            ✕
          </text>
        </g>
      ))}

      {/* Recon courses. Drawn under strikes so a busy turn still reads. */}
      {flights.map((flight) => {
        const end = flight.interceptedAt ?? flight.to
        const length = Math.hypot(end.x - flight.from.x, flip(end.y) - flip(flight.from.y))
        return (
          <g key={flight.id}>
            <line
              className="strike-path"
              x1={flight.from.x}
              y1={flip(flight.from.y)}
              x2={end.x}
              y2={flip(end.y)}
              stroke={flight.outcome === 'intercepted' ? '#38bdf8' : '#34d399'}
              strokeWidth={0.12}
              strokeLinecap="round"
              strokeDasharray={length}
              style={{ ['--len' as string]: String(length) }}
              opacity={0.85}
            />
          </g>
        )
      })}

      {strikes.map((strike, i) => {
        const end = strike.interceptedAt ?? strike.to
        const x1 = strike.from.x
        const y1 = flip(strike.from.y)
        const x2 = end.x
        const y2 = flip(end.y)
        // Dash length drives the draw-on animation, so the line has to know how
        // long it is. CSS runs it: animation frames stall in a hidden tab.
        const length = Math.hypot(x2 - x1, y2 - y1)
        const color = OUTCOME_COLOR[strike.outcome]
        return (
          <g key={strike.id}>
            <line
              className="strike-path"
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={color}
              strokeWidth={0.16}
              strokeLinecap="round"
              strokeDasharray={length}
              style={{ ['--len' as string]: String(length) }}
            />
            <g className="strike-impact">
              <circle cx={x2} cy={y2} r={0.52} fill={color} opacity={0.3} />
              <circle
                cx={x2}
                cy={y2}
                r={0.52}
                fill="none"
                stroke={color}
                strokeWidth={0.16}
              />
              <text
                x={x2}
                y={y2 + 0.22}
                textAnchor="middle"
                fontSize={0.62}
                fontWeight="bold"
                fill={color}
              >
                {strike.outcome === 'intercepted' ? '✕' : i + 1}
              </text>
            </g>
          </g>
        )
      })}
    </svg>
  )
}

const OUTCOME_COLOR: Record<Strike['outcome'], string> = {
  intercepted: '#38bdf8',
  destroyed: '#f43f5e',
  hit: '#fb923c',
  miss: '#94a3b8',
}

function RowLabel({ n, tone }: { n: number; tone: string }) {
  return (
    <div
      className={`flex items-center justify-end pr-1 font-mono text-[9px] ${tone}`}
      style={{ height: 'var(--cell)' }}
    >
      {n}
    </div>
  )
}

function ZoneBand({
  zone,
  tone,
  blurb = false,
}: {
  zone: ZoneDef
  tone: string
  blurb?: boolean
}) {
  return (
    <div
      className="flex flex-col justify-center border-l border-slate-700 pl-2"
      style={{ height: `calc(var(--cell) * ${zone.endRow - zone.startRow + 1})` }}
    >
      <div className={`text-[10px] font-semibold uppercase tracking-wider ${tone}`}>
        {zone.label}
      </div>
      {blurb && (
        <div className="mt-0.5 text-[9px] leading-snug text-slate-500">
          {zone.blurb}
        </div>
      )}
    </div>
  )
}

function ViewButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-slate-700 bg-slate-900 px-3 py-1 text-[10px] text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
    >
      {children}
    </button>
  )
}
