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
