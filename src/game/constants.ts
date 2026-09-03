import type { StructureKind, ZoneId } from './types'

/** GDD §4: "a grid of approximately 12 columns by 16 rows". */
export const COLS = 12
export const ROWS = 16

interface ZoneDef {
  id: ZoneId
  label: string
  /** Inclusive row range. Row 0 is the enemy border. */
  startRow: number
  endRow: number
  blurb: string
}

/** GDD §4: close = top 4 rows, mid = middle 8, long = bottom 4. */
export const ZONES: ZoneDef[] = [
  {
    id: 'close',
    label: 'Close Range',
    startRow: 0,
    endRow: 3,
    blurb: 'Deep reach, high exposure. Forward bases die young.',
  },
  {
    id: 'mid',
    label: 'Mid Range',
    startRow: 4,
    endRow: 11,
    blurb: 'The workhorse zone. Balanced reach and exposure.',
  },
  {
    id: 'long',
    label: 'Long Range',
    startRow: 12,
    endRow: 15,
    blurb: 'Safest ground, reachable only by advanced weaponry.',
  },
]

export function zoneForRow(row: number): ZoneDef {
  const zone = ZONES.find((z) => row >= z.startRow && row <= z.endRow)
  if (!zone) throw new Error(`Row ${row} falls outside every zone`)
  return zone
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
  /**
   * How far a basic bomber reaches, measured across the border in cell widths.
   * Tuned so a close-range airfield strikes deep into enemy territory while a
   * long-range one cannot reach at all — GDD §5's zone restrictions, emerging
   * from geometry instead of a hard rule.
   */
  bomberRange: 12,
  /** Radius, in cells, in which a battery may engage a passing strike. */
  antiAirRadius: 3,
  /** Chance a single battery downs a strike crossing its envelope. */
  antiAirHitChance: 0.35,
} as const

export const STRUCTURE_HP: Record<StructureKind, number> = {
  airfield: 2,
  antiair: 2,
  command: 3,
}

/** Structures that count toward the M2 win condition. */
export const OFFENSIVE_KINDS: StructureKind[] = ['airfield']

/** Spreadsheet-style labels so players can talk about coordinates out loud. */
export const COL_LABELS = Array.from({ length: COLS }, (_, i) =>
  String.fromCharCode(65 + i),
)
