# 0010 — ARCHITECTURE.md + submission docs

**Priority:** P0
**Phase:** 4

## Description

Write the required `ARCHITECTURE.md` (system diagram, LLM provider choice and why, streaming/
concurrency handling, sarcasm/hidden-intent approach, known limitations) and `SETUP.md`, and
finalize `AI_COLLABORATION.md` with what actually happened during the build (not just the
original plan). Optionally add the `GET /api/telemetry/session/:session_id/summary` endpoint —
not required for Track A, but cheap to add and demonstrates completeness given the reference
backend already sketches it.

Pascal (Echory CTO) emailed on 2026-09-03 confirming Docker is preferred for their automated
evaluation and asked for two specific things to be documented: the initial Docker download size
and time-to-operational, and (if available) our own response-time/latency measurements including
the hardware they were produced on.

## Definition of done

- `ARCHITECTURE.md` covers every bullet in `docs/CHALLENGE.md`'s deliverable #4 list
- `SETUP.md` (or README section) lets a stranger clone, install, configure `.env`, and run both
  backend and frontend with the documented commands, cold
- `AI_COLLABORATION.md` updated with real tool usage, effective prompts, where AI failed and how
  it was corrected, and how suggestions were validated
- Session summary endpoint added only if time remains after the above
- README/SETUP.md states the Docker image download size and measured time-to-operational (numbers
  already captured in ticket 0012's log — ~73MB compressed / ~292MB on disk, ~4.7s cold to healthy
  on Felix's dev machine), with a note that pull time varies by network speed
- ARCHITECTURE.md's latency section includes real measured numbers (from ticket 0008) alongside
  the hardware they were produced on, per Pascal's explicit request
- ARCHITECTURE.md's known-limitations section documents the accepted Vite dev-server vulnerability
  from ticket 0002's log (esbuild CORS advisory + Windows `fs.deny` bypass, both dev-server-only)
  and why it wasn't fixed (Vite 8 needs Node `^20.19.0`/`>=22.12.0`, incompatible with the Node
  21.4.0 used here, plus a different Rolldown-based plugin peer dependency)

## Log

### 2026-09-03 — Description and DoD amended
Pascal's email confirmed Docker is preferred and explicitly asked for the download-size/
time-to-operational figures and hardware-qualified latency numbers to be in the docs — added both
as DoD bullets. The download-size numbers are already measured (see ticket 0012's log); this
ticket just needs to transcribe them into the actual submission docs.

### 2026-09-03 — DoD amended again: Vite vulnerability disclosure
When asked where the Vite dev-server vulnerability (accepted in ticket 0002's log) was tracked,
found it was only narrated there — the stated intention to put it in ARCHITECTURE.md's
known-limitations section had never actually been turned into a DoD bullet here. Added it now so
it doesn't silently fall through at submission time.

### 2026-09-04 — `ARCHITECTURE.md` written; explicitly flagged as provisional per Felix's instruction

Felix: "implement 0010 but know it might change once we have an answer from Pascal" — referring to
[ticket 0017](../finished/0017-containerize-ollama.md)'s open Ollama-containerization question (at
the time this was written; resolved since — see that ticket's log).
Wrote `ARCHITECTURE.md` with that in mind: a status note at the very top names the one provisional
piece explicitly, and the Known Limitations / What's Next sections point at ticket 0017 rather than
asserting a final architecture. Everything else in the document reflects settled, already-verified
decisions (LLM choice, concurrency model, prompt design), not provisional ones.

Covers every deliverable-#4 bullet from `docs/CHALLENGE.md`: a Mermaid system diagram (frontend →
Docker-contained backend → host-native Ollama, with the Groq cloud swap shown as an alternate path);
LLM provider choice with the `phi4-mini` vs. `groq/qwen3.8-27b` comparison table and hardware
(`RTX 5080`, `16GB VRAM` confirmed via `nvidia-smi`, `Windows 11 Pro` — Pascal explicitly asked
these numbers be hardware-qualified, so stated directly in the doc rather than only linked out);
streaming/concurrency (why no WebSocket, the `SessionStore` synchronous-append argument for why a
mid-append race is structurally impossible, and ticket 0008's real concurrent-request test as the
actual evidence, including the cross-reference to the analogous frontend bug that same test design
caught); the sarcasm/hidden-intent prompt-design approach (the acoustic-contradicts-words rule, the
two tie-breaking rules added after real benchmark failures, why structured-output enforcement is a
correctness requirement here specifically, and the overfitting check that ruled out `gemma4:e2b`);
known limitations (Ollama not containerized, the Vite dev-server vulnerability with the exact
Node-version reason it wasn't fixed, in-memory session store, no auth/rate limiting, the optional
session-summary endpoint); and what's next.

Verified every markdown link in the new document resolves to a real file (`grep` + existence check,
not just visual review) before considering this done.

`README.md`'s top section updated to link directly to `ARCHITECTURE.md` (was a forward-reference to
"added once the implementation stabilizes") and to the ticket 0017 open question, replacing the
generic "Phases 1-4 done... docs are next" framing.

