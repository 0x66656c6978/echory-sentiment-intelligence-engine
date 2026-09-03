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

## Definition of done

- `ARCHITECTURE.md` covers every bullet in `docs/CHALLENGE.md`'s deliverable #4 list
- `SETUP.md` (or README section) lets a stranger clone, install, configure `.env`, and run both
  backend and frontend with the documented commands, cold
- `AI_COLLABORATION.md` updated with real tool usage, effective prompts, where AI failed and how
  it was corrected, and how suggestions were validated
- Session summary endpoint added only if time remains after the above
