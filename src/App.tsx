import { useReducer } from 'react'
import { MapGrid } from './components/MapGrid'
import { PassScreen } from './components/PassScreen'
import { StructurePalette } from './components/StructurePalette'
import { initialState, opponentOf, reducer } from './game/state'

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  const me = state.players[state.activePlayer]
  const enemy = state.players[opponentOf(state.activePlayer)]
  const viewingEnemy = state.view === 'enemy'

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

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-200">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-sm font-semibold tracking-wide text-slate-100">
            Battleship 2.0
          </h1>
          <span className="text-[10px] uppercase tracking-[0.25em] text-slate-600">
            Prototype · Milestone 1
          </span>
        </div>

        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Turn
            </div>
            <div className="font-mono text-sm text-slate-200">{state.turn}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Commanding
            </div>
            <div className="text-sm font-medium text-slate-100">{me.name}</div>
          </div>
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
        <StructurePalette
          selected={state.selectedKind}
          onSelect={(kind) => dispatch({ type: 'selectKind', kind })}
          placed={me.structures}
          disabled={viewingEnemy}
        />

        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-1 rounded border border-slate-800 bg-slate-900 p-1">
            <ViewTab
              active={!viewingEnemy}
              onClick={() => dispatch({ type: 'setView', view: 'own' })}
            >
              Your Territory
            </ViewTab>
            <ViewTab
              active={viewingEnemy}
              onClick={() => dispatch({ type: 'setView', view: 'enemy' })}
            >
              Enemy Territory
            </ViewTab>
          </div>

          <MapGrid
            structures={viewingEnemy ? enemy.structures : me.structures}
            fogged={viewingEnemy}
            selectedKind={state.selectedKind}
            onPlace={(col, row) => dispatch({ type: 'placeStructure', col, row })}
            onRemove={(id) => dispatch({ type: 'removeStructure', id })}
          />
        </div>

        <aside className="w-56 shrink-0 space-y-3">
          <div>
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Situation
            </h2>
            <dl className="mt-2 space-y-1.5 text-[11px]">
              <Row label="Structures placed" value={String(me.structures.length)} />
              <Row label="Viewing" value={viewingEnemy ? 'Enemy map' : 'Own map'} />
              <Row label="Grid" value="12 × 16" />
            </dl>
          </div>

          <p className="border-t border-slate-800 pt-2.5 text-[10px] leading-relaxed text-slate-600">
            Milestone 1 covers placement and fog only. Attacks, defenses, and
            action points follow in Milestone 2.
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

function ViewTab({
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
      className={`rounded px-3 py-1.5 text-xs transition ${
        active
          ? 'bg-slate-700 text-slate-100'
          : 'text-slate-500 hover:text-slate-300'
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
