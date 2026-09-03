# 0003 — Backend testing suite

**Priority:** P0
**Phase:** 2

## Description

Add unit tests for the classification/session logic built in Phase 1, plus one integration test
that hits the live `POST /api/telemetry/stream` endpoint and validates the response against the
Zod schema from the contract (not just a snapshot — actual shape/type/enum validation). Depends
on [0001-backend-bootstrap](0001-backend-bootstrap.md).

## Definition of done

- Unit tests cover: session store behavior (no state bleed across `session_id`s), the
  request/response Zod schemas themselves (valid payload passes, malformed payload rejected)
- One integration test boots the server and posts a real chunk, asserting the response matches
  the contract
- Regression coverage for the error-response normalization from
  [0013-normalize-error-response-contract](0013-normalize-error-response-contract.md): malformed
  JSON, empty body, and missing Content-Type header must all return 400 with the same
  `{error, details}` shape as a schema-validation failure — this regressed silently once already
  before being caught by manual probing, so it needs an automated test, not just documentation
- `npm test` (or documented command) runs the full suite

## Log

### 2026-09-03 — Definition of done amended
Added the regression-coverage bullet (error-response normalization) after
[0013-normalize-error-response-contract](0013-normalize-error-response-contract.md) found and
fixed a bug in this exact area that this ticket's original scope would have caught if it existed
yet. This predates the rule requiring a Log entry for DoD edits — recorded here retroactively.

### 2026-09-03 — Implementation
Added Vitest to the backend workspace and `npm test` at both the workspace and repo-root level
(`npm run test -w backend` delegated from root). Three test files, 23 tests total:

- `src/session/store.test.ts` — session store returns undefined for an unseen session,
  accumulates chunks in order for one session, and does not bleed state between two different
  `session_id`s (positive-only vs. aggressive-only stays isolated across interleaved appends)
- `src/contract-schemas.test.ts` — `TelemetryChunkRequestSchema`/`TelemetryChunkResponseSchema`
  accept valid payloads and reject (via `it.each`) missing fields, wrong types, invalid enums,
  out-of-range acoustic values, and over-length `hidden_intent`/`mitigation_suggestion` strings
- `src/app.test.ts` — integration tests via Fastify's `.inject()` (no real network port needed):
  health check, the happy path against the real contract, and the full ticket-0013 regression
  suite (schema failure, malformed JSON, empty body, and — the sharpest case — a missing
  Content-Type header all returning 400 with the same `{error, details}` shape, not 415). A
  separate case forces `LLM_PROVIDER=inference` to make the still-stubbed provider throw,
  confirming genuine server errors stay distinct at 500 with `{error: "internal_error"}` and are
  never conflated with the 400 shape.

### 2026-09-03 — Dependency audit
`npm audit` initially showed a critical finding (Vitest UI-server arbitrary file read/execute,
<3.2.6) plus the same dev-server-only Vite/esbuild findings already accepted in ticket 0002.
Pinned `vitest` to `^3.2.6`, which resolves the critical finding while still supporting Vite 5.x
(no forced major-version jump) — confirmed via `npm view vitest@3.2.6 dependencies`. The two
remaining findings are the same already-documented, already-accepted risk from ticket 0002/0011,
now also pulled in transitively via Vitest's own tooling; not treating this as a new risk.

### 2026-09-03 — Validation
`npm test` from the repo root and `npm run test -w backend` both run all 23 tests, all passing.
Re-ran `npx tsc --noEmit` after adding the test files — clean under strict mode.
