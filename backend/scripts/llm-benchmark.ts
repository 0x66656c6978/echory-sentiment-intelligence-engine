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
import { SentimentClassificationSchema } from "@echory/contract";
import {
  SENTIMENT_CLASSIFICATION_SYSTEM_PROMPT,
  SENTIMENT_CLASSIFICATION_JSON_SCHEMA,
  buildSentimentClassificationUserMessage,
} from "../src/prompts/sentimentClassification.js";
import { BENCHMARK_CASES as ORIGINAL_CASES, type BenchmarkCase } from "./benchmark-test-set.js";
import { HOLDOUT_CASES } from "./holdout-test-set.js";

// TEST_SET=holdout runs the independent holdout set (holdout-test-set.ts)
// instead of the original 18 cases -- used to check whether a prompt
// improvement measured on the original set actually generalizes, since that
// same set was used to diagnose the failures the improvement targets.
const BENCHMARK_CASES: BenchmarkCase[] = process.env.TEST_SET === "holdout" ? HOLDOUT_CASES : ORIGINAL_CASES;

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

interface Candidate {
  name: string;
  call: (systemPrompt: string, userMessage: string) => Promise<{ latencyMs: number; content: string }>;
  /**
   * Unconstrained call for the warm-up ping only. Some providers (Groq's
   * strict json_schema mode, unlike Ollama's more lenient `format`) reject
   * output outright (400) when a schema-enforced call can't fit an
   * off-topic warm-up answer into the classification schema -- warm-up must
   * never carry response_format/schema enforcement.
   */
  warmup: (systemPrompt: string, userMessage: string) => Promise<{ latencyMs: number; content: string }>;
}

function ollamaCandidate(model: string): Candidate {
  return {
    name: model,
    call: (sys, user) => callOllama(model, sys, user, SENTIMENT_CLASSIFICATION_JSON_SCHEMA),
    warmup: (sys, user) => callOllama(model, sys, user),
  };
}

// Ticket 0015: Groq candidates. llama-3.3-70b-versatile (this project's
// earlier assumed model) no longer exists in Groq's catalog -- verified via
// their /models endpoint. groq/compound(-mini) turned out to be an agentic
// system that internally routes through gpt-oss-120b (~1.5s total) -- not a
// usable candidate, excluded. qwen/qwen3.6-27b embeds <think> tags directly
// in `content` (not a separate field) and took ~4.2s by default -- excluded.
function groqCandidate(name: string, model: string, extraBody: Record<string, unknown>): Candidate {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set -- add it to backend/.env");
  return {
    name,
    call: (sys, user) =>
      callOpenAICompatible("https://api.groq.com/openai/v1", apiKey, model, sys, user, {
        temperature: 0.2,
        response_format: { type: "json_schema", json_schema: { name: "classification", schema: SENTIMENT_CLASSIFICATION_JSON_SCHEMA } },
        ...extraBody,
      }),
    warmup: (sys, user) => callOpenAICompatible("https://api.groq.com/openai/v1", apiKey, model, sys, user, { temperature: 0.2, ...extraBody }),
  };
}

// Ticket 0015: cloud candidates alongside the local ones already selected in
// ticket 0006, to check whether Groq changes the phi4-mini/granite4.1:3b
// decision. Gemini Flash skipped per Felix's direction (observed instability).
// gpt-oss-20b needs reasoning_effort:"low" to be latency-viable at all
// (default reasoning: 441 tokens/~980ms; low: ~52 tokens/~450ms). qwen3.8-27b
// doesn't expose (or need) a reasoning_effort lever -- it simply doesn't emit
// reasoning content by default, confirmed via direct spot-check (467ms, clean
// JSON, no <think>/reasoning field) before spending a full benchmark run on it.
const CANDIDATE_MODELS: Candidate[] = [
  ollamaCandidate("phi4-mini"),
  ollamaCandidate("granite4.1:3b"),
  groqCandidate("groq/gpt-oss-20b", "openai/gpt-oss-20b", { reasoning_effort: "low" }),
  groqCandidate("groq/qwen3.8-27b", "qwen/qwen3.8-27b", {}),
];

const JUDGE_BASE_URL = process.env.JUDGE_BASE_URL ?? "https://api.deepseek.com/v1";
const JUDGE_MODEL = process.env.JUDGE_MODEL ?? "deepseek-reasoner";
const JUDGE_API_KEY = process.env.JUDGE_API_KEY;
if (!JUDGE_API_KEY) {
  throw new Error("JUDGE_API_KEY is not set -- add it to backend/.env (see .env.example)");
}

// Reuses the same schema ticket 0007's InferenceProvider validates against
// (backend/src/provider/inference.ts) -- benchmarked and shipped output must
// be checked identically, not by two independently-maintained schemas.
const ClassificationSchema = SentimentClassificationSchema;
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
  choices: { message: { content: string; reasoning_content?: string; reasoning?: string } }[];
}

/**
 * Generic OpenAI-compatible chat call (Groq, DeepSeek, or any other provider
 * using this wire format). Reasoning-model providers return the chain-of-
 * thought as a separate field (reasoning_content or reasoning) from the final
 * answer (content) -- unlike the local Ollama "thinking" models, there's no
 * truncation risk here as long as max_tokens/reasoning_effort leaves room for
 * both. We only ever read `content`.
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries on 429 (rate limit) -- expected on Groq's free tier, not a bug.
 * The retry wait itself is never counted in the reported latencyMs (that
 * would misrepresent free-tier throttling as model latency) -- the timer
 * starts fresh on each attempt, only the successful attempt's duration
 * is reported.
 */
