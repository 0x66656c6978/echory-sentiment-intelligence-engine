import { describe, expect, it, afterEach } from "vitest";
import { TelemetryChunkResponseSchema } from "@echory/contract";
import { buildApp } from "./app.js";

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
  const originalProvider = process.env.LLM_PROVIDER;

  afterEach(() => {
    process.env.LLM_PROVIDER = originalProvider;
  });

  it("returns 500 { error: internal_error } when the provider throws, not the 400 shape", async () => {
    process.env.LLM_PROVIDER = "inference"; // not implemented yet -- throws by design
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/telemetry/stream",
      payload: VALID_REQUEST,
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ error: "internal_error" });
  });
});
