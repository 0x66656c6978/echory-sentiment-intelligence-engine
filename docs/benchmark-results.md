# LLM Quality & Latency Benchmark Results (Tickets 0006, 0015)

## Final decision

**Primary model: `phi4-mini` (local, via Ollama). Documented swap-in alternatives:
`granite4.1:3b` (local, safer latency margin) and `groq/qwen3.8-27b` (cloud, better accuracy —
deliberately not chosen as primary; see below).** Switching any of these is a one-line
`INFERENCE_MODEL` change, no code changes (`INFERENCE_BASE_URL`/`INFERENCE_API_KEY` for the cloud
option) — see `backend/.env.example`.

### The decision in one table

Twelve local models (4 rounds) and three cloud models (Groq) were benchmarked against the same
18-case set plus an independent 10-case holdout, using the same prompt and judge throughout. Two
real candidates survived serious consideration once accuracy and latency were both weighed
properly:

| Model | Sentiment accuracy (28 combined samples) | Risk-level accuracy | Avg latency | **% of calls exceeding 500ms** |
|---|---|---|---|---|
| **`phi4-mini` (chosen)** | 82% | 75% | 408ms | **0%** |
| `groq/qwen3.8-27b` (declined) | 93% | 71% | 378ms (lower!) | **14%** |

