# 0015 — Cloud model benchmark (Groq)

**Priority:** P1
**Phase:** 3

## Description

Ticket 0006 benchmarked 12 local models and selected `phi4-mini` as primary. Ticket 0007's DoD
only verifies that swapping to a cloud endpoint *works mechanically* (Pascal's configurability
requirement) — it doesn't measure whether a cloud model would actually be a *better* choice on
quality/latency. Felix added real Groq and Gemini Flash API keys specifically to test this
properly. Scoped to **Groq only** for now — Gemini Flash is observably unstable right now
(Felix's direct observation), not worth spending time on until/unless that changes.

Same methodology as ticket 0006 for a fair comparison: the same 18-case benchmark set and 10-case
holdout set (`backend/scripts/benchmark-test-set.ts` / `holdout-test-set.ts`), the same v2 prompt
(`backend/src/prompts/sentimentClassification.ts`), the same DeepSeek judge. Groq is called via
its OpenAI-compatible endpoint (`https://api.groq.com/openai/v1`) with `response_format` JSON
schema enforcement (per ticket 0007's finding that this is required regardless of model).

## Definition of done

- `llm-benchmark.ts` extended to call a cloud (OpenAI-compatible) endpoint alongside/instead of
  Ollama, without disrupting the existing local-model path
- Groq's `llama-3.3-70b-versatile` (or current equivalent — verify the model name is still valid
  before assuming) benchmarked against both the 18-case set and the 10-case holdout set
- Results added to `docs/benchmark-results.md` alongside the existing local-model comparison,
  including latency (Groq is marketed for very fast inference — measure it, don't assume it)
- Explicit recommendation: does this change the `phi4-mini` decision from ticket 0006, or confirm
  it? Either answer is fine as long as it's backed by the same rigor (holdout check included, not
  just the original 18 cases) as ticket 0006 applied to the local candidates

## Log

### 2026-09-03 — Model catalog verification and reasoning_effort discovery
`llama-3.3-70b-versatile` (this project's earlier assumed Groq model) no longer exists — verified
via Groq's `/models` endpoint rather than assumed. Current lineup (`gpt-oss-20b/120b`,
`qwen3.6/3.8-27b`) is dominated by reasoning-capable models, same architecture family already
ruled out locally for latency. Found Groq exposes `reasoning_effort` (low/medium/high): default
produced 441 reasoning tokens / ~980ms for one test call; `"low"` cut that to ~52 tokens / ~450ms.
`gpt-oss-120b` stayed over budget (~775ms) even at low effort — only `gpt-oss-20b` benchmarked.

### 2026-09-03 — Two implementation bugs found and fixed
(1) Applying the same strict `response_format` schema enforcement to the warm-up call caused Groq
to reject it outright (400) since an off-topic warm-up question can't be forced into the
classification schema — Ollama's `format` is more lenient about this, Groq's isn't. Added a
separate unconstrained `warmup` path per candidate.
(2) Hit Groq's free-tier rate limit (8000 TPM) mid-run; added retry-with-backoff that excludes the
wait time from reported latency (a rate-limit wait isn't model latency). Also hit an empty-
generation validation failure from Groq itself (a real reliability data point) that was crashing
the whole run via an uncaught exception — wrapped candidate calls in try/catch, recorded as a
failed case like an unparseable response instead of crashing.

### 2026-09-03 — Results: real quality edge, but latency variance is the real risk
Benchmarked `gpt-oss-20b` (via Groq's OpenAI-compatible endpoint, `reasoning_effort: "low"`,
`response_format` schema enforcement) against both the 18-case set and the 10-case holdout,
alongside `phi4-mini`/`granite4.1:3b` for a clean comparison.

| Model | Original acc | Holdout acc | Holdout risk acc | Original latency | Holdout latency |
|---|---|---|---|---|---|
| `phi4-mini` | 83% | 70% | 60% | 395ms | 399ms |
| `granite4.1:3b` | 78% | 70% | 50% | 396ms | 413ms |
| `groq/gpt-oss-20b` | 89% | 90% | 40% | 564ms | 490ms |

Unlike `gemma4:e2b`, `gpt-oss-20b`'s accuracy held up on the holdout (89%→90%) — this quality edge
looks genuine, not overfitting. But latency shows high variance rather than uniform slowness:
individual calls ranged 180-754ms, several exceeding 500ms even though the average lands near or
under it — driven by network/queue time to Groq's servers, not raw model speed. `phi4-mini` and
`granite4.1:3b` stayed tightly clustered 300-500ms with no comparable spikes across either run.
`gpt-oss-20b` also has the weakest risk-level accuracy of the three (40%) despite the best
sentiment accuracy. Full analysis in `docs/benchmark-results.md`.

This is a genuine tradeoff (better, holdout-confirmed accuracy vs. latency that's inconsistent in
a way local inference isn't), not a clear verdict either way — flagged for Felix's decision.
