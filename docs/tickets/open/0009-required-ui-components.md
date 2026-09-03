# 0009 — Required UI components (polish pass)

**Priority:** P0
**Phase:** 4

## Description

Take the working-but-plain frontend from [0002-frontend-bootstrap](0002-frontend-bootstrap.md)
and build the four required UI elements properly, now that real model output (Phase 3) is
available to design around:

- Traffic Light Indicator — green/yellow/red/critical based on `risk_level`
- Sentiment Stream — scrolling timeline of classified chunks
- Volatility Alert — prominent warning when `volatility_flag` is true
- Mitigation Panel — displays current `mitigation_suggestion`

## Definition of done

- All four elements present and visibly reacting to live data
- Feels purpose-built for a negotiation room, not a generic data table (this is 15% of the score)
- Launchable with a single documented command
