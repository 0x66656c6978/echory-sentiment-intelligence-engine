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
