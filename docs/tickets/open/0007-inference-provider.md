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

## Definition of done

- Default path: `InferenceProvider.analyze()` makes a real OpenAI-compatible chat-completions call
  using `INFERENCE_BASE_URL`/`INFERENCE_MODEL`/`INFERENCE_API_KEY`, parses the response into the
  contract shape, handles malformed/non-JSON model output gracefully (Zod-validated, clear error
  rather than an unhandled exception)
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