`qwen3.8-27b` is not a strawman — it beats `phi4-mini` on accuracy and even on *average* latency,
and that accuracy edge held up on the independent holdout set (93%→100% on holdout, i.e. not
overfitting the way an earlier candidate, `gemma4:e2b`, turned out to be — see below). The reason
it was declined anyway: **`phi4-mini` measured 0% of calls exceeding the 500ms hard limit across
28 samples; `qwen3.8-27b` measured 14%, from network/queue variance inherent to any cloud API call,
not something addressable by prompt engineering (verified directly — see ticket 0015's log).**

The challenge brief states latency is a scored dimension (25% weight) and that "consistently
exceeding 500ms counts as a failure on this dimension" — language that reads as a scoring cliff,
not a smooth penalty. Weighing that against Nuance Detection Accuracy (30% weight, where
`phi4-mini` already scores respectably at 75-82%): risking a likely-failed 25%-weighted dimension
to gain a partial improvement within the 30%-weighted one was judged not worth it, **especially
since the 0%/14% figures were measured from Felix's own network to Groq — an evaluator's
environment has no reason to be faster, and no guarantee of being comparable at all.** This is a
genuine, close trade-off, not a clear-cut either way — documented in full here and in ticket
0015's log specifically so it can be explained and defended on its merits if asked.

Full phase-by-phase reasoning (four rounds of local benchmarking, the overfitting catch, and the
cloud comparison) follows below.

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

## Prompt v2: targeted improvement for granite4.1:3b

Felix chose `granite4.1:3b` as the prompt-improvement target (safer latency margin over
`gemma4:e2b`'s higher-but-riskier accuracy). Inspected its 5 specific v1 failures directly rather
than guessing:

| Case | v1 got | Should be |
|---|---|---|
| `clear_negative` | aggressive | negative (calm firm rejection, no hostility) |
| `sarcasm_masked_as_commitment` | appeasement | sarcastic (challenge's own worked example) |
| `deflecting_subtle` | neutral | deflecting |
| `contradiction_calm_words_loud_acoustic` | neutral | sarcastic/aggressive |
| `high_volatility_shock` | deflecting | negative/aggressive (shock reaction) |

Pattern: literal-word reading overriding acoustic contradiction (cases 2, 4), a fuzzy negative/
aggressive boundary (case 1), missed subtle stalling language (case 3), and a shock/distress
reaction mislabeled as a deliberate stalling strategy (case 5).

v2 prompt (`backend/src/prompts/sentimentClassification.ts`) adds: an explicit rule that acoustic
contradiction overrides literal word meaning above ~0.6 pitch_volatility/volume_intensity; an
explicit negative-vs-aggressive boundary (hostility must be present, not just refusal-content); an
explicit rule that shock/distress reactions are not deflection; and three fresh worked examples
(new scenarios, not the benchmark cases themselves, so the fix generalizes rather than memorizing
test answers). Also set an explicit `temperature: 0.2` for classification calls (previously
Ollama's chat-tuned default, ~0.8) — free change, worth testing alongside the prompt.

**Result: 72% → 78% accuracy**, judge score stable (6.8→6.9), latency stable (363ms→396ms, still a
104ms margin under the 500ms line). Risk-level accuracy also improved (44%→50%). Fixed the
negative/aggressive confusion cleanly (case 1). **Did not fully fix cases 2, 3, 5** — `sarcasm_
masked_as_commitment` and `contradiction_calm_words_loud_acoustic` still don't weight the acoustic
contradiction strongly enough (both now land on `appeasement` instead of the previous `neutral` —
directionally closer but still wrong), and `high_volatility_shock` still gets called `deflecting`
despite a rule written specifically for that exact failure. Honest read: the acoustic-contradiction
and shock-vs-deflection rules only partially transferred — worth a further prompt iteration if
pursued further, rather than treating 78% as the ceiling for this model.

`granite4.1:3b` v2 now **matches Round 3's previous accuracy leader (`gemma4:e2b`, 78%) while
keeping the much safer latency margin** (104ms vs. 40ms) — a meaningfully stronger overall position
than either model had alone before this iteration.

Raw data: `docs/benchmark-raw-results-prompt-v2-granite.json`.

## Prompt v2 across all other latency-compliant models

Per Felix's direction, discarded the latency-failing models entirely (no point re-testing a prompt
change against models that already fail the hard 500ms line regardless of quality) and re-ran v2
against the remaining five: `gemma4:e2b`, `phi4-mini`, `llama3.2:3b`, `qwen2.5:1.5b`,
`llama3.2:1b`.

| Model | v1 accuracy | v2 accuracy | v2 risk acc | v2 judge | v2 latency | Margin to 500ms |
|---|---|---|---|---|---|---|
| `gemma4:e2b` | 78% | **89%** | 33% | 7.1 | 483ms | **17ms — very tight** |
| `phi4-mini` | 61% | 78% | **78%** (best) | 6.2 | 405ms | 95ms |
| `granite4.1:3b` | 72% | 78% | 50% | 6.9 | 396ms | 104ms |
| `llama3.2:3b` | 56% | 72% | 33% | 6.2 | 367ms | 133ms |
| `qwen2.5:1.5b` | 39% | 56% | 28% | 3.7 | 362ms | 138ms |
| `llama3.2:1b` | 22% | 39% | 28% | 2.4 | 237ms | 263ms |

Raw data: `docs/benchmark-raw-results-prompt-v2-others.json`.

**Every model improved substantially** — confirms the v2 prompt's fixes generalize rather than
being overfit to `granite4.1:3b`'s specific failures (the point of using fresh worked examples
instead of the benchmark cases themselves).

**New risk worth flagging directly: `gemma4:e2b`'s latency margin has shrunk to 17ms.** The v2
prompt is longer (added rules + worked examples), and that alone pushed `gemma4:e2b`'s latency
from 460ms (v1) to 483ms (v2) — its margin nearly halved from an already-tight 40ms. It's now the
single best-accuracy option (89%) but sits dangerously close to the hard failure line; any further
prompt growth, or ordinary run-to-run/hardware variance on the evaluators' machine, could push it
over. `phi4-mini` and `granite4.1:3b` both landed at 78% accuracy with much more comfortable
margins (95ms and 104ms) — `phi4-mini` additionally has the best risk-level accuracy of any model
tested (78%, well above everyone else). This is now a genuine three-way tradeoff rather than a
clear winner, flagged for Felix's decision rather than picked here.

## Holdout validation: is prompt v2 actually generalizing, or overfitting to the 18 cases?

Felix raised a legitimate methodological concern: the v2 prompt was designed by looking at
`granite4.1:3b`'s failures *on the original 18-case set*, then measured *on that same set*. That's
structurally the same issue as tuning against a validation set and reporting the validation score
as if it were held-out — the 78-89% figures above could partly reflect fitting to this specific,
small (n=18), self-authored test set rather than genuine improvement at the underlying task.

Built an independent 10-case holdout set (`backend/scripts/holdout-test-set.ts`): different
negotiation contexts (pricing, timelines, finance sign-off, rather than the original set's
"partnership" theme), different phrasing, different acoustic value combinations — designed from
the base category definitions, not reverse-engineered from v1/v2's specific failure analysis.
Re-ran the three leading candidates (`gemma4:e2b`, `phi4-mini`, `granite4.1:3b`) against it with
the same v2 prompt.

| Model | Original-set accuracy | Holdout accuracy | Drop | Holdout risk acc | Holdout latency | Margin to 500ms |
|---|---|---|---|---|---|---|
| `gemma4:e2b` | 89% | 70% | **-19 points** | 30% | 495ms | **5ms — essentially none** |
| `phi4-mini` | 78% | 70% | -8 points | **70%** | 406ms | 94ms |
| `granite4.1:3b` | 78% | 70% | -8 points | 50% | 393ms | 107ms |

Raw data: `docs/benchmark-raw-results-holdout.json`.

**Felix's concern was correct, and it changes the recommendation.** `gemma4:e2b`'s 89% was
substantially inflated by overfitting to the original set — it drops the most (19 points) once
tested on cases it had no part in shaping the prompt around. All three models converge to the same
70% on genuinely unseen cases (with only 10 holdout cases, treat this as directionally tied rather
than precisely equal), so the accuracy edge that made `gemma4:e2b` attractive **evaporates** — and
its latency margin, already the worst of the three, has also collapsed to essentially nothing
(5ms), driven by the same longer v2 prompt. There's no longer any reason to prefer it.

`phi4-mini`'s risk-level accuracy advantage (70% vs. `granite4.1:3b`'s 50%) held up on the holdout
too, unlike `gemma4:e2b`'s raw-accuracy edge — that looks like a genuine, consistent strength
rather than a fluke of the original set. Between `phi4-mini` and `granite4.1:3b`, both are now
close to tied on sentiment accuracy with comfortable latency margins (94ms/107ms); `phi4-mini`'s
better risk-level accuracy is the more meaningful remaining differentiator.

## Ticket 0015: Groq cloud comparison

Felix added real Groq and Gemini Flash API keys to test cloud models properly rather than assume.
Gemini Flash skipped (observed instability, not worth the time right now). Groq's model catalog
had changed since this project's earlier docs assumed `llama-3.3-70b-versatile` — verified via
Groq's `/models` endpoint that it no longer exists. Current lineup is dominated by reasoning-
capable models (`openai/gpt-oss-20b/120b`, `qwen/qwen3.6/3.8-27b`) — the same architecture family
already ruled out locally for latency reasons. Direct testing found Groq exposes a
`reasoning_effort` parameter: default effort produced 441 reasoning tokens and ~980ms for a single
call; `reasoning_effort: "low"` cut that to ~52 tokens and ~450ms. `gpt-oss-120b` stayed over
budget (~775ms) even at low effort, so only `gpt-oss-20b` was benchmarked.

| Model | Original-set accuracy | Holdout accuracy | Holdout risk acc | Original latency | Holdout latency |
|---|---|---|---|---|---|
| `phi4-mini` | 83% | 70% | 60% | 395ms | 399ms |
| `granite4.1:3b` | 78% | 70% | 50% | 396ms | 413ms |
| `groq/gpt-oss-20b` | 89% | **90%** | 40% | 564ms | 490ms |

Raw data: `docs/benchmark-raw-results-original-cloud-comparison.json`,
`docs/benchmark-raw-results-holdout-cloud-comparison.json`.

**This is a different situation from `gemma4:e2b`, not the same overfitting pattern.**
`gpt-oss-20b`'s accuracy *held up* on the holdout (89%→90%, actually slightly higher) — real
evidence the quality edge is genuine, not test-set fitting. But its latency tells a different
story than the local models: not uniformly too slow, but **high-variance**. Individual holdout
calls ranged from 180ms to 754ms — several individual requests exceeded 500ms even though the
*average* (490ms) technically lands under it, driven by network round-trip and queue time to
Groq's servers rather than raw model speed (Groq's actual token generation is extremely fast — the
variance is network/queue, not compute). `phi4-mini` and `granite4.1:3b`, running on local
hardware with no network hop, stayed tightly clustered in the 300-500ms range across every case in
both runs, with no comparable spikes. Also hit Groq's free-tier rate limit (8000 TPM) mid-run,
handled with retry/backoff — a real operational consideration for a production integration, not
just a benchmark artifact.

