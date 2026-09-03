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
- Hardware probe done (ticket 0005, `docs/hardware-probe-results.md`): real numbers narrowed the
  field further than expected. Only `llama3.2:1b` (1B, 174ms avg) clears the 250ms target with
  headroom; `qwen3.5:4b` (566ms), `qwen3:8b` (1040ms), and `qwen3.5:9b` (1472ms) all miss it. Also
  found every currently-pulled model defaults to a "thinking" mode that Ollama's OpenAI-compatible
  endpoint can't suppress (only its native API can) — affects ticket 0007's provider design
  depending on which model gets chosen.
- This creates a real tension with Nuance Detection Accuracy (30% weight): benchmark
  `llama3.2:1b`'s actual quality rather than assuming a 1B model is sufficient just because it's
  fast, and treat the cloud fallback as a serious primary contender if the quality gap is large
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

- **LLM strategy:** local model via Ollama as primary (GPU confirmed 16GB VRAM via `nvidia-smi`),
  with the inference endpoint **always swappable to a real external OpenAI-compatible endpoint**
  (Groq, Gemini Flash, etc.) via `INFERENCE_BASE_URL`/`INFERENCE_MODEL`/`INFERENCE_API_KEY` alone —
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
