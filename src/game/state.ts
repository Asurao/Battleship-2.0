import { isInRange, rollInterception, attackerPoint, defenderPoint } from './combat'
import {
  BOARDS,
  COMBAT,
  DEFAULT_BOARD,
  ECONOMY,
  OFFENSIVE_KINDS,
  REQUIRED_SETUP,
  STRUCTURE_COST,
  STRUCTURE_HP,
} from './constants'
import type { BoardId, BoardPreset } from './constants'
import type {
  MapView,
  MatchState,
  PlanMode,
  PlayerId,
  PlayerState,
  QueuedStrike,
  Strike,
  StructureKind,
} from './types'

export type Action =
  | { type: 'selectKind'; kind: StructureKind }
  | { type: 'setView'; view: MapView }
  | { type: 'setMode'; mode: PlanMode }
  | { type: 'selectSource'; id: string | null }
  | { type: 'placeStructure'; col: number; row: number }
  | { type: 'removeStructure'; id: string }
  | { type: 'queueStrike'; col: number; row: number }
  | { type: 'unqueueStrike'; id: string }
  | { type: 'commitStrikes' }
  | { type: 'resolveNext' }
  | { type: 'endTurn' }
  | { type: 'finishSetup' }
  | { type: 'confirmPass' }
  | { type: 'beginTurn' }
  | { type: 'resetMatch'; boardId?: BoardId }

function newPlayer(id: PlayerId, name: string): PlayerState {
  return {
    id,
    name,
    structures: [],
    ruins: [],
    craters: [],
    known: [],
    budget: ECONOMY.startingBudget,
    actionPoints: 0,
    hasBuiltAirfield: false,
    setupDone: false,
  }
}

/** The preset a match is being played on. */
export function boardOf(state: MatchState): BoardPreset {
  return BOARDS[state.boardId]
}

export function initialState(boardId: BoardId = DEFAULT_BOARD): MatchState {
  return {
    boardId,
    turn: 1,
    activePlayer: 'p1',
    // Both sides field their starting structures before a shot is fired, so
    // nobody spends turn 1 bombing an empty map.
    phase: 'setup',
    view: 'own',
    mode: 'build',
    selectedKind: 'airfield',
    selectedSourceId: null,
    players: { p1: newPlayer('p1', 'Player 1'), p2: newPlayer('p2', 'Player 2') },
    passOrigin: 'setup',
    queued: [],
    log: [],
    winner: null,
  }
}

export function opponentOf(id: PlayerId): PlayerId {
  return id === 'p1' ? 'p2' : 'p1'
}

/** Strikes the given player suffered since they last held the device. */
export function incomingSince(state: MatchState, player: PlayerId): Strike[] {
  return state.log.filter((s) => s.attacker !== player)
}

let nextId = 0

