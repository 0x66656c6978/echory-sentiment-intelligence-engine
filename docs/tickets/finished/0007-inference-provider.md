# 0007 — Inference provider (local default, always swappable)

**Priority:** P0
**Phase:** 3

## Description

Implement `InferenceProvider` (the seam stubbed in `backend/src/provider/inference.ts`) for real,
against the model ticket 0006 selects.

**Two requirements that are in tension, both real, both must be satisfied:**

1. Pascal (Echory CTO) explicitly emailed asking for the inference endpoint to be configurable via
   base URL + model name, specifically so Echory can point this backend at an external model if
   their container has trouble running local inference on their side. This is a hard requirement
   from the client, not a nice-to-have — the default/primary code path must always be swappable to
   any real OpenAI-compatible endpoint via `.env` alone, zero code changes.
2. Felix's priority: ship a genuinely good **local** model reliably. Ticket 0005 found that
   Ollama's OpenAI-compatible endpoint can't suppress "thinking" mode on reasoning models
   (`think: false` is silently ignored there — only Ollama's native `/api/chat` respects it). If
   ticket 0006 picks a reasoning model for quality reasons, the universal OpenAI-compatible path
   alone won't produce clean, fast output from it.

**Resolution:** the default path is the universal OpenAI-compatible call (`INFERENCE_BASE_URL` +
`INFERENCE_MODEL` + optional `INFERENCE_API_KEY`) — this is what satisfies requirement 1 always,
with zero config beyond pointing at a different endpoint. A separate opt-in flag,
`INFERENCE_DISABLE_THINKING=true`, switches the *local* call to Ollama's native `/api/chat` with
`think: false` instead — only relevant if ticket 0006 picks a reasoning model; leave it unset for
a non-reasoning model (e.g. `llama3.2:1b`, confirmed to behave identically on both endpoints) or
for any cloud provider. This isn't pretending there's one universal wire format when there
genuinely isn't — it's one small, documented, opt-in escape hatch on top of a default that always
satisfies Pascal's ask.

If ticket 0006 ends up choosing a non-reasoning model, the escape hatch is simply never exercised
in practice and the two "requirements in tension" above stop being in tension at all — worth
keeping in mind as a factor (not the only factor) in that ticket's model choice.

**Update:** ticket 0006 selected `phi4-mini` (non-reasoning) as primary, `granite4.1:3b`
(non-reasoning) as the documented swap-in alternative. Both confirmed clean via the default
OpenAI-compatible path — `INFERENCE_DISABLE_THINKING` is not needed for either and this ticket's
"tension" doesn't actually arise for the current choice. One real implementation detail found while
confirming this: Ollama's **native** `/api/chat` takes structured-output schemas via a `format`
field, but its **OpenAI-compatible** `/v1/chat/completions` endpoint uses the OpenAI-standard
`response_format: {type: "json_schema", json_schema: {name, schema}}` shape instead — different
field name and nesting, not just a passthrough. Without it (plain prompting only), `phi4-mini`
wrapped its JSON in markdown code fences and `granite4.1:3b` dropped `risk_level` entirely — the
exact same missing-field failure mode ticket 0006 found and fixed on the native path. `response_
format` must be used on this ticket's default path, not skipped just because the model is
non-reasoning.

## Definition of done

- Default path: `InferenceProvider.analyze()` makes a real OpenAI-compatible chat-completions call
  using `INFERENCE_BASE_URL`/`INFERENCE_MODEL`/`INFERENCE_API_KEY`, **including `response_format`
  with the JSON schema** (confirmed necessary even for non-reasoning models — see the note above),
  parses the response into the contract shape, handles malformed/non-JSON model output gracefully
  (Zod-validated, clear error rather than an unhandled exception)
- Verified this default path actually works against a **real external endpoint change** — not
  just local Ollama — e.g. pointing `INFERENCE_BASE_URL`/`INFERENCE_MODEL`/`INFERENCE_API_KEY` at
  Groq with no code changes, confirming Pascal's explicit ask is genuinely satisfied
- `INFERENCE_DISABLE_THINKING=true` path: same provider, routes to Ollama's native `/api/chat`
  with `think: false`, verified against whatever model ticket 0006 selects if it's a reasoning
  model (skip this verification if 0006 picks a non-reasoning model — document that it wasn't
  needed rather than testing a hypothetical)
- `.env.example` documents both the default (any OpenAI-compatible endpoint, local or cloud) and
  the `INFERENCE_DISABLE_THINKING` opt-in with a clear explanation of when each applies
- README/SETUP.md documents the `ollama pull <model>` step needed for the local path

## Log

### 2026-09-03 — Description and DoD rewritten; provider skeleton corrected
Pascal's email explicitly requested inference-endpoint configurability via base URL + model name,
so Echory can swap in an external model if their container has trouble. Replaced the originally
planned `LLM_PROVIDER=local|cloud` split (separate `LocalProvider`/`CloudProvider` classes,
`OLLAMA_BASE_URL`/`OLLAMA_MODEL`/`GROQ_API_KEY`/`GROQ_MODEL` env vars from ticket 0001) with a
single `LLM_PROVIDER=placeholder|inference` switch and one `InferenceProvider` configured via
`INFERENCE_BASE_URL`/`INFERENCE_MODEL`/`INFERENCE_API_KEY` — same code regardless of whether it
points at local Ollama or a cloud API, since Ollama also exposes an OpenAI-compatible endpoint.

Did the skeleton correction now rather than waiting for this ticket's sequential turn, since it's
a low-risk rename (the provider still just throws "not implemented" — no behavior change) and
leaving the known-superseded design in the repo in the meantime seemed worse than fixing it while
the context was fresh. The actual HTTP call implementation is still this ticket's real, sequenced
work — not done yet. Deleted `backend/src/provider/local.ts` and `cloud.ts`, added
`backend/src/provider/inference.ts`, updated `backend/src/provider/index.ts` and
`backend/.env.example` accordingly. Re-ran the ticket-0001 regression checks (health check, happy
path) to confirm the default placeholder path is unaffected — passed.

### 2026-09-03 — Description amended: native-API complication
Ticket 0005's probe found Ollama's OpenAI-compatible endpoint can't suppress "thinking" mode on
reasoning models, while the native API can. Added as a conditional note above rather than deciding
now, since the actual impact depends on which model ticket 0006 selects.

### 2026-09-03 — Briefly re-scoped to local-only, then reversed
Felix initially said to discard cloud fallback entirely and focus on local reliability first,
deferring cloud to a contingent ticket. Drafted that split (ticket 0007 renamed to
"local-inference-provider", a new deferred ticket 0015 for cloud). Felix then reconsidered
immediately after seeing this ticket's own text restate what Pascal actually asked for: "Okay I
didn't think that Pascal said that. We need to make that work then."

Reversed the split. Final design keeps a single ticket: the default path is always the universal
OpenAI-compatible call (satisfies Pascal's explicit request with zero special config), with
`INFERENCE_DISABLE_THINKING` as a narrow, documented opt-in for the local-reasoning-model case
ticket 0005 found. No ticket 0015 was created. Renamed the file from
`0007-provider-switch-cloud-fallback.md` → `0007-local-inference-provider.md` → back to
`0007-inference-provider.md` (final) — updated cross-references in `docs/tickets/index.md`,
ticket 0001's log, ticket 0008, `backend/src/provider/inference.ts`, and `ROADMAP.md` to the final
filename.

### 2026-09-03 — Model chosen (phi4-mini); response_format requirement confirmed
Ticket 0006 finished: `phi4-mini` selected as primary (granite4.1:3b as documented swap-in), both
non-reasoning, both confirmed clean via the default OpenAI-compatible path. Verified with a direct
curl check before finalizing: without `response_format`, `phi4-mini` wraps JSON in markdown fences
and `granite4.1:3b` drops `risk_level` entirely (same missing-field failure ticket 0006 found on
Ollama's native API, now confirmed on the OpenAI-compatible path too). With OpenAI's `response_
format: {type: "json_schema", json_schema: {name, schema}}` shape (different field name/nesting
than Ollama native's `format`), both produce clean, complete JSON. Added as an explicit DoD
requirement rather than leaving it implicit. `backend/.env.example` updated with `phi4-mini` as
the default `INFERENCE_MODEL` and `granite4.1:3b` documented as the swap-in alternative.

### 2026-09-04 — Implemented for real; all DoD items verified

Implemented `InferenceProvider.analyze()` in `backend/src/provider/inference.ts`:
- Default path: real HTTP call to `${INFERENCE_BASE_URL}/chat/completions` (OpenAI-compatible),
  always including `response_format: {type: "json_schema", ...}` per the requirement confirmed
  above. Auth header is only sent when `INFERENCE_API_KEY` is set (Ollama needs none; cloud
  providers do) — config is a plain object (`InferenceProviderConfig`), constructor defaults to
  reading env vars but accepts an explicit config for tests, so no env-var mutation is needed to
  test different provider configurations.
- Model output is parsed with a fences-stripping fallback (same approach as ticket 0006/0015's
  benchmark script), then validated against a new `SentimentClassificationSchema` exported from
  `@echory/contract` (added so production and `backend/scripts/llm-benchmark.ts` validate against
  the exact same schema instead of two independently-maintained copies — refactored the benchmark
  script to import it too). Invalid JSON or a failed schema check throws a descriptive `Error`
  (e.g. naming the exact missing/invalid field) rather than letting `JSON.parse` or Zod's own error
  propagate raw — caught by the existing global Fastify error handler (ticket 0013) and normalized
  to `500 {error: "internal_error"}`, same as any other unexpected failure. This satisfies "clear
  error rather than an unhandled exception" — Fastify was always going to return 500 for a thrown
  error either way; what changed is the message is now specific enough to debug from logs alone.
- `INFERENCE_DISABLE_THINKING=true` path: same class, routes to Ollama's native `/api/chat` with
  `think:false` and the native `format` field, deriving the native base URL from
  `INFERENCE_BASE_URL` by stripping a trailing `/v1` (one env var to document, not two).

**Found and fixed a real gap while implementing this**: nothing in `backend/src` ever loaded
`backend/.env` — `npm start` (`tsx src/index.ts` directly) only sees real process env vars.
`backend/.env` "worked" so far only because the placeholder provider needs no config at all; this
ticket is the first one where a missing `INFERENCE_API_KEY`/`INFERENCE_MODEL` would silently break
things for anyone following the documented `cp backend/.env.example backend/.env` step. Added
`backend/src/env.ts` (the same minimal loader already used by `scripts/llm-benchmark.ts`, no new
dependency) and call it at the top of `backend/src/index.ts`, before anything reads `process.env`.
Does not affect Docker — `docker-compose.yml` already injects env vars directly via `env_file`,
bypassing this entirely, and `.dockerignore` already excludes `.env` from the build context.

**Fixed a test that would have silently gone stale**: `app.test.ts` had a test asserting `500` when
`LLM_PROVIDER=inference` because the old stub always threw "not implemented". That test would now
either hit a real (unmocked) network call in CI or fail for the wrong reason. Replaced it with a
dedicated `ThrowingProvider` test double injected via `buildApp`'s existing `overrideProvider` param
— same assertion (provider throws → 500, not 400), no longer coupled to `InferenceProvider`'s
internals. Added a new `backend/src/provider/inference.test.ts` (8 tests, `vi.stubGlobal("fetch",
...)` — first use of fetch-mocking in this codebase) covering: happy path with `response_format`
asserted in the request body, markdown-fence stripping, non-JSON output, missing-field schema
failure, non-2xx HTTP response, conditional `Authorization` header, base-URL swappability, and the
`INFERENCE_DISABLE_THINKING` path's native-URL derivation. Full suite: 39/39 passing
(`npm test` in `backend/`).

**Live verification against real endpoints** (all three DoD-required checks, run manually against
real services, not mocked — script written, run, and discarded per the ticket-0015 precedent for
one-off diagnostics):
1. Local Ollama, `phi4-mini`, default path: succeeded, clean classification, no code changes from
   what ships. (6.8s latency on this run — a cold model load, not a regression; ticket 0006's
   actual warmed benchmark numbers, 408ms avg, are what's used for the phi4-mini decision. Warmed
   latency under real concurrency is ticket 0008's job, not this one's.)
2. **Real external endpoint swap, Groq (`qwen/qwen3.8-27b`), same code, only `INFERENCE_BASE_URL`
   /`INFERENCE_MODEL`/`INFERENCE_API_KEY` changed**: succeeded, 472ms, clean classification —
   confirms Pascal's explicit ask is genuinely satisfied, not just architecturally plausible.
3. `INFERENCE_DISABLE_THINKING=true` against a real local reasoning model (`qwen3:8b`, already
   pulled locally from earlier benchmarking): succeeded, clean JSON with no leaked `<think>`
   content, confirming the native-API escape hatch actually works. Not exercised in production
   (phi4-mini is non-reasoning) but no longer just theoretical.

`.env.example` updated with a full `INFERENCE_DISABLE_THINKING` block (default `false`, explains
exactly when to flip it and why, references the ticket 0005 finding). `README.md` updated with the
`ollama pull phi4-mini` step and how to switch `LLM_PROVIDER=inference` — this was the DoD's
"document the pull step" item and was previously missing entirely (Setup section only covered the
placeholder-mode default). `ROADMAP.md`'s Phase 3 section and `docs/tickets/index.md` updated to
reflect completion.

All DoD items are now satisfied. Moving to `finished/`.
