# 0019 — Dockerize the frontend, add the optional local-LLM container

**Priority:** P0
**Phase:** 4

## Description

Two follow-ups from Felix after reviewing ticket 0018:

1. Echory wants to run the **whole** app with a single command — this reopens ticket 0009's
   decision ("frontend not containerized, not currently planned") and ticket 0016/0018's framing
   ("Docker-only" meant the backend only). The frontend now needs its own container, brought up by
   the same `docker compose up` as the backend.
2. Implement the optional local-LLM container that [ticket 0017](0017-containerize-ollama.md) and
   [ticket 0018](0018-groq-default-per-pascal.md) deferred — Pascal explicitly welcomed this as an
   *addition*, not a requirement. Must stay strictly optional (never started by a plain
   `docker compose up`) and must not assume or request GPU acceleration (Pascal's explicit ask,
   ticket 0018) — state plainly that it will be slow without it.

Also: Felix raised a third inference-provider idea — firing two concurrent Groq requests and using
whichever returns first, to reduce exposure to the measured ~14% tail-latency risk. Considered,
not implemented (see this ticket's log for why), documented for the record / Loom talking points.

## Definition of done

- `frontend/Dockerfile` builds the dashboard as static assets, served by a real web server (not a
  dev server) — `docker compose up` (no flags) starts both `backend` and `frontend`
- Backend's `http://localhost:3000` reachability and existing behavior are unaffected
- The optional local-LLM container(s) are gated behind a Compose profile — verified, not assumed,
  that a plain `docker compose up` does *not* start them
- Docs and comments state plainly that the optional container has no GPU acceleration and will be
  meaningfully slower than the documented GPU-accelerated numbers
- The concurrent-Groq-requests idea is written up somewhere findable (this ticket), with the actual
  reasoning for not implementing it
- Verified end-to-end: real `docker compose up --build` brings up a working dashboard that
  successfully talks to the real backend

## Log

### 2026-09-04 — Concurrent-Groq-requests idea: considered, not implemented

Felix: fire two Groq requests concurrently for every chunk, use whichever comes back first, as a
mitigation for the measured ~14% chance of a single request exceeding 500ms. Real idea, correctly
reasoned through by Felix himself before raising it: doubling outbound request volume doubles
exposure to Groq's per-key rate limits (free-tier: 8000 TPM, already hit once during ticket 0015's
benchmarking under much lighter load than a real evaluation run). Since Echory's automated test
harness's actual request volume/rate isn't known, deliberately choosing to double our own request
rate against an unknown ceiling is a real risk, not a hypothetical one — could turn an occasional
slow response into a burst of hard failures instead. Not implemented. Documented here (and
available to reuse directly for Loom notes) rather than either silently dropped or built without
being asked to.

### 2026-09-04 — Frontend dockerized

`frontend/Dockerfile`: multi-stage build, `node:20-alpine` compiles the static assets
(`npm run build -w frontend` — the same command already used natively), `nginx:alpine` serves the
result. Build context is the repo root, same reason as `backend/Dockerfile`: the frontend depends
on the `@echory/contract` workspace package.

**Real bug found and fixed during the first build attempt**: `tsc -b` failed with
`Cannot read file '/app/tsconfig.base.json'` — `frontend/tsconfig.json` (like `backend/tsconfig.json`)
extends a root-level `tsconfig.base.json` that the Dockerfile never copied in. This never surfaced
for the backend's own Dockerfile because its `CMD` runs `tsx src/index.ts` directly — `tsx`
transpiles on the fly and never invokes `tsc`, so a missing project-reference config was never
exercised there. The frontend's build step genuinely runs `tsc -b`, so it hit a gap that had been
latent (silently correct only by accident, not by design) since the backend Dockerfile was written.
Fixed by copying `tsconfig.base.json` alongside the other root files already copied in.

