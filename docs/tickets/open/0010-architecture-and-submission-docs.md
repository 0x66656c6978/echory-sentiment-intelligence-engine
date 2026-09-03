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

## Log

### 2026-09-03 — Description and DoD amended
Pascal's email confirmed Docker is preferred and explicitly asked for the download-size/
time-to-operational figures and hardware-qualified latency numbers to be in the docs — added both
as DoD bullets. The download-size numbers are already measured (see ticket 0012's log); this
ticket just needs to transcribe them into the actual submission docs.
