# Sentiment Intelligence Engine — Echory Technical Challenge

Real-time sentiment/nuance analysis engine for a simulated AI negotiation copilot, built for
Echory's Senior Full-Stack Engineer technical assessment (Track A — Full Stack).

**Status:** Phases 1-4 done (backend, frontend, Docker, tests, LLM observability, real LLM
inference wired up and swappable to any OpenAI-compatible endpoint, latency/concurrency verified
end-to-end, full UI polish pass). `ARCHITECTURE.md`/`AI_COLLABORATION.md` finalization and
submission docs (ticket 0010) are next. See [ROADMAP.md](ROADMAP.md) for the phase plan and
[docs/tickets/index.md](docs/tickets/index.md) for task-level tracking.

- Original challenge brief: [docs/CHALLENGE.md](docs/CHALLENGE.md)
- AI collaboration strategy: [AI_COLLABORATION.md](AI_COLLABORATION.md)
- **LLM model selection** (12 local + 3 cloud models benchmarked, final choice and full numbers):
  [docs/benchmark-results.md](docs/benchmark-results.md)
- **Real end-to-end latency verification** (real HTTP requests against the deployed server, not
  just the raw model call): p50 332ms, p95 366ms, 0% over the 500ms failure line — see
  [ticket 0008](docs/tickets/finished/0008-latency-concurrency-verification.md)
- Architecture (technical decisions, LLM choice, limitations): `ARCHITECTURE.md` — added once the
  implementation stabilizes (ticket 0010)

## Setup

### Native (matches the evaluation harness in docs/CHALLENGE.md)

```bash
npm install
cp backend/.env.example backend/.env
npm start            # backend on http://localhost:3000
npm run dev:frontend # dashboard on http://localhost:5173
```

By default the backend runs the rule-based placeholder classifier (`LLM_PROVIDER=placeholder`),
no setup needed. To use the real local LLM instead:

```bash
ollama pull phi4-mini   # ~2.5GB, one-time
```

Then set `LLM_PROVIDER=inference` in `backend/.env` (the rest of the `INFERENCE_*` defaults already
point at Ollama's local OpenAI-compatible endpoint with `phi4-mini`). See
`backend/.env.example` for the full set of options — including swapping to a cloud provider like
Groq via `INFERENCE_BASE_URL`/`INFERENCE_MODEL`/`INFERENCE_API_KEY` alone, no code changes — and
[docs/benchmark-results.md](docs/benchmark-results.md) for why `phi4-mini` was chosen.

Once both are running, click **"INITIATE SIMULATED CALL"** on the dashboard — it streams a scripted
9-chunk negotiation call to the real backend one chunk at a time (not fixture data) and the Traffic
Light / Sentiment Stream / Volatility Alert / Mitigation Panel all update live as each response
lands.

### Docker (backend only — frontend runs natively for now)

```bash
docker compose up --build
```

Runs the backend on `http://localhost:3000` using `backend/.env.example` defaults (placeholder
mode, no API keys needed; ~73MB download, ~5s cold start — see
[ticket 0012](docs/tickets/finished/0012-dockerize-backend.md) for the measurement). The frontend
exists (`npm run dev:frontend`) but isn't containerized yet — not currently planned, since the
evaluation harness only needs the backend reachable.

### Testing

```bash
npm test   # backend unit + integration tests (Vitest)
```
