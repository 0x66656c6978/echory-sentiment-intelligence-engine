import type { AcousticMetadata } from "@echory/contract";

function normalizeRate(wpm: number): number {
  return Math.min(1, wpm / 220);
}

// 600ms, not a round 1000ms -- chosen against this app's own data (the
// challenge spec's example payload uses 340ms, and the scripted demo call
// tops out at 420ms). At a 1000ms ceiling, every realistic pause length here
// normalized to under ~45% and mostly landed on the MIN_HEIGHT_PERCENT floor
// below, so the pause bar barely ever visibly changed between chunks -- a
// real contributor to the bars reading as static rather than a stable value.
function normalizePause(ms: number): number {
  return Math.min(1, ms / 600);
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
    <div className="flex shrink-0 items-end gap-[3px]" title="acoustic signal: pitch / rate / pause / volume">
      {bars.map((bar) => (
        // 8/32px tall, not the original 5/20px -- the values were always
        // computed correctly per chunk (verified directly against the DOM),
        // but a real chunk-to-chunk difference was often only a few percent,
        // which came out to a fraction of a pixel on a 20px-tall bar and
        // read as static even though it wasn't. Bigger bars give the same
        // percentage difference more pixels to actually show up in.
        <div key={bar.key} className="flex h-8 w-[6px] items-end overflow-hidden rounded-full bg-neutral-300/60">
          <div
            className="w-full rounded-full bg-accent-400/75"
            style={{ height: `${Math.max(MIN_HEIGHT_PERCENT, Math.round(bar.value * 100))}%` }}
          />
        </div>
      ))}
    </div>
  );
}
