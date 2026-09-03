# Local LLM Quality Benchmark Results (Ticket 0006)

**Method:** 18 hand-labeled test cases (`backend/scripts/benchmark-test-set.ts`) deliberately
targeting sarcasm, deflection, aggression, appeasement, and acoustic/verbal contradiction — not
just easy positive/negative/neutral cases. One includes `docs/CHALLENGE.md`'s own worked example
as a direct sanity check. Every candidate model called via Ollama's native `/api/chat` with
`think: false` (mandatory — see ticket 0005) and structured-output `format` (JSON Schema)
enforcement. Sentiment/risk_level/volatility_flag accuracy computed deterministically against hand
labels; `hidden_intent`/`mitigation_suggestion` quality scored 0-10 by an external judge
(DeepSeek `deepseek-reasoner`, chosen specifically so the judge isn't competing with the candidates
for the same local GPU). Single run per model — not averaged across repeated samples, so treat
exact percentages as directional, not statistically precise.

## Two real bugs found and fixed during this benchmark (see ticket 0006's log for detail)

1. **Missing required fields**: without JSON-schema enforcement, `llama3.2:1b` silently dropped
   `volatility_flag` from its output under this prompt's full length — not invalid JSON, an
   incomplete object. Fixed by adding Ollama's structured-output `format` parameter.
2. **Length-limit violations**: the first schema didn't encode `maxLength` on `hidden_intent`/
   `mitigation_suggestion`, so models filled the space with longer text than the real API contract
   allows (60/120 chars), and correct strict validation rejected it. Fixed by adding `maxLength` to
   the schema. After both fixes: **zero parse failures across all four models.**

## Results

**Correction (2026-09-03):** the latency figures below were originally computed by averaging all 18
calls per model, including each model's very first call — which incurs Ollama's one-time
model-load-into-memory cost (seconds, not ms) on top of actual inference. That's not representative
of a warm, already-loaded model in production. Recomputed excluding each model's first call
(cheap — the raw per-case data was already saved, no need to re-spend judge API budget). No
pass/fail conclusion changes, but the reported margins were meaningfully overstated, especially for
`qwen3.5:4b` (1090ms → 662ms). The benchmark script now does an explicit discarded warm-up call
before timing starts, so this won't recur in future runs.

| Model | Sentiment accuracy | Risk-level accuracy | Volatility accuracy | Judge score (0-10) | Avg latency (warm) | Clears 500ms? |
|---|---|---|---|---|---|---|
| `llama3.2:1b` | 22% | 28% | 100% | 3.0 | **226ms** | ✅ Yes |
| `qwen3.5:4b` | **72%** | 39% | 75% | 5.3 | 662ms | ❌ No |
| `qwen3:8b` | 56% | 44% | 100% | 5.6 | 613ms | ❌ No |
| `qwen3.5:9b` | 67% | 44% | 100% | **6.0** | 917ms | ❌ No |

## The central finding

**No model satisfies both requirements simultaneously.** The only model that clears the latency
budget (`llama3.2:1b`, 226ms warm) has by far the worst classification quality (22% accuracy,
lowest judge score) — it defaults to "neutral" on more than half the genuinely nuanced cases
(sarcasm, deflection, aggression all frequently misread as neutral). Every model with real quality
(`qwen3.5:4b` at 72% — more than 3x `llama3.2:1b`'s accuracy) still misses the 500ms hard failure
line, by roughly 1.2-1.8x depending on the model.

This isn't a close call resolvable by more prompt tuning — the accuracy gap between the fast model
and the good models is too large (22% vs. 56-72%) for that alone. The latency gap is more moderate
than first reported (see the correction above) but still real and consistent across every
quality-competitive model. Confirms ticket 0005's flagged tension in the sharpest possible
terms, with real numbers now instead of a prediction.

## Notable per-case findings

- `sarcasm_masked_as_commitment` (the exact example from `docs/CHALLENGE.md`, expected `sarcastic`/
  high risk): `qwen3.5:4b` got this exactly right (sarcastic, judge score 9). `llama3.2:1b` called
  it `neutral`. This one case alone is a reasonable proxy for the quality gap.
- `llama3.2:1b` never once correctly identified `aggressive`, `deflecting`, or `sarcastic` across
  all their respective test cases — it appears to collapse most nuanced inputs toward `neutral` or
  `negative`, consistent with a 1B model's limited capacity to track this prompt's more elaborate
  classification instructions.
- All models scored 75-100% on `volatility_flag` — this signal seems to transfer well from the
  acoustic-metadata guidance regardless of model size, unlike sentiment nuance.

## Round 2: additional non-reasoning candidates

Per Felix's direction, researched and tested additional small, non-hybrid-reasoning models before
concluding cloud was necessary: `phi4-mini` (Microsoft, 3.8B), `mistral` (7B, known for reliable
structured/JSON output), `qwen2.5:1.5b` (pre-dates the "thinking-by-default" Qwen3.x generation),
and `llama3.2:3b` (untested larger sibling of the already-benchmarked 1B, same non-reasoning
family). All four confirmed clean (no `reasoning` field) via direct spot-check before running the
full suite. Same methodology as Round 1, with the warm-up fixes already applied (see ticket 0006's
log) — measured warm-only from the start, no correction needed for this round.

| Model | Sentiment accuracy | Risk-level accuracy | Volatility accuracy | Judge score (0-10) | Avg latency (warm) | Clears 500ms? |
|---|---|---|---|---|---|---|
| `phi4-mini` | **61%** | 50% | 75% | **6.1** | **392ms** | ✅ Yes |
| `mistral` | 67% | 44% | 100% | 6.2 | 693ms | ❌ No |
| `qwen2.5:1.5b` | 39% | 33% | 75% | 3.5 | 271ms | ✅ Yes |
| `llama3.2:3b` | 56% | 44% | 75% | 4.8 | 313ms | ✅ Yes |

Raw data: `docs/benchmark-raw-results-round2.json`.

## Updated finding: `phi4-mini` may resolve the tension entirely

Unlike every Round 1 model, `phi4-mini` clears the latency budget (392ms, ~110ms of headroom under
the fail line) **while** nearly tripling `llama3.2:1b`'s quality (61% vs. 22% sentiment accuracy,
judge score 6.1 vs. 3.0) — matching or beating the *quality* of Round 1's best latency-failing
models (`mistral` 67%/`qwen3.5:4b` 72%) without their latency cost. `llama3.2:3b` is a solid second
option in the same latency-safe range (313ms, 56% accuracy).

