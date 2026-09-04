# 0004 — LLM call observability logging

**Priority:** P1
**Phase:** 2

## Description

Structured logging for every LLM call: latency, token counts (if available from the provider),
and the prompt + response persisted per chunk. This is what Phase 3's benchmark will read from
to compare models, and it's a concrete "production AI" talking point for `ARCHITECTURE.md`.

Start with a simple structured log (JSON lines to a file or console) — Langfuse integration is a
stretch goal only if time allows, not a blocker for anything downstream.

## Definition of done

- Every call to the LLM provider (local or cloud) logs: `chunk_id`, `session_id`, provider/model
  name, latency_ms, prompt, raw response, parsed result
- Logs are queryable enough to compute per-model latency stats for Phase 3
- Langfuse noted as stretch — only attempt after the above is working and time remains

## Log

### 2026-09-03 — Scope note
`InferenceProvider` (ticket 0007) is still a stub — there's no real LLM call to log yet. Scoped
this ticket to building the logging infrastructure fully now, wired so ticket 0007 gets logging
for free by populating one optional field, rather than faking a call just to make this ticket look
done. The rule-based `PlaceholderProvider` is explicitly out of scope for logging — it's not an
LLM call, so it correctly produces no log entries (tested).

### 2026-09-03 — Design: extended the SentimentProvider seam
Changed `SentimentProvider.analyze()` in `@echory/contract` to return
`{ classification, observability? }` instead of the classification fields directly.
`observability` (model, prompt, rawResponse, tokenCounts) is optional and only meaningful for
providers that actually called an LLM. `backend/src/routes/telemetry.ts` now logs automatically
whenever `observability` is present — ticket 0007 doesn't need to touch the route or the logger at
all, just populate that field once the real HTTP call exists. Updated `PlaceholderProvider` (wraps
its existing result, no `observability`) and `InferenceProvider`'s stub signature accordingly.

### 2026-09-03 — Implementation
- `backend/src/observability/llmLogger.ts` — `logLLMCall`/`readLLMCallLog` against a JSON-lines
  file (`backend/logs/llm-calls.jsonl` by default, gitignored; path is injectable for tests)
- `backend/src/observability/stats.ts` — `computeLatencyStatsByModel`, groups by model and
  computes count/avg/p50/p95 — this is what ticket 0006's benchmark will call directly
- `backend/src/app.ts` — `buildApp()` now accepts an optional provider override, used only by
  tests that need to exercise a specific provider without going through `LLM_PROVIDER`

### 2026-09-03 — Validation
8 new tests (31 total in the suite now): logger append/read/multi-entry/directory-creation, stats
grouping/aggregation/empty-input, and two route-level integration tests confirming a provider that
returns `observability` gets logged with all fields intact (model, prompt, raw response, token
counts) while the placeholder provider produces zero log entries for the same request shape.
`npx tsc --noEmit` clean under strict mode after the interface change.

### 2026-09-04 — Stretch goal: Langfuse tracing (for the Loom demo)
Revisited the Langfuse stretch this DoD explicitly deferred. Off by default: enabled only when
`LANGFUSE_PUBLIC_KEY`/`LANGFUSE_SECRET_KEY` are both set, so an evaluator without a Langfuse account
sees zero behavior or latency difference (verified — no keys means no OpenTelemetry SDK ever starts).

False start caught before it shipped: `npm view langfuse version` installed the legacy `Langfuse`
class (v3, `.generation()`/`.trace()`), which is the pattern this LLM would produce from memory. The
Langfuse Agent Skill (`github.com/langfuse/skills`) explicitly warns against implementing from
memory and mandates fetching current docs first — doing so showed the current recommended SDK is
OpenTelemetry-based (`@langfuse/tracing` + `@langfuse/otel` + `@opentelemetry/sdk-node`), not the
`Langfuse` class. Swapped packages before writing any real code against the wrong API.

Hit the same class of module-load-ordering bug as ticket 0007's `.env` discovery: `index.ts` imports
`app.ts` (which transitively imports `langfuse.ts`) before calling `loadDotEnv()`, so an eagerly
computed `export const langfuseEnabled = computeLangfuseEnabled()` at module scope would have
permanently baked in `false` even with real keys on disk. Fixed by making it a mutable `let`,
defaulting to `false` and only ever set by `initLangfuse()`, called explicitly right after
`loadDotEnv()` in `index.ts`.

The skill also mandates *running* the integration for real and self-auditing the actual trace
against Langfuse's own best-practices doc rather than trusting the SDK docs alone. Did exactly that
against the real Docker container and Langfuse Cloud (via `langfuse-cli`), and it caught two real
gaps unit tests couldn't have (mocks don't validate real timing/naming semantics):
- The recorded trace showed `latency: 0` — the observation was created and ended *after*
  `provider.analyze()` had already fully completed, so its own span duration was near-instant
  rather than reflecting the real LLM call. Fixed by threading real `Date` objects (`startTime`
  captured before the call, `endTime` after) from `telemetry.ts` through to `startObservation(...,
  { startTime })` and `.end(endTime)`. Re-fetched the trace: `latency: 0.445` matched the API
  response's real `processing_latency_ms: 445` exactly.
- The observation name (`sentiment-classification`) was noun-first, and `input` embedded the full
  system prompt repeated identically on every call — both against the fetched best-practices doc's
  explicit guidance. Renamed to verb-first `classify-sentiment` (used as both the observation name
  and the propagated `traceName`), and moved the system prompt out of `input` into
  `metadata.system_prompt`, leaving `input` as just the transcript being classified. Re-fetched and
  confirmed both fixes on a second real trace.

Fire-and-forget from `telemetry.ts` (`void logToLangfuse(...).catch(...)`), never awaited before the
response is sent and never allowed to surface as a caller-visible failure — observability must not
become a new way for the API to break. 7 new tests in `backend/src/observability/langfuse.test.ts`
(mocking `@langfuse/tracing`/`@opentelemetry/sdk-node`/`@langfuse/otel`, with `vi.resetModules()` +
a dynamic import per test since `sdk` is a genuine module-level singleton). Documented in
`ARCHITECTURE.md`'s new "Observability" section.
