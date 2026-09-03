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
