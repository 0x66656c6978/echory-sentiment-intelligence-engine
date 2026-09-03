/**
 * backend/scripts/llm-benchmark.ts
 * ==================================
 * Ticket 0006 — benchmarks candidate local models for nuance-detection
 * quality (not just latency, which ticket 0005 already measured) against the
 * hand-labeled test set in benchmark-test-set.ts.
 *
 * For each (model, test case): calls the model via Ollama's native /api/chat
 * with think:false (mandatory per ticket 0006's DoD — never scores truncated
 * chain-of-thought), using the exact prompt from
 * src/prompts/sentimentClassification.ts (the same prompt ticket 0007 ships).
 *
 * sentiment/risk_level/volatility_flag accuracy is computed directly against
 * the hand labels (deterministic, no LLM needed for that part). A stronger
 * *external* judge model (DeepSeek, not a local model competing with the
 * candidates for the same GPU) then scores the qualitative fields
 * (hidden_intent, mitigation_suggestion) against each case's rationale, since
 * those can't be exact-matched. Using deepseek-reasoner specifically (not the
 * plain chat model) for judge-quality grading -- DeepSeek's API cleanly
 * separates `reasoning_content` from the final `content`, unlike the local
 * Ollama "thinking" models, which truncated before ever reaching an answer.
 *
 * Usage: npx tsx scripts/llm-benchmark.ts (run from backend/)
 * Requires: `ollama serve` running with all CANDIDATE_MODELS pulled, and
 * JUDGE_API_KEY set in backend/.env (DeepSeek API key).
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { TelemetryChunkResponseSchema } from "@echory/contract";
import {
  SENTIMENT_CLASSIFICATION_SYSTEM_PROMPT,
  SENTIMENT_CLASSIFICATION_JSON_SCHEMA,
  buildSentimentClassificationUserMessage,
} from "../src/prompts/sentimentClassification.js";
import { BENCHMARK_CASES, type BenchmarkCase } from "./benchmark-test-set.js";

// Minimal .env loader (no dotenv dependency needed for one script) -- only
// sets vars not already present in the environment.
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

const OLLAMA_NATIVE_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
// Prompt v2 re-test across all other latency-compliant models (granite4.1:3b
// already re-tested with v2 separately -- see docs/benchmark-results.md).
// Latency-failing models (qwen3.5:4b/8b/9b thinking family, gemma4:e4b,
// mistral, ministral-3:8b) are discarded per Felix's direction -- no point
// re-testing a prompt change on models that already fail the hard 500ms line
// regardless of quality.
const CANDIDATE_MODELS = ["gemma4:e2b", "phi4-mini", "llama3.2:3b", "qwen2.5:1.5b", "llama3.2:1b"];

const JUDGE_BASE_URL = process.env.JUDGE_BASE_URL ?? "https://api.deepseek.com/v1";
const JUDGE_MODEL = process.env.JUDGE_MODEL ?? "deepseek-reasoner";
const JUDGE_API_KEY = process.env.JUDGE_API_KEY;
if (!JUDGE_API_KEY) {
  throw new Error("JUDGE_API_KEY is not set -- add it to backend/.env (see .env.example)");
}

const ClassificationSchema = TelemetryChunkResponseSchema.omit({ chunk_id: true, processing_latency_ms: true });
type Classification = z.infer<typeof ClassificationSchema>;

const JudgeResponseSchema = z.object({
  score: z.number().min(0).max(10),
  comment: z.string(),
});

interface OllamaNativeChatResponse {
  message: { content: string };
  done_reason: string;
  eval_count: number;
}

async function callOllama(
  model: string,
  systemPrompt: string,
  userMessage: string,
  format?: object,
): Promise<{ latencyMs: number; content: string; doneReason: string }> {
  const start = Date.now();
  const res = await fetch(`${OLLAMA_NATIVE_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      stream: false,
      think: false,
      // Ollama's default temperature (~0.8) is tuned for open-ended chat, not
      // deterministic classification. Low but not zero, to avoid pathological
      // repetition on some models while still favoring consistency.
      options: { temperature: 0.2 },
      ...(format ? { format } : {}),
    }),
  });
  const latencyMs = Date.now() - start;
  if (!res.ok) throw new Error(`${model} responded ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as OllamaNativeChatResponse;
  return { latencyMs, content: data.message.content, doneReason: data.done_reason };
}

interface OpenAiCompatChatResponse {
  choices: { message: { content: string; reasoning_content?: string } }[];
}

/**
 * Calls DeepSeek's OpenAI-compatible endpoint. reasoning_content (the
 * chain-of-thought) is returned as a separate field from content (the final
 * answer) -- unlike the local Ollama "thinking" models, there's no truncation
 * risk here as long as max_tokens leaves room for both. We only read content.
 */
