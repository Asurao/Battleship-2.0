import { useLayoutEffect, useRef } from 'react'
import { COLS, COL_LABELS, ROWS, ZONES, structureDef, zoneForRow } from '../game/constants'
import type {
  KnownCell,
  QueuedStrike,
  Ruin,
  Strike,
  Structure,
} from '../game/types'

const ZONE_TINT: Record<string, string> = {
  close: 'bg-rose-500/[0.07]',
  mid: 'bg-slate-400/[0.04]',
  long: 'bg-emerald-500/[0.06]',
}

const KNOWLEDGE_STYLE: Record<KnownCell['knowledge'], string> = {
  empty: 'bg-slate-700/40 text-slate-500',
  struck: 'bg-orange-500/30 text-orange-200 ring-1 ring-inset ring-orange-400/60',
  destroyed: 'bg-rose-600/30 text-rose-200 ring-1 ring-inset ring-rose-400/60',
}

const KNOWLEDGE_MARK: Record<KnownCell['knowledge'], string> = {
  empty: '·',
  struck: '✳',
  destroyed: '✕',
}

interface MapStackProps {
  mode: 'build' | 'attack'
  own: { structures: Structure[]; ruins: Ruin[] }
  enemyKnown: KnownCell[]
  reachable: Set<string> | null
  queued: QueuedStrike[]
  strikes: Strike[]
  selectedSourceId: string | null
  previewCode: string | null
  interactive: boolean
  onEnemyCellClick: (col: number, row: number) => void
  /** Fires for every cell on your half; the caller decides place vs remove. */
  onOwnCellClick: (col: number, row: number) => void
}

