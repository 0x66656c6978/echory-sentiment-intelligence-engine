# 0002 — Frontend bootstrap

**Priority:** P0
**Phase:** 1

## Description

Stand up a Vite + React + Tailwind frontend that connects to the backend from
[0001-backend-bootstrap](0001-backend-bootstrap.md) and renders raw analysis results as they
arrive, proving the end-to-end pipeline. UI polish (Traffic Light, Sentiment Stream, Volatility
Alert, Mitigation Panel) comes later in Phase 4 — this ticket is about the working connection,
not the final design.

## Definition of done

- `npm run dev:frontend` (or documented command) launches the dashboard
- Dashboard successfully receives and displays results from a manually-triggered backend request
- No design polish required yet — plain list/log view is sufficient

## Log

### 2026-09-03 — Implementation
Vite + React + TypeScript + Tailwind, workspace package `frontend`. Fixture-backed list view
(`src/fixtures.ts`, two hand-written examples matching the contract exactly) and a real fetch path
(`src/lib/api.ts`, isolated single call site) share one render list in `App.tsx` — a "Send test
chunk to backend" button hits the real endpoint and prepends to the same list the fixtures render
into, so there's one code path, not two. Errors from the fetch are caught and shown as a
"Not connected to backend" message rather than crashing.

### 2026-09-03 — Dependency audit
`npm audit` flagged a moderate esbuild dev-server CORS advisory and a high-severity Vite
`server.fs.deny` bypass on Windows (both dev-server-only, not present in production builds).
Bumped to the latest Vite 5.x patch (5.4.21) which was a safe same-major update, but the full fix
needs Vite 8 — checked, and it requires Node `^20.19.0 || >=22.12.0` (our Node 21.4.0 satisfies
neither range) plus a fundamentally different Rolldown-based `@vitejs/plugin-react` peer
dependency, not a drop-in bump. Decided this is a disproportionate migration for a localhost-only,
dev-server-only vulnerability under this deadline — documented as an accepted, reasoned risk
rather than silently ignored or force-fixed. Worth revisiting if time allows, and worth a mention
in ARCHITECTURE.md's known-limitations section (ticket 0010).

### 2026-09-03 — Validation
Ran both dev servers and exercised the real app in a browser (not just type-checking): fixtures
render correctly on load; clicking "Send test chunk to backend" round-trips a real request (visible
in network tab: OPTIONS preflight 204, POST 200) and prepends the live-classified result above the
fixtures; stopping the backend and retrying shows the graceful "Not connected to backend: Failed to
fetch" message with existing results left untouched. No console errors in any state.
