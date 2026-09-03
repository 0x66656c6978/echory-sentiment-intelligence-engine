# 0006 — Local LLM benchmark + prompt design

**Priority:** P0
**Phase:** 3

## Description

Depends on [0005-hardware-latency-probe](0005-hardware-latency-probe.md). Shortlist ~3 local
models (informed by the probe results) and benchmark them for nuance-detection quality, not just
speed. Build a small hand-labeled test set (~15-20 chunks) deliberately targeting sarcasm,
deflection, aggression, appeasement, and volatility shifts — not just easy positive/negative
cases. Use a stronger cloud model (Gemini Flash or Groq Llama-70B) as an LLM-judge to score each
local model's outputs against the hand-labeled expectations.

Prompt and model choice are coupled — expect at least one iteration where a prompt tweak changes
which model wins.

## Definition of done

- Test set of ~15-20 chunks with expected sentiment/hidden_intent/risk_level committed to the repo
- Benchmark script runs all shortlisted models against the test set and records: accuracy vs.
  hand-labels, judge score, average latency
- Results committed (e.g. `docs/benchmark-results.md`) so the model choice is transparent and
  defensible in the interview follow-up
- Primary local model selected and wired into the backend's provider interface

## Log

_No work logged yet._
