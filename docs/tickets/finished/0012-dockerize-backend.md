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

### 2026-09-04 — Fixed: `docker compose up` silently ignored `backend/.env`

Felix tried testing `LLM_PROVIDER=inference` via Docker after editing `backend/.env`, and the
container kept running `placeholder` regardless. Root cause: `docker-compose.yml`'s `env_file`
pointed only at `backend/.env.example` (this ticket's original, correct call at the time — the
zero-setup DoD requirement above, written before ticket 0007's real inference path existed) and
never read `backend/.env` at all, so no edit to it could ever reach the container.

Fixed by layering both files: `env_file: [backend/.env.example, path: backend/.env, required:
false]` (Compose Specification long-form, confirmed supported — installed Compose is v5.5.0).
`.env.example` still provides the zero-setup baseline on a fresh clone (satisfies this ticket's
original DoD, `required: false` means Compose doesn't error when `backend/.env` doesn't exist yet),
and `backend/.env` now overrides it when present — Docker finally honors the same file the native
`npm start` path already does.

Fixing that surfaced a second, separate issue: with `LLM_PROVIDER=inference` actually taking effect,
the request failed with `ECONNREFUSED` — `INFERENCE_BASE_URL=http://localhost:11434/v1` doesn't
reach the host's Ollama from inside the container (`localhost` there means the container itself).
Not a bug in the app (the 500 + clear error is exactly ticket 0007's designed failure mode) — a
standard Docker networking fact. Fixed by pointing `backend/.env` at
`http://host.docker.internal:11434/v1` instead (Docker Desktop resolves this to the host on
Windows/Mac with no extra config). Documented in `backend/.env.example` and `README.md`, including
the one caveat this creates: `backend/.env` is now read by both the native and Docker paths, but the
correct host differs between them, so switching between the two means switching this one line.

Verified end-to-end for real, not just config review: recreated the container
(`docker compose up -d`), confirmed the startup log now says `Sentiment provider: inference`, sent a
real request that failed with the exact predicted `ECONNREFUSED` before the host-address fix, then
sent it again after the fix and got a genuine `phi4-mini` classification back (3.2s cold model
load on the first call, 514ms on the second, consistent with the cold/warm pattern from tickets
0006-0008).

### 2026-09-04 — Build-time double-check: couldn't reproduce a slow `npm ci`, found what it likely was
Felix recalled a manual `docker build --no-cache` run (around the time of the `.env`-loading bug
above) taking a few minutes and appearing to hang on `npm ci`, with no logging to explain why, and
asked to double/triple-check current build times before trusting them. Measured for real rather than
guessing:
- `docker compose build --no-cache` with the existing local BuildKit cache warm (base images already
  pulled from earlier builds this session): **13.3s** total, `npm ci` 3.8s (frontend) / 4.8s
  (backend).
- Same build after `docker builder prune -af` (wipes the *entire* BuildKit cache, including base
  image layers — the closest reproduction of a genuinely first-ever build on this machine): **16.0s**
  total, `npm ci` 4.3s / 5.5s. Base image pulls (`node:20-alpine`, `nginx:alpine`) added under 2s
  combined — not the bottleneck either.

Confirmed first: `.dockerignore` correctly excludes `node_modules`/`.git`/`dist` (build context is
~360KB, not gigabytes) — ruled out a bloated context transfer being mistaken for a hung `npm ci`.
Could not reproduce anything close to "a few minutes" even from a fully wiped build cache, so the
earlier experience likely wasn't the build itself — the most probable explanation is Docker
Desktop's own engine/VM cold-starting at that moment (a first launch after a reboot commonly takes
30s-2min independent of anything in this repo), which can make whatever step happens to be printing
last in the terminal look like it's the thing hanging. Documented honestly in `README.md`
(current real numbers, plus the Docker-Desktop-startup caveat) rather than asserting a root cause
that wasn't directly confirmed.
