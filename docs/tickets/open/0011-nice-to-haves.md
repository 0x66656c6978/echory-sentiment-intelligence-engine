# 0011 — Nice-to-haves (only if time remains)

**Priority:** P2
**Phase:** 5

## Description

Bucket ticket for optional polish, only attempted after everything in Phases 1-4 is done and
submission-ready with time to spare on Saturday:

- Scripted chunk-streaming simulator over WebSocket — build only if it turns out to help generate
  the Phase 3 test set faster, or as a very-last Loom-demo polish item. Judges bring their own
  test payloads, so this is cosmetic, not scoring-relevant. Do not start this before the rest of
  the roadmap is done.
- Diagnostics/maintenance view
- Any further UI polish beyond the required four components
- Upgrade frontend to Vite 8+ to resolve the dev-server-only vulnerabilities accepted in ticket
  0002's log (esbuild CORS advisory, Windows `fs.deny` bypass). Requires bumping Node to
  `^20.19.0`/`>=22.12.0` first (current dev environment is on 21.4.0) and migrating to the
  Rolldown-based `@vitejs/plugin-react` peer dependency — not a drop-in version bump. Not
  scoring-relevant (dev-server only, doesn't ship in the production build), so genuinely last
  in line.

## Definition of done

N/A — this ticket is a scope container, not a single deliverable. Split off a dedicated ticket
per item only if actually started.

## Log

### 2026-09-03 — Description amended
Added the Vite upgrade as a candidate item after confirming it wasn't tracked anywhere as
actionable work (it only existed as a narrative note in ticket 0002's log). This is the
appropriate home for it: a real fix exists, but it's disproportionate effort for a dev-only,
non-scoring risk under this deadline, so it belongs in the "only if time remains" bucket rather
than blocking anything.
