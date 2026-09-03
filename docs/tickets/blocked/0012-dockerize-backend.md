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

## Status

**Blocked** — Docker isn't installed in the agent sandbox this was built in, so `docker build`/
`docker compose up` couldn't be run directly. Instead, the exact layered-copy + install + start
sequence the Dockerfile encodes was simulated in a scratch directory with real `npm ci`/
`npm run start -w backend`, and it booted and served `/health` correctly — the workspace
resolution and script wiring are sound. What's NOT verified: an actual container build (Alpine
base image, musl libc) and `docker compose up` itself. All current dependencies (fastify, zod,
@fastify/cors, tsx) are pure JS with no native bindings, so risk is low, but this needs a real run
on a machine with Docker before the ticket can move to finished.

**Action needed:** run `docker compose up --build` from the repo root and confirm `curl
http://localhost:3000/health` and a real `POST /api/telemetry/stream` both work as they did
natively in ticket 0001.

**Update:** Docker isn't installed on Felix's machine either, so nobody in this loop can currently
run the real verification. Not worth chasing further right now — it's not required by the
evaluation harness, Pascal hasn't confirmed he even wants it, and the native `npm start` path
(which is what's actually scored) is unaffected either way. Pausing this ticket; revisit if Docker
becomes available or Pascal's answer comes back positive. Resuming work on ticket 0002 in the
meantime.

## Definition of done

- `backend/Dockerfile` builds from the monorepo root context (needed because `backend` depends on
  the `@echory/contract` workspace package)
- `docker-compose.yml` at repo root runs the backend service, mapping port 3000, defaulting to
  `backend/.env.example` so `docker compose up` works with zero setup in placeholder mode
- Native `npm start` path still works unmodified — verified, not assumed
- `docker compose up` verified end-to-end with the same curl checks used for ticket 0001
  (valid request classified correctly, malformed request rejected with 400)
- README documents both paths (native npm, and `docker compose up` as an alternative)
