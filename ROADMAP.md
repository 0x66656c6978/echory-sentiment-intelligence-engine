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
  acceptable as long as the setup (`ollama pull ...`) is clearly documented; a cloud fallback provider
  is still built in as a latency safety net.
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
- Quick hardware probe (tokens/sec on available GPU) before committing to model sizes
- Shortlist ~3 local models across the size range (one fast ~3B baseline, one or two ~7-8B quality
  candidates) rather than an exhaustive sweep
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

- **LLM strategy:** local model via Ollama as primary (GPU available, 8GB+ VRAM), with a documented
  cloud free-tier fallback (Groq or Gemini Flash) — de-risks the latency-scored dimension without
  abandoning the local-first approach. Implemented as a single generic `InferenceProvider` configured
  via `INFERENCE_BASE_URL`/`INFERENCE_MODEL`/`INFERENCE_API_KEY` (Ollama exposes an OpenAI-compatible
  endpoint, so the same code serves local and cloud) rather than two hardcoded provider classes —
  corrected from an earlier `LLM_PROVIDER=local|cloud` design after Pascal's explicit request for
  base-URL+model configurability (see ticket 0007's log).
- **STT dropped entirely** from scope — not required by the actual API contract.
- **No exhaustive multi-model shootout** — a scoped shortlist (~3 models) judged against a small
  hand-labeled set, not the open-ended benchmark originally sketched in `AI_COLLABORATION.md`.
