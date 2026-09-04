# Sentiment Intelligence Engine — Echory Technical Challenge

Real-time sentiment/nuance analysis engine for a simulated AI negotiation copilot, built for
Echory's Senior Full-Stack Engineer technical assessment (Track A — Full Stack).

**Status:** Phases 1-4 done (backend, frontend, Docker, tests, LLM observability, real LLM
inference wired up and swappable to any OpenAI-compatible endpoint, latency/concurrency verified
end-to-end, full UI polish pass, `ARCHITECTURE.md` written). One open architectural question
remains — see [ticket 0017](docs/tickets/blocked/0017-containerize-ollama.md) — blocked on Pascal's
input, not on anything technical. See [ROADMAP.md](ROADMAP.md) for the phase plan and
[docs/tickets/index.md](docs/tickets/index.md) for task-level tracking.

- Original challenge brief: [docs/CHALLENGE.md](docs/CHALLENGE.md)
- **Architecture** (system diagram, LLM provider choice, streaming/concurrency, sarcasm/hidden-intent
  approach, known limitations): [ARCHITECTURE.md](ARCHITECTURE.md)
- AI collaboration strategy: [AI_COLLABORATION.md](AI_COLLABORATION.md)
- **LLM model selection** (12 local + 3 cloud models benchmarked, final choice and full numbers):
  [docs/benchmark-results.md](docs/benchmark-results.md)
- **Real end-to-end latency verification** (real HTTP requests against the deployed server, not
  just the raw model call): p50 332ms, p95 366ms, 0% over the 500ms failure line — see
  [ticket 0008](docs/tickets/finished/0008-latency-concurrency-verification.md)

## Setup

**Docker-only, by design (ticket 0016)** — per Pascal's explicit preference for Docker (his email,
2026-09-03), the backend has no supported native `npm start` path anymore; it always runs in a
container. The one external prerequisite Docker can't provide itself is Ollama (see the note below).

### Backend

```bash
ollama pull phi4-mini   # ~2.5GB, one-time -- see the prerequisite note below
docker compose up --build
```

Runs the backend on `http://localhost:3000` with **the real local LLM (`phi4-mini`) as the default**
— `docker compose up` alone, no `.env` file needed, exercises the actual thing being evaluated, not
a rule-based stand-in (~73MB image download, ~5s cold start — see
[ticket 0012](docs/tickets/finished/0012-dockerize-backend.md) for the measurement; the LLM's own
cold-start model load adds a few more seconds on the very first request).

**Prerequisite**: Ollama must be installed and running natively on the host with `phi4-mini` pulled
(`ollama pull phi4-mini`) — it is **not yet containerized** (open question, see
[ticket 0017](docs/tickets/blocked/0017-containerize-ollama.md), blocked on confirming GPU
passthrough is workable on Echory's side). Without Ollama running, requests fail with a clear
`500` (ticket 0007's designed failure mode, not a crash) rather than silently falling back.

**If Ollama has trouble on your side**, switching to a cloud provider needs zero code changes — edit
`backend/.env` (falls back to `.env.example`'s defaults if this file doesn't exist; create it with
`cp backend/.env.example backend/.env` first) and replace the three `INFERENCE_*` lines with the
Groq block already commented in that file, then `docker compose up -d` to pick it up. See
`backend/.env.example` for the full set of options — including the rule-based `LLM_PROVIDER=placeholder`
fallback if you'd rather not install Ollama or hold an API key at all — and
[docs/benchmark-results.md](docs/benchmark-results.md) for why `phi4-mini` was chosen over Groq by
default despite Groq's own accuracy edge.

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
