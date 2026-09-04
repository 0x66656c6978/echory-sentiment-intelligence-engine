# Sentiment Intelligence Engine — Echory Technical Challenge

Real-time sentiment/nuance analysis engine for a simulated AI negotiation copilot, built for
Echory's Senior Full-Stack Engineer technical assessment (Track A — Full Stack).

**Status:** All required (Track A) work done. Backend, frontend, Docker, tests, LLM observability,
real LLM inference (Groq by default, local Ollama as a documented swap-in), latency/concurrency
verified end-to-end, full UI polish, `ARCHITECTURE.md` written, Track B session-summary endpoint
included. Remaining open items are explicitly optional nice-to-haves
([ticket 0011](docs/tickets/open/0011-nice-to-haves.md)). See [ROADMAP.md](ROADMAP.md) for the phase
plan and [docs/tickets/index.md](docs/tickets/index.md) for task-level tracking.

- Original challenge brief: [docs/CHALLENGE.md](docs/CHALLENGE.md)
- **Architecture** (system diagram, LLM provider choice, streaming/concurrency, sarcasm/hidden-intent
  approach, known limitations): [ARCHITECTURE.md](ARCHITECTURE.md)
- AI collaboration strategy: [AI_COLLABORATION.md](AI_COLLABORATION.md)
- **LLM model selection** (12 local + 3 cloud models benchmarked, final choice and full numbers):
  [docs/benchmark-results.md](docs/benchmark-results.md)
- **Real end-to-end latency verification** (real HTTP requests against the deployed server, not
  just the raw model call): p50 332ms, p95 366ms, 0% over the 500ms failure line — see
  [ticket 0008](docs/tickets/finished/0008-latency-concurrency-verification.md)
- **Session summary endpoint** (Track B parity, not required for Track A but implemented):
  `GET /api/telemetry/session/:session_id/summary` — returns `chunk_count`, `dominant_sentiment`,
  `aggregated_volatility_score`, and the top 3 `top_risk_moments` for a session; `404` for an
  unknown session id

## Setup

**Single command, Docker-only (tickets 0016, 0019)** — `docker compose up` brings up both the
backend and the frontend dashboard; neither has a supported native path anymore. No GPU
acceleration or host-side install step is assumed anywhere in the default path (per Pascal's
explicit answer, ticket 0018) — the one thing you need to supply is a free-tier Groq API key.

```bash
cp backend/.env.example backend/.env
# edit backend/.env: paste a free-tier key from https://console.groq.com/keys into INFERENCE_API_KEY
docker compose up --build
```

- Backend: `http://localhost:3000`, against **Groq (`qwen/qwen3.8-27b`) as the default** inference
  provider — no GPU, no local model install, nothing beyond the API key (~73MB image download, ~5s
  cold start — see [ticket 0012](docs/tickets/finished/0012-dockerize-backend.md) for the
  measurement). This default carries a measured ~14% chance of an individual call exceeding the
  500ms line, from Groq-side queue/network variance — a real, investigated tradeoff, not an
  oversight; see [ARCHITECTURE.md](ARCHITECTURE.md#llm-provider-choice-and-why) and
  [docs/benchmark-results.md](docs/benchmark-results.md) for the full measurement and why it's
  shipped as the default anyway.
- Frontend dashboard: `http://localhost:5173`, static assets served by nginx. Click
  **"INITIATE SIMULATED CALL"** — it streams a scripted 9-chunk negotiation call to the real backend
  one chunk at a time (not fixture data) and the Traffic Light / Sentiment Stream / Volatility Alert
  / Mitigation Panel all update live as each response lands.

**If you'd rather run the LLM locally** (zero latency-variance risk): two options, both fully
documented in `backend/.env.example` with zero code changes either way —
1. **Ollama installed on your host machine** — `ollama pull phi4-mini` (~2.5GB, one-time), then swap
   the three `INFERENCE_*` lines in `backend/.env` for the `host.docker.internal` block.
2. **The optional containerized Ollama**, no host install at all:
   ```bash
   docker compose --profile local-llm up --build
   ```
   Not started by a plain `docker compose up` — Pascal explicitly asked that a local LLM container
   stay optional, never a prerequisite. **No GPU is requested or assumed for this container either**
   — measured directly (not estimated): `phi4-mini` through this path took **6.3s warm**, over 15x
   its ~400ms GPU-accelerated latency on the host-native path, missing the 500ms line — unless
   you've separately configured GPU passthrough into Docker yourself. Once
   `docker compose logs ollama-pull -f` shows the pull finished, point `backend/.env` at
   `INFERENCE_BASE_URL=http://ollama:11434/v1` and restart the backend.

`LLM_PROVIDER=placeholder` (rule-based, no LLM, no API key) is also available as a manual override
if you just want to see the API/UI working. Without a configured, reachable provider, requests fail
with a clear `500` (ticket 0007's designed failure mode, not a crash) rather than silently falling
back.

### Testing

```bash
npm install
npm test   # backend unit + integration tests (Vitest)
```
