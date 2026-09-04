import type { AcousticMetadata } from "@echory/contract";

function normalizeRate(wpm: number): number {
  return Math.min(1, wpm / 220);
}

function normalizePause(ms: number): number {
  return Math.min(1, ms / 1000);
}

/** Small technical readout of the raw acoustic signal behind a classification -- pitch, rate, pause, volume, in that order. */
export function AcousticBars({ acoustic }: { acoustic: AcousticMetadata }) {
  const bars = [
    { key: "pitch", label: "P", value: acoustic.pitch_volatility },
    { key: "rate", label: "R", value: normalizeRate(acoustic.speech_rate_wpm) },
    { key: "pause", label: "H", value: normalizePause(acoustic.pause_duration_ms) },
    { key: "volume", label: "V", value: acoustic.volume_intensity },
  ];

  return (
    <div className="flex items-end gap-[3px] h-6 shrink-0" title="acoustic signal: pitch / rate / pause / volume">
      {bars.map((bar) => (
        <div key={bar.key} className="flex h-full w-1.5 items-end bg-line/40">
          <div className="w-full bg-amber/70" style={{ height: `${Math.round(bar.value * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}
