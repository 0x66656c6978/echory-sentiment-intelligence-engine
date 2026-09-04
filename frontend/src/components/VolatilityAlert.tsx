/** Required "Volatility Alert": the whole card recolors when the latest chunk's volatility_flag is true, calm otherwise. */
export function VolatilityAlert({ active }: { active: boolean }) {
  return (
    <div className={`rounded-md p-5 transition-colors duration-300 ${active ? "bg-accent-300" : "bg-surface shadow-sm"}`}>
      <div
        className={`mb-2 font-body text-[11px] font-semibold uppercase tracking-[0.18em] ${
          active ? "text-accent-800" : "text-neutral-700"
        }`}
      >
        Volatility
      </div>
      <div className="flex items-center gap-3">
        {active ? (
          <span className="relative flex h-3.5 w-3.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ring-out rounded-full bg-accent-700" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-accent-700" />
          </span>
        ) : (
          <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-neutral-400" />
        )}
        <span className={`font-body text-base font-semibold ${active ? "text-accent-900" : "text-neutral-700"}`}>
          {active ? "Emotional spike detected" : "Stable"}
        </span>
      </div>
    </div>
  );
}
