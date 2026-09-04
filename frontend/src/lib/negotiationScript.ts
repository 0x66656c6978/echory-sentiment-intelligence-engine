import type { TelemetryChunkRequest } from "@echory/contract";

/**
 * A scripted negotiation call arc, sent chunk-by-chunk to the real backend to
 * drive the dashboard live (not fixture data standing in for it) -- opens
 * calm, escalates through pushback/deflection/pressure/a volatile spike, and
 * resolves. Deliberately distinct wording from backend/scripts/benchmark-
 * test-set.ts and holdout-test-set.ts (this drives a UI demo, not a graded
 * benchmark) but the same kind of acoustic-contradiction cases those cover.
 */
function chunk(
  offsetMs: number,
  overrides: Omit<TelemetryChunkRequest, "chunk_id" | "session_id" | "timestamp_ms">,
  sessionId: string,
): TelemetryChunkRequest {
  return {
    chunk_id: `${sessionId}_${offsetMs}`,
    session_id: sessionId,
    timestamp_ms: Date.now() + offsetMs,
    ...overrides,
  };
}

export function buildNegotiationScript(): TelemetryChunkRequest[] {
  const sessionId = `session_live_${Date.now()}`;
  return [
    chunk(
      0,
      {
        speaker: "counterpart",
        text: "Thanks for making time today. We're genuinely excited about what a partnership could look like.",
        acoustic_metadata: { pitch_volatility: 0.18, speech_rate_wpm: 128, pause_duration_ms: 80, volume_intensity: 0.42 },
      },
      sessionId,
    ),
    chunk(
      1200,
      {
        speaker: "candidate",
        text: "Likewise. Let's start with the term sheet — anything jump out at you on first read?",
        acoustic_metadata: { pitch_volatility: 0.12, speech_rate_wpm: 118, pause_duration_ms: 60, volume_intensity: 0.38 },
      },
      sessionId,
    ),
    chunk(
      2400,
      {
        speaker: "counterpart",
        text: "That's an interesting question — let's circle back to pricing once we've covered the easier items.",
        acoustic_metadata: { pitch_volatility: 0.28, speech_rate_wpm: 132, pause_duration_ms: 420, volume_intensity: 0.4 },
      },
      sessionId,
    ),
    chunk(
      3600,
      {
        speaker: "counterpart",
        text: "We've reviewed the exclusivity clause and it doesn't meet our requirements as written.",
        acoustic_metadata: { pitch_volatility: 0.2, speech_rate_wpm: 112, pause_duration_ms: 150, volume_intensity: 0.44 },
      },
      sessionId,
    ),
    chunk(
      4800,
      {
        speaker: "counterpart",
        text: "No, no, the timeline is completely fine on our end, really.",
        acoustic_metadata: { pitch_volatility: 0.74, speech_rate_wpm: 178, pause_duration_ms: 90, volume_intensity: 0.63 },
      },
      sessionId,
    ),
    chunk(
      6000,
      {
        speaker: "counterpart",
        text: "Either we get this signed by Friday at our terms, or we walk and take the deal to your competitor.",
        acoustic_metadata: { pitch_volatility: 0.66, speech_rate_wpm: 196, pause_duration_ms: 40, volume_intensity: 0.81 },
      },
      sessionId,
    ),
    chunk(
      7200,
      {
        speaker: "candidate",
        text: "Wait — that penalty clause applies retroactively? Hold on, let me re-read that.",
        acoustic_metadata: { pitch_volatility: 0.71, speech_rate_wpm: 205, pause_duration_ms: 30, volume_intensity: 0.7 },
      },
      sessionId,
    ),
    chunk(
      8400,
      {
        speaker: "candidate",
        text: "You know, whatever you think is fairest here is fine with us — we really don't want this to be a sticking point.",
        acoustic_metadata: { pitch_volatility: 0.35, speech_rate_wpm: 145, pause_duration_ms: 60, volume_intensity: 0.35 },
      },
      sessionId,
    ),
    chunk(
      9600,
      {
        speaker: "counterpart",
        text: "Alright — let's lock in the revised terms and get legal moving. Good session today.",
        acoustic_metadata: { pitch_volatility: 0.16, speech_rate_wpm: 122, pause_duration_ms: 100, volume_intensity: 0.4 },
      },
      sessionId,
    ),
  ];
}
