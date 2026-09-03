import type { TelemetryChunkResponse } from "@echory/contract";

/**
 * Hand-written examples matching the real contract shape exactly, so the
 * render path is provably working without a live backend. Rendered through
 * the same list as real fetch results — see App.tsx.
 */
export const FIXTURE_RESULTS: TelemetryChunkResponse[] = [
  {
    chunk_id: "fixture_001",
    processing_latency_ms: 92,
    sentiment: "sarcastic",
    confidence: 0.84,
    volatility_flag: true,
    hidden_intent: "deflection_via_legal_delay",
    mitigation_suggestion:
      "Acknowledge concern, propose joint legal review session with fixed timeline",
    risk_level: "high",
  },
  {
    chunk_id: "fixture_002",
    processing_latency_ms: 41,
    sentiment: "positive",
    confidence: 0.91,
    volatility_flag: false,
    hidden_intent: "agreement_signal",
    mitigation_suggestion: "Reinforce alignment and propose a concrete next step",
    risk_level: "low",
  },
];
