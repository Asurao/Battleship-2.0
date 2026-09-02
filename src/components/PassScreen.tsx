interface PassScreenProps {
  fromName: string
  toName: string
  turn: number
  onContinue: () => void
}

export function PassScreen({ fromName, toName, turn, onContinue }: PassScreenProps) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500">
          Turn {turn} · {fromName} has finished
        </div>
        <h1 className="text-3xl font-semibold text-slate-100">
          Pass the device to {toName}
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-slate-400">
          {fromName}&rsquo;s map is hidden. Hand over the device before
          continuing — whoever presses the button below will see {toName}&rsquo;s
          territory.
        </p>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="rounded border border-slate-500 bg-slate-800 px-6 py-3 text-sm font-medium text-slate-100 transition hover:border-slate-300 hover:bg-slate-700"
      >
        I am {toName} — show my map
      </button>
    </div>
  )
}
