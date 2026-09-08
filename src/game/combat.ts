import { COMBAT } from './constants'
import type { BoardPreset } from './constants'
import type { Point, Structure } from './types'

/**
 * The two grids face each other across a border at y = 0. The attacker's
 * territory occupies negative y, the defender's positive y, so a single
 * straight line describes a strike's whole journey and the defender's batteries
 * can be measured against the part of it that crosses their airspace.
 *
 * Columns are NOT mirrored: column A on one map faces column A on the other.
 * That keeps coordinates easy to reason about while playtesting.
 */
export function attackerPoint(col: number, row: number): Point {
  return { x: col + 0.5, y: -(row + 0.5) }
}

export function defenderPoint(col: number, row: number): Point {
  return { x: col + 0.5, y: row + 0.5 }
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** How far a strike from `source` would have to fly to reach an enemy cell. */
export function strikeDistance(
  source: Structure,
  targetCol: number,
  targetRow: number,
): number {
  return distance(
    attackerPoint(source.col, source.row),
    defenderPoint(targetCol, targetRow),
  )
}

export function isInRange(
  board: BoardPreset,
  source: Structure,
  targetCol: number,
  targetRow: number,
): boolean {
  return strikeDistance(source, targetCol, targetRow) <= board.bomberRange
}

/** Deepest enemy row an airfield can reach straight ahead of itself. */
export function deepestReach(
  board: BoardPreset,
  source: Structure,
  range: number = board.bomberRange,
): number | null {
  for (let row = board.rows - 1; row >= 0; row--) {
    if (strikeDistance(source, source.col, row) <= range) return row
  }
  return null
}

interface SegmentHit {
  /** Position along the segment, 0 at the source and 1 at the target. */
  t: number
  distance: number
  closest: Point
}

/** Closest approach of a point to a line segment. */
function closestApproach(p: Point, a: Point, b: Point): SegmentHit {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  const t =
    lengthSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq))
  const closest = { x: a.x + t * dx, y: a.y + t * dy }
  return { t, distance: distance(p, closest), closest }
}

export interface InterceptionResult {
  intercepted: boolean
  at?: Point
  batteryId?: string
}

/**
 * Rolls every defending battery whose envelope the flight path crosses, in the
 * order the strike meets them. The first battery to connect stops it there, so
 * batteries placed forward screen everything behind them — which is the point.
 */
export function rollInterception(
  board: BoardPreset,
  from: Point,
  to: Point,
  batteries: Structure[],
  random: () => number = Math.random,
): InterceptionResult {
  const engagements = batteries
    .map((battery) => ({
      battery,
      approach: closestApproach(
        defenderPoint(battery.col, battery.row),
        from,
        to,
      ),
    }))
    .filter(({ approach }) => approach.distance <= board.antiAirRadius)
    .sort((a, b) => a.approach.t - b.approach.t)

  for (const { battery, approach } of engagements) {
    if (random() < COMBAT.antiAirHitChance) {
      return { intercepted: true, at: approach.closest, batteryId: battery.id }
    }
  }
  return { intercepted: false }
}

export function isInReconRange(
  board: BoardPreset,
  source: Structure,
  targetCol: number,
  targetRow: number,
): boolean {
  return strikeDistance(source, targetCol, targetRow) <= board.reconRange
}

/**
 * Every defender cell the flight passes through, however briefly.
 *
 * Works by collecting the parameters at which the segment crosses a column or
 * row boundary, then reading the cell at the midpoint of each resulting span.
 * That counts a cell the path merely clips, which is the point: a diagonal
 * crosses far more cells than a straight run, so the angle you fly is a real
 * decision.
 */
export function cellsAlongPath(
  board: BoardPreset,
  from: Point,
  to: Point,
  stopAt?: Point,
): Array<{ col: number; row: number }> {
  const end = stopAt ?? to
  if (end.y <= 0) return []
  // Only the leg inside the defender's airspace reveals anything.
  const start = from.y < 0 ? borderCrossing(from, end) : from

  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) return []

  const cuts = new Set<number>([0, 1])
  const addCrossings = (a: number, b: number, delta: number) => {
    if (delta === 0) return
    const lo = Math.ceil(Math.min(a, b))
    const hi = Math.floor(Math.max(a, b))
    for (let line = lo; line <= hi; line++) {
      const t = (line - a) / delta
      if (t > 0 && t < 1) cuts.add(t)
    }
  }
  addCrossings(start.x, end.x, dx)
  addCrossings(start.y, end.y, dy)

  const ordered = [...cuts].sort((a, b) => a - b)
  const seen = new Set<string>()
  const cells: Array<{ col: number; row: number }> = []
  for (let i = 0; i < ordered.length - 1; i++) {
    const mid = (ordered[i] + ordered[i + 1]) / 2
    const col = Math.floor(start.x + mid * dx)
    const row = Math.floor(start.y + mid * dy)
    if (col < 0 || col >= board.cols || row < 0 || row >= board.rows) continue
    const key = `${col},${row}`
    if (seen.has(key)) continue
    seen.add(key)
    cells.push({ col, row })
  }
  return cells
}

/** Where the flight path crosses into defended airspace, for drawing. */
export function borderCrossing(from: Point, to: Point): Point {
  const span = to.y - from.y
  if (span === 0) return from
  const t = (0 - from.y) / span
  return { x: from.x + t * (to.x - from.x), y: 0 }
}
