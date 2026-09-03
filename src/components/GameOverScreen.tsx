interface GameOverScreenProps {
  winnerName: string
  loserName: string
  turn: number
  onReset: () => void
}

export function GameOverScreen({
  winnerName,
  loserName,
  turn,
  onReset,
}: GameOverScreenProps) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500">
          Match ended on turn {turn}
        </div>
        <h1 className="text-3xl font-semibold text-slate-100">
          {winnerName} wins
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-slate-400">
          {loserName} has no offensive structures left standing and can no longer
          strike back.
        </p>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="rounded border border-slate-500 bg-slate-800 px-6 py-3 text-sm font-medium text-slate-100 transition hover:border-slate-300 hover:bg-slate-700"
      >
        New match
      </button>
    </div>
  )
}
