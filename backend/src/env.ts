import { existsSync, readFileSync } from "node:fs";

/**
 * Minimal .env loader (no dependency). Only sets vars not already present in
 * process.env, so a real environment (Docker's env_file, CI secrets) always
 * wins over a checked-out .env file. Same approach already used by
 * scripts/llm-benchmark.ts; extracted here so the actual server process loads
 * backend/.env too -- previously nothing did, so INFERENCE_* config in .env
 * was silently ignored by `npm start`.
 */
export function loadDotEnv(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
