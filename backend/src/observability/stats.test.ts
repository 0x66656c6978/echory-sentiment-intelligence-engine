import { describe, expect, it } from "vitest";
import { computeLatencyStatsByModel } from "./stats.js";
import type { LLMCallLogEntry } from "./llmLogger.js";

function entry(model: string, latency_ms: number): LLMCallLogEntry {
  return {
    timestamp: new Date().toISOString(),
    chunk_id: "c",
    session_id: "s",
    provider: "inference",
    model,
    latency_ms,
    prompt: "p",
    raw_response: "r",
    parsed_result: null,
  };
}

describe("computeLatencyStatsByModel", () => {
  it("groups entries by model and computes count/avg/p50/p95", () => {
    const entries = [entry("model-a", 100), entry("model-a", 200), entry("model-a", 300), entry("model-b", 50)];

    const stats = computeLatencyStatsByModel(entries);

    expect(stats["model-a"].count).toBe(3);
    expect(stats["model-a"].avgMs).toBeCloseTo(200);
    expect(stats["model-a"].p50Ms).toBe(200);
    expect(stats["model-b"].count).toBe(1);
    expect(stats["model-b"].avgMs).toBe(50);
  });

  it("returns an empty object for no entries", () => {
    expect(computeLatencyStatsByModel([])).toEqual({});
  });
});