`docker-compose.yml`: added a `frontend` service (build from `frontend/Dockerfile`, port `5173:80`
— same port the native dev server already used, so existing docs/instincts about "the dashboard is
on 5173" stay correct), `depends_on: backend` (ordering only, not a hard gate). No env var or
runtime config needed — the dashboard's `lib/api.ts` calls `http://localhost:3000` directly from
the *browser*, not from inside the frontend container, so containerizing the frontend doesn't
change how it reaches the backend at all.

### 2026-09-04 — Optional local-LLM container added, gated by a Compose profile

Added `ollama` (official `ollama/ollama` image, a named volume so the ~2.5GB model persists across
container recreation) and `ollama-pull` (one-shot, waits for `ollama`'s healthcheck, then
`ollama pull phi4-mini`) to `docker-compose.yml`, both under `profiles: ["local-llm"]`. Verified
directly, not assumed, that this actually gates them: `docker compose config --services` lists only
`backend`/`frontend` by default, and only lists `ollama`/`ollama-pull` too when invoked with
`--profile local-llm` — a plain `docker compose up` genuinely never touches either.

No GPU reservation requested in either service definition, deliberately — per Pascal's explicit ask
not to assume GPU acceleration in a container. Stated plainly, in both `docker-compose.yml`'s
comments and `backend/.env.example`, that this means meaningfully slower (likely multi-second,
probably missing the 500ms line) CPU-only inference compared to the GPU-accelerated numbers
documented elsewhere in this repo — a real, named tradeoff of opting into this path, not left
implicit. `backend/.env.example` documents both local-Ollama variants side by side now: host-native
(`host.docker.internal`) and this new containerized one (`ollama`, the Compose service's own DNS
name on the shared default network) — same `InferenceProvider`, zero code changes for either.

### 2026-09-04 — Real bug found during verification: Groq rejected every request outright (429)

First real end-to-end check (`docker compose up -d` after the frontend build, then a real browser
session against `http://localhost:5173`) failed immediately: every chunk came back
`NO SIGNAL — BACKEND RESPONDED 500`. Checked `docker compose logs backend` rather than guessing, and
found the real cause: Groq responded `429`, `"Request too large for model qwen/qwen3.8-27b ... on
output tokens per minute (OTPM): Limit 1000, Requested 1299."` `InferenceProvider.callOpenAiCompatible`
never set `max_tokens` at all — without it, Groq apparently sizes its per-minute rate-limit check
against the model's full remaining context as the worst-case possible output, not the classification
task's actual few-hundred-token response, so the request was rejected before it ever ran. Unrelated
to this ticket's actual scope (frontend Docker, optional Ollama) but a real, previously-latent bug
in the shipped Groq default path -- found only because this ticket's own verification step forced a
real end-to-end request through it, on this account/key, for the first time since the max-tokens gap
was introduced.

Fixed by adding `max_tokens: 500` to `callOpenAiCompatible`'s request body -- generous headroom for
a small fixed-shape JSON response (`hidden_intent` <=60 chars, `mitigation_suggestion` <=120 chars,
plus a handful of short fields), comfortably clear of the account's per-minute limit. Added a unit
test asserting `max_tokens` is always set and positive (`inference.test.ts`) -- the existing mocked
tests never would have caught this, since the fake `fetch` always "succeeds" regardless of what's in
the request body; only a real call to Groq surfaced it. Full suite: 47/47.

### 2026-09-04 — End-to-end verification, for real

Rebuilt the backend image with the fix, recreated the container, and ran a full real browser session
against `http://localhost:5173` (nginx-served, from the new `frontend` container) against the real
`backend` container: all 9 scripted chunks classified correctly and live — `SARCASTIC`/`HIGH RISK`,
`AGGRESSIVE`/`CRITICAL RISK`, `VOLATILE` tags, the risk-signal lamp and mitigation panel updating in
real time, aggregate tiles computing correctly (`0.43` volatility index, `negative` dominant tone at
that point in the session) — read back via the rendered page text, not just a screenshot. One
command (`docker compose up --build`) genuinely brings up a working, fully-networked two-container
stack.

### 2026-09-04 — Optional profile verified fully, including a real classification through it

The `ollama`/`ollama-pull` pull (started in the previous log entry) finished mid-session on Felix's
connection (70MB/s — `ollama-pull` exited `0`, `ollama` reported healthy) — a genuine full run, not
cut short as originally expected. Took the opportunity to verify all the way through rather than
stop at "the containers start": pointed `backend/.env` at `INFERENCE_BASE_URL=http://ollama:11434/v1`,
`INFERENCE_MODEL=phi4-mini` (the Compose service's own DNS name, reachable because both containers
share the default network regardless of which one required the `--profile` flag to start), recreated
just the backend service, and sent two real requests:

- First (cold model load): 21,124ms.
- Second (warm): **6,283ms** — correct classification (`sarcastic`/`high`/`volatile`), just slow.

6.3 seconds warm, CPU-only, is the real number behind this ticket's "meaningfully slower" warning —
not a guess. Over **15x** `phi4-mini`'s GPU-accelerated warm latency (~330-400ms, tickets 0006/0008)
for the identical model and prompt; comfortably past the 500ms line even warmed up, confirming the
documented risk of enabling this path without GPU passthrough is real and roughly quantified, not
theoretical. Restored `backend/.env` to the real Groq default afterward and confirmed it still works
(395ms, correct classification) before stopping the optional `ollama`/`ollama-pull` containers
(`docker compose --profile local-llm stop`) — pulled model data persists in the `ollama_data` volume
for next time. `ARCHITECTURE.md`/`README.md` updated to cite this measured 6.3s figure directly
instead of an estimated "likely several seconds."

Moving to `finished/`.
