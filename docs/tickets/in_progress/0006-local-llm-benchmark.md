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