async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  extraBody: Record<string, unknown> = {},
  maxRetries = 5,
): Promise<{ latencyMs: number; content: string }> {
  for (let attempt = 0; ; attempt++) {
    const start = Date.now();
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 4000, // reasoning providers need room for hidden reasoning + the final content
        ...extraBody,
      }),
    });
    const latencyMs = Date.now() - start;

    if (res.status === 429 && attempt < maxRetries) {
      const body = await res.text();
      const retryAfterHeader = res.headers.get("retry-after");
      const parsedFromBody = /try again in ([\d.]+)s/i.exec(body)?.[1];
      const waitSeconds = retryAfterHeader ? Number(retryAfterHeader) : parsedFromBody ? Number(parsedFromBody) : 8;
      console.log(`  (rate limited, waiting ${waitSeconds.toFixed(1)}s before retry ${attempt + 1}/${maxRetries})`);
      await sleep((waitSeconds + 0.5) * 1000);
      continue;
    }

    if (!res.ok) throw new Error(`${model} responded ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as OpenAiCompatChatResponse;
    return { latencyMs, content: data.choices[0].message.content };
  }
}

function callJudge(systemPrompt: string, userMessage: string): Promise<{ latencyMs: number; content: string }> {
  return callOpenAICompatible(JUDGE_BASE_URL, JUDGE_API_KEY!, JUDGE_MODEL, systemPrompt, userMessage);
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

async function runCandidate(candidate: Candidate, testCase: BenchmarkCase): Promise<CaseResult> {
  const userMessage = buildSentimentClassificationUserMessage(testCase.chunk);

  // A hard call failure (e.g. Groq's own generation validation rejecting an
  // empty completion) is itself a real reliability data point for this
  // candidate, not something that should crash the whole benchmark run --
  // recorded the same way as an unparseable response.
  const callStart = Date.now();
  let latencyMs: number;
  let content: string;
  try {
    ({ latencyMs, content } = await candidate.call(SENTIMENT_CLASSIFICATION_SYSTEM_PROMPT, userMessage));
  } catch (err) {
    return {
      caseId: testCase.id,
      model: candidate.name,
      latencyMs: Date.now() - callStart,
      parseOk: false,
      failureReason: `call failed: ${err instanceof Error ? err.message : String(err)}`,
      sentimentCorrect: null,
      riskLevelCorrect: null,
      volatilityCorrect: null,
      judgeScore: null,
      judgeComment: "N/A -- call failed",
    };
  }

  const parsed = tryParseJson(content);
  const validated = parsed ? ClassificationSchema.safeParse(parsed) : undefined;

  if (!validated?.success) {
    const failureReason =
      parsed === undefined
        ? "invalid JSON syntax"
        : `schema validation failed: ${validated?.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`;
    return {
      caseId: testCase.id,
      model: candidate.name,
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
    model: candidate.name,
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

  for (const candidate of CANDIDATE_MODELS) {
    console.log(`\n=== Benchmarking ${candidate.name} ===`);

    // Warm-up call, discarded -- local models need to load into memory on
    // first use (seconds, not ms), which would otherwise inflate the first
    // timed case and skew the average. Harmless no-op cost for cloud
    // candidates. Deliberately a completely unrelated prompt (not the real
    // system prompt or any test case) so there's no prompt/KV-cache reuse
    // advantage for whichever real case happens to run first -- every one of
    // the timed calls below is equally "cold" content-wise.
    const warmupStart = Date.now();
    await candidate.warmup("You are a helpful assistant.", "What is the capital of France? Answer in one word.");
    console.log(`  (warm-up: ${Date.now() - warmupStart}ms, discarded)`);

    for (const testCase of BENCHMARK_CASES) {
      const result = await runCandidate(candidate, testCase);
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

  const summaries = CANDIDATE_MODELS.map((candidate) => summarize(candidate.name, allResults.filter((r) => r.model === candidate.name)));

  console.log("\n\n=== Summary ===");
  console.table(
    summaries.map((s) => ({
      model: s.model,
      [`sentiment acc (of ${BENCHMARK_CASES.length})`]: `${(s.effectiveSentimentAccuracy * 100).toFixed(0)}%`,
      "sentiment acc (parsed only)": `${(s.sentimentAccuracyAmongParsed * 100).toFixed(0)}%`,
      "risk acc": `${(s.riskLevelAccuracy * 100).toFixed(0)}%`,
      "volatility acc": s.volatilityAccuracy === null ? "N/A" : `${(s.volatilityAccuracy * 100).toFixed(0)}%`,
      "avg judge score": s.avgJudgeScore.toFixed(1),
      "avg latency": `${s.avgLatencyMs.toFixed(0)}ms`,
      "parse failures": `${s.parseFailures}/${BENCHMARK_CASES.length}`,
    })),
  );

  const suffix = (process.env.TEST_SET === "holdout" ? "holdout" : "original") + "-cloud-comparison";
  const outPath = join(process.cwd(), "..", "docs", `benchmark-raw-results-${suffix}.json`);
  writeFileSync(outPath, JSON.stringify({ summaries, allResults }, null, 2), "utf-8");
  console.log(`\nRaw results written to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
