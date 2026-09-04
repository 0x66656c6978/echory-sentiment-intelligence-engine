import { describe, expect, it, afterEach } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { SentimentAnalysisResult, SentimentProvider, TelemetryChunkRequest } from "@echory/contract";
import { API_MITIGATION_FEEDBACK_PATH, API_SESSION_SUMMARY_PATH, TelemetryChunkResponseSchema } from "@echory/contract";
import { buildApp } from "./app.js";
import { DEFAULT_LLM_LOG_PATH, readLLMCallLog } from "./observability/llmLogger.js";

class FakeInferenceProvider implements SentimentProvider {
  readonly name = "inference";
  async analyze(_chunk: TelemetryChunkRequest): Promise<SentimentAnalysisResult> {
    return {
      classification: {
        sentiment: "positive",
        confidence: 0.9,
        volatility_flag: false,
        hidden_intent: "agreement_signal",
        mitigation_suggestion: "Reinforce alignment",
        risk_level: "low",
      },
      observability: {
        model: "fake-model-for-test",
        prompt: "test prompt",
        rawResponse: '{"sentiment":"positive"}',
        tokenCounts: { prompt: 42, completion: 7 },
      },
    };
  }
}

const VALID_REQUEST = {
  chunk_id: "chunk_int_001",
  session_id: "session_int_test",
  timestamp_ms: Date.now(),
  speaker: "counterpart",
  text: "Yes, we are absolutely committed to the partnership.",
  acoustic_metadata: {
    pitch_volatility: 0.82,
    speech_rate_wpm: 187,
    pause_duration_ms: 340,
    volume_intensity: 0.61,
  },
};

describe("GET /health", () => {
  it("returns ok status", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok" });
  });
});

describe("POST /api/telemetry/stream — happy path", () => {
  it("returns a response matching the contract for a valid chunk", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/telemetry/stream",
      payload: VALID_REQUEST,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.chunk_id).toBe(VALID_REQUEST.chunk_id);
    const parsed = TelemetryChunkResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);
  });
});

// Regression coverage for ticket 0013: every one of these failure modes must
// return the SAME 400 { error, details } shape, not Fastify's raw internal
// error format and not (for the missing-Content-Type case) a 415. This exact
// inconsistency shipped once already and was only caught by manual probing.
describe("POST /api/telemetry/stream — error response normalization (ticket 0013 regression)", () => {
  it("returns 400 { error, details } for a schema validation failure", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/telemetry/stream",
      payload: { ...VALID_REQUEST, timestamp_ms: "not-a-number" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "invalid_request" });
  });

  it("returns 400 { error, details } for malformed JSON syntax", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/telemetry/stream",
      headers: { "content-type": "application/json" },
      payload: "{not valid json",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "invalid_request" });
  });

  it("returns 400 { error, details } for an empty body", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/telemetry/stream",
      headers: { "content-type": "application/json" },
      payload: "",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "invalid_request" });
  });

  it("returns 400 (not 415) { error, details } for a missing Content-Type header", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/telemetry/stream",
      payload: JSON.stringify(VALID_REQUEST),
      // deliberately no content-type header
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "invalid_request" });
  });
});

describe("POST /api/telemetry/stream — genuine server errors stay distinct", () => {
  class ThrowingProvider implements SentimentProvider {
    readonly name = "inference";
    async analyze(): Promise<SentimentAnalysisResult> {
      throw new Error("simulated provider failure (e.g. malformed model output or a network error)");
    }
  }

  it("returns 500 { error: internal_error } when the provider throws, not the 400 shape", async () => {
    const app = await buildApp(new ThrowingProvider());
    const response = await app.inject({
      method: "POST",
      url: "/api/telemetry/stream",
      payload: VALID_REQUEST,
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ error: "internal_error" });
  });
});

