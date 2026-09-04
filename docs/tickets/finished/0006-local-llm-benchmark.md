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

### 2026-09-03 — Judge changed to external (DeepSeek), not local
Originally planned to use the largest locally-pulled model (`gpt-oss:20b`) as judge. Felix
rejected this mid-implementation: a 13GB local judge competes with the candidates under test for
the same GPU, which is bad methodology (contention, and no independence from the environment being
measured). Felix provided a DeepSeek API key. Switched to DeepSeek's OpenAI-compatible API as the
judge — first `deepseek-chat`, then Felix asked for `deepseek-reasoner` specifically ("We want to
get the best quality review possible"), accepting the extra latency/cost of a reasoning judge in
exchange for grading quality. Confirmed DeepSeek's API cleanly separates `reasoning_content` from
the final `content` field (no truncation risk, unlike the local "thinking" models). Key stored in
`backend/.env` (gitignored), documented in `.env.example` as benchmark-only tooling config, not
required for the actual backend.

### 2026-09-03 — Two real methodology bugs found and fixed
First full run: **100% parse failure for `llama3.2:1b`** across all 18 cases. Investigated by
calling the model directly with the real prompt — it was silently omitting the required
`volatility_flag` field, not producing invalid JSON syntax. Root cause: this benchmark's full
classification prompt is much longer/more complex than ticket 0005's simpler probe prompt (which
worked fine), and the 1B model can't reliably track every required field across that length. Fixed
by adding Ollama's structured-output `format` parameter (JSON Schema) to constrain generation —
this is itself a valuable finding for ticket 0007's production implementation, not just benchmark
plumbing, since the same reliability problem would occur in production.

Second full run (with format enforcement): parse failures dropped for `llama3.2:1b` but many
models now failed on `hidden_intent`/`mitigation_suggestion` exceeding the real API's 60/120-char
limits — the JSON Schema I'd written only declared `type: "string"` without `maxLength`, so
enforcement didn't cap length and correct strict validation (rightly) rejected the oversized
output. Added `maxLength: 60`/`maxLength: 120` to the schema, spot-checked one case to confirm the
cap is respected, then re-ran. Third run: **zero parse failures across all four models.**

Both fixes now live in `backend/src/prompts/sentimentClassification.ts`
(`SENTIMENT_CLASSIFICATION_JSON_SCHEMA`), shared with whatever ticket 0007 ships — the benchmark
and production now use the identical schema-enforced call shape, not an approximation.

### 2026-09-03 — Final benchmark results
Full results, methodology, and the central finding are in `docs/benchmark-results.md`. Headline:

| Model | Sentiment acc | Judge score | Avg latency | Clears 500ms? |
|---|---|---|---|---|
| `llama3.2:1b` | 22% | 3.0 | 313ms | Yes |
| `qwen3.5:4b` | 72% | 5.3 | 1090ms | No |
| `qwen3:8b` | 56% | 5.6 | 678ms | No |
| `qwen3.5:9b` | 67% | 6.0 | 977ms | No |

**No model satisfies both latency and quality.** The only latency-compliant model has by far the
worst quality (defaults to "neutral" on most nuanced cases); every model with real quality misses
the hard 500ms failure line by roughly 2-4x. This isn't closeable by more prompt tuning given the
size of both gaps. `docs/benchmark-raw-results.json` (full per-case data, judge comments) committed
alongside the summary for full traceability, per the DoD's "transparent and defensible" bar.

**Not yet done, deliberately:** the DoD's last bullet ("primary local model selected and wired
into the backend's provider interface") is being held for Felix's input rather than decided here —
the data suggests making the cloud endpoint (Groq) the default/primary configuration instead of
local Ollama, which reverses the roadmap's original local-first assumption. That's a significant
enough pivot to surface explicitly rather than just doing it.

### 2026-09-03 — Latency numbers corrected: no warm-up call
Felix: "Are we sure that loading the model into memory doesn't inflate our numbers? I only want to
test warm models." Checked the raw data — confirmed real: every model's first case in the loop was
inflated by Ollama's one-time model-load cost (e.g. `qwen3.5:4b`'s first call was 8365ms vs.
~600-700ms for the rest). Recomputed corrected warm-only averages from the already-saved raw
per-case data rather than re-spending judge API budget on a needless re-run. No pass/fail
conclusion changed, but margins were meaningfully overstated (`qwen3.5:4b`: 1090ms reported → 662ms
actual). Added an explicit discarded warm-up call to the benchmark script before timing starts, so
this can't recur in the models-still-to-be-tested pass. `docs/benchmark-results.md` updated with
corrected figures and the correction documented inline.

### 2026-09-03 — Researching additional non-reasoning candidates
Felix: only benchmark newly-identified models initially, redo the full benchmark later once there's
a better picture. Researched current (Sept 2026) small models known for good instruction-following
without hybrid "thinking" mode by default: Phi-4-mini (3.8B, Microsoft), Mistral 7B (known for
reliable structured/JSON output), the pre-thinking-era Qwen2.5 generation, and Llama 3.2 3B (larger
sibling of the already-tested 1B, same non-reasoning family). Proceeding to pull and spot-check
these for thinking-mode behavior before running the full 18-case suite on them alone.

