import { describe, expect, it } from "vitest";
import type { SentimentAnalysisResult, SentimentProvider, TelemetryChunkRequest } from "@echory/contract";
import { buildApp } from "./app.js";
import { sessionStore } from "./session/store.js";

/**
 * Ticket 0008 -- concurrency verification. The unit-level isolation test in
 * session/store.test.ts only exercises sequential, synchronous calls to
 * SessionStore directly; it can't catch a bug where the route handler itself
 * mixes up which in-flight request's data belongs to which response once
 * multiple `provider.analyze()` calls are genuinely interleaved (overlapping
 * awaits, not one-at-a-time). This fake provider adds a randomized delay
 * specifically to force real interleaving, and echoes the exact chunk_id it
 * was called with back in `hidden_intent` -- if the route handler ever
 * accidentally read from a stale/shared variable instead of its own request's
 * data, this would catch it directly instead of relying on timing luck.
 */
class DelayedEchoProvider implements SentimentProvider {
  readonly name = "inference";
  async analyze(chunk: TelemetryChunkRequest): Promise<SentimentAnalysisResult> {
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 30));
    return {
      classification: {
        sentiment: "neutral",
        confidence: 0.5,
        volatility_flag: false,
        hidden_intent: `echo:${chunk.chunk_id}`,
        mitigation_suggestion: "n/a",
        risk_level: "low",
      },
    };
  }
}

function makeRequest(sessionId: string, chunkId: string) {
  return {
    chunk_id: chunkId,
    session_id: sessionId,
    timestamp_ms: Date.now(),
    speaker: "counterpart" as const,
    text: `chunk ${chunkId} for ${sessionId}`,
    acoustic_metadata: { pitch_volatility: 0.3, speech_rate_wpm: 120, pause_duration_ms: 100, volume_intensity: 0.4 },
  };
}

describe("Concurrent sessions (ticket 0008)", () => {
  it("keeps each response paired with its own request under real concurrency", async () => {
    const app = await buildApp(new DelayedEchoProvider());
    const sessionIds = ["concurrent_session_a", "concurrent_session_b", "concurrent_session_c", "concurrent_session_d"];
    const chunksPerSession = 5;

    const requests = sessionIds.flatMap((sessionId) =>
      Array.from({ length: chunksPerSession }, (_, i) => ({ sessionId, chunkId: `${sessionId}_c${i}` })),
    );

    // Fire all 20 requests concurrently (not per-session sequentially) --
    // interleaves their awaits, which is the actual scenario this ticket
    // needs verified, not just "many sessions used one after another."
    const responses = await Promise.all(
      requests.map(({ sessionId, chunkId }) =>
        app.inject({ method: "POST", url: "/api/telemetry/stream", payload: makeRequest(sessionId, chunkId) }),
      ),
    );

    responses.forEach((response, i) => {
      expect(response.statusCode).toBe(200);
      const body = response.json();
      // Each response must match its own request's chunk_id, and the
      // provider's echoed hidden_intent must match too -- a route-handler
      // mixup would show up as either of these being wrong.
      expect(body.chunk_id).toBe(requests[i].chunkId);
      expect(body.hidden_intent).toBe(`echo:${requests[i].chunkId}`);
    });

    for (const sessionId of sessionIds) {
      const stored = sessionStore.get(sessionId);
      expect(stored).toHaveLength(chunksPerSession);
      const storedChunkIds = new Set(stored?.map((c) => c.chunk_id));
      const expectedChunkIds = new Set(
        requests.filter((r) => r.sessionId === sessionId).map((r) => r.chunkId),
      );
      expect(storedChunkIds).toEqual(expectedChunkIds);
    }
  });
});
