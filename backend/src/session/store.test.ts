import { describe, expect, it } from "vitest";
import type { TelemetryChunkResponse } from "@echory/contract";
import { sessionStore } from "./store.js";

function makeResponse(overrides: Partial<TelemetryChunkResponse> = {}): TelemetryChunkResponse {
  return {
    chunk_id: "chunk_1",
    processing_latency_ms: 10,
    sentiment: "neutral",
    confidence: 0.5,
    volatility_flag: false,
    hidden_intent: "informational",
    mitigation_suggestion: "Ask an open-ended question to surface intent",
    risk_level: "low",
    ...overrides,
  };
}

describe("sessionStore", () => {
  // sessionStore is a module-level singleton, so each test uses its own
  // unique session_id to stay isolated from other tests' state.

  it("returns undefined for a session that has never been appended to", () => {
    expect(sessionStore.get("session_never_seen")).toBeUndefined();
  });

  it("accumulates multiple chunks for the same session in order", () => {
    const sessionId = "session_accumulate";
    sessionStore.append(sessionId, makeResponse({ chunk_id: "c1" }), 100);
    sessionStore.append(sessionId, makeResponse({ chunk_id: "c2" }), 200);

    const chunks = sessionStore.get(sessionId);
    expect(chunks).toHaveLength(2);
    expect(chunks?.map((c) => c.chunk_id)).toEqual(["c1", "c2"]);
    expect(chunks?.map((c) => c.timestamp_ms)).toEqual([100, 200]);
  });

  it("does not bleed state between different session_ids", () => {
    const sessionA = "session_a_isolation";
    const sessionB = "session_b_isolation";

    sessionStore.append(sessionA, makeResponse({ chunk_id: "a1", sentiment: "positive" }), 1);
    sessionStore.append(sessionB, makeResponse({ chunk_id: "b1", sentiment: "aggressive" }), 1);
    sessionStore.append(sessionA, makeResponse({ chunk_id: "a2", sentiment: "positive" }), 2);

    const chunksA = sessionStore.get(sessionA);
    const chunksB = sessionStore.get(sessionB);

    expect(chunksA).toHaveLength(2);
    expect(chunksB).toHaveLength(1);
    expect(chunksA?.every((c) => c.sentiment === "positive")).toBe(true);
    expect(chunksB?.[0]?.sentiment).toBe("aggressive");
  });
});
