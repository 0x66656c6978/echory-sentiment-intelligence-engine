import type { AcousticMetadata } from "@echory/contract";

function normalizeRate(wpm: number): number {
  return Math.min(1, wpm / 220);
}

function normalizePause(ms: number): number {
  return Math.min(1, ms / 1000);
}

// A zero-value bar should still read as a bar, not disappear entirely.
const MIN_HEIGHT_PERCENT = 12;

/** Small technical readout of the raw acoustic signal behind a classification -- pitch, rate, pause, volume, in that order. */
export function AcousticBars({ acoustic }: { acoustic: AcousticMetadata }) {
  const bars = [
    { key: "pitch", value: acoustic.pitch_volatility },
    { key: "rate", value: normalizeRate(acoustic.speech_rate_wpm) },
    { key: "pause", value: normalizePause(acoustic.pause_duration_ms) },
    { key: "volume", value: acoustic.volume_intensity },
  ];

  return (
    <div className="flex shrink-0 items-end gap-1" title="acoustic signal: pitch / rate / pause / volume">
      {bars.map((bar) => (
        <div key={bar.key} className="flex h-5 w-[5px] items-end overflow-hidden rounded-full bg-neutral-300/60">
          <div
            className="w-full rounded-full bg-accent-400/75"
            style={{ height: `${Math.max(MIN_HEIGHT_PERCENT, Math.round(bar.value * 100))}%` }}
          />
        </div>
      ))}
    </div>
  );
}
