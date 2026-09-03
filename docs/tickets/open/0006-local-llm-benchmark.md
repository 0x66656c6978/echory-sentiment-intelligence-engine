# 0006 — Local LLM benchmark + prompt design

**Priority:** P0
**Phase:** 3

## Description

Depends on [0005-hardware-latency-probe](0005-hardware-latency-probe.md). Shortlist local models
(informed by the probe results — see `docs/hardware-probe-results.md`) and benchmark them for
nuance-detection quality, not just speed. Build a small hand-labeled test set (~15-20 chunks)
deliberately targeting sarcasm, deflection, aggression, appeasement, and volatility shifts — not
just easy positive/negative cases. Use a stronger cloud model (Gemini Flash or Groq Llama-70B) as
an LLM-judge to score each local model's outputs against the hand-labeled expectations.

Ticket 0005's real numbers narrowed the field more than expected: only `llama3.2:1b` (174ms avg,
with `think: false`) clears the latency budget with headroom — `qwen3.5:4b` (566ms), `qwen3:8b`
(1040ms), and `qwen3.5:9b` (1472ms) all miss it, measured the same correct way. This is a genuine
tension with Nuance Detection Accuracy (30% weight, the single heaviest scoring dimension) — a 1B
model is a real quality risk, and Felix wants a genuinely good local model, not just a fast one.
**Actually measure `llama3.2:1b`'s quality here, don't assume it's sufficient just because it's
fast.** Give the reasoning models (`qwen3.5:4b`, `qwen3:8b`, `qwen3.5:9b`) a fair, correctly-
measured shot at the quality comparison too — they're not excluded from this benchmark just for
missing latency, since a large enough quality win could still justify the
`INFERENCE_DISABLE_THINKING` path ticket 0007 built for exactly this case. The 500ms figure is
Pascal's own hard failure line, though (per `docs/CHALLENGE.md`), not a soft preference — a model
that can't get under it consistently is disqualified regardless of quality, not just penalized.

Prompt and model choice are coupled — expect at least one iteration where a prompt tweak changes
which model wins.

## Definition of done

- Test set of ~15-20 chunks with expected sentiment/hidden_intent/risk_level committed to the repo
- Benchmark script runs all shortlisted models against the test set and records: accuracy vs.
  hand-labels, judge score, average latency
- Results committed (e.g. `docs/benchmark-results.md`) so the model choice is transparent and
  defensible in the interview follow-up
- Primary local model selected and wired into the backend's provider interface
- Benchmark script calls any reasoning-capable model with `think: false` via Ollama's native API
  (per ticket 0005's finding) — never scores a model on truncated chain-of-thought output

## Log

### 2026-09-03 — Description amended
Updated with ticket 0005's real latency numbers, which narrowed the realistic shortlist more than
the original "~3 local models" framing assumed — see `docs/hardware-probe-results.md` for the full
data and the "thinking mode" finding that also affects ticket 0007's design.

### 2026-09-03 — Description and DoD amended again: think:false is mandatory methodology
Felix: "For testing local models - also consider models have thinking capabilities and set
`think: false` for them." Made this an explicit DoD requirement rather than leaving it implicit
from ticket 0005's approach, and clarified reasoning models get a genuine fair shot at the quality
comparison (not excluded just for missing latency) since ticket 0007 now supports running them via
the `INFERENCE_DISABLE_THINKING` opt-in if quality justifies it. Also reiterated that the 500ms
figure is a hard failure line per the challenge doc, not a soft preference to weigh against quality.
