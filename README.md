# Sentiment Intelligence Engine — Echory Technical Challenge

Real-time sentiment/nuance analysis engine for a simulated AI negotiation copilot, built for
Echory's Senior Full-Stack Engineer technical assessment (Track A — Full Stack).

**Status:** Phases 1-2 done (backend, frontend, Docker, tests, LLM observability). The local LLM
has been selected (`phi4-mini`, see below) — wiring it into the real inference call (ticket 0007)
is next. See [ROADMAP.md](ROADMAP.md) for the phase plan and
[docs/tickets/index.md](docs/tickets/index.md) for task-level tracking.

- Original challenge brief: [docs/CHALLENGE.md](docs/CHALLENGE.md)
- AI collaboration strategy: [AI_COLLABORATION.md](AI_COLLABORATION.md)
- **LLM model selection** (12 local + 3 cloud models benchmarked, final choice and full numbers):
  [docs/benchmark-results.md](docs/benchmark-results.md)
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
