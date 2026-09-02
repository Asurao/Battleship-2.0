import type { MapView, MatchState, PlayerId, StructureKind } from './types'

export type Action =
  | { type: 'selectKind'; kind: StructureKind }
  | { type: 'setView'; view: MapView }
  | { type: 'placeStructure'; col: number; row: number }
  | { type: 'removeStructure'; id: string }
  | { type: 'endTurn' }
  | { type: 'confirmPass' }
  | { type: 'resetMatch' }

export function initialState(): MatchState {
  return {
    turn: 1,
    activePlayer: 'p1',
    phase: 'placing',
    view: 'own',
    selectedKind: 'airfield',
    players: {
      p1: { id: 'p1', name: 'Player 1', structures: [] },
      p2: { id: 'p2', name: 'Player 2', structures: [] },
    },
  }
}

export function opponentOf(id: PlayerId): PlayerId {
  return id === 'p1' ? 'p2' : 'p1'
}

let nextId = 0

export function reducer(state: MatchState, action: Action): MatchState {
  switch (action.type) {
    case 'selectKind':
      return { ...state, selectedKind: action.kind }

    case 'setView':
      return { ...state, view: action.view }

    case 'placeStructure': {
      const me = state.players[state.activePlayer]
      const occupied = me.structures.some(
        (s) => s.col === action.col && s.row === action.row,
      )
      if (occupied) return state

      const structure = {
        id: `s${nextId++}`,
        kind: state.selectedKind,
        owner: me.id,
        col: action.col,
        row: action.row,
      }
      return {
        ...state,
        players: {
          ...state.players,
          [me.id]: { ...me, structures: [...me.structures, structure] },
        },
      }
    }

    case 'removeStructure': {
      const me = state.players[state.activePlayer]
      return {
        ...state,
        players: {
          ...state.players,
          [me.id]: {
            ...me,
            structures: me.structures.filter((s) => s.id !== action.id),
          },
        },
      }
    }

    case 'endTurn':
      return { ...state, phase: 'pass' }

    case 'confirmPass': {
      // Player 2 finishing their turn closes out the round.
      const roundComplete = state.activePlayer === 'p2'
      return {
        ...state,
        phase: 'placing',
        view: 'own',
        activePlayer: opponentOf(state.activePlayer),
        turn: roundComplete ? state.turn + 1 : state.turn,
      }
    }

    case 'resetMatch':
      return initialState()
  }
}
