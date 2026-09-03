# 0007 — Provider switch + cloud fallback

**Priority:** P1
**Phase:** 3

## Description

Implement `InferenceProvider` (the seam stubbed in `backend/src/provider/inference.ts`) for real:
an OpenAI-compatible chat-completions HTTP call, configured entirely via env vars
(`INFERENCE_BASE_URL`, `INFERENCE_MODEL`, optional `INFERENCE_API_KEY`) rather than separate
hardcoded local/cloud classes. The same code path serves both the local Ollama model selected in
[0006-local-llm-benchmark](0006-local-llm-benchmark.md) (Ollama exposes an OpenAI-compatible
endpoint) and a cloud fallback (Groq, etc.) — switching between them, or pointing at any other
OpenAI-compatible endpoint, is purely a `.env` change, no code changes.

This design was corrected on 2026-09-03 from an earlier `LLM_PROVIDER=local|cloud` split (two
hardcoded provider classes) after Pascal (Echory CTO) explicitly asked, by email, for the
inference endpoint to be configurable via base URL + model name — specifically so Echory can
point this backend at an external model if their container has problems running local inference
on their side. A single generic provider is also simpler than two hardcoded ones.

**Conditional complication found in ticket 0005** (see `docs/hardware-probe-results.md`): Ollama's
OpenAI-compatible endpoint does not support suppressing "thinking" mode on hybrid-reasoning models
(`think: false` is silently ignored there; only Ollama's native `/api/chat` respects it). Whether
the "one unified OpenAI-compatible code path" design above still holds **depends entirely on which
model ticket 0006 picks**:
- If it's a non-reasoning model (e.g. `llama3.2:1b`, confirmed to behave identically on both
  endpoints) — the unified design above is unaffected, implement as planned.
- If it's a "thinking" model (any of the qwen3.x/gemma4.x family) — the local path must call
  Ollama's native `/api/chat` instead, while the cloud path still uses the OpenAI-compatible
  endpoint. That's back to two code paths for that case, not fully unified. Decide once 0006's
  model choice is known, don't guess now.

## Definition of done

- `InferenceProvider.analyze()` makes a real OpenAI-compatible chat-completions call using
  `INFERENCE_BASE_URL` / `INFERENCE_MODEL` / `INFERENCE_API_KEY`, parses the model's response into
  the contract shape, and handles the case where the response isn't valid/parseable JSON
- Verified working against both a local Ollama endpoint and a real cloud endpoint (Groq or
  equivalent) with the same code, only `.env` changed
- `.env.example` documents both the local and cloud configurations (already scaffolded — verify
  still accurate once the real call is implemented)
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
