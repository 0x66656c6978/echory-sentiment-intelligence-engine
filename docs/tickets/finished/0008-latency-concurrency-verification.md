# 0008 — Latency & concurrency verification

**Priority:** P0
**Phase:** 4

## Description

End-to-end performance pass once the real model (from Phase 3) is wired in: confirm latency
consistently stays under the 500ms failure line (ideally <250ms) under the chosen provider, and
verify multiple concurrent `session_id`s don't bleed state into each other.

## Definition of done

- Latency measured across a batch of real requests (not just one-off manual tests), p50/p95
  reported
- Concurrent-session test: multiple sessions interleaved, each session's summary/history stays
  correctly isolated
- If latency target is missed on the local provider, document the decision to fall back to cloud
  for submission (via [0007](0007-inference-provider.md))

## Log

### 2026-09-03 — Link fix
Ticket 0007 was renamed (`0007-provider-switch-cloud-fallback.md` → `0007-inference-provider.md`)
when its scope was reconciled to keep cloud-swap capability alongside the local-first priority.
Updated the cross-reference link only — no change in meaning.

### 2026-09-04 — Real end-to-end latency measured; concurrency verified; both DoD items pass

**Latency.** Added `backend/scripts/latency-benchmark.ts` (`npm run benchmark:latency` from
`backend/`). Deliberately does NOT reuse Fastify's in-process `.inject()` (already used by the test
suite) — it boots the real app with `app.listen()` on a real port and hits it with real `fetch()`
calls, the same way an evaluator's harness or the frontend actually would. This measures something
tickets 0006/0015 never did: real network + Fastify overhead on top of the provider call, against
the actual chosen model (`phi4-mini`, `LLM_PROVIDER=inference`), not just the raw model call in
isolation. Ran the same combined 28-case set (18 original + 10 holdout) used throughout Phase 3, for
consistency with prior methodology.

First run (no warm-up): 1/28 (4%) over 500ms — but that one outlier was exactly the *first* request
(2853ms server-side), the same cold-model-load effect ticket 0006 already found and controls for.
Added a discarded warm-up call (unrelated prompt, same precedent as tickets 0006/0015) and re-ran:

- Client-observed round-trip (network + Fastify + provider): p50=332ms, p95=366ms, max=374ms,
  **0/28 (0%) over 500ms**
- Server-reported `processing_latency_ms` alone: p50=330ms, p95=365ms, max=372ms, 0/28 over 500ms

Confirms ticket 0006/0015's `phi4-mini` decision (408ms avg, 0% over 500ms measured on the raw
model call) holds up end-to-end through the real deployed server — if anything these full-stack
numbers are slightly *better* than the raw-model benchmark's, so Fastify/network overhead is not
eating into the safety margin. Comfortably clears the 500ms failure line; p50/p95 sit above the
"<250ms for full marks" stretch target from `ROADMAP.md`, noted honestly here rather than glossed
over — not something a code change fixes without reopening the model tradeoff itself (see
`docs/benchmark-results.md`), and 0% failure-line risk was the priority this ticket verifies.
**Latency target is not missed, so the cloud-fallback DoD item does not apply** — documenting that
explicitly rather than silently skipping it. Raw results: `docs/latency-verification-results.json`.

**Concurrency.** Added `backend/src/concurrency.test.ts`: fires 20 requests across 4 different
`session_id`s concurrently via `Promise.all` (not sequentially per session — the actual interleaved-
awaits scenario that matters), using a fake provider with a randomized delay specifically to force
real interleaving, which also echoes the exact `chunk_id` it received back in `hidden_intent` as an
extra tripwire against any route-handler mixup. Verified: every response matches its own request
(`chunk_id` and echoed field both), and each session's `sessionStore` entry ends up with exactly its
own 5 `chunk_id`s, no foreign ones — confirmed correctly isolated under real concurrency, not just
the sequential case `session/store.test.ts` (ticket 0003) already covered. Full suite: 40/40 passing.

Moving to `finished/`.
