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

## Recommendation (for discussion, not unilaterally decided here)

Given ticket 0007 already supports a fully swappable inference endpoint (Pascal's explicit
requirement), and local models on this hardware can't hit both quality and latency at once, the
strongest evidence-based option is to make **the cloud endpoint (Groq) the default/primary**
configuration rather than local Ollama — Groq is specifically known for very low latency on fast
inference hardware while running much larger, higher-quality models than anything that fits this
GPU's latency budget. Local Ollama remains fully documented and available as an alternative
(useful for demo/offline scenarios), but as a secondary option rather than the primary path this
data no longer clearly supports. This reverses the roadmap's original "local-first" assumption —
flagged for Felix's decision, not decided unilaterally here.
