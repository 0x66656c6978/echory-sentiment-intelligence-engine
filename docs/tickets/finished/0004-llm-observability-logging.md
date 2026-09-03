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
