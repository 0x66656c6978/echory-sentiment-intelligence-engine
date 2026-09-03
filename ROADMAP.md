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
- **Docker confirmed preferred by Echory** (Pascal's email, 2026-09-03) for their automated
  evaluation, alongside the native `npm start` path. He also asked for the inference endpoint to be
  configurable via env vars (base URL + model name) so Echory can point the backend at an external
  model if their container has trouble running local inference — see the provider design note below.

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

### Phase 4 — End-to-end verification & performance iteration
- Latency profiling under the real model; concurrency check (multiple sessions, no state bleed)
- Polish the 4 required UI components: Traffic Light, Sentiment Stream, Volatility Alert,
  Mitigation Panel
- `ARCHITECTURE.md`, `SETUP.md`, finalize `AI_COLLABORATION.md` with what actually happened
- Session summary endpoint (not required for Track A, cheap to add, shows completeness) — only if
  time allows

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

- **LLM strategy:** `phi4-mini` as the primary local model (`granite4.1:3b` documented swap-in —
  change `INFERENCE_MODEL` alone), chosen via ticket 0006's benchmark after an independent holdout
  check ruled out a higher-scoring but overfit alternative (`gemma4:e2b`). GPU confirmed 16GB VRAM
  via `nvidia-smi`. The inference endpoint stays **always swappable to a real external
  OpenAI-compatible endpoint** (Groq, Gemini Flash, etc.) via
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