export function reducer(state: MatchState, action: Action): MatchState {
  if (state.phase === 'gameover' && action.type !== 'resetMatch') return state

  switch (action.type) {
    case 'selectKind':
      return { ...state, selectedKind: action.kind }

    case 'setView':
      return { ...state, view: action.view }

    case 'setMode':
      return {
        ...state,
        mode: action.mode,
        view: action.mode === 'attack' ? 'enemy' : 'own',
      }

    case 'selectSource':
      return { ...state, selectedSourceId: action.id }

    case 'placeStructure': {
      const me = state.players[state.activePlayer]
      const blocked =
        me.structures.some((s) => s.col === action.col && s.row === action.row) ||
        me.ruins.some((r) => r.col === action.col && r.row === action.row) ||
        (COMBAT.cratersBlockBuilding &&
          me.craters.some((c) => c.col === action.col && c.row === action.row))
      if (blocked) return state

      const cost = placementCost(state, me, state.selectedKind)
      if (cost > me.budget) return state

      const structure = {
        id: `s${nextId++}`,
        kind: state.selectedKind,
        owner: me.id,
        col: action.col,
        row: action.row,
        hp: STRUCTURE_HP[state.selectedKind],
        maxHp: STRUCTURE_HP[state.selectedKind],
        refundable: true,
      }
      return {
        ...state,
        players: {
          ...state.players,
          [me.id]: {
            ...me,
            budget: me.budget - cost,
            structures: [...me.structures, structure],
            hasBuiltAirfield:
              me.hasBuiltAirfield || state.selectedKind === 'airfield',
          },
        },
      }
    }

    case 'removeStructure': {
      const me = state.players[state.activePlayer]
      const target = me.structures.find((s) => s.id === action.id)
      if (!target || !target.refundable) return state
      return {
        ...state,
        selectedSourceId:
          state.selectedSourceId === action.id ? null : state.selectedSourceId,
        players: {
          ...state.players,
          [me.id]: {
            ...me,
            budget: me.budget + refundOf(state, me, target.kind),
            structures: me.structures.filter((s) => s.id !== action.id),
          },
        },
      }
    }

    case 'queueStrike': {
      const me = state.players[state.activePlayer]
      const source = me.structures.find((s) => s.id === state.selectedSourceId)
      if (!source) return state
      if (me.actionPoints < COMBAT.attackCost) return state
      if (sortiesLeft(state, source.id) <= 0) return state
      if (!isInRange(boardOf(state), source, action.col, action.row)) return state
      // One target per cell — a second click is a mistake, not a double strike.
      if (state.queued.some((q) => q.col === action.col && q.row === action.row))
        return state

      return {
        ...state,
        queued: [
          ...state.queued,
          {
            id: `q${nextId++}`,
            sourceId: source.id,
            col: action.col,
            row: action.row,
          },
        ],
        players: {
          ...state.players,
          [me.id]: { ...me, actionPoints: me.actionPoints - COMBAT.attackCost },
        },
      }
    }

    case 'unqueueStrike': {
      const order = state.queued.find((q) => q.id === action.id)
      if (!order) return state
      const me = state.players[state.activePlayer]
      return {
        ...state,
        queued: state.queued.filter((q) => q.id !== action.id),
        players: {
          ...state.players,
          [me.id]: { ...me, actionPoints: me.actionPoints + COMBAT.attackCost },
        },
      }
    }

    case 'commitStrikes':
      if (state.queued.length === 0) return state
      return { ...state, phase: 'resolving' }

    case 'resolveNext': {
      const [next, ...rest] = state.queued
      if (!next) return { ...state, phase: 'planning' }
      const resolved = resolveStrike(state, next)
      return {
        ...resolved,
        queued: rest,
        // Hold on the resolving screen until the last strike has landed.
        phase:
          resolved.phase === 'gameover'
            ? 'gameover'
            : rest.length > 0
              ? 'resolving'
              : 'planning',
      }
    }

    case 'finishSetup': {
      const me = state.players[state.activePlayer]
      if (!setupComplete(me)) return state
      return {
        ...state,
        phase: 'pass',
        passOrigin: 'setup',
        players: {
          ...state.players,
          [me.id]: { ...me, setupDone: true },
        },
      }
    }

    case 'endTurn': {
      // Unfired orders are abandoned; their action points die with the turn.
      const me = state.players[state.activePlayer]
      return {
        ...state,
        phase: 'pass',
        passOrigin: 'turn',
        selectedSourceId: null,
        queued: [],
        players: { ...state.players, [me.id]: { ...me, actionPoints: 0 } },
      }
    }

    case 'confirmPass': {
      const next = opponentOf(state.activePlayer)

      // Still fielding starting forces: hand over and keep setting up.
      if (state.passOrigin === 'setup') {
        const opening = state.players[next].setupDone
        return {
          ...state,
          activePlayer: next,
          phase: opening ? 'planning' : 'setup',
          view: 'own',
          mode: 'build',
          selectedSourceId: null,
          queued: [],
          players: opening
            ? { ...state.players, [next]: openTurn(state.players[next]) }
            : state.players,
        }
      }

      // Player 2 finishing their turn closes out the round.
      const roundComplete = state.activePlayer === 'p2'
      const hasNews = state.log.some((s) => s.attacker !== next)
      return {
        ...state,
        activePlayer: next,
        phase: hasNews ? 'briefing' : 'planning',
        view: 'own',
        mode: 'build',
        selectedSourceId: null,
        queued: [],
        turn: roundComplete ? state.turn + 1 : state.turn,
        // Keep what was fired AT the incoming player so they can be briefed on
        // it; drop their own strikes, which they already watched resolve.
        log: state.log.filter((s) => s.attacker !== next),
        players: {
          ...state.players,
          [next]: openTurn(state.players[next]),
        },
      }
    }

    // Acknowledging the briefing only opens the turn. It must NOT re-run
    // confirmPass, which would hand control straight back to the opponent.
    case 'beginTurn':
      return { ...state, phase: 'planning' }

    case 'resetMatch':
      return initialState(action.boardId ?? state.boardId)
  }
}