export function MapStack({
  mode,
  own,
  enemyKnown,
  reachable,
  queued,
  strikes,
  selectedSourceId,
  previewCode,
  interactive,
  onEnemyCellClick,
  onOwnCellClick,
}: MapStackProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const seam = useRef<HTMLDivElement>(null)

  const anim = useRef(0)

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

    // Measured against the viewport rather than offsetParent, so nested
    // positioned wrappers can't skew it.
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
    // to the destination rather than leaving the view stranded. Same for anyone
    // who has asked for reduced motion.
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

  // Positioning runs in a layout effect so measurements happen after the grid
  // is laid out but before paint — no first-frame jump, and no dependence on an
  // animation frame that a hidden tab will never deliver.
  useLayoutEffect(() => {
    scrollTo(mode === 'attack' ? 'seam' : 'own')
    return () => cancelAnimationFrame(anim.current)
  }, [mode])

  const structureAt = new Map<string, Structure>()
  for (const s of own.structures) structureAt.set(`${s.col},${s.row}`, s)
  const ruinAt = new Map<string, Ruin>()
  for (const r of own.ruins) ruinAt.set(`${r.col},${r.row}`, r)
  const knownAt = new Map<string, KnownCell>()
  for (const k of enemyKnown) knownAt.set(`${k.col},${k.row}`, k)
  const queuedAt = new Map<string, number>()
  queued.forEach((q, i) => queuedAt.set(`${q.col},${q.row}`, i + 1))

  const enemyRows = Array.from({ length: ROWS }, (_, i) => ROWS - 1 - i)
  const ownRows = Array.from({ length: ROWS }, (_, i) => i)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-2">
        <ViewButton onClick={() => scrollTo('seam')}>↑ Front line</ViewButton>
        <ViewButton onClick={() => scrollTo('own')}>↓ Your map</ViewButton>
      </div>

      <div
        ref={scroller}
        className="overflow-y-auto rounded border border-slate-800"
        style={{
          // Cells are sized here so the whole 32-row stack shares one unit.
          ['--cell' as string]: 'clamp(18px, 2.3vw, 32px)',
          height: 'calc(100vh - 11rem)',
        }}
      >
        <div className="flex gap-1.5 p-2">
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
              rows={enemyRows}
              onClick={onEnemyCellClick}
              render={(col, row) => {
                const key = `${col},${row}`
                const seen = knownAt.get(key)
                const order = queuedAt.get(key)
                const inRange = reachable?.has(key) ?? false
                const dimmed = reachable !== null && !inRange
                const label = `${COL_LABELS[col]}${row + 1}`
                if (order) {
                  return {
                    content: order,
                    title: `${label} — target ${order}, click to remove`,
                    disabled: !interactive || mode !== 'attack',
                    className:
                      'bg-rose-500/40 text-rose-50 font-bold ring-2 ring-inset ring-rose-300',
                  }
                }
                return {
                  content: seen ? KNOWLEDGE_MARK[seen.knowledge] : '',
                  title: dimmed
                    ? `${label} — out of range`
                    : `${label}${seen ? ` — ${seen.knowledge}` : ''}`,
                  disabled: !interactive || dimmed || mode !== 'attack',
                  className: `${seen ? KNOWLEDGE_STYLE[seen.knowledge] : 'bg-slate-800/90'} ${
                    dimmed
                      ? 'opacity-20'
                      : inRange
                        ? 'bg-sky-500/10 ring-1 ring-inset ring-sky-400/40 hover:bg-sky-500/50'
                        : ''
                  }`,
                }
              }}
            />

            <div ref={seam} className="relative h-0">
              <div className="pointer-events-none absolute inset-x-0 -top-px z-10 flex items-center justify-center">
                <span className="rounded-full border border-rose-400/60 bg-slate-950 px-2 py-0.5 text-[9px] uppercase tracking-[0.3em] text-rose-300">
                  Border
                </span>
              </div>
            </div>

            {/* Your half. */}
            <CellGrid
              rows={ownRows}
              onClick={onOwnCellClick}
              render={(col, row) => {
                const key = `${col},${row}`
                const label = `${COL_LABELS[col]}${row + 1}`
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
                    className: `border ${def.tone} ${
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
                    className: 'bg-slate-700/50 text-slate-500',
                  }
                }
                return {
                  content: previewCode ? (
                    <span className="hidden text-slate-300/70 group-hover:inline">
                      {previewCode}
                    </span>
                  ) : null,
                  title: `${label} — ${zoneForRow(row).label}`,
                  disabled: !interactive || mode !== 'build',
                  className: 'group hover:bg-slate-600/60',
                }
              }}
            />

            <FlightPaths strikes={strikes} />
          </div>

          <div className="flex w-24 shrink-0 flex-col">
            {[...ZONES].reverse().map((z) => (
              <ZoneBand key={`e${z.id}`} zone={z} tone="text-rose-200/70" />
            ))}
            {ZONES.map((z) => (
              <ZoneBand key={`o${z.id}`} zone={z} tone="text-slate-300" blurb />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function CellGrid({
  rows,
  render,
  onClick,
}: {
  rows: number[]
  render: (
    col: number,
    row: number,
  ) => {
    content?: React.ReactNode
    title?: string
    disabled?: boolean
    className?: string
  }
  onClick: (col: number, row: number) => void
}) {
  return (
    <div
      className="grid gap-px bg-slate-800/60"
      style={{
        gridTemplateColumns: `repeat(${COLS}, var(--cell))`,
        gridAutoRows: 'var(--cell)',
      }}
    >
      {rows.map((row) =>
        Array.from({ length: COLS }, (_, col) => {
          const spec = render(col, row)
          const zone = zoneForRow(row)
          return (
            <button
              key={`${col},${row}`}
              type="button"
              disabled={spec.disabled}
              title={spec.title}
              onClick={() => onClick(col, row)}
              className={`flex items-center justify-center font-mono text-[9px] transition ${ZONE_TINT[zone.id]} ${spec.className ?? ''}`}
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
 * Strike paths live in stacked space, where the border is y = 0 and the two
 * halves sit either side of it. The stack draws 32 rows with the enemy's
 * deepest row at the top, so visual y = 16 - stacked y.
 */
function FlightPaths({ strikes }: { strikes: Strike[] }) {
  if (strikes.length === 0) return null
  const flip = (y: number) => ROWS - y

  return (
    <svg
      viewBox={`0 0 ${COLS} ${ROWS * 2}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {strikes.map((strike) => {
        const end = strike.interceptedAt ?? strike.to
        const downed = strike.outcome === 'intercepted'
        const color =
          strike.outcome === 'intercepted'
            ? '#38bdf8'
            : strike.outcome === 'destroyed'
              ? '#f43f5e'
              : strike.outcome === 'hit'
                ? '#fb923c'
                : '#94a3b8'
        return (
          <g key={strike.id}>
            <line
              x1={strike.from.x}
              y1={flip(strike.from.y)}
              x2={end.x}
              y2={flip(end.y)}
              stroke={color}
              strokeWidth={0.14}
              strokeDasharray={downed ? '0.5 0.3' : undefined}
              strokeLinecap="round"
              opacity={0.95}
            />
            <circle cx={end.x} cy={flip(end.y)} r={0.42} fill={color} opacity={0.25} />
            <circle
              cx={end.x}
              cy={flip(end.y)}
              r={0.42}
              fill="none"
              stroke={color}
              strokeWidth={0.14}
            />
            {downed && (
              <text
                x={end.x}
                y={flip(end.y) + 0.2}
                textAnchor="middle"
                fontSize={0.6}
                fill={color}
              >
                ✕
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
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
  zone: (typeof ZONES)[number]
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
