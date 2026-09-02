export type PlayerId = 'p1' | 'p2'

/** Distance bands from the enemy border, which sits at the top of the map. */
export type ZoneId = 'close' | 'mid' | 'long'

export type StructureKind = 'airfield' | 'antiair' | 'command'

export interface Structure {
  id: string
  kind: StructureKind
  owner: PlayerId
  col: number
  row: number
}

export interface PlayerState {
  id: PlayerId
  name: string
  structures: Structure[]
}

/**
 * `placing` — the active player is looking at their own map, building.
 * `pass`    — the hand-off screen, so the next player doesn't see the last one's map.
 */
export type Phase = 'placing' | 'pass'

/** Which map the active player is currently looking at. */
export type MapView = 'own' | 'enemy'

export interface MatchState {
  turn: number
  activePlayer: PlayerId
  phase: Phase
  view: MapView
  selectedKind: StructureKind
  players: Record<PlayerId, PlayerState>
}
