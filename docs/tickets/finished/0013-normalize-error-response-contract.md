# 0013 — Normalize error response contract

**Priority:** P1
**Phase:** 2 (discovered ahead of ticket 0003's formal test suite, during ad hoc edge-case probing
requested outside the sequential ticket order)

## Description

Ticket 0001's manual validation only checked the happy path plus one "missing required fields"
case, which does return a clean `{error: "invalid_request", details: {...}}` 400. Probing further
edge cases surfaced three genuinely different error shapes depending on failure mode:

| Input | Status | Shape |
|---|---|---|
| Missing/wrong-typed fields, bad enum, out-of-range values | 400 | `{error: "invalid_request", details: {...}}` (ours, via Zod `safeParse` in the route) |
| Malformed JSON syntax | 400 | Fastify's raw internal shape (`{statusCode, code: "FST_ERR_CTP_INVALID_JSON_BODY", error, message}`) |
| Empty body | 400 | Fastify's raw internal shape (different `code`) |
| Missing `Content-Type` header | **415**, not 400 | Fastify's raw internal shape again |

This leaks framework internals inconsistently and gives API consumers (including our own frontend,
about to be built in ticket 0002) three different shapes to handle instead of one contract. The
415-instead-of-400 case is the sharpest edge: a client that simply forgets a header gets a
completely different status code than one that sends a slightly-wrong payload, for what is
conceptually the same failure ("this request can't be turned into a valid TelemetryChunkRequest").

## Resolution

Added a single `app.setErrorHandler` in `backend/src/app.ts` that normalizes every error Fastify
raises outside our own route handlers into `{error: "invalid_request", details: {...}}` at 400 —
including the previously-415 missing-Content-Type case. Genuine unexpected/server-side errors
(anything with no client-facing `statusCode`, e.g. a provider throwing) are kept distinct at 500
with a generic `{error: "internal_error", ...}` shape that doesn't leak internals. Zod validation
failures inside `telemetryRoutes` are unaffected — they reply directly and never reach this
handler.

Before/after, all six probed cases plus the original ticket-0001 happy path:

| Case | Before | After |
|---|---|---|
| Missing fields (schema) | 400, `{error, details}` | 400, `{error, details}` (unchanged) |
| Wrong type / bad enum / out-of-range (schema) | 400, `{error, details}` | 400, `{error, details}` (unchanged) |
| Malformed JSON syntax | 400, Fastify's raw shape | 400, `{error, details}` |
| Empty body | 400, Fastify's raw shape | 400, `{error, details}` |
| Missing Content-Type header | **415**, Fastify's raw shape | **400**, `{error, details}` |
| Unimplemented provider (genuine server error) | unhandled → Fastify default 500 | 500, `{error: "internal_error", ...}` (distinct, no leak) |
| Happy path | 200, contract response | 200, contract response (unchanged) |

## Definition of done

- A single Fastify-level error handler normalizes every non-5xx error (bad JSON, empty body, wrong
  content-type, anything else Fastify itself rejects before reaching the route) into the same
  `{error: "invalid_request", details: {...}}` shape and always 400, not 415
- Unexpected server-side errors (5xx) get a separate, generic `{error: "internal_error", ...}`
  shape that doesn't leak internals — distinct from client-error handling, not lumped in with it
- All 6 edge cases from the investigation re-tested and confirmed uniform (see commit for the
  actual before/after curl output)
- Ticket 0003 (backend testing suite) should add regression tests for this exact behavior so it
  doesn't silently regress — noted there, not duplicated here
