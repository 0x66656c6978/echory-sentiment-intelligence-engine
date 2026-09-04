# Sentiment Intelligence Engine

Real-time sentiment and nuance analysis for a simulated AI negotiation copilot — built for Echory's
Senior Full-Stack Engineer technical assessment (Track A — Full Stack).

The backend classifies live negotiation transcript chunks (transcribed speech + acoustic metadata)
into sentiment, risk level, and an actionable mitigation suggestion, using an LLM. The frontend is a
live monitoring console a negotiator would glance at during a call.

## Setup

Requires Docker. One command runs the whole app — backend and frontend both:

```bash
cp backend/.env.example backend/.env
# paste a free Groq API key (https://console.groq.com/keys) into INFERENCE_API_KEY
docker compose up --build
```

- Backend: `http://localhost:3000`
- Dashboard: `http://localhost:5173` — click **"Initiate simulated call"** to stream a scripted
  negotiation session through the real backend and watch the Traffic Light, Sentiment Stream,
  Volatility Alert, and Mitigation Panel update live.

By default, sentiment classification runs on Groq (`qwen/qwen3.8-27b`) — no GPU or local install
needed, just the API key (~73MB image download, ~5s cold start). See
[ARCHITECTURE.md](ARCHITECTURE.md) for why, including the measured latency tradeoffs behind that
choice.

`docker compose up --build` measured end-to-end (both images, fully from scratch, no build cache or
base images present locally) at **~16s** on this machine (`npm ci`: ~4-6s per service) — the build
itself isn't the bottleneck. If it takes noticeably longer than that for you, it's almost certainly
Docker Desktop's own engine/VM starting up (its first launch after a reboot commonly takes 30s-2min
on its own, independent of anything in this repo), not `npm ci` or the image build — worth checking
Docker Desktop's own status if `docker compose up` seems stuck.

### Running the LLM locally instead

If you'd rather not use a cloud API, `backend/.env.example` documents two options, both a
config-only swap:

- **Ollama on your host machine** — `ollama pull phi4-mini`, then swap in the local block from
  `backend/.env.example`.
- **A containerized Ollama, no host install**: `docker compose --profile local-llm up --build`. Not
  started by default, and runs without GPU acceleration, so expect noticeably slower responses
  (measured: ~6s vs. ~400ms) unless you've configured GPU passthrough into Docker yourself.

A rule-based `LLM_PROVIDER=placeholder` mode is also available if you just want to see the API and
UI working without any LLM at all.

### Optional: Langfuse tracing

Off by default. To turn it on, get a free account at [cloud.langfuse.com](https://cloud.langfuse.com)
and set both keys in `backend/.env`:

```
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
```

With both set, every real LLM call is recorded as a `classify-sentiment` generation (model, prompt,
response, token usage), grouped by `session_id` in Langfuse's Sessions view. Leave either key empty
(the default) and this is fully inert — no tracing SDK starts, no network calls, no latency cost. See
[ARCHITECTURE.md](ARCHITECTURE.md#observability) for how it's wired and how it was verified.

## Testing

```bash
npm install
npm test
```

## API

- `POST /api/telemetry/stream` — classify one transcript chunk. See
  [docs/CHALLENGE.md](docs/CHALLENGE.md) for the full request/response contract.
- `GET /api/telemetry/session/:session_id/summary` — aggregated summary for a session
  (`dominant_sentiment`, `aggregated_volatility_score`, top 3 `top_risk_moments`); `404` for an
  unknown session id.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — system design, LLM provider choice, concurrency handling,
  known limitations
- [AI_COLLABORATION.md](AI_COLLABORATION.md) — how AI tools were used to build this
- [docs/benchmark-results.md](docs/benchmark-results.md) — LLM benchmark methodology and full numbers
- [docs/CHALLENGE.md](docs/CHALLENGE.md) — original challenge brief