### 2026-09-03 — Warm-up prompt made unrelated to the real prompt
Felix, immediately after the previous fix: "Your warm up call might cache that prompt for the
first benchmark. Send a completely unrelated prompt to warm the model up please." Correct —
the warm-up was reusing the real system prompt + the first test case's exact user message, which
could let Ollama's prompt/KV-cache reuse make that one specific case measure faster than the other
17 for reasons unrelated to the model's real performance. Changed the warm-up to a generic,
unrelated question ("capital of France") so every one of the 18 timed calls is equally cold
content-wise — only the model itself is warm, not any specific prompt.

### 2026-09-03 — Round 2 results: phi4-mini may resolve the tension entirely
Pulled and spot-checked (confirmed no `reasoning` field) `phi4-mini`, `mistral`, `qwen2.5:1.5b`,
`llama3.2:3b`, then ran the full 18-case suite on just these four per Felix's direction. Result:

| Model | Sentiment acc | Judge score | Latency | Clears 500ms? |
|---|---|---|---|---|
| `phi4-mini` | 61% | 6.1 | 392ms | Yes |
| `mistral` | 67% | 6.2 | 693ms | No |
| `qwen2.5:1.5b` | 39% | 3.5 | 271ms | Yes |
| `llama3.2:3b` | 56% | 4.8 | 313ms | Yes |

`phi4-mini` clears latency with room to spare (392ms) while nearly tripling `llama3.2:1b`'s Round-1
quality (61% vs 22%) and matching Round 1's best *latency-failing* models' quality. This changes
the picture Round 1 suggested — Groq-as-default is no longer clearly the only path; `phi4-mini`
deserves serious consideration as the primary local model. Full writeup in
`docs/benchmark-results.md`. Not yet decided: whether to run a consolidated 8-model comparison
before finalizing, or proceed with `phi4-mini` directly — surfaced for Felix.

### 2026-09-03 — Round 3: gemma4:e2b and granite4.1:3b both beat phi4-mini
Felix asked to discard all thinking models entirely and researched further non-reasoning
candidates first. Found and pulled `gemma4:e2b`/`gemma4:e4b` (Google's edge-optimized Gemma 4,
April 2026 — confirmed these specifically don't emit thinking tags even when disabled, unlike the
larger `12b`/`26b` already ruled out), `ministral-3:8b`, and `granite4.1:3b` (both explicitly built
for structured JSON output). One pull run hit a transient disk-space error on the actual Ollama
storage drive (`G:`, not `C:` — the earlier `C:` free-space check was checking the wrong drive);
Felix fixed it externally, retried sequentially, all four pulled successfully. Spot-checked all
four clean (no `reasoning` field) before running the full suite.

Results: `gemma4:e2b` 78% accuracy / 460ms (40ms margin under 500ms), `gemma4:e4b` 83% / 779ms
(best quality overall, misses latency), `ministral-3:8b` 72% / 757ms (misses latency),
`granite4.1:3b` 72% / 363ms (137ms margin). Both `gemma4:e2b` and `granite4.1:3b` now beat
`phi4-mini` (61%/392ms) on quality while staying latency-compliant. `granite4.1:3b` has the more
comfortable safety margin; `gemma4:e2b` has better raw accuracy but a tight 40ms buffer. Full
updated leaderboard across all three rounds in `docs/benchmark-results.md`.

Next: per Felix's plan, pick the current best candidate and try to improve its accuracy via prompt
refinement, then re-test the improved prompt across all relevant models.