Also notable: `gpt-oss-20b`'s risk-level accuracy is the *weakest* of the three on the holdout
(40% vs. `phi4-mini`'s 60%) despite the best sentiment accuracy — the traffic-light signal doesn't
automatically benefit from the same quality edge.

**This is a real tradeoff, not a clear "use Groq" or "ignore Groq" answer:** meaningfully better
and holdout-confirmed sentiment accuracy, against latency that's consistent on average but spikes
unpredictably above the hard line in a way purely local inference doesn't. Whether that's
acceptable depends on how "consistently exceeding 500ms" in the challenge's scoring is actually
interpreted.

**Resolution:** computed exact `% of calls over 500ms` across all 28 combined samples (18 original
+ 10 holdout) per model, not just averages — the metric that actually answers "consistently
exceeding":

| Model | % over 500ms | p50 | p95 | max |
|---|---|---|---|---|
| `phi4-mini` | **0%** | 416ms | 473ms | 488ms |
| `granite4.1:3b` | 7% | 390ms | 518ms | 544ms |
| `groq/gpt-oss-20b` | **46%** | 482ms | 986ms | 1062ms |

`gpt-oss-20b`'s median (p50: 482ms, right at the line) confirms it fails on close to a coin flip —
not an occasional spike, a near-50/50 outcome per request. Given the challenge's "consistently
exceeding 500ms counts as a failure" reads as a scoring cliff rather than a smooth penalty, and a
25%-weighted dimension likely failing outright isn't worth a partial gain within the 30%-weighted
accuracy dimension (already respectable at 70-83% locally) — **`gpt-oss-20b` is not recommended.**
Felix confirmed: stick with `phi4-mini`.

## Additional Groq models checked (per Felix's "anything with better latency for less quality?")

Checked the rest of Groq's current catalog for a middle ground before concluding none exists:
- `groq/compound-mini` — turned out to be an agentic system that internally routes through
  **multiple sub-models including `gpt-oss-120b`** (already ruled out) — 1.46s total, worse than
  `gpt-oss-20b` alone, not a middle ground.
- `qwen/qwen3.6-27b` — embeds `<think>...</think>` reasoning directly inside `content` (not a
  separate field like `gpt-oss`/DeepSeek), and took ~4.2s by default with no working
  `reasoning_effort` lever for this model. Excluded.
- **`qwen/qwen3.8-27b`** — a real find: doesn't emit reasoning content at all by default (no
  `reasoning_effort` needed), clean JSON, and turned out to be the strongest candidate overall.
  Benchmarked properly (both sets, same rigor):

