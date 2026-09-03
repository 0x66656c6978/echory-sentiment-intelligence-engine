import { describe, expect, it, afterEach } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { logLLMCall, readLLMCallLog, type LLMCallLogEntry } from "./llmLogger.js";

const TEST_LOG_PATH = join(process.cwd(), "logs", "test-llm-calls.jsonl");

function entry(overrides: Partial<LLMCallLogEntry> = {}): LLMCallLogEntry {
  return {
    timestamp: new Date().toISOString(),
    chunk_id: "c1",
    session_id: "s1",
    provider: "inference",
    model: "llama3.2:3b",
    latency_ms: 123,
    prompt: "Classify this chunk...",
    raw_response: '{"sentiment":"positive"}',
    parsed_result: { sentiment: "positive" },
    ...overrides,
  };
}

describe("llmLogger", () => {
  afterEach(() => {
    if (existsSync(TEST_LOG_PATH)) rmSync(TEST_LOG_PATH);
  });

  it("appends a call entry as a JSON line and reads it back", () => {
    logLLMCall(entry(), TEST_LOG_PATH);

    const entries = readLLMCallLog(TEST_LOG_PATH);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ chunk_id: "c1", model: "llama3.2:3b", latency_ms: 123 });
  });

  it("appends multiple entries across calls without truncating", () => {
    logLLMCall(entry({ chunk_id: "c1", latency_ms: 100 }), TEST_LOG_PATH);
    logLLMCall(entry({ chunk_id: "c2", latency_ms: 200 }), TEST_LOG_PATH);

    const entries = readLLMCallLog(TEST_LOG_PATH);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.chunk_id)).toEqual(["c1", "c2"]);
  });

  it("returns an empty array when the log file does not exist yet", () => {
    const missingPath = join(process.cwd(), "logs", "does-not-exist.jsonl");
    expect(readLLMCallLog(missingPath)).toEqual([]);
  });

  it("creates the log directory if it doesn't exist", () => {
    const nestedPath = join(process.cwd(), "logs", "nested", "calls.jsonl");
    logLLMCall(entry(), nestedPath);
    expect(readLLMCallLog(nestedPath)).toHaveLength(1);
    rmSync(join(process.cwd(), "logs", "nested"), { recursive: true, force: true });
  });
});
