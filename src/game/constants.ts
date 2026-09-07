import type { StructureKind, ZoneId } from './types'

export interface ZoneDef {
  id: ZoneId
  label: string
  /** Inclusive row range. Row 0 is the enemy border. */
  startRow: number
  endRow: number
  blurb: string
}

export type BoardId = 'standard' | 'compact'

export interface BoardPreset {
  id: BoardId
  label: string
  note: string
  cols: number
  rows: number
  zones: ZoneDef[]
  /**
   * Bomber reach in cells. Scales with the board: on a 16-row map a range of 12
   * puts a forward airfield three quarters of the way down enemy territory and
   * leaves their long-range zone unreachable. Hold it constant on a shorter map
   * and a forward airfield covers everything, which erases the whole
   * forward-versus-rear trade-off.
   */
  bomberRange: number
  /** Engagement radius in cells; scaled so it covers the same share of width. */
  antiAirRadius: number
  /** CSS length for one cell, so a smaller board still fills the screen. */
  cellSize: string
}

const ZONE_BLURB: Record<ZoneId, string> = {
  close: 'Deep reach, high exposure. Forward bases die young.',
  mid: 'The workhorse zone. Balanced reach and exposure.',
  long: 'Safest ground, reachable only by advanced weaponry.',
}

const ZONE_LABEL: Record<ZoneId, string> = {
  close: 'Close Range',
  mid: 'Mid Range',
  long: 'Long Range',
}

/** GDD §4 splits the map a quarter / half / quarter from the enemy border. */
function buildZones(close: number, mid: number, long: number): ZoneDef[] {
  const spans: [ZoneId, number][] = [
    ['close', close],
    ['mid', mid],
    ['long', long],
  ]
  let cursor = 0
  return spans.map(([id, span]) => {
    const zone: ZoneDef = {
      id,
      label: ZONE_LABEL[id],
      startRow: cursor,
      endRow: cursor + span - 1,
      blurb: ZONE_BLURB[id],
    }
    cursor += span
    return zone
  })
}

export const BOARDS: Record<BoardId, BoardPreset> = {
  standard: {
    id: 'standard',
    label: 'Standard',
    note: '12 × 16 · 192 cells per side',
    cols: 12,
    rows: 16,
    zones: buildZones(4, 8, 4),
    bomberRange: 12,
    antiAirRadius: 3,
    cellSize: 'clamp(18px, 2.3vw, 32px)',
  },
  compact: {
    id: 'compact',
    label: 'Compact',
    note: '8 × 12 · 96 cells per side, faster to search',
    cols: 8,
    rows: 12,
    zones: buildZones(3, 6, 3),
    bomberRange: 9,
    antiAirRadius: 2,
    cellSize: 'clamp(22px, 3vw, 42px)',
  },
}

export const DEFAULT_BOARD: BoardId = 'standard'

export function zoneForRow(board: BoardPreset, row: number): ZoneDef {
  const zone = board.zones.find((z) => row >= z.startRow && row <= z.endRow)
  if (!zone) throw new Error(`Row ${row} falls outside every zone`)
  return zone
}

/** Spreadsheet-style labels so players can talk about coordinates out loud. */
export function colLabels(board: BoardPreset): string[] {
  return Array.from({ length: board.cols }, (_, i) => String.fromCharCode(65 + i))
}

interface StructureDef {
  kind: StructureKind
  label: string
  /** Two-letter stamp drawn in the cell. */
  code: string
  blurb: string
  /** Tailwind classes for the placed marker. */
  tone: string
  /** Tailwind classes for the palette swatch. */
  swatch: string
}

/** Roadmap M1 palette. Capital arrives in M7, everything else later. */
export const STRUCTURES: StructureDef[] = [
  {
    kind: 'airfield',
    label: 'Airfield',
    code: 'AF',
    blurb: 'Produces bombers and recon aircraft.',
    tone: 'border-amber-400/70 bg-amber-400/20 text-amber-200',
    swatch: 'bg-amber-400',
  },
  {
    kind: 'antiair',
    label: 'Anti-Air Battery',
    code: 'AA',
    blurb: 'Basic flak. Engages incoming strikes.',
    tone: 'border-sky-400/70 bg-sky-400/20 text-sky-200',
    swatch: 'bg-sky-400',
  },
  {
    kind: 'command',
    label: 'Command Center',
    code: 'CC',
    blurb: 'Generates action points and research points.',
    tone: 'border-violet-400/70 bg-violet-400/20 text-violet-200',
    swatch: 'bg-violet-400',
  },
]

export function structureDef(kind: StructureKind): StructureDef {
  const def = STRUCTURES.find((s) => s.kind === kind)
  if (!def) throw new Error(`Unknown structure kind: ${kind}`)
  return def
}

/**
 * Combat tuning. Every number here is meant to be turned during the M8 balance
 * pass, and these are the hooks the M5 tech tree will raise and lower.
 */
export const COMBAT = {
  /** Flat per-turn action budget. The real economy arrives in M5. */
  actionPointsPerTurn: 6,
  /** GDD §11: a standard attack costs 2. */
  attackCost: 2,
  /** Damage one bomber run deals to whatever it lands on. */
  strikeDamage: 1,
  /** Chance a single battery downs a strike crossing its envelope. */
  antiAirHitChance: 0.35,
  /**
   * Experiment switch. When true, ground scarred by a landed strike can never
   * be built on again, so every miss permanently denies a cell. Off by default:
   * it rewards uninformed shooting, which fights the recon-first design and
   * would skew M3's read on whether recon is worth the investment.
   */
  cratersBlockBuilding: false,
} as const

/** Each player places exactly these before turn 1. GDD §16. */
export const REQUIRED_SETUP: StructureKind[] = ['airfield', 'antiair', 'command']

export const STRUCTURE_HP: Record<StructureKind, number> = {
  airfield: 2,
  antiair: 2,
  command: 3,
}

/** Structures that count toward the M2 win condition. */
export const OFFENSIVE_KINDS: StructureKind[] = ['airfield']