function resolveStrike(state: MatchState, order: QueuedStrike): MatchState {
  const { col: targetCol, row: targetRow } = order
  const me = state.players[state.activePlayer]
  const enemyId = opponentOf(state.activePlayer)
  const enemy = state.players[enemyId]

  // The launching airfield may have been destroyed since the order was given.
  const source = me.structures.find((s) => s.id === order.sourceId)
  if (!source) return state

  const from = attackerPoint(source.col, source.row)
  const to = defenderPoint(targetCol, targetRow)

  const strike: Strike = {
    id: `k${nextId++}`,
    attacker: me.id,
    sourceId: source.id,
    targetCol,
    targetRow,
    outcome: 'miss',
    from,
    to,
  }

  const batteries = enemy.structures.filter((s) => s.kind === 'antiair')
  const interception = rollInterception(boardOf(state), from, to, batteries)

  let enemyNext = enemy
  let knowledge: MatchState['players'][PlayerId]['known'] = me.known

  if (interception.intercepted) {
    strike.outcome = 'intercepted'
    strike.interceptedAt = interception.at
    strike.interceptorId = interception.batteryId
    // An intercepted strike teaches the attacker nothing about the target cell.
  } else {
    enemyNext = {
      ...enemy,
      craters: [...enemy.craters, { col: targetCol, row: targetRow }],
    }
    const target = enemy.structures.find(
      (s) => s.col === targetCol && s.row === targetRow,
    )
    if (!target) {
      strike.outcome = 'miss'
      knowledge = rememberCell(me.known, targetCol, targetRow, 'empty')
    } else {
      const hp = target.hp - COMBAT.strikeDamage
      strike.struckKind = target.kind
      if (hp <= 0) {
        strike.outcome = 'destroyed'
        enemyNext = {
          ...enemyNext,
          structures: enemy.structures.filter((s) => s.id !== target.id),
          ruins: [
            ...enemy.ruins,
            { col: target.col, row: target.row, kind: target.kind },
          ],
        }
        knowledge = rememberCell(me.known, targetCol, targetRow, 'destroyed')
      } else {
        strike.outcome = 'hit'
        enemyNext = {
          ...enemyNext,
          structures: enemy.structures.map((s) =>
            s.id === target.id ? { ...s, hp } : s,
          ),
        }
        knowledge = rememberCell(me.known, targetCol, targetRow, 'struck')
      }
    }
  }

  // Action points were already spent when the target was marked.
  const meNext = { ...me, known: knowledge }

  const players = { ...state.players, [me.id]: meNext, [enemyId]: enemyNext }
  const defeated =
    enemyNext.hasBuiltAirfield &&
    !enemyNext.structures.some((s) => OFFENSIVE_KINDS.includes(s.kind))

  return {
    ...state,
    players,
    log: [...state.log, strike],
    winner: defeated ? me.id : null,
    phase: defeated ? 'gameover' : state.phase,
  }
}

function rememberCell(
  known: MatchState['players'][PlayerId]['known'],
  col: number,
  row: number,
  knowledge: 'empty' | 'struck' | 'destroyed',
) {
  const rest = known.filter((k) => k.col !== col || k.row !== row)
  return [...rest, { col, row, knowledge }]
}


export function setupRemaining(player: PlayerState): StructureKind[] {
  return REQUIRED_SETUP.filter(
    (kind) => !player.structures.some((s) => s.kind === kind),
  )
}

export function setupComplete(player: PlayerState): boolean {
  return setupRemaining(player).length === 0
}


/**
 * A turn opens with fresh income and an action budget sized by surviving
 * command infrastructure (GDD §11). Structures raised on earlier turns stop
 * being refundable, so the map cannot be rearranged for free.
 */
function openTurn(player: PlayerState): PlayerState {
  return {
    ...player,
    budget: player.budget + ECONOMY.incomePerTurn,
    actionPoints: actionPointsFor(player),
    structures: player.structures.map((s) =>
      s.refundable ? { ...s, refundable: false } : s,
    ),
  }
}

export function actionPointsFor(player: PlayerState): number {
  const commands = player.structures.filter((s) => s.kind === 'command').length
  return ECONOMY.actionPointsBase + ECONOMY.actionPointsPerCommand * commands
}

/** Deployment fields one of each required structure free; extras are bought. */
function isFreeRequired(
  state: MatchState,
  player: PlayerState,
  kind: StructureKind,
): boolean {
  return (
    state.phase === 'setup' &&
    REQUIRED_SETUP.includes(kind) &&
    !player.structures.some((s) => s.kind === kind)
  )
}

export function placementCost(
  state: MatchState,
  player: PlayerState,
  kind: StructureKind,
): number {
  return isFreeRequired(state, player, kind) ? 0 : STRUCTURE_COST[kind]
}

/**
 * Taking back a free deployment structure must not mint budget, so the refund
 * is whatever putting another one down would now cost — zero while it is still
 * the free one.
 */
function refundOf(
  state: MatchState,
  player: PlayerState,
  kind: StructureKind,
): number {
  const wouldBeFree =
    state.phase === 'setup' &&
    REQUIRED_SETUP.includes(kind) &&
    player.structures.filter((s) => s.kind === kind).length === 1
  return wouldBeFree ? 0 : STRUCTURE_COST[kind]
}


/** Missions this airfield has already committed or flown this turn. */
export function sortiesUsed(state: MatchState, airfieldId: string): number {
  const queued = state.queued.filter((q) => q.sourceId === airfieldId).length
  const flown = state.log.filter(
    (s) => s.attacker === state.activePlayer && s.sourceId === airfieldId,
  ).length
  return queued + flown
}

export function sortiesLeft(state: MatchState, airfieldId: string): number {
  return COMBAT.sortiesPerAirfield - sortiesUsed(state, airfieldId)
}
