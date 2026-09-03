# 0001 — Backend bootstrap

**Priority:** P0
**Phase:** 1

## Description

Stand up the Fastify + TypeScript (strict) backend satisfying the full
`POST /api/telemetry/stream` contract from `docs/CHALLENGE.md`, using a rule-based placeholder
classifier (no LLM yet) to de-risk the request/response plumbing and latency measurement before
LLM complexity is introduced. Include the provider-switch skeleton (`LLM_PROVIDER=local|cloud`)
as an interface even though only the placeholder implementation exists yet.

## Definition of done

- `npm start` / `npm run dev` boots the server on `http://localhost:3000` (or documented port)
- `POST /api/telemetry/stream` accepts and returns payloads matching the contract exactly
  (Zod-validated)
- `GET /health` present
- `.env.example` lists all required env vars
- `processing_latency_ms` is self-reported and accurate
- Basic manual verification via curl/Postman documented in the ticket or commit message

## Log

### 2026-09-03 — Implementation
Built Fastify + TypeScript strict backend satisfying the full telemetry contract, with a
rule-based placeholder classifier (behaviorally informed by reference-backend/index.js,
reimplemented in typed TS), an isolated in-memory session store keyed by `session_id`, and the
`SentimentProvider` seam (placeholder working now, local/cloud stubbed for Phase 3).

### 2026-09-03 — Dependency audit
`npm audit` flagged two high-severity CVEs in Fastify <=4.x (DoS via unbounded memory allocation,
schema validation bypass). Upgraded to Fastify v5.12.1 / @fastify/cors v10 — audit clean after.

### 2026-09-03 — Validation
Booted the server and curl'd `POST /api/telemetry/stream` with a realistic sarcasm-flavored
payload (correct aggressive/critical classification), a malformed payload (400 with field-level
errors), and a second `session_id` (classified independently, confirming no state bleed). Backfilled
into this Log during the 0014 ticket-format migration — originally only recorded in the commit
message.
