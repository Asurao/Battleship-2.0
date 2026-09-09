import { useMemo, useState } from 'react'
import { AttackPanel } from './components/AttackPanel'
import { BriefingScreen } from './components/BriefingScreen'
import { GameOverScreen } from './components/GameOverScreen'
import { MapStack } from './components/MapStack'
import { ReconPanel } from './components/ReconPanel'
import { PassScreen } from './components/PassScreen'
import { SetupPanel } from './components/SetupPanel'
import { StructurePalette } from './components/StructurePalette'
import { isInRange, isInReconRange } from './game/combat'
import { BOARDS, ECONOMY, structureDef } from './game/constants'
import type { BoardId } from './game/constants'
import type { StructureKind } from './game/types'

import {
  actionPointsFor,
  boardOf,
  overflightsSince,
  reconSortiesLeft,
  sortiesLeft,
  incomingSince,
  opponentOf,
  setupRemaining,
} from './game/state'
import type { Match } from './match/types'

/** Which panel this client is working in. Purely local — the opponent's screen
 *  has its own, which is why it cannot live in the shared match state. */
type PlanMode = 'build' | 'recon' | 'attack'

export default function App({ match }: { match: Match }) {
  const { state, dispatch, you, yourTurn, waitingOn } = match
  const [mode, setMode] = useState<PlanMode>('build')
  const [selectedKind, setSelectedKind] = useState<StructureKind>('airfield')
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  /**
   * Which situation an End Turn confirmation was given for. Held as a snapshot
   * rather than a flag so that any change — queueing, switching mode, the turn
   * passing — invalidates it during render, with no effect to keep in sync.
   */
  const [confirmedFor, setConfirmedFor] = useState<string | null>(null)

  const board = boardOf(state)
  // Rendered from this client's seat, which is not necessarily the seat whose
  // turn it is — hot-seat is the special case where those always coincide.
  const me = state.players[you]
  const enemy = state.players[opponentOf(you)]
  const attacking = mode === 'attack' && state.phase !== 'setup'
  const scouting = mode === 'recon' && state.phase !== 'setup'
  const resolving = state.phase === 'resolving'
  /** Anything that would change the board is gated on holding the turn. */
  const canAct = yourTurn && !resolving
  const pending = me.queued.length + me.queuedRecon.length
  const endKey = `${state.activePlayer}|${state.turn}|${mode}|${pending}`
  const confirmEnd = confirmedFor === endKey
  const settingUp = state.phase === 'setup'
  const remaining = setupRemaining(me)

  const airfields = useMemo(
    () => me.structures.filter((s) => s.kind === 'airfield'),
    [me.structures],
  )
  const source = airfields.find((s) => s.id === selectedSourceId) ?? null

  const sorties = useMemo(
    () =>
      Object.fromEntries(airfields.map((f) => [f.id, sortiesLeft(me, f.id)])),
    [airfields, me],
  )
  const reconSorties = useMemo(
    () =>
      Object.fromEntries(
        airfields.map((f) => [f.id, reconSortiesLeft(me, f.id)]),
      ),
    [airfields, me],
  )

  /** Cells the selected airfield can reach — further for recon than for bombs. */
  const reachable = useMemo(() => {
    if (!source) return null
    const within = scouting ? isInReconRange : isInRange
    const cells = new Set<string>()
    for (let row = 0; row < board.rows; row++) {
      for (let col = 0; col < board.cols; col++) {
        if (within(board, source, col, row)) cells.add(`${col},${row}`)
      }
    }
    return cells
  }, [source, board, scouting])

  /** Strikes this player launched this turn, drawn on the enemy map. */
  const outgoing = state.log.filter((s) => s.attacker === me.id)
  const outgoingRecon = state.reconLog.filter((r) => r.attacker === me.id)

  const structureAtOwnCell = (col: number, row: number) =>
    me.structures.find((s) => s.col === col && s.row === row)

  if (state.phase === 'gameover' && state.winner) {
    return (
      <div className="h-full bg-slate-950 text-slate-200">
        <GameOverScreen
          winnerName={state.players[state.winner].name}
          loserName={state.players[opponentOf(state.winner)].name}
          turn={state.turn}
          onReset={() => dispatch({ type: 'resetMatch' })}
        />
      </div>
    )
  }

  // Briefings and hand-offs belong to the player whose turn is opening. The
  // other client stays on the board behind a waiting banner, rather than being
  // shown someone else's intelligence report addressed to them.
  if (state.phase === 'pass' && yourTurn) {
    return (
      <div className="h-full bg-slate-950 text-slate-200">
        <PassScreen
          fromName={me.name}
          toName={enemy.name}
          turn={state.turn}
          setup={state.passOrigin === 'setup'}
          onContinue={() => dispatch({ type: 'confirmPass' })}
        />
      </div>
    )
  }

  if (state.phase === 'briefing' && yourTurn) {
    return (
      <div className="h-full overflow-auto bg-slate-950 text-slate-200">
        <BriefingScreen
          board={board}
          playerName={me.name}
          turn={state.turn}
          incoming={incomingSince(state, me.id)}
          overflights={overflightsSince(state, me.id)}
          onContinue={() => dispatch({ type: 'beginTurn' })}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-200">
      <header className="flex items-baseline gap-3 border-b border-slate-800 px-5 py-3">
        <h1 className="text-sm font-semibold tracking-wide text-slate-100">
          Battleship 2.0
        </h1>
        <span className="text-[10px] uppercase tracking-[0.25em] text-slate-600">
          Prototype · Economy pass
        </span>
      </header>

      <main className="flex min-h-0 flex-1 items-start justify-center gap-8 overflow-auto px-6 py-5">
        <div className="flex w-64 shrink-0 flex-col gap-3">
          {waitingOn && (
            <div className="rounded border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-[11px] leading-snug text-sky-200">
              {waitingOn}
            </div>
          )}
          <div className="rounded border border-slate-700 bg-slate-900/60 px-3 py-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-slate-100">
                {me.name}
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                {settingUp ? 'Deploy' : `Turn ${state.turn}`}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Meter label="Budget" value={String(me.budget)} />
              <Meter
                label="Actions"
                value={
                  settingUp ? '—' : `${me.actionPoints}/${actionPointsFor(me)}`
                }
              />
            </div>
          </div>

          {!settingUp && (
            <div className="flex gap-1 rounded border border-slate-800 bg-slate-900 p-1">
              <Tab
                active={mode === 'build'}
                onClick={() => setMode('build')}
                disabled={!canAct}
              >
                Build
              </Tab>
              <Tab
                active={scouting}
                onClick={() => setMode('recon')}
                disabled={!canAct}
              >
                Recon
              </Tab>
              <Tab
                active={attacking}
                onClick={() => setMode('attack')}
                disabled={!canAct}
              >
                Attack
              </Tab>
            </div>
          )}

          {settingUp ? (
            <SetupPanel
              player={me}
              selected={selectedKind}
              remaining={remaining}
              onSelect={setSelectedKind}
              onReady={() => dispatch({ type: 'finishSetup' })}
            />
          ) : scouting ? (
            <ReconPanel
              board={board}
              airfields={airfields}
              reconSorties={reconSorties}
              selectedSourceId={selectedSourceId}
              queued={me.queuedRecon}
              results={outgoingRecon}
              resolving={!canAct}
              onSelectSource={setSelectedSourceId}
              onRemoveTarget={(id) => dispatch({ type: 'unqueueRecon', id })}
            />
          ) : attacking ? (
            <AttackPanel
              board={board}
              airfields={airfields}
              sorties={sorties}
              selectedSourceId={selectedSourceId}
              actionPoints={me.actionPoints}
              queued={me.queued}
              results={outgoing}
              resolving={!canAct}
              onSelectSource={setSelectedSourceId}
              onRemoveTarget={(id) => dispatch({ type: 'unqueueStrike', id })}
            />
          ) : (
            <StructurePalette
              selected={selectedKind}
              onSelect={setSelectedKind}
              placed={me.structures}
              budget={me.budget}
              disabled={!canAct}
            />
          )}

          {!settingUp && pending > 0 && (
            <button
              type="button"
              disabled={!canAct}
              onClick={() => dispatch({ type: 'commitStrikes' })}
              className="rounded border border-rose-400/70 bg-rose-500/20 px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/40 disabled:opacity-40"
            >
              {resolving
                ? 'Operations under way…'
                : `Commit ${pending} operation${pending === 1 ? '' : 's'}`}
            </button>
          )}

          {!settingUp && (
            <div className="mt-1 border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => {
                  // Ending a turn with orders on the table silently burns them
                  // along with the whole turn's action points, and this button
                  // sits right under Commit — so make that case ask twice.
                  if (pending > 0 && !confirmEnd) setConfirmedFor(endKey)
                  else dispatch({ type: 'endTurn' })
                }}
                disabled={resolving}
                className={`w-full rounded border px-4 py-2 text-xs font-medium transition disabled:opacity-40 ${
                  confirmEnd
                    ? 'border-amber-400 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                }`}
              >
                {confirmEnd
                  ? `Discard ${pending} order${pending === 1 ? '' : 's'} and end turn?`
                  : 'End Turn'}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-3">
          <MapStack
            board={board}
            mode={mode}
            own={{
              structures: me.structures,
              ruins: me.ruins,
              craters: me.craters,
            }}
            enemyKnown={me.known}
            interceptions={me.interceptions}
            reachable={attacking || scouting ? reachable : null}
            reachRadius={scouting ? board.reconRange : board.bomberRange}
            queued={me.queued}
            queuedRecon={me.queuedRecon}
            strikes={outgoing}
            flights={outgoingRecon}
            selectedSourceId={selectedSourceId}
            selectedKind={selectedKind}
            previewCode={attacking ? null : structureDef(selectedKind).code}
            interactive={canAct}
            onEnemyCellClick={(col, row) => {
              // Repeat clicks stack operations on one cell; removal is done
              // from the plan lists, so a defended target can be hit twice.
              if (!selectedSourceId) return
              if (scouting)
                dispatch({ type: 'queueRecon', sourceId: selectedSourceId, col, row })
              else if (attacking)
                dispatch({ type: 'queueStrike', sourceId: selectedSourceId, col, row })
            }}
            onClearInterceptions={() =>
              dispatch({ type: 'clearInterceptions' })
            }
            onOwnCellClick={(col, row) => {
              if (attacking) return
              const existing = structureAtOwnCell(col, row)
              if (existing)
                dispatch({ type: 'removeStructure', id: existing.id })
              else
                dispatch({ type: 'placeStructure', kind: selectedKind, col, row })
            }}
          />
        </div>

        <aside className="w-56 shrink-0 space-y-3">
          <div>
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Situation
            </h2>
            <dl className="mt-2 space-y-1.5 text-[11px]">
              <Row label="Structures" value={String(me.structures.length)} />
              <Row
                label="Airfields"
                value={`${airfields.length} · ${Object.values(sorties).reduce((a, b) => a + b, 0)} sorties`}
              />
              <Row label="Ruins" value={String(me.ruins.length)} />
              <Row label="Craters" value={String(me.craters.length)} />
              <Row
                label="Income / turn"
                value={`+${ECONOMY.incomePerTurn}`}
              />
              <Row
                label="Bomber reach"
                value={`${board.bomberRange} cells`}
              />
              <Row label="Targets marked" value={String(me.queued.length)} />
              <Row label="Strikes flown" value={String(outgoing.length)} />
            </dl>
          </div>

          {attacking && (
            <div className="space-y-1 border-t border-slate-800 pt-2.5">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Legend
              </h2>
              <Legend mark="·" tone="text-slate-500" text="Confirmed empty" />
              <Legend mark="✳" tone="text-orange-300" text="Structure damaged" />
              <Legend mark="✕" tone="text-rose-300" text="Structure destroyed" />
            </div>
          )}

          <p className="border-t border-slate-800 pt-2.5 text-[10px] leading-relaxed text-slate-600">
            Win by destroying every enemy airfield. Recon lifts the fog in
            Milestone 3 — until then you are shooting blind.
          </p>

          <div className="border-t border-slate-800 pt-2.5">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Board
            </h2>
            <p className="mt-1 text-[10px] leading-snug text-slate-600">
              Picking a size starts a fresh match — it cannot change mid-game.
            </p>
            <div className="mt-2 space-y-1">
              {Object.values(BOARDS).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: 'resetMatch',
                      boardId: preset.id as BoardId,
                    })
                  }
                  className={`w-full rounded border px-2 py-1.5 text-left transition ${
                    preset.id === state.boardId
                      ? 'border-slate-400 bg-slate-700/70'
                      : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
                  }`}
                >
                  <span className="block text-[11px] text-slate-100">
                    {preset.label}
                    {preset.id === state.boardId && ' · current'}
                  </span>
                  <span className="block text-[9px] text-slate-500">
                    {preset.note}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}

function Meter({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-slate-800/60 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-[0.15em] text-slate-500">
        {label}
      </div>
      <div className="font-mono text-sm text-slate-100">{value}</div>
    </div>
  )
}

function Tab({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-4 py-1.5 text-xs transition disabled:opacity-40 ${
        active ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      {children}
    </button>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-mono text-slate-300">{value}</dd>
    </div>
  )
}

function Legend({ mark, tone, text }: { mark: string; tone: string; text: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px] text-slate-500">
      <span className={`font-mono ${tone}`}>{mark}</span>
      {text}
    </div>
  )
}
