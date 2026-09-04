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

**Docker-only, by design (ticket 0016)** — the backend has no supported native `npm start` path;
it always runs in a container. No GPU acceleration or host-side install step is assumed anywhere in
the default path (per Pascal's explicit answer, ticket 0018) — the one thing you need to supply is
a free-tier Groq API key.

### Backend

```bash
cp backend/.env.example backend/.env
# edit backend/.env: paste a free-tier key from https://console.groq.com/keys into INFERENCE_API_KEY
docker compose up --build
```

Runs the backend on `http://localhost:3000` against **Groq (`qwen/qwen3.8-27b`) as the default**
inference provider — no GPU, no local model install, nothing beyond the API key (~73MB image
download, ~5s cold start — see [ticket 0012](docs/tickets/finished/0012-dockerize-backend.md) for
the measurement). This default carries a measured ~14% chance of an individual call exceeding the
500ms line, from Groq-side queue/network variance — a real, investigated tradeoff, not an oversight;
see [ARCHITECTURE.md](ARCHITECTURE.md#llm-provider-choice-and-why) and
[docs/benchmark-results.md](docs/benchmark-results.md) for the full measurement and why it's shipped
as the default anyway.

**If you'd rather run the LLM locally** (zero latency-variance risk, but needs Ollama installed on
the host — the one path in this project that isn't purely `docker compose up`): swap the three
`INFERENCE_*` lines in `backend/.env` for the local-Ollama block already in `backend/.env.example`,
run `ollama pull phi4-mini` (~2.5GB, one-time) on the host, then `docker compose up -d` to pick up
the change. `LLM_PROVIDER=placeholder` (rule-based, no LLM, no API key) is also available as a
manual override if you just want to see the API/UI working — see `backend/.env.example` for the
full set of options. Without a configured, reachable provider, requests fail with a clear `500`
(ticket 0007's designed failure mode, not a crash) rather than silently falling back.

### Frontend

```bash
npm install
npm run dev:frontend # dashboard on http://localhost:5173
```

Not containerized (not currently planned — the evaluation harness only needs the backend reachable).
Once the backend is running, click **"INITIATE SIMULATED CALL"** on the dashboard — it streams a
scripted 9-chunk negotiation call to the real backend one chunk at a time (not fixture data) and the
Traffic Light / Sentiment Stream / Volatility Alert / Mitigation Panel all update live as each
response lands.

### Testing

```bash
npm test   # backend unit + integration tests (Vitest)
```