| Model | Sentiment Acc | Risk Acc | Judge | Avg Latency | % over 500ms | p95 | max |
|---|---|---|---|---|---|---|---|
| `phi4-mini` | 82% | 75% | 6.6 | 408ms | 0% | 473ms | 488ms |
| `granite4.1:3b` | 71% | 46% | 6.9 | 400ms | 7% | 518ms | 544ms |
| `groq/gpt-oss-20b` | 96% | 46% | 8.1 | 519ms | 46% | 986ms | 1062ms |
| **`groq/qwen3.8-27b`** | **93%** | 71% | 7.6 | **378ms** | 14% | 707ms | 711ms |

`qwen3.8-27b` beats `phi4-mini` on accuracy (93% vs. 82%) and even on *average* latency (378ms vs.
408ms) — but still carries a real 14% chance of exceeding 500ms on any given request (4 of 28
calls), driven by network/queue variance to Groq's servers, something purely local inference has
zero exposure to regardless of the evaluator's own network conditions (unknown, and no reason to
assume better than this measurement). This is a genuinely closer call than `gpt-oss-20b` was —
not a clear discard, unlike that one. Flagged for Felix's decision: `phi4-mini`'s zero-risk safety
vs. `qwen3.8-27b`'s better accuracy/average-latency at a real but occasional tail-latency risk.

**Updated recommendation: `phi4-mini` or `granite4.1:3b`, not `gemma4:e2b`.** Between the two,
`phi4-mini` edges ahead on risk-level accuracy, which matters directly for the traffic-light UI
signal — a reasonable case for making it the primary choice, though `granite4.1:3b`'s slightly
larger latency margin is a legitimate counter-argument. Flagged for Felix's final call.