### 2026-09-03 — Prompt v2: targeted fix for granite4.1:3b's 5 specific failures
Felix chose `granite4.1:3b` (safer latency margin over `gemma4:e2b`'s higher accuracy). Inspected
its exact 5 v1 failures from the raw JSON rather than guessing at improvements. Pattern: literal-
word reading overriding acoustic contradiction, a fuzzy negative/aggressive boundary, missed subtle
stalling language, and a shock reaction mislabeled as deliberate deflection.

Rewrote `SENTIMENT_CLASSIFICATION_SYSTEM_PROMPT` (v2) with explicit rules for each failure mode
plus three fresh worked examples (new scenarios, not the 18 benchmark cases, so the fix
generalizes rather than memorizing test answers). Also set `temperature: 0.2` for classification
calls (was Ollama's ~0.8 chat-tuned default) — free change, bundled into the same test.

Result: 72% → 78% accuracy, latency stable (396ms, 104ms margin). Fixed the negative/aggressive
case cleanly. Did NOT fully fix 3 of 5 original failures — two moved from `neutral` to
`appeasement` (directionally closer, still wrong) and the shock-reaction case is unchanged despite
a rule written specifically for it. Reporting this honestly rather than only the accuracy delta:
this prompt revision partially, not fully, transferred. `granite4.1:3b` v2 now matches Round 3's
previous accuracy leader (`gemma4:e2b`, 78%) while keeping a much safer latency margin (104ms vs.
40ms) — full writeup in `docs/benchmark-results.md`.

Next: test v2 across all relevant models per Felix's plan — not yet done.

### 2026-09-03 — Prompt v2 tested across all other latency-compliant models
Felix: discard the latency-failing models, run v2 against the rest. Tested `gemma4:e2b`,
`phi4-mini`, `llama3.2:3b`, `qwen2.5:1.5b`, `llama3.2:1b`. Every model improved substantially
(e.g. `gemma4:e2b` 78%→89%, `phi4-mini` 61%→78%, `llama3.2:1b` 22%→39%) — confirms the v2 fixes
generalize rather than being overfit to `granite4.1:3b`'s specific failures.

New risk found: `gemma4:e2b`'s latency margin shrank from 40ms (v1) to 17ms (v2) — the longer v2
prompt (added rules + examples) pushed its latency from 460ms to 483ms. It's now the best-accuracy
option (89%) but dangerously close to the hard 500ms line. `phi4-mini` and `granite4.1:3b` both
landed at 78% with much safer margins (95ms/104ms); `phi4-mini` additionally has by far the best
risk-level accuracy (78% vs. everyone else's 28-50%). Full table in `docs/benchmark-results.md`.

This is now a genuine three-way tradeoff (best raw accuracy vs. margin safety vs. risk-level
accuracy), not a clear single winner — surfaced for Felix rather than decided here.

### 2026-09-03 — Holdout validation confirms overfitting concern, changes the recommendation
Felix asked directly: aren't we just fitting the prompt to our test data? Legitimate concern —
v2 was designed by looking at failures *on the 18-case set* and measured *on that same set*,
structurally the same issue as tuning against a validation set. Built an independent 10-case
holdout set (`backend/scripts/holdout-test-set.ts`, different negotiation contexts/phrasing/
acoustic values, designed from the base category definitions rather than the v1/v2 failure
analysis) and re-tested the three leading candidates against it.

Result: all three converge to 70% (from 78-89% on the original set). `gemma4:e2b` drops the most
(89%→70%, -19 points) — its accuracy lead was substantially inflated by overfitting. `phi4-mini`
and `granite4.1:3b` drop less (-8 points each) and land at the same 70%. `gemma4:e2b`'s latency
margin also collapsed to 5ms (from 17ms) on the longer holdout prompt calls — no longer any reason
to prefer it. `phi4-mini`'s risk-level accuracy advantage (70% vs. 50%) held up on the holdout,
unlike `gemma4:e2b`'s raw-accuracy edge, suggesting it's a genuine strength, not a fluke.

Updated recommendation: `phi4-mini` or `granite4.1:3b`, not `gemma4:e2b`. Full analysis in
`docs/benchmark-results.md`. Final choice between the two flagged for Felix.

### 2026-09-03 — Final decision: phi4-mini primary, granite4.1:3b swap-in
Felix: "Let's use phi4-mini for now but allow for swapping to granite4.1:3b." Before finalizing,
verified both work cleanly via the actual production default path (OpenAI-compatible endpoint,
not just Ollama's native API used throughout this benchmark) — found that without `response_
format`, `phi4-mini` wraps JSON in markdown fences and `granite4.1:3b` drops `risk_level`
entirely (same missing-field failure mode as the original llama3.2:1b discovery, now confirmed on
this path too). With OpenAI's `response_format: {type: "json_schema", ...}` shape, both are clean.
Flagged as an explicit DoD requirement on ticket 0007, which implements the real call.

`backend/.env.example` updated: `INFERENCE_MODEL=phi4-mini` is now the default, with
`granite4.1:3b` documented as the one-line swap-in alternative (just change `INFERENCE_MODEL`, no
code changes). Interpreting this ticket's last DoD bullet ("selected and wired into the backend's
provider interface") as satisfied by this default-configuration step — the actual HTTP call
implementation is ticket 0007's explicit, separate scope, not re-done here.

**Final summary for anyone reading only this ticket:** benchmarked 12 models across 4 rounds (4
"thinking" models discarded after ticket 0005's latency finding, 8 non-reasoning models tested),
iterated the prompt once with a documented partial fix, and caught a real overfitting risk via an
independent holdout set before finalizing. `phi4-mini` (70% holdout accuracy, best risk-level
accuracy, 94ms latency margin) is the result.

### 2026-09-04 — Superseded on the *default* question by ticket 0018 (Pascal's answer)
This ticket's benchmark work and its `phi4-mini`-as-best-local-candidate conclusion are unchanged
and still accurate. What changed is which provider ships as the shipped *default*: Pascal's
explicit infrastructure constraints (no GPU passthrough assumed, no install step on Echory's side)
rule out any local model as the default, regardless of benchmark quality. `phi4-mini` remains the
documented local swap-in. See [ticket 0018](0018-groq-default-per-pascal.md).
