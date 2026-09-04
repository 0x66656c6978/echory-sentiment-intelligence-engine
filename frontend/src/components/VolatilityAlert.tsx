/** Required "Volatility Alert": prominent, unmissable when the latest chunk's volatility_flag is true, quiet otherwise. */
export function VolatilityAlert({ active }: { active: boolean }) {
  return (
    <div
      className={`border p-4 transition-colors duration-300 ${
        active ? "border-red-500/70 bg-red-950/40" : "border-line bg-panel"
      }`}
    >
      <div className="mb-2 font-display text-xs font-semibold tracking-[0.2em] text-slate-500">VOLATILITY WATCH</div>
      {active ? (
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
          </span>
          <span className="font-mono text-sm font-semibold tracking-wide text-red-300">EMOTIONAL SPIKE DETECTED</span>
        </div>
      ) : (
        <div className="font-mono text-sm text-slate-600">stable</div>
      )}
    </div>
  );
}
