# 0008 — Latency & concurrency verification

**Priority:** P0
**Phase:** 4

## Description

End-to-end performance pass once the real model (from Phase 3) is wired in: confirm latency
consistently stays under the 500ms failure line (ideally <250ms) under the chosen provider, and
verify multiple concurrent `session_id`s don't bleed state into each other.

## Definition of done

- Latency measured across a batch of real requests (not just one-off manual tests), p50/p95
  reported
- Concurrent-session test: multiple sessions interleaved, each session's summary/history stays
  correctly isolated
- If latency target is missed on the local provider, document the decision to fall back to cloud
  for submission (via [0007](0007-provider-switch-cloud-fallback.md))
