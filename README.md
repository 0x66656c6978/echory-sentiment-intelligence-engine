# Sentiment Intelligence Engine — Echory Technical Challenge

Real-time sentiment/nuance analysis engine for a simulated AI negotiation copilot, built for
Echory's Senior Full-Stack Engineer technical assessment (Track A — Full Stack).

**Status:** in progress — see [ROADMAP.md](ROADMAP.md) for the current phase plan and
[docs/tickets/index.md](docs/tickets/index.md) for task-level tracking.

- Original challenge brief: [docs/CHALLENGE.md](docs/CHALLENGE.md)
- AI collaboration strategy: [AI_COLLABORATION.md](AI_COLLABORATION.md)
- Architecture (technical decisions, LLM choice, limitations): `ARCHITECTURE.md` — added once the
  implementation stabilizes

## Setup

### Native (matches the evaluation harness in docs/CHALLENGE.md)

```bash
npm install
cp backend/.env.example backend/.env
npm start            # backend on http://localhost:3000
npm run dev:frontend # once the frontend exists (ticket 0002)
```

### Docker (alternative, backend only for now)

```bash
docker compose up --build
```

Runs the backend on `http://localhost:3000` using `backend/.env.example` defaults (placeholder
mode, no API keys needed). The frontend and local-LLM (Ollama) services will be added to
`docker-compose.yml` once those pieces exist.
