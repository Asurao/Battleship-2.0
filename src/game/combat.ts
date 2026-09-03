import { COMBAT } from './constants'
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
  source: Structure,
  targetCol: number,
  targetRow: number,
): boolean {
  return strikeDistance(source, targetCol, targetRow) <= COMBAT.bomberRange
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
    .filter(({ approach }) => approach.distance <= COMBAT.antiAirRadius)
    .sort((a, b) => a.approach.t - b.approach.t)

  for (const { battery, approach } of engagements) {
    if (random() < COMBAT.antiAirHitChance) {
      return { intercepted: true, at: approach.closest, batteryId: battery.id }
    }
  }
  return { intercepted: false }
}

/** Where the flight path crosses into defended airspace, for drawing. */
export function borderCrossing(from: Point, to: Point): Point {
  const span = to.y - from.y
  if (span === 0) return from
  const t = (0 - from.y) / span
  return { x: from.x + t * (to.x - from.x), y: 0 }
}