async function callJudge(systemPrompt: string, userMessage: string): Promise<{ latencyMs: number; content: string }> {
  const start = Date.now();
  const res = await fetch(`${JUDGE_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${JUDGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 4000, // reasoner needs room for reasoning_content + content
    }),
  });
  const latencyMs = Date.now() - start;
  if (!res.ok) throw new Error(`Judge (${JUDGE_MODEL}) responded ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as OpenAiCompatChatResponse;
  return { latencyMs, content: data.choices[0].message.content };
}

function tryParseJson(raw: string): unknown | undefined {
  try {
    return JSON.parse(raw);
  } catch {
    // some models wrap output in ```json fences despite instructions -- try stripping them
    const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    try {
      return JSON.parse(stripped);
    } catch {
      return undefined;
    }
  }
}

interface CaseResult {
  caseId: string;
  model: string;
  latencyMs: number;
  parseOk: boolean;
  /** Populated only when parseOk is false, for debugging -- e.g. "invalid JSON syntax" vs. "missing required field(s): volatility_flag". */
  failureReason?: string;
  rawContent?: string;
  classification?: Classification;
  sentimentCorrect: boolean | null;
  riskLevelCorrect: boolean | null;
  volatilityCorrect: boolean | null;
  judgeScore: number | null;
  judgeComment: string;
}

async function runCandidate(model: string, testCase: BenchmarkCase): Promise<CaseResult> {
  const userMessage = buildSentimentClassificationUserMessage(testCase.chunk);
  const { latencyMs, content } = await callOllama(
    model,
    SENTIMENT_CLASSIFICATION_SYSTEM_PROMPT,
    userMessage,
    SENTIMENT_CLASSIFICATION_JSON_SCHEMA,
  );

  const parsed = tryParseJson(content);
  const validated = parsed ? ClassificationSchema.safeParse(parsed) : undefined;

  if (!validated?.success) {
    const failureReason =
      parsed === undefined
        ? "invalid JSON syntax"
        : `schema validation failed: ${validated?.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`;
    return {
      caseId: testCase.id,
      model,
      latencyMs,
      parseOk: false,
      failureReason,
      rawContent: content,
      sentimentCorrect: null,
      riskLevelCorrect: null,
      volatilityCorrect: null,
      judgeScore: null,
      judgeComment: "N/A -- invalid/unparseable model output",
    };
  }

  const classification = validated.data;
  const { expected } = testCase;
  const sentimentCorrect =
    classification.sentiment === expected.sentiment || (expected.acceptableSentiments?.includes(classification.sentiment) ?? false);
  const riskLevelCorrect = classification.risk_level === expected.risk_level;
  const volatilityCorrect = expected.volatility_flag === undefined ? null : classification.volatility_flag === expected.volatility_flag;

  const judgePrompt = `You are grading an AI negotiation-sentiment classifier's output for quality.

Transcript: "${testCase.chunk.text}"
Ground-truth analysis (from a human labeler): ${testCase.rationale}

The classifier under test produced:
- sentiment: ${classification.sentiment}
- hidden_intent: "${classification.hidden_intent}"
- mitigation_suggestion: "${classification.mitigation_suggestion}"
- risk_level: ${classification.risk_level}

Score 0-10 how well hidden_intent and mitigation_suggestion capture the true underlying dynamic described in the ground-truth analysis and give genuinely useful guidance to a negotiator. 0 = completely misses the point, 10 = excellent, specific, actionable. Respond with ONLY strict JSON: {"score": number, "comment": "one sentence"}`;

  const judgeCall = await callJudge("You are a precise, terse grading assistant.", judgePrompt);
  const judgeParsed = tryParseJson(judgeCall.content);
  const judgeValidated = judgeParsed ? JudgeResponseSchema.safeParse(judgeParsed) : undefined;

  return {
    caseId: testCase.id,
    model,
    latencyMs,
    parseOk: true,
    classification,
    sentimentCorrect,
    riskLevelCorrect,
    volatilityCorrect,
    judgeScore: judgeValidated?.success ? judgeValidated.data.score : null,
    judgeComment: judgeValidated?.success ? judgeValidated.data.comment : "N/A -- judge output unparseable",
  };
}

interface ModelSummary {
  model: string;
  parseFailures: number;
  /** Correct / total cases -- a parse failure counts as incorrect, not excluded. The honest headline number. */
  effectiveSentimentAccuracy: number;
  /** Correct / successfully-parsed only -- context for the number above, NOT a substitute for it (misleading alone when failures are high). */
  sentimentAccuracyAmongParsed: number;
  riskLevelAccuracy: number;
  volatilityAccuracy: number | null;
  avgJudgeScore: number;
  avgLatencyMs: number;
}

function summarize(model: string, results: CaseResult[]): ModelSummary {
  const total = results.length;
  const parseFailures = results.filter((r) => !r.parseOk).length;
  const graded = results.filter((r) => r.parseOk);
  const effectiveSentimentAccuracy = graded.filter((r) => r.sentimentCorrect).length / total;
  const sentimentAccuracyAmongParsed = graded.filter((r) => r.sentimentCorrect).length / (graded.length || 1);
  const riskLevelAccuracy = graded.filter((r) => r.riskLevelCorrect).length / (graded.length || 1);
  const volatilityGraded = graded.filter((r) => r.volatilityCorrect !== null);
  const volatilityAccuracy = volatilityGraded.length
    ? volatilityGraded.filter((r) => r.volatilityCorrect).length / volatilityGraded.length
    : null;
  const judgeScores = graded.map((r) => r.judgeScore).filter((s): s is number => s !== null);
  const avgJudgeScore = judgeScores.length ? judgeScores.reduce((a, b) => a + b, 0) / judgeScores.length : 0;
  const avgLatencyMs = results.reduce((a, b) => a + b.latencyMs, 0) / results.length;

  return {
    model,
    parseFailures,
    effectiveSentimentAccuracy,
    sentimentAccuracyAmongParsed,
    riskLevelAccuracy,
    volatilityAccuracy,
    avgJudgeScore,
    avgLatencyMs,
  };
}

async function main() {
  const allResults: CaseResult[] = [];

  for (const model of CANDIDATE_MODELS) {
    console.log(`\n=== Benchmarking ${model} ===`);

    // Warm-up call, discarded -- Ollama loads the model into memory on first
    // use, and that load time (seconds, not ms) would otherwise inflate the
    // first timed case for every model, skewing the average. Deliberately a
    // completely unrelated prompt (not the real system prompt or any test
    // case) so there's no prompt/KV-cache reuse advantage for whichever real
    // case happens to run first -- every one of the 18 timed calls below is
    // equally "cold" content-wise, only the model itself is warm.
    const warmupStart = Date.now();
    await callOllama(model, "You are a helpful assistant.", "What is the capital of France? Answer in one word.");
    console.log(`  (warm-up: ${Date.now() - warmupStart}ms, discarded)`);

    for (const testCase of BENCHMARK_CASES) {
      const result = await runCandidate(model, testCase);
      allResults.push(result);
      const label = result.parseOk ? result.classification!.sentiment : `PARSE_FAIL (${result.failureReason})`;
      console.log(
        `  ${testCase.id}: sentiment=${label} ` +
          `(expected ${testCase.expected.sentiment}${testCase.expected.acceptableSentiments ? `/${testCase.expected.acceptableSentiments.join("/")}` : ""}) ` +
          `${result.sentimentCorrect ? "✓" : result.sentimentCorrect === false ? "✗" : "-"} ` +
          `judge=${result.judgeScore ?? "N/A"} latency=${result.latencyMs}ms`,
      );
    }
  }

  const summaries = CANDIDATE_MODELS.map((model) => summarize(model, allResults.filter((r) => r.model === model)));

  console.log("\n\n=== Summary ===");
  console.table(
    summaries.map((s) => ({
      model: s.model,
      "sentiment acc (of 18)": `${(s.effectiveSentimentAccuracy * 100).toFixed(0)}%`,
      "sentiment acc (parsed only)": `${(s.sentimentAccuracyAmongParsed * 100).toFixed(0)}%`,
      "risk acc": `${(s.riskLevelAccuracy * 100).toFixed(0)}%`,
      "volatility acc": s.volatilityAccuracy === null ? "N/A" : `${(s.volatilityAccuracy * 100).toFixed(0)}%`,
      "avg judge score": s.avgJudgeScore.toFixed(1),
      "avg latency": `${s.avgLatencyMs.toFixed(0)}ms`,
      "parse failures": `${s.parseFailures}/18`,
    })),
  );

  const outPath = join(process.cwd(), "..", "docs", "benchmark-raw-results-prompt-v2-others.json");
  writeFileSync(outPath, JSON.stringify({ summaries, allResults }, null, 2), "utf-8");
  console.log(`\nRaw results written to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