describe("POST /api/telemetry/stream — LLM call observability logging (ticket 0004)", () => {
  afterEach(() => {
    if (existsSync(DEFAULT_LLM_LOG_PATH)) rmSync(DEFAULT_LLM_LOG_PATH);
  });

  it("logs the call when the provider returns observability data", async () => {
    const app = await buildApp(new FakeInferenceProvider());
    const request = { ...VALID_REQUEST, chunk_id: "chunk_observability_test" };
    const response = await app.inject({ method: "POST", url: "/api/telemetry/stream", payload: request });

    expect(response.statusCode).toBe(200);

    const logged = readLLMCallLog().filter((e) => e.chunk_id === "chunk_observability_test");
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({
      chunk_id: "chunk_observability_test",
      session_id: request.session_id,
      provider: "inference",
      model: "fake-model-for-test",
      prompt: "test prompt",
      raw_response: '{"sentiment":"positive"}',
      token_counts: { prompt: 42, completion: 7 },
    });
  });

  it("does not log anything for the placeholder provider (no LLM call was made)", async () => {
    const app = await buildApp(); // defaults to placeholder
    const request = { ...VALID_REQUEST, chunk_id: "chunk_no_observability_test" };
    await app.inject({ method: "POST", url: "/api/telemetry/stream", payload: request });

    const logged = readLLMCallLog().filter((e) => e.chunk_id === "chunk_no_observability_test");
    expect(logged).toHaveLength(0);
  });
});

describe("GET /api/telemetry/session/:session_id/summary (ticket 0010, Track B endpoint)", () => {
  it("returns 404 for a session that was never streamed to", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: API_SESSION_SUMMARY_PATH("session_summary_unknown") });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: "not_found" });
  });

  it("summarizes a real session built up through the actual POST endpoint", async () => {
    const app = await buildApp(new FakeInferenceProvider());
    const sessionId = "session_summary_integration";

    await app.inject({
      method: "POST",
      url: "/api/telemetry/stream",
      payload: { ...VALID_REQUEST, chunk_id: "sum_1", session_id: sessionId },
    });
    await app.inject({
      method: "POST",
      url: "/api/telemetry/stream",
      payload: { ...VALID_REQUEST, chunk_id: "sum_2", session_id: sessionId },
    });

    const response = await app.inject({ method: "GET", url: API_SESSION_SUMMARY_PATH(sessionId) });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.session_id).toBe(sessionId);
    expect(body.chunk_count).toBe(2);
    // FakeInferenceProvider always classifies "positive" -- both chunks agree.
    expect(body.dominant_sentiment).toBe("positive");
    expect(body.top_risk_moments.length).toBeGreaterThan(0);
    expect(body.top_risk_moments[0]).toHaveProperty("text_excerpt");
  });
});

describe("POST /api/telemetry/session/:session_id/mitigation-feedback (Mitigation Panel actually recording something)", () => {
  it("returns 404 for a chunk that was never streamed to this session", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: API_MITIGATION_FEEDBACK_PATH("session_feedback_unknown"),
      payload: { chunk_id: "never_seen", action: "used" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: "not_found" });
  });

  it("returns 400 for an invalid action", async () => {
    const app = await buildApp(new FakeInferenceProvider());
    const sessionId = "session_feedback_invalid";
    await app.inject({
      method: "POST",
      url: "/api/telemetry/stream",
      payload: { ...VALID_REQUEST, chunk_id: "fb_invalid", session_id: sessionId },
    });

    const response = await app.inject({
      method: "POST",
      url: API_MITIGATION_FEEDBACK_PATH(sessionId),
      payload: { chunk_id: "fb_invalid", action: "maybe-later" },
    });

    expect(response.statusCode).toBe(400);
  });

  it("records feedback against a real chunk and reflects it back in the session summary's underlying data", async () => {
    const app = await buildApp(new FakeInferenceProvider());
    const sessionId = "session_feedback_real";
    await app.inject({
      method: "POST",
      url: "/api/telemetry/stream",
      payload: { ...VALID_REQUEST, chunk_id: "fb_1", session_id: sessionId },
    });

    const response = await app.inject({
      method: "POST",
      url: API_MITIGATION_FEEDBACK_PATH(sessionId),
      payload: { chunk_id: "fb_1", action: "used" },
    });

    expect(response.statusCode).toBe(204);
  });
});
