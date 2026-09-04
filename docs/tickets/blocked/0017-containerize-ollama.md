# 0017 — Containerize Ollama (or confirm it should stay host-native)

**Priority:** P2
**Phase:** 4

## Description

Split out of [ticket 0016](../finished/0016-docker-only-default-inference.md). Right now, `docker
compose up` runs the backend in a container, but Ollama (serving the default `phi4-mini` model)
still has to be installed and running natively on the host — the backend reaches it via
`host.docker.internal`. That's not "docker only" for the LLM piece itself, just for the app server.

Two ways to resolve this, discussed with Felix directly:

1. **Containerize Ollama too** — add an `ollama` service to `docker-compose.yml` (official
   `ollama/ollama` image, a named volume so the ~2.5GB model isn't re-pulled on every rebuild, and a
   one-shot init step or entrypoint that runs `ollama pull phi4-mini` before the backend starts).
   Fully self-contained `docker compose up`, nothing to install beforehand. **Real risk**: GPU
   passthrough into the container isn't guaranteed. Docker Desktop on Mac cannot pass a GPU through
   to a Linux container **at all**. On Windows/Linux it needs the NVIDIA Container Toolkit
   specifically configured — not a given on an arbitrary evaluation machine. Without it, `phi4-mini`
   silently falls back to CPU-only inference, which could push latency well past the scored 500ms
   failure line — exactly the kind of regression ticket 0008 worked hard to rule out for the current
   (host-native, GPU-accelerated) setup.
2. **Keep Ollama host-native** — what's running today, already verified end-to-end (ticket
   0016's log). Zero latency risk since it uses whatever GPU acceleration the host's own Ollama
   install already has configured (works correctly on Windows/Mac/Linux alike, since each platform's
   native Ollama installer handles its own GPU backend). Costs one manual install step outside
   Docker, so not literally "docker compose up" alone for the LLM.

## Definition of done

- Resolved one way or the other, based on Felix confirming with Pascal whether Echory's evaluation
  environment has working GPU passthrough into Docker (or is willing to accept CPU-only inference
  latency, which has not been measured/benchmarked and should be if this path is chosen)
- If containerizing: `ollama` service added to `docker-compose.yml` with a persistent volume and a
  model-pull step gated so the backend doesn't start hammering Ollama before the model is ready;
  latency re-verified end-to-end the same way as ticket 0008 (real HTTP requests, p50/p95, %
  over 500ms) since container-vs-host performance is exactly the open question
- If staying host-native: this ticket closes as "confirmed, no change" with Pascal's answer logged
  for the record (interview defense material)
- `README.md`/`backend/.env.example` updated either way to remove the "not yet containerized" caveat

## Log

### 2026-09-04 — Opened, blocked pending Pascal's input

Felix: "I'll ask Pascal. Let's put this on hold but make sure it's documented as something we need
to clarify and then implement." Not a technical blocker on my end — a genuine external-input
blocker, so filed under `blocked/` per the project's ticket-status convention rather than left as an
implicit TODO. See ticket 0016's log for the full context of how this came up (fixing the
`docker compose up` env-file bug surfaced the question of what "Docker-only" should mean for Ollama
specifically).
