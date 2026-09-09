import {
  attackerPoint,
  cellsAlongPath,
  defenderPoint,
  isInRange,
  isInReconRange,
  rollInterception,
} from './combat'
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
  CellKnowledge,
  KnownCell,
  MatchState,
  PlayerId,
  PlayerState,
  QueuedRecon,
  QueuedStrike,
  ReconFlight,
  Strike,
  StructureKind,
} from './types'

export type Action =
  | { type: 'placeStructure'; kind: StructureKind; col: number; row: number }
  | { type: 'removeStructure'; id: string }
  | { type: 'queueStrike'; sourceId: string; col: number; row: number }
  | { type: 'queueRecon'; sourceId: string; col: number; row: number }
  | { type: 'unqueueRecon'; id: string }
  | { type: 'unqueueStrike'; id: string }
  | { type: 'commitStrikes' }
  | { type: 'clearInterceptions' }
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
    queued: [],
    queuedRecon: [],
    flownThisTurn: [],
    scoutedThisTurn: [],
    known: [],
    interceptions: [],
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
    players: { p1: newPlayer('p1', 'Player 1'), p2: newPlayer('p2', 'Player 2') },
    passOrigin: 'setup',
    log: [],
    reconLog: [],
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

/**
 * `actor` is who is taking the action, which the transport knows and the state
 * should not have to guess. Hot-seat passes the active player; the server passes
 * the seat the socket belongs to.
 */