**Not done, deliberately, pending Felix's answer**: `AI_COLLABORATION.md`'s own header states "This
file may not be edited by an AI agent unless the user explicitly requests a formatting or a wording
change" — direct tension with this ticket's DoD bullet asking for it to be finalized with real tool
usage/prompts/failures. Did not touch it or work around the restriction; asked Felix directly how
he wants to handle it rather than silently skipping the DoD item or silently overriding his own
stated rule.

`npm test` re-confirmed passing (40/40) — this ticket's changes are documentation-only, but checked
rather than assumed.

### 2026-09-04 — Felix's answers: draft AI_COLLABORATION.md separately, implement the summary endpoint now

Asked both open questions directly rather than guessing. Felix: draft AI_COLLABORATION.md additions
to a separate scratch file for his own review/paste-in, don't touch the real file (see the standing
note above — his call was to work around the restriction by not editing it at all, not to lift the
restriction); and yes, implement the session summary endpoint now given the deadline.

**`GET /api/telemetry/session/:session_id/summary` implemented.** Extended `SessionStore` rather
than computing aggregates in the route handler, matching the existing pattern (`observability/
stats.ts` computes latency stats separately too):
- `SessionStore.append()` now also takes the original chunk `text` (route handler already had it
  from the validated request) — needed because `TelemetryChunkResponse` alone has no `text` field,
  and `RiskMomentSchema.text_excerpt` needs the real transcript, not something invented.
- `SessionStore.summarize()` computes `dominant_sentiment` (mode, ties break to whichever sentiment
  was seen first), `aggregated_volatility_score` (share of chunks with `volatility_flag` true — the
  same simpler-than-a-risk-weighted-mean definition already used by
  `frontend/src/components/AggregateTiles.tsx`, kept identical rather than inventing a second
  definition for the same concept in two places), and `top_risk_moments` (severity descending, ties
  broken by recency, capped at 3, `text_excerpt` truncated to 100 chars with an ellipsis).
- Added `API_SESSION_SUMMARY_ROUTE_PATTERN` to `@echory/contract` alongside the existing
  `API_SESSION_SUMMARY_PATH` URL-builder function — Fastify needs a `:session_id`-style pattern for
  route registration, which is a different string shape than the builder produces; one constant for
  each, not the same path shape hand-typed twice.
- Unknown `session_id` → `404 {error: "not_found", message}`, not a 200 with empty/zeroed fields —
  consistent with ticket 0013's `{error, ...}` shape convention, extended to a status code that
  convention hadn't covered yet.

Added 4 new `SessionStore.summarize()` unit tests (dominant-sentiment tie-break, volatility-score
arithmetic, risk-ranking with a recency tie-break, excerpt truncation) and 2 integration tests
(404 for an unknown session; a real session built up through the actual `POST` endpoint, then
summarized) — full suite now 46/46.

**Verified against the real Docker container, not just `npm test`** — this project is Docker-only
now (ticket 0016), so that's the environment that actually matters: rebuilt the image
(`docker compose build backend`), recreated the container, sent two real chunks through
`POST /api/telemetry/stream` to a fresh session (one calm, one an aggressive ultimatum), then
`GET` the summary and got back `chunk_count: 2`, `aggregated_volatility_score: 0.5` (1 of 2
flagged), `dominant_sentiment: "positive"` (a genuine 1-1 tie, correctly broken to first-seen), and
`top_risk_moments` correctly ordered high-risk chunk before low-risk. Also confirmed the 404 path
against the same running container for an unknown session id.

Both DoD items (`AI_COLLABORATION.md` finalization, session summary endpoint) now resolved — one
implemented and verified, one explicitly deferred per Felix's own instruction and handled outside
this ticket (draft delivered separately, not committed to the repo). Moving to `finished/`.
