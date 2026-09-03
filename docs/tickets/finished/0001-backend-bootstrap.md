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
