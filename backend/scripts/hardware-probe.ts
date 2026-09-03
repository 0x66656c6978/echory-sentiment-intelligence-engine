/**
 * backend/scripts/hardware-probe.ts
 * ==================================
 * Ticket 0005 — measures real tokens/sec and wall-clock latency for candidate
 * local models on this machine's GPU.
 *
 * IMPORTANT FINDING (see docs/hardware-probe-results.md and ticket 0005's log
 * for the full story): every model currently pulled on this machine (qwen3.x,
 * gemma4.x) defaults to an extended "thinking" mode that emits a chain-of-
 * thought `reasoning` field before the actual answer. Ollama's OpenAI-
 * compatible endpoint (/v1/chat/completions) -- the API ticket 0007's unified
 * InferenceProvider design intended to use for both local and cloud -- does
 * NOT respect the `think: false` override that suppresses this. Only
 * Ollama's NATIVE API (/api/chat) does. So this probe (and, likely, ticket
 * 0007's eventual local-path implementation) uses the native API, not the
 * OpenAI-compatible one. This is a real constraint on the "one code path for
 * local and cloud" simplification, not just a probe detail -- flagged
 * forward into ticket 0007.
 *
 * Usage: npx tsx scripts/hardware-probe.ts (run from backend/)
 * Requires: `ollama serve` running, and the models below already pulled.
 */

const OLLAMA_NATIVE_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const MODELS = ["llama3.2:1b", "qwen3.5:4b", "qwen3:8b", "qwen3.5:9b"];
const WARMUP_RUNS = 1;
const TIMED_RUNS = 3;

// Draft prompt, representative in length/shape of the real classification
// prompt ticket 0006 will design and tune -- exact wording will change, but
// input/output token counts (and therefore latency) should stay similar.
const SYSTEM_PROMPT = `You are a real-time negotiation sentiment analysis engine. Given a transcript chunk and acoustic metadata from a live business negotiation call, classify the speaker's emotional state.

Always respond with strict JSON matching this schema, and nothing else:
{
  "sentiment": "positive" | "negative" | "neutral" | "sarcastic" | "aggressive" | "deflecting" | "appeasement",
  "confidence": number between 0 and 1,
  "volatility_flag": boolean,
  "hidden_intent": string (max 60 chars, free text description of the underlying intent),
  "mitigation_suggestion": string (max 120 chars, actionable advice for the negotiator),
  "risk_level": "low" | "medium" | "high" | "critical"
}`;

const USER_MESSAGE = `Transcript chunk (speaker: counterpart):
"Yes, we are absolutely committed to the partnership — though naturally our legal team will need to review every single line."

Acoustic metadata:
pitch_volatility=0.82, speech_rate_wpm=187, pause_duration_ms=340, volume_intensity=0.61

Classify this chunk.`;

interface OllamaNativeChatResponse {
  message: { content: string };
  done_reason: string;
  eval_count: number; // completion tokens
  prompt_eval_count: number;
}

async function callModel(model: string): Promise<{ latencyMs: number; completionTokens: number; content: string; doneReason: string }> {
  const start = Date.now();
  const res = await fetch(`${OLLAMA_NATIVE_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_MESSAGE },
      ],
      stream: false,
      think: false, // suppresses chain-of-thought -- see file header
    }),
  });
  const latencyMs = Date.now() - start;

  if (!res.ok) {
    throw new Error(`${model} responded ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as OllamaNativeChatResponse;
  return {
    latencyMs,
    completionTokens: data.eval_count,
    content: data.message.content,
    doneReason: data.done_reason,
  };
}

async function probeModel(model: string) {
  console.log(`\n=== ${model} ===`);

  for (let i = 0; i < WARMUP_RUNS; i++) {
    const { latencyMs } = await callModel(model);
    console.log(`  warmup ${i + 1}: ${latencyMs}ms (includes model load if not already resident)`);
  }

  const runs: { latencyMs: number; completionTokens: number; content: string; doneReason: string }[] = [];
  for (let i = 0; i < TIMED_RUNS; i++) {
    const run = await callModel(model);
    runs.push(run);
    const tokensPerSec = run.completionTokens / (run.latencyMs / 1000);
    const validJson = (() => {
      try {
        JSON.parse(run.content);
        return true;
      } catch {
        return false;
      }
    })();
    console.log(
      `  run ${i + 1}: ${run.latencyMs}ms, ${run.completionTokens} tokens, ${tokensPerSec.toFixed(1)} tok/s, ` +
        `done_reason=${run.doneReason}, valid_json=${validJson}`,
    );
  }

  const avgLatency = runs.reduce((sum, r) => sum + r.latencyMs, 0) / runs.length;
  const avgTokens = runs.reduce((sum, r) => sum + r.completionTokens, 0) / runs.length;
  const avgTokensPerSec = avgTokens / (avgLatency / 1000);

  console.log(`  avg: ${avgLatency.toFixed(0)}ms, ${avgTokens.toFixed(0)} tokens, ${avgTokensPerSec.toFixed(1)} tok/s`);
  return { model, avgLatencyMs: avgLatency, avgCompletionTokens: avgTokens, avgTokensPerSec };
}

async function main() {
  const results = [];
  for (const model of MODELS) {
    results.push(await probeModel(model));
  }

  console.log("\n\n=== Summary ===");
  console.log("| Model | Avg latency (ms) | Avg completion tokens | Avg tok/s |");
  console.log("|---|---|---|---|");
  for (const r of results) {
    console.log(`| ${r.model} | ${r.avgLatencyMs.toFixed(0)} | ${r.avgCompletionTokens.toFixed(0)} | ${r.avgTokensPerSec.toFixed(1)} |`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
