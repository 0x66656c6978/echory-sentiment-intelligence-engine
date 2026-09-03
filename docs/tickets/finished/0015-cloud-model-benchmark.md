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

### 2026-09-03 — Felix confirmed phi4-mini; computed exact % over 500ms for rigor
Felix: stay with `phi4-mini`, but wanted the tradeoff made very clear with real numbers rather than
"average latency." Computed exact `% of calls over 500ms` across all 28 combined samples per
model: `phi4-mini` 0%, `granite4.1:3b` 7%, `gpt-oss-20b` **46%** (p50 already at 482ms — a near
coin-flip failure rate, not an occasional spike). This settles it: a 25%-weighted dimension likely
failing outright isn't worth a partial gain within the 30%-weighted accuracy dimension where local
models already do reasonably. `gpt-oss-20b` is not recommended.

### 2026-09-03 — Checked for a middle-ground Groq model; found a strong one
Felix asked whether any other Groq model might offer better latency for slightly lower quality.
Checked the rest of Groq's catalog before concluding none exists:
- `groq/compound-mini`: an agentic system routing through multiple sub-models including
  `gpt-oss-120b` internally — 1.46s total, worse than `gpt-oss-20b` alone.
- `qwen/qwen3.6-27b`: embeds `<think>` tags directly in `content` (no separate reasoning field),
  ~4.2s by default, no working `reasoning_effort` lever for this model. Excluded.
- `qwen/qwen3.8-27b`: doesn't emit reasoning content at all by default — clean JSON, no lever
  needed. Spot-checked first (467ms, clean output) before spending a full benchmark run on it.

Benchmarked `qwen3.8-27b` properly (both sets). Result across 28 combined samples: **93%
sentiment accuracy, 71% risk accuracy, 378ms average latency (lower than `phi4-mini`'s 408ms)**,
but a real 14% chance of exceeding 500ms (4/28 calls, p95 707ms) from network/queue variance to
Groq — something local inference has zero exposure to. This is NOT the same situation as
`gpt-oss-20b` (near-coin-flip failure) or `gemma4:e2b` (fake accuracy edge) — the accuracy gain is
holdout-confirmed real, and even the average latency is better than the local option. This is a
genuinely close call, flagged for Felix: `phi4-mini`'s zero measured risk vs. `qwen3.8-27b`'s
better accuracy and average latency at a real but occasional (not consistent) tail-latency risk.

### 2026-09-03 — Checked whether a shorter prompt would reduce qwen3.8-27b's tail latency
Felix asked directly. Ran 6 direct calls capturing Groq's latency breakdown (`queue_time`,
`prompt_time`, `completion_time`) rather than guessing. With the current ~980-token prompt,
`prompt_time` (prefill -- the component a shorter prompt would actually reduce) was consistently
~79-82ms, barely varying. `queue_time` varied 18-168ms and network round-trip 39-134ms -- both
much larger and noisier than prefill, and neither scales with prompt length. Conclusion: shortening
the prompt would save at most ~30-40ms off prefill and would not address the actual source of the
14% tail-latency risk (Groq-side queuing and network variance, structural to using a cloud API,
not fixable via prompt engineering). One-off diagnostic script used and discarded, not committed --
the finding is what matters, not the throwaway tool.

### 2026-09-03 — Final decision confirmed: phi4-mini
Felix: "phi44-mini. We will document why we chose this trade off, backed by numbers. I will be
able to argue this technical decision and we will hope it won't affect our computed score too
much." Confirms `phi4-mini` as final, with the tail-latency-risk finding above closing off the
last open question (a shorter prompt wouldn't have changed the calculus). Updated
`docs/benchmark-results.md`'s top summary, `backend/.env.example` (including fixing the stale
`llama-3.3-70b-versatile` reference in the Groq example -- that model no longer exists, verified
in this same ticket), and `ROADMAP.md` with the full final numbers and reasoning, framed for
direct reuse when defending this decision. Honest acknowledgment carried through the documentation
rather than smoothed over: this was a genuinely close call, not an obviously correct one, and the
0%/14% figures were measured from Felix's own network to Groq -- an evaluator's environment isn't
guaranteed to match.
