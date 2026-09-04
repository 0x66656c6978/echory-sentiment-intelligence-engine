/**
 * backend/scripts/latency-benchmark.ts
 * =====================================
 * Ticket 0008 -- end-to-end latency verification against the real, running
 * server (not Fastify's in-process `.inject()`, and not the raw-model-only
 * numbers already measured in tickets 0006/0015). Boots the actual app,
 * listens on a real port, and hits it with real HTTP requests the same way
 * an evaluator's harness or the frontend would -- this is what actually
 * determines pass/fail against the challenge's <500ms line, since it
 * includes real network + Fastify overhead on top of the provider call.
 *
 * Requires LLM_PROVIDER=inference (in backend/.env or exported) and the
 * configured INFERENCE_MODEL reachable (Ollama running locally, pulled).
 *
 * Usage: npx tsx scripts/latency-benchmark.ts (run from backend/)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildApp } from "../src/app.js";
import { BENCHMARK_CASES } from "./benchmark-test-set.js";
import { HOLDOUT_CASES } from "./holdout-test-set.js";

function loadDotEnv(path: string): void {
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
loadDotEnv(join(process.cwd(), ".env"));

const PORT = 3999; // dedicated port -- never collides with a real dev server on 3000
const ALL_CASES = [...BENCHMARK_CASES, ...HOLDOUT_CASES];

function percentile(sortedAsc: number[], p: number): number {
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[idx];
}

function summarize(label: string, values: number[]): void {
  const sorted = [...values].sort((a, b) => a - b);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const over500 = values.filter((v) => v > 500).length;
  console.log(
    `${label}: n=${values.length} avg=${avg.toFixed(0)}ms p50=${percentile(sorted, 50)}ms ` +
      `p95=${percentile(sorted, 95)}ms max=${Math.max(...values)}ms ` +
      `over500ms=${over500}/${values.length} (${((over500 / values.length) * 100).toFixed(0)}%)`,
  );
}

async function main() {
  const provider = process.env.LLM_PROVIDER ?? "placeholder";
  if (provider !== "inference") {
    console.error(
      `LLM_PROVIDER must be "inference" to benchmark real latency (currently "${provider}"). ` +
        `Set it in backend/.env or export it before running this script.`,
    );
    process.exit(1);
  }

  const app = await buildApp();
  await app.listen({ port: PORT, host: "127.0.0.1" });
  console.log(`Server listening on http://127.0.0.1:${PORT}, model=${process.env.INFERENCE_MODEL}\n`);

  // Discarded warm-up call -- a local model's first invocation after the
  // process starts pays a one-time cold-load cost (seconds, not ms; ticket
  // 0006 found the same effect). That's a real one-time server-startup cost,
  // not a per-request latency risk, so it's reported separately below rather
  // than skewing the steady-state p50/p95 the challenge's <500ms line
  // actually cares about. Deliberately not one of the real test cases.
  const warmupStart = Date.now();
  const warmupRes = await fetch(`http://127.0.0.1:${PORT}/api/telemetry/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chunk_id: "warmup",
      session_id: "warmup",
      timestamp_ms: Date.now(),
      speaker: "counterpart",
      text: "This is an unrelated warm-up message to load the model into memory.",
      acoustic_metadata: { pitch_volatility: 0.2, speech_rate_wpm: 120, pause_duration_ms: 100, volume_intensity: 0.3 },
    }),
  });
  await warmupRes.json();
  console.log(`(cold-start warm-up call: ${Date.now() - warmupStart}ms, discarded -- one-time server-startup cost, not steady-state)\n`);

  // Discovered running this script for real against Groq (2026-09-04): its
  // free tier caps input tokens per minute (7000 ITPM as of this writing),
  // and 28 back-to-back ~980-token requests blows through that after ~7
  // calls, 500ing the rest -- not a latency problem, a hard failure the
  // production InferenceProvider doesn't retry around. Pacing at one request
  // per ~9s keeps a rolling minute safely under the limit (6 * 980 ≈ 5880)
  // so this script measures real per-call latency instead of rate-limit
  // noise. Skipped for a local endpoint, which has no such per-minute cap.
  const isCloudEndpoint = !/localhost|127\.0\.0\.1/.test(process.env.INFERENCE_BASE_URL ?? "");
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const clientLatencies: number[] = [];
  const serverLatencies: number[] = [];

  for (const testCase of ALL_CASES) {
    if (isCloudEndpoint) await sleep(9000);
    const clientStart = Date.now();
    const res = await fetch(`http://127.0.0.1:${PORT}/api/telemetry/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...testCase.chunk, chunk_id: `latency_${testCase.id}` }),
    });
    const clientLatency = Date.now() - clientStart;
    const body = (await res.json()) as { processing_latency_ms?: number; error?: string };

    clientLatencies.push(clientLatency);
    if (typeof body.processing_latency_ms === "number") serverLatencies.push(body.processing_latency_ms);

    console.log(
      `  ${testCase.id}: status=${res.status} client=${clientLatency}ms server=${body.processing_latency_ms ?? "N/A"}ms` +
        (res.status !== 200 ? ` FAILED: ${body.error}` : ""),
    );
  }

  await app.close();

  console.log("\n=== Summary ===");
  summarize("Client-observed round-trip (real HTTP, network + Fastify + provider)", clientLatencies);
  summarize("Server-reported processing_latency_ms (provider call only)", serverLatencies);

  const outPath = join(process.cwd(), "..", "docs", "latency-verification-results.json");
  writeFileSync(
    outPath,
    JSON.stringify({ model: process.env.INFERENCE_MODEL, clientLatencies, serverLatencies }, null, 2),
    "utf-8",
  );
  console.log(`\nRaw results written to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
