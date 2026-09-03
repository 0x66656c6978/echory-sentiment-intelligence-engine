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

_No work logged yet._
