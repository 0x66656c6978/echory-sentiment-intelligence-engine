# 0012 — Dockerize backend

**Priority:** P1
**Phase:** 1

## Description

Your original `AI_COLLABORATION.md` Phase 1 plan called for dockerizing the setup; this was
dropped when the roadmap was iterated and not re-surfaced until asked about directly. Adding it
back in now, pragmatically: the evaluation harness in `docs/CHALLENGE.md` explicitly runs the
backend via plain `npm install` / `npm start` on `localhost:3000` — that path must keep working
unmodified. Docker is an **additional** convenience on top of it, not a replacement, pending
Pascal's confirmation that `docker compose` is an acceptable way for them to run it too.

Only the backend is containerized in this ticket, since the frontend doesn't exist yet
(ticket 0002). The compose file should be extended once the frontend and local LLM (Ollama)
pieces land.

## Definition of done

- `backend/Dockerfile` builds from the monorepo root context (needed because `backend` depends on
  the `@echory/contract` workspace package)
- `docker-compose.yml` at repo root runs the backend service, mapping port 3000, defaulting to
  `backend/.env.example` so `docker compose up` works with zero setup in placeholder mode
- Native `npm start` path still works unmodified — verified, not assumed
- `docker compose up` verified end-to-end with the same curl checks used for ticket 0001
  (valid request classified correctly, malformed request rejected with 400)
- README documents both paths (native npm, and `docker compose up` as an alternative)

## Log

### 2026-09-03 — Initial build (blocked)
Docker isn't installed in the agent sandbox this was built in, so `docker build`/`docker compose
up` couldn't be run directly. Instead, the exact layered-copy + install + start sequence the
Dockerfile encodes was simulated in a scratch directory with real `npm ci`/`npm run start -w
backend`, and it booted and served `/health` correctly — the workspace resolution and script
wiring are sound. What wasn't verified: an actual container build (Alpine base image, musl libc)
and `docker compose up` itself. All dependencies (fastify, zod, @fastify/cors, tsx) are pure JS
with no native bindings, so risk was assessed as low, but a real run on a machine with Docker was
needed before this could move to finished. Marked blocked rather than claiming an unperformed
verification.

### 2026-09-03 — Docker installed, verified end-to-end
Docker Desktop installed via `winget install Docker.DockerDesktop` at the user's request (WSL2
backend, already had Ubuntu WSL2 set up). Ran the real verification:

```
docker compose up --build -d
curl http://localhost:3000/health                        → {"status":"ok",...}
POST /api/telemetry/stream (realistic sarcastic payload)  → aggressive/critical, matches native run exactly
POST /api/telemetry/stream (malformed payload)            → 400 with the same field-level Zod errors
docker compose down                                       → clean teardown
```

Native `npm start` path re-confirmed unaffected. Unblocked and finished.

### 2026-09-03 — Cold-start measurement (per Pascal's request)
Pascal's email confirmed Docker is preferred by Echory and asked for the initial download size and
time-to-operational to be documented. Measured with a genuinely cold state (removed both the built
image and the `node:20-alpine` base image first, confirmed via `docker images` before rerunning):

- `docker compose up --build -d` returned in ~3.7s
- `GET /health` first responded 200 at ~4.7s total from a cold start
- Final image: 72.7MB compressed content size, 292MB on-disk (uncompressed layers)

Measured on Felix's dev machine (Windows 11 Pro, Docker Desktop/WSL2 backend); actual pull time on
Echory's side will vary with their network speed, but the image itself is small (Alpine base +
pure-JS deps, no native compilation) so this should stay fast on most connections. Full numbers
will go into README/SETUP.md via ticket 0010.
