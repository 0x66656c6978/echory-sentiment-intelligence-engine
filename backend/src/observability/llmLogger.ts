import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface LLMCallLogEntry {
  timestamp: string;
  chunk_id: string;
  session_id: string;
  provider: string;
  model: string;
  latency_ms: number;
  prompt: string;
  raw_response: string;
  parsed_result: unknown;
  token_counts?: { prompt?: number; completion?: number };
}

export const DEFAULT_LLM_LOG_PATH = join(process.cwd(), "logs", "llm-calls.jsonl");

/** Appends one call as a JSON line. Never throws on a missing log directory. */
export function logLLMCall(entry: LLMCallLogEntry, logPath: string = DEFAULT_LLM_LOG_PATH): void {
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, `${JSON.stringify(entry)}\n`, "utf-8");
}

/** Reads back every logged call. Returns [] if the log doesn't exist yet. */
export function readLLMCallLog(logPath: string = DEFAULT_LLM_LOG_PATH): LLMCallLogEntry[] {
  if (!existsSync(logPath)) return [];
  return readFileSync(logPath, "utf-8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as LLMCallLogEntry);
}
