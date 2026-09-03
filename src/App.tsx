import { useMemo, useReducer } from 'react'
import { AttackPanel } from './components/AttackPanel'
import { BriefingScreen } from './components/BriefingScreen'
import { GameOverScreen } from './components/GameOverScreen'
import { MapGrid } from './components/MapGrid'
import { PassScreen } from './components/PassScreen'
import { StructurePalette } from './components/StructurePalette'
import { isInRange } from './game/combat'
import { COLS, COMBAT, ROWS, structureDef } from './game/constants'
import { incomingSince, initialState, opponentOf, reducer } from './game/state'

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  const me = state.players[state.activePlayer]
  const enemy = state.players[opponentOf(state.activePlayer)]
  const attacking = state.mode === 'attack'
  const viewingEnemy = state.view === 'enemy'

  const airfields = useMemo(
    () => me.structures.filter((s) => s.kind === 'airfield'),
    [me.structures],
  )
  const source = airfields.find((s) => s.id === state.selectedSourceId) ?? null

  /** Cells the selected airfield can actually reach, for the range overlay. */
  const reachable = useMemo(() => {
    if (!source) return null
    const cells = new Set<string>()
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (isInRange(source, col, row)) cells.add(`${col},${row}`)
      }
    }
    return cells
  }, [source])

  /** Strikes this player launched this turn, drawn on the enemy map. */
  const outgoing = state.log.filter((s) => s.attacker === me.id)

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

  if (state.phase === 'pass') {
    return (
      <div className="h-full bg-slate-950 text-slate-200">
        <PassScreen
          fromName={me.name}
          toName={enemy.name}
          turn={state.turn}
          onContinue={() => dispatch({ type: 'confirmPass' })}
        />
      </div>
    )
  }

  if (state.phase === 'briefing') {
    return (
      <div className="h-full overflow-auto bg-slate-950 text-slate-200">
        <BriefingScreen
          playerName={me.name}
          turn={state.turn}
          incoming={incomingSince(state, me.id)}
          onContinue={() => dispatch({ type: 'beginTurn' })}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-200">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-sm font-semibold tracking-wide text-slate-100">
            Battleship 2.0
          </h1>
          <span className="text-[10px] uppercase tracking-[0.25em] text-slate-600">
            Prototype · Milestone 2
          </span>
        </div>

        <div className="flex items-center gap-5">
          <Readout label="Turn" value={String(state.turn)} />
          <Readout
            label="Action Points"
            value={`${me.actionPoints} / ${COMBAT.actionPointsPerTurn}`}
          />
          <Readout label="Commanding" value={me.name} />
          <button
            type="button"
            onClick={() => dispatch({ type: 'endTurn' })}
            className="rounded border border-slate-500 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-100 transition hover:border-slate-300 hover:bg-slate-700"
          >
            End Turn
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 items-start justify-center gap-8 overflow-auto px-6 py-5">
        {attacking ? (
          <AttackPanel
            airfields={airfields}
            selectedSourceId={state.selectedSourceId}
            actionPoints={me.actionPoints}
            onSelectSource={(id) => dispatch({ type: 'selectSource', id })}
          />
        ) : (
          <StructurePalette
            selected={state.selectedKind}
            onSelect={(kind) => dispatch({ type: 'selectKind', kind })}
            placed={me.structures}
            disabled={viewingEnemy}
          />
        )}

        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-1 rounded border border-slate-800 bg-slate-900 p-1">
            <Tab
              active={!attacking}
              onClick={() => dispatch({ type: 'setMode', mode: 'build' })}
            >
              Build
            </Tab>
            <Tab
              active={attacking}
              onClick={() => dispatch({ type: 'setMode', mode: 'attack' })}
            >
              Attack
            </Tab>
          </div>

          {attacking ? (
            <MapGrid
              mode="enemy"
              known={me.known}
              reachable={reachable}
              paths={outgoing}
              interactive={!!source && me.actionPoints >= COMBAT.attackCost}
              onCellClick={(col, row) =>
                dispatch({ type: 'launchStrike', col, row })
              }
            />
          ) : (
            <MapGrid
              mode="own"
              structures={me.structures}
              ruins={me.ruins}
              previewCode={structureDef(state.selectedKind).code}
              onCellClick={(col, row) =>
                dispatch({ type: 'placeStructure', col, row })
              }
              onStructureClick={(id) => dispatch({ type: 'removeStructure', id })}
            />
          )}
        </div>

        <aside className="w-56 shrink-0 space-y-3">
          <div>
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Situation
            </h2>
            <dl className="mt-2 space-y-1.5 text-[11px]">
              <Row label="Structures" value={String(me.structures.length)} />
              <Row label="Airfields" value={String(airfields.length)} />
              <Row label="Ruins" value={String(me.ruins.length)} />
              <Row label="Strikes this turn" value={String(outgoing.length)} />
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

          <button
            type="button"
            onClick={() => dispatch({ type: 'resetMatch' })}
            className="text-[10px] text-slate-600 underline underline-offset-2 transition hover:text-slate-400"
          >
            Reset match
          </button>
        </aside>
      </main>
    </div>
  )
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
        {label}
      </div>
      <div className="font-mono text-sm text-slate-200">{value}</div>
    </div>
  )
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-4 py-1.5 text-xs transition ${
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
