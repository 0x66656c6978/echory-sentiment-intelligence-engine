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
    sessionStore.append(sessionId, makeResponse({ chunk_id: "c1" }), 100, "first chunk text");
    sessionStore.append(sessionId, makeResponse({ chunk_id: "c2" }), 200, "second chunk text");

    const chunks = sessionStore.get(sessionId);
    expect(chunks).toHaveLength(2);
    expect(chunks?.map((c) => c.chunk_id)).toEqual(["c1", "c2"]);
    expect(chunks?.map((c) => c.timestamp_ms)).toEqual([100, 200]);
    expect(chunks?.map((c) => c.text)).toEqual(["first chunk text", "second chunk text"]);
  });

  it("does not bleed state between different session_ids", () => {
    const sessionA = "session_a_isolation";
    const sessionB = "session_b_isolation";

    sessionStore.append(sessionA, makeResponse({ chunk_id: "a1", sentiment: "positive" }), 1, "a1 text");
    sessionStore.append(sessionB, makeResponse({ chunk_id: "b1", sentiment: "aggressive" }), 1, "b1 text");
    sessionStore.append(sessionA, makeResponse({ chunk_id: "a2", sentiment: "positive" }), 2, "a2 text");

    const chunksA = sessionStore.get(sessionA);
    const chunksB = sessionStore.get(sessionB);

    expect(chunksA).toHaveLength(2);
    expect(chunksB).toHaveLength(1);
    expect(chunksA?.every((c) => c.sentiment === "positive")).toBe(true);
    expect(chunksB?.[0]?.sentiment).toBe("aggressive");
  });

  describe("summarize (ticket 0010, Track B endpoint)", () => {
    it("returns undefined for a session that was never appended to", () => {
      expect(sessionStore.summarize("session_summary_never_seen")).toBeUndefined();
    });

    it("computes chunk_count, dominant_sentiment (first-seen tie-break), and aggregated_volatility_score (share of flagged chunks)", () => {
      const sessionId = "session_summary_basic";
      sessionStore.append(sessionId, makeResponse({ chunk_id: "s1", sentiment: "positive", volatility_flag: false }), 1, "t1");
      sessionStore.append(sessionId, makeResponse({ chunk_id: "s2", sentiment: "negative", volatility_flag: true }), 2, "t2");
      sessionStore.append(sessionId, makeResponse({ chunk_id: "s3", sentiment: "positive", volatility_flag: false }), 3, "t3");
      sessionStore.append(sessionId, makeResponse({ chunk_id: "s4", sentiment: "negative", volatility_flag: false }), 4, "t4");

      const summary = sessionStore.summarize(sessionId);
      expect(summary?.session_id).toBe(sessionId);
      expect(summary?.chunk_count).toBe(4);
      // positive and negative are tied at 2 each -- positive was seen first.
      expect(summary?.dominant_sentiment).toBe("positive");
      expect(summary?.aggregated_volatility_score).toBe(0.25); // 1 of 4 flagged
    });

    it("ranks top_risk_moments by severity first, then by recency for ties, capped at 3", () => {
      const sessionId = "session_summary_risk_ranking";
      sessionStore.append(sessionId, makeResponse({ chunk_id: "r1", risk_level: "low" }), 100, "low risk chunk");
      sessionStore.append(sessionId, makeResponse({ chunk_id: "r2", risk_level: "critical" }), 200, "first critical chunk");
      sessionStore.append(sessionId, makeResponse({ chunk_id: "r3", risk_level: "medium" }), 300, "medium risk chunk");
      sessionStore.append(sessionId, makeResponse({ chunk_id: "r4", risk_level: "critical" }), 400, "second critical chunk");
      sessionStore.append(sessionId, makeResponse({ chunk_id: "r5", risk_level: "high" }), 500, "high risk chunk");

      const summary = sessionStore.summarize(sessionId);
      expect(summary?.top_risk_moments).toHaveLength(3);
      // Both criticals outrank everything; the more recent one (r4) comes first among them.
      expect(summary?.top_risk_moments.map((m) => m.chunk_id)).toEqual(["r4", "r2", "r5"]);
    });

    it("truncates a long text_excerpt rather than returning the full transcript", () => {
      const sessionId = "session_summary_excerpt_truncation";
      const longText = "a".repeat(150);
      sessionStore.append(sessionId, makeResponse({ chunk_id: "long1", risk_level: "critical" }), 1, longText);

      const summary = sessionStore.summarize(sessionId);
      const excerpt = summary?.top_risk_moments[0]?.text_excerpt ?? "";
      expect(excerpt.length).toBeLessThan(longText.length);
      expect(excerpt.endsWith("…")).toBe(true);
    });
  });

  describe("recordMitigationFeedback", () => {
    it("returns false for a session that doesn't exist", () => {
      expect(sessionStore.recordMitigationFeedback("session_feedback_missing", "c1", "used")).toBe(false);
    });

    it("returns false for a chunk_id that isn't part of the session", () => {
      const sessionId = "session_feedback_wrong_chunk";
      sessionStore.append(sessionId, makeResponse({ chunk_id: "real_chunk" }), 100, "text");
      expect(sessionStore.recordMitigationFeedback(sessionId, "not_a_real_chunk", "used")).toBe(false);
    });

    it("records the action against the matching chunk and leaves other chunks untouched", () => {
      const sessionId = "session_feedback_record";
      sessionStore.append(sessionId, makeResponse({ chunk_id: "c1" }), 100, "first");
      sessionStore.append(sessionId, makeResponse({ chunk_id: "c2" }), 200, "second");

      expect(sessionStore.recordMitigationFeedback(sessionId, "c1", "used")).toBe(true);

      const chunks = sessionStore.get(sessionId);
      expect(chunks?.find((c) => c.chunk_id === "c1")?.mitigationFeedback).toBe("used");
      expect(chunks?.find((c) => c.chunk_id === "c2")?.mitigationFeedback).toBeUndefined();
    });

    it("overwrites a prior action if feedback is recorded twice for the same chunk", () => {
      const sessionId = "session_feedback_overwrite";
      sessionStore.append(sessionId, makeResponse({ chunk_id: "c1" }), 100, "first");

      sessionStore.recordMitigationFeedback(sessionId, "c1", "used");
      sessionStore.recordMitigationFeedback(sessionId, "c1", "dismissed");

      expect(sessionStore.get(sessionId)?.[0]?.mitigationFeedback).toBe("dismissed");
    });
  });
});