This is a materially different picture than Round 1 suggested. The earlier recommendation to make
Groq the cloud default no longer looks like the only viable path — `phi4-mini` deserves serious
consideration as the primary local model.

## Round 3: further non-reasoning candidates (Gemma 4 edge, Ministral, Granite)

Felix asked to discard all "thinking" models on the basis that reasoning capability appears to be
an architectural/weights-level cost, not something a runtime flag removes (see the conversation
for the full explanation) — so all further candidates were screened to confirm they never emit a
`reasoning` field, before spending benchmark time on them. Researched and pulled: `gemma4:e2b` /
`gemma4:e4b` (Google's edge-optimized Gemma 4 variants, released April 2026 — notably, *unlike*
the larger `gemma4:12b`/`26b` already ruled out, these don't even emit empty thinking tags when
disabled, i.e. genuinely non-reasoning by design, not just suppressed), `ministral-3:8b` (Mistral's
edge/on-device model, marketed for native JSON output), and `granite4.1:3b` (IBM, also built for
structured JSON output). All four confirmed clean via spot-check before running the full suite.

| Model | Sentiment accuracy | Risk-level accuracy | Volatility accuracy | Judge score (0-10) | Avg latency (warm) | Clears 500ms? |
|---|---|---|---|---|---|---|
| `gemma4:e2b` | 78% | 39% | 100% | 7.0 | 460ms | ✅ Yes (40ms margin) |
| `gemma4:e4b` | **83%** | 50% | 100% | **7.3** | 779ms | ❌ No |
| `ministral-3:8b` | 72% | 33% | 50% | 5.6 | 757ms | ❌ No |
| `granite4.1:3b` | 72% | 44% | 100% | 6.8 | 363ms | ✅ Yes (137ms margin) |

Raw data: `docs/benchmark-raw-results-round3.json`.

## Current leaderboard across all three rounds (latency-compliant models only)

| Model | Sentiment accuracy | Judge score | Latency | Margin to 500ms |
|---|---|---|---|---|
| **`gemma4:e2b`** | **78%** | 7.0 | 460ms | 40ms (tight) |
| **`granite4.1:3b`** | 72% | 6.8 | 363ms | 137ms (comfortable) |
| `phi4-mini` | 61% | 6.1 | 392ms | 108ms |
| `llama3.2:3b` | 56% | 4.8 | 313ms | 187ms |
| `qwen2.5:1.5b` | 39% | 3.5 | 271ms | 229ms |
| `llama3.2:1b` | 22% | 3.0 | 226ms | 274ms |

Round 3 changed the picture again, more favorably this time: `granite4.1:3b` and `gemma4:e2b` both
clearly beat `phi4-mini` on quality while staying under the latency line. `granite4.1:3b` has the
more comfortable safety margin (137ms vs. `gemma4:e2b`'s 40ms) — worth weighing, since a 40ms
margin leaves little room for run-to-run variance or slower conditions on the evaluators' machine.
`gemma4:e4b` remains the single best quality result across all rounds (83%/7.3) if latency weren't
binding, which is worth keeping in mind as a cloud-fallback-equivalent option (same model family,
just too slow locally on this GPU) rather than discarding entirely.

**Next step (per Felix's plan):** pick the current best candidate and try to improve its accuracy
through prompt refinement (few-shot examples, trimmed acoustic guidance, explicit low temperature),
then re-test the improved prompt across all relevant models to see if the ranking changes.
