import { describe, expect, it } from "vitest";
import { TelemetryChunkRequestSchema, TelemetryChunkResponseSchema } from "@echory/contract";

const VALID_REQUEST = {
  chunk_id: "chunk_001",
  session_id: "session_abc123",
  timestamp_ms: 1234567890000,
  speaker: "counterpart",
  text: "Yes, we are absolutely committed to the partnership.",
  acoustic_metadata: {
    pitch_volatility: 0.82,
    speech_rate_wpm: 187,
    pause_duration_ms: 340,
    volume_intensity: 0.61,
  },
};

const VALID_RESPONSE = {
  chunk_id: "chunk_001",
  processing_latency_ms: 87,
  sentiment: "sarcastic",
  confidence: 0.84,
  volatility_flag: true,
  hidden_intent: "deflection_via_legal_delay",
  mitigation_suggestion: "Acknowledge concern, propose joint legal review session with fixed timeline",
  risk_level: "high",
};

describe("TelemetryChunkRequestSchema", () => {
  it("accepts a valid request payload", () => {
    expect(TelemetryChunkRequestSchema.safeParse(VALID_REQUEST).success).toBe(true);
  });

  it.each([
    ["missing required field", { ...VALID_REQUEST, timestamp_ms: undefined }],
    ["wrong type", { ...VALID_REQUEST, timestamp_ms: "not-a-number" }],
    ["invalid enum value", { ...VALID_REQUEST, speaker: "narrator" }],
    [
      "out-of-range acoustic value",
      { ...VALID_REQUEST, acoustic_metadata: { ...VALID_REQUEST.acoustic_metadata, pitch_volatility: 1.5 } },
    ],
    ["negative speech rate", { ...VALID_REQUEST, acoustic_metadata: { ...VALID_REQUEST.acoustic_metadata, speech_rate_wpm: -5 } }],
  ])("rejects: %s", (_label, payload) => {
    expect(TelemetryChunkRequestSchema.safeParse(payload).success).toBe(false);
  });
});

describe("TelemetryChunkResponseSchema", () => {
  it("accepts a valid response payload", () => {
    expect(TelemetryChunkResponseSchema.safeParse(VALID_RESPONSE).success).toBe(true);
  });

  it.each([
    ["invalid sentiment enum", { ...VALID_RESPONSE, sentiment: "confused" }],
    ["confidence above 1", { ...VALID_RESPONSE, confidence: 1.5 }],
    ["confidence below 0", { ...VALID_RESPONSE, confidence: -0.1 }],
    ["hidden_intent over 60 chars", { ...VALID_RESPONSE, hidden_intent: "x".repeat(61) }],
    ["mitigation_suggestion over 120 chars", { ...VALID_RESPONSE, mitigation_suggestion: "x".repeat(121) }],
    ["invalid risk_level enum", { ...VALID_RESPONSE, risk_level: "extreme" }],
  ])("rejects: %s", (_label, payload) => {
    expect(TelemetryChunkResponseSchema.safeParse(payload).success).toBe(false);
  });
});
