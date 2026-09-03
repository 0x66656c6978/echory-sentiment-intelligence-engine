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
