# Roadmap

Iterated plan for the Echory "Sentiment Intelligence Engine" technical challenge (Track A — Full Stack).
This document is the living, execution-level counterpart to [`AI_COLLABORATION.md`](AI_COLLABORATION.md)'s
general plan — it gets updated as work progresses; `AI_COLLABORATION.md` itself stays frozen as the
original strategy record.

## Constraints driving sequencing

- **Deadline:** 2026-09-05 EOD (Saturday). ~3 working days from kickoff (2026-09-03).
- **Latency:** scored dimension. Target < 250ms round-trip for full marks, < 500ms is the failure line.
- **Quality:** Nuance Detection Accuracy is the single heaviest weighted dimension (30%) — sarcasm,
  deflection, hidden intent, volatility shifts, not just surface positive/negative/neutral.
- **No STT needed:** the API contract only ever receives pre-transcribed `text` + precomputed
  `acoustic_metadata` as JSON. No audio processing is on the scoring-critical path.
- **Reproducibility:** evaluators run the backend themselves locally. A local-model dependency is
  acceptable as long as the setup (`ollama pull ...`) is clearly documented; the inference endpoint
  must also always be swappable to an external provider with no code changes (see below).
- **Docker confirmed preferred by Echory** (Pascal's email, 2026-09-03). As of ticket 0016, Docker is
  now the *only* supported way to run the backend — the native `npm start` path was dropped from the
  documented setup entirely (Felix's explicit call, building on Pascal's stated preference). He also
  asked for the inference endpoint to be configurable via env vars (base URL + model name) so Echory
  can point the backend at an external model if their container has trouble running local inference
  — see the provider design note below. `LLM_PROVIDER=inference` (the real local model) is the
  default now too, not the rule-based placeholder — ticket 0016.

## Phases

### Phase 0 — Plan (in progress)
- Iterate roadmap with Claude (this document)
- Scaffold repo structure, ticket system, initial push

### Phase 1 — Bootstrap
- Backend: Fastify + TypeScript (strict), `POST /api/telemetry/stream` satisfying the full contract
  with a rule-based placeholder first (de-risks plumbing/latency before LLM complexity is added),
  `.env.example`, provider-switch skeleton (`LLM_PROVIDER=local|cloud`)
- Frontend: Vite + React + Tailwind, connected to the backend, rendering raw results — proves the
  end-to-end pipeline before UI polish

### Phase 2 — Testing & monitoring
- Unit tests for classification/session logic
- Integration test against the live contract (Zod-validated request/response schemas)
- Structured LLM-call logging: latency, token counts, prompt + response persisted per chunk
  (Langfuse as a stretch goal — already familiar with it, good story for the ARCHITECTURE.md doc)
- Frontend smoke test (Playwright) — cut if time-pressured

### Phase 3 — Local LLM benchmark + prompt design (formerly "speech2text", repurposed — no STT needed)
- Hardware probe done (ticket 0005): found every "thinking"-capable model (Qwen3.x family)
  structurally too slow for the latency budget regardless of prompting — reasoning capability
  is baked into the architecture, not a runtime toggle. All such models discarded from further
  consideration.
- Benchmark done (ticket 0006, `docs/benchmark-results.md`): 12 models across 4 rounds, one prompt
  iteration, and an independent holdout-set check that caught real overfitting (a leading
  candidate's accuracy lead turned out to be ~19 points of test-set fitting, not genuine quality).
  **Final choice: `phi4-mini` primary, `granite4.1:3b` swap-in alternative** (change
  `INFERENCE_MODEL` alone) — both non-reasoning, 70% holdout accuracy, safe latency margins
  (94-107ms under the 500ms line).
- Small hand-labeled test set (~15-20 chunks) deliberately targeting sarcasm, deflection, aggression,
  appeasement, and volatility — not just easy positive/negative cases
- Stronger model (cloud, e.g. Gemini Flash or Groq Llama-70B) as LLM-judge; results stored in-repo
- Pick primary local model; confirm cloud fallback model for the provider switch
- Prompt and model are coupled — expect to revisit prompt after model choice and vice versa
- `InferenceProvider` implemented for real (ticket 0007): default path is a real OpenAI-compatible
  HTTP call (works unmodified against local Ollama or a real external endpoint — verified against
  Groq with zero code changes, satisfying Pascal's explicit ask), with `INFERENCE_DISABLE_THINKING`
  as a verified-but-unused opt-in for a local reasoning model. Malformed/non-JSON model output is
  Zod-validated and raised as a clear error rather than crashing.

### Phase 4 — End-to-end verification & performance iteration
- Latency profiling under the real model; concurrency check (multiple sessions, no state bleed) —
  done (ticket 0008): real HTTP requests against the deployed server (not the in-process test
  harness), p50 332ms / p95 366ms / 0% over the 500ms failure line across 28 cases; 20
  concurrent requests across 4 sessions confirmed correctly isolated, no cross-session bleed.
- Polish the 4 required UI components: Traffic Light, Sentiment Stream, Volatility Alert,
  Mitigation Panel — done (ticket 0009), driven by a scripted 9-chunk call sent live to the real
  backend, not fixtures, and verified end-to-end against the real `phi4-mini` path. Initially built
  as a dark "negotiation console" (stack-light risk indicator, terminal-style stream); superseded by
  a warm "Organic" theme (cream/terracotta/sage, card-based stream) ported from an independently
  produced design spec/mockup — same four elements, same live-data behavior, different visual
  system. See `docs/design/0009-alt-mockup/` and ticket 0009's log for the full story.
- `ARCHITECTURE.md` — done (ticket 0010), covers every deliverable-#4 bullet from `docs/CHALLENGE.md`;
  explicitly flags the ticket 0017 Ollama question as the one provisional piece, everything else
  settled. `AI_COLLABORATION.md` finalization is Felix's own to do (its header restricts AI edits;
  a draft was written to a separate file for him to review/paste in instead).
- Session summary endpoint — done (ticket 0010): `GET /api/telemetry/session/:session_id/summary`,
  Track B parity, implemented once time allowed and verified against the real Docker container.

### Phase 5 — Nice-to-haves (only if time remains)
- Scripted chunk-streaming simulator over WebSocket for a livelier Loom demo — build only if it turns
  out to help generate the Phase 3 test set faster, or as a very last polish item. Judges bring their
  own test payloads, so this is cosmetic, not scoring-relevant.
- Diagnostics/maintenance view
- Deeper UI polish

## Day allocation (approximate)

- **Day 1 (2026-09-03):** Phase 0 (done) + Phase 1
- **Day 2 (2026-09-04):** Phase 2, then Phase 3
- **Day 3 (2026-09-05, submission day):** Phase 4, then Phase 5 if time remains, Loom recording, submit

## Key decisions locked in this iteration

- **LLM strategy:** `phi4-mini` as the primary local model, chosen via ticket 0006's benchmark
  after an independent holdout check ruled out a higher-scoring but overfit alternative
  (`gemma4:e2b`). Ticket 0015 then benchmarked Groq cloud models for comparison and found
  `groq/qwen3.8-27b` genuinely beats `phi4-mini` on accuracy (93% vs. 82%) and even average latency
  (378ms vs. 408ms) — but carries a real 14% chance of exceeding the 500ms line (network/queue
  variance, not fixable via prompting, verified directly) vs. `phi4-mini`'s measured 0%. Given the
  challenge scores latency as a pass/fail cliff, kept `phi4-mini` as primary — a close, deliberate
  call, not an easy one, documented with full numbers in `docs/benchmark-results.md` for defense in
  the follow-up interview. `granite4.1:3b` (local, safe) and `groq/qwen3.8-27b` (cloud, higher
  accuracy/latency-risk) are both documented swap-ins — change `INFERENCE_MODEL` alone. GPU
  confirmed 16GB VRAM via `nvidia-smi`. The inference endpoint stays **always swappable to a real
  external OpenAI-compatible endpoint** (Groq, Gemini Flash, etc.) via
  `INFERENCE_BASE_URL`/`INFERENCE_MODEL`/`INFERENCE_API_KEY` alone —
  this is a hard requirement Pascal explicitly asked for by email, not just a latency safety net,
  and it must keep working with zero code changes. A separate opt-in, `INFERENCE_DISABLE_THINKING`,
  routes the local call through Ollama's native API instead when the chosen model needs "thinking"
  suppressed (see ticket 0005's finding that the OpenAI-compatible endpoint can't do this) — only
  relevant for local reasoning models, never for the cloud-swap path. One `InferenceProvider`
  handles both. See ticket 0007's log for the full reasoning, including a same-day reversal after
  briefly considering deferring cloud-swap support entirely.
- **STT dropped entirely** from scope — not required by the actual API contract.
- **No exhaustive multi-model shootout** — a scoped shortlist (~3 models) judged against a small
  hand-labeled set, not the open-ended benchmark originally sketched in `AI_COLLABORATION.md`.
- **Docker-only, local model default** (ticket 0016): native `npm start` dropped from the documented
  setup entirely; `docker compose up` alone now runs the backend against the real `phi4-mini` model
  by default (was the rule-based placeholder). Ollama itself still runs host-native, not
  containerized — [ticket 0017](docs/tickets/blocked/0017-containerize-ollama.md) tracks that as a
  separate, explicitly blocked decision (Felix is checking with Pascal whether GPU passthrough into
  a container is workable on Echory's side before committing to it, given the latency risk of
  silently falling back to CPU-only inference).