export function reducer(
  state: MatchState,
  action: Action,
  actor: PlayerId = state.activePlayer,
): MatchState {
  if (state.phase === 'gameover' && action.type !== 'resetMatch') return state

  switch (action.type) {
    case 'placeStructure': {
      const me = state.players[actor]
      const blocked =
        me.structures.some((s) => s.col === action.col && s.row === action.row) ||
        me.ruins.some((r) => r.col === action.col && r.row === action.row) ||
        (COMBAT.cratersBlockBuilding &&
          me.craters.some((c) => c.col === action.col && c.row === action.row))
      if (blocked) return state

      const cost = placementCost(state, me, action.kind)
      if (cost > me.budget) return state

      const structure = {
        id: `s${nextId++}`,
        kind: action.kind,
        owner: me.id,
        col: action.col,
        row: action.row,
        hp: STRUCTURE_HP[action.kind],
        maxHp: STRUCTURE_HP[action.kind],
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
            hasBuiltAirfield: me.hasBuiltAirfield || action.kind === 'airfield',
          },
        },
      }
    }

    case 'removeStructure': {
      const me = state.players[actor]
      const target = me.structures.find((s) => s.id === action.id)
      if (!target || !target.refundable) return state
      return {
        ...state,
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
      const me = state.players[actor]
      const source = me.structures.find((s) => s.id === action.sourceId)
      if (!source) return state
      if (me.actionPoints < COMBAT.attackCost) return state
      if (sortiesLeft(me, source.id) <= 0) return state
      if (!isInRange(boardOf(state), source, action.col, action.row)) return state

      return {
        ...state,
        players: {
          ...state.players,
          [me.id]: {
            ...me,
            actionPoints: me.actionPoints - COMBAT.attackCost,
            queued: [
              ...me.queued,
              {
                id: `q${nextId++}`,
                sourceId: source.id,
                col: action.col,
                row: action.row,
              },
            ],
          },
        },
      }
    }

    case 'queueRecon': {
      const me = state.players[actor]
      const source = me.structures.find((s) => s.id === action.sourceId)
      if (!source) return state
      if (me.actionPoints < COMBAT.reconCost) return state
      if (reconSortiesLeft(me, source.id) <= 0) return state
      if (!isInReconRange(boardOf(state), source, action.col, action.row))
        return state

      return {
        ...state,
        players: {
          ...state.players,
          [me.id]: {
            ...me,
            actionPoints: me.actionPoints - COMBAT.reconCost,
            queuedRecon: [
              ...me.queuedRecon,
              {
                id: `r${nextId++}`,
                sourceId: source.id,
                col: action.col,
                row: action.row,
              },
            ],
          },
        },
      }
    }

    case 'unqueueRecon': {
      const me = state.players[actor]
      if (!me.queuedRecon.some((q) => q.id === action.id)) return state
      return {
        ...state,
        players: {
          ...state.players,
          [me.id]: {
            ...me,
            actionPoints: me.actionPoints + COMBAT.reconCost,
            queuedRecon: me.queuedRecon.filter((q) => q.id !== action.id),
          },
        },
      }
    }

    case 'unqueueStrike': {
      const me = state.players[actor]
      if (!me.queued.some((q) => q.id === action.id)) return state
      return {
        ...state,
        players: {
          ...state.players,
          [me.id]: {
            ...me,
            actionPoints: me.actionPoints + COMBAT.attackCost,
            queued: me.queued.filter((q) => q.id !== action.id),
          },
        },
      }
    }

    case 'commitStrikes': {
      const me = state.players[actor]
      if (me.queued.length === 0 && me.queuedRecon.length === 0) return state
      return { ...state, phase: 'resolving' }
    }

    case 'resolveNext': {
      const me = state.players[state.activePlayer]
      // GDD §12: recon resolves before attacks. Because both were committed
      // together, intel from this turn cannot inform this turn's strikes.
      const [nextRecon, ...restRecon] = me.queuedRecon
      if (nextRecon) {
        const flown = resolveRecon(state, nextRecon)
        const drained = withQueues(flown, state.activePlayer, {
          queuedRecon: restRecon,
        })
        const more = restRecon.length > 0 || me.queued.length > 0
        return { ...drained, phase: more ? 'resolving' : 'planning' }
      }

      const [next, ...rest] = me.queued
      if (!next) return { ...state, phase: 'planning' }
      const resolved = resolveStrike(state, next)
      const drained = withQueues(resolved, state.activePlayer, { queued: rest })
      return {
        ...drained,
        // Hold on the resolving screen until the last strike has landed.
        phase:
          drained.phase === 'gameover'
            ? 'gameover'
            : rest.length > 0
              ? 'resolving'
              : 'planning',
      }
    }

    case 'clearInterceptions': {
      const me = state.players[actor]
      return {
        ...state,
        players: { ...state.players, [me.id]: { ...me, interceptions: [] } },
      }
    }

    case 'endTurn': {
      // Unfired orders are abandoned; their action points die with the turn.
      const me = state.players[actor]
      return {
        ...state,
        phase: 'pass',
        passOrigin: 'turn',
        players: {
          ...state.players,
          [me.id]: { ...me, actionPoints: 0, queued: [], queuedRecon: [] },
        },
      }
    }

    case 'finishSetup': {
      const me = state.players[actor]
      if (!setupComplete(me)) return state
      return {
        ...state,
        phase: 'pass',
        passOrigin: 'setup',
        players: { ...state.players, [me.id]: { ...me, setupDone: true } },
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
          players: opening
            ? {
                ...state.players,
                [next]: openTurn(state.players[next], state.turn),
              }
            : state.players,
        }
      }

      // Player 2 finishing their turn closes out the round.
      const roundComplete = state.activePlayer === 'p2'
      // Aircraft overhead count as news too: GDD pillar 2 says the defender
      // watches their own map, and a recon-only turn would otherwise be silent.
      const hasNews =
        state.log.some((s) => s.attacker !== next) ||
        state.reconLog.some((r) => r.attacker !== next)
      const nextTurn = roundComplete ? state.turn + 1 : state.turn
      return {
        ...state,
        activePlayer: next,
        phase: hasNews ? 'briefing' : 'planning',
        turn: nextTurn,
        // Keep what was fired AT the incoming player so they can be briefed on
        // it; drop their own, which they already watched resolve.
        log: state.log.filter((s) => s.attacker !== next),
        reconLog: state.reconLog.filter((r) => r.attacker !== next),
        players: {
          ...state.players,
          [next]: openTurn(state.players[next], nextTurn),
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

  let marks = me.interceptions
  if (interception.intercepted) {
    strike.outcome = 'intercepted'
    strike.interceptedAt = interception.at
    strike.interceptorId = interception.batteryId
    // Nothing is learned about the target cell, but where it fell is itself
    // intelligence: a battery is within engagement radius of that point.
    if (interception.at) marks = [...marks, interception.at]
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
  const meNext = {
    ...me,
    known: knowledge,
    interceptions: marks,
    flownThisTurn: [...me.flownThisTurn, source.id],
  }

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

/**
 * A recon flight reveals every cell it overflies. If a battery brings it down
 * the intel it gathered up to that point still counts, so a downed flight is a
 * partial success rather than a wasted action point.
 */
function resolveRecon(state: MatchState, order: QueuedRecon): MatchState {
  const board = boardOf(state)
  const me = state.players[state.activePlayer]
  const enemyId = opponentOf(state.activePlayer)
  const enemy = state.players[enemyId]

  const source = me.structures.find((s) => s.id === order.sourceId)
  if (!source) return state

  const from = attackerPoint(source.col, source.row)
  const to = defenderPoint(order.col, order.row)
  const interception = rollInterception(
    board,
    from,
    to,
    enemy.structures.filter((s) => s.kind === 'antiair'),
  )

  const overflown = cellsAlongPath(board, from, to, interception.at)
  let known = me.known
  for (const cell of overflown) {
    const standing = enemy.structures.find(
      (s) => s.col === cell.col && s.row === cell.row,
    )
    known = rememberCell(
      known,
      cell.col,
      cell.row,
      standing ? 'scouted' : 'empty',
      standing?.kind,
    )
  }

  const flight: ReconFlight = {
    id: `f${nextId++}`,
    attacker: me.id,
    sourceId: source.id,
    targetCol: order.col,
    targetRow: order.row,
    outcome: interception.intercepted ? 'intercepted' : 'scouted',
    from,
    to,
    interceptedAt: interception.at,
    revealed: overflown.length,
  }

  return {
    ...state,
    reconLog: [...state.reconLog, flight],
    players: {
      ...state.players,
      [me.id]: {
        ...me,
        known,
        interceptions: interception.at
          ? [...me.interceptions, interception.at]
          : me.interceptions,
        scoutedThisTurn: [...me.scoutedThisTurn, source.id],
      },
    },
  }
}

/** Newer observations replace older ones outright — intel does not merge. */
function rememberCell(
  known: KnownCell[],
  col: number,
  row: number,
  knowledge: CellKnowledge,
  kind?: StructureKind,
): KnownCell[] {
  const rest = known.filter((k) => k.col !== col || k.row !== row)
  return [...rest, { col, row, knowledge, kind }]
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
 * A turn opens with an action budget sized by surviving command infrastructure
 * (GDD §11), and with the government's payment — except on turn 1. Paying on
 * turn 1 would hand a player money before they had done anything with the
 * forces they deployed, which is the same problem the starting budget had.
 * Structures raised on earlier turns stop being refundable here, so the map
 * cannot be rearranged for free.
 */
function openTurn(player: PlayerState, turn: number): PlayerState {
  return {
    ...player,
    budget: turn > 1 ? player.budget + ECONOMY.incomePerTurn : player.budget,
    actionPoints: actionPointsFor(player),
    queued: [],
    queuedRecon: [],
    flownThisTurn: [],
    scoutedThisTurn: [],
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


/** Replaces one player's order queues without disturbing the rest of the state. */
function withQueues(
  state: MatchState,
  id: PlayerId,
  patch: Partial<Pick<PlayerState, 'queued' | 'queuedRecon'>>,
): MatchState {
  return {
    ...state,
    players: { ...state.players, [id]: { ...state.players[id], ...patch } },
  }
}

/** Combat missions this airfield has committed or flown this turn. */
export function sortiesLeft(player: PlayerState, airfieldId: string): number {
  const queued = player.queued.filter((q) => q.sourceId === airfieldId).length
  const flown = player.flownThisTurn.filter((id) => id === airfieldId).length
  return COMBAT.sortiesPerAirfield - queued - flown
}


/** Recon missions this airfield has committed or flown this turn. */
export function reconSortiesLeft(
  player: PlayerState,
  airfieldId: string,
): number {
  const queued = player.queuedRecon.filter(
    (q) => q.sourceId === airfieldId,
  ).length
  const flown = player.scoutedThisTurn.filter((id) => id === airfieldId).length
  return COMBAT.reconSortiesPerAirfield - queued - flown
}

/** Recon flights the given player suffered since they last held the device. */
export function overflightsSince(
  state: MatchState,
  player: PlayerId,
): ReconFlight[] {
  return state.reconLog.filter((r) => r.attacker !== player)
}
