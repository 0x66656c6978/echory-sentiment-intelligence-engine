/**
 * Two-tile aggregate strip, beyond the four required elements (per
 * docs/design/0009-alt-mockup/0009-ui-spec.md §5-6). Pure arithmetic over
 * classifications the backend already returned -- no second LLM call, no
 * added latency. Volatility index is the simpler, more defensible "share of
 * chunks flagged volatile" definition (not a risk-weighted mean) -- a
 * product judgement documented here since it isn't model output.
 */
export function AggregateTiles({ volatilityIndex, dominantTone }: { volatilityIndex: number | null; dominantTone: string | null }) {
  return (
    <div className="grid grid-cols-2 gap-[10px]">
      <div className="rounded-sm bg-accent2-200 px-[13px] py-[15px]">
        <div className="font-heading text-2xl text-accent2-800">{volatilityIndex === null ? "—" : volatilityIndex.toFixed(2)}</div>
        <div className="mt-1 font-body text-[10px] font-semibold uppercase tracking-[0.1em] text-accent2-700">
          Volatility index
        </div>
      </div>
      <div className="rounded-sm bg-neutral-200 px-[13px] py-[15px]">
        <div className="font-heading text-2xl text-neutral-800">{dominantTone ?? "—"}</div>
        <div className="mt-1 font-body text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-700">
          Dominant tone
        </div>
      </div>
    </div>
  );
}
