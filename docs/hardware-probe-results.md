# Hardware Latency Probe Results (Ticket 0005)

**Hardware:** NVIDIA GeForce RTX 5080, 16GB VRAM (Windows-reported VRAM figures are unreliable —
confirmed via `nvidia-smi`, not Task Manager/WMI, which under-report on this card).

**Method:** each model was called via Ollama with a draft classification prompt representative in
length/shape of the real one (system prompt describing the JSON schema + a sample transcript chunk
and acoustic metadata as the user message — see `backend/scripts/hardware-probe.ts` for the exact
text). 1 warm-up call (discarded) + 3 timed calls per model, averaged.

## Critical finding: "thinking" mode

Every model already pulled on this machine (`qwen3.5:4b`, `qwen3:8b`, `qwen3.5:9b`, `gemma4:12b`)
defaults to an extended chain-of-thought "thinking" mode. The first probe run (before this was
understood) measured *only reasoning tokens* — every response hit the 200-token cap with
`finish_reason: "length"` and an **empty** `content` field, the real answer never reached. That
data was meaningless and is not reported below.

**Ollama's OpenAI-compatible endpoint (`/v1/chat/completions`) does not support suppressing this**
— passing `think: false` there is silently ignored. Only Ollama's **native** API (`/api/chat`)
respects `think: false`. This is a real constraint on ticket 0007's originally-planned "one
unified OpenAI-compatible code path for local and cloud" design:

- If the chosen local model is a "thinking" model (qwen3.x, gemma4.x here), ticket 0007 must call
  Ollama's **native** `/api/chat` API for the local path, not the OpenAI-compatible one.
- If the chosen local model has no thinking mode at all (e.g. `llama3.2:1b`, tested below), it
  behaves identically on both endpoints — confirmed directly — and the unified OpenAI-compatible
  design remains fully viable.

This is forward-flagged into ticket 0007's log; not resolved here.

## Results (with `think: false`, valid JSON, `done_reason: "stop"` on every run)

| Model | Params | Avg latency | Avg completion tokens | Avg tok/s | Clears 250ms target? | Clears 500ms fail line? |
|---|---|---|---|---|---|---|
| `llama3.2:1b` | 1B | **174ms** | 74 | 424.5 | ✅ Yes | ✅ Yes |
| `qwen3.5:4b` | 4B | 566ms | 88 | 156.1 | ❌ No | ❌ Borderline/no |
| `qwen3:8b` | 8B | 1040ms | 70 | 67.6 | ❌ No | ❌ No |
| `qwen3.5:9b` | 9B | 1472ms | 94 | 63.6 | ❌ No | ❌ No |

(`qwen3:8b`'s numbers varied more across the two probe runs — 539ms vs. 1040ms — likely GPU/VRAM
contention from cycling through 4 models in the second run rather than 3. Doesn't change the
conclusion: it's well clear of budget either way.)

## Implication for ticket 0006 (local LLM benchmark)

Only `llama3.2:1b` clears the latency bar with real headroom. This is a genuine tension with
Nuance Detection Accuracy (30% weight, the highest-weighted scoring dimension) — a 1B model is a
real quality risk for subtle sarcasm/deflection detection compared to the 4-9B candidates. Ticket
0006 needs to actually measure `llama3.2:1b`'s classification quality against the LLM-judge, not
assume it's sufficient just because it's fast, and should treat the cloud fallback (ticket 0007)
as a serious primary contender — not just a safety net — if the quality gap turns out to be large.
`qwen3.5:4b` remains a reasonable "quality-favored, latency-risky" second candidate for that
comparison.

## Available but not probed

`gpt-oss:20b` (13GB) and `gemma4:26b` (17GB) are pulled locally but were not timed — both are
large enough that clearing the latency budget was assessed as very unlikely, and a full probe run
would cost significant time for a predictable result. `gemma4:12b` was spot-checked only for the
"thinking" behavior (confirmed it also reasons via the OpenAI-compat endpoint) and took ~24.7s
completely unwarmed — not included in the table since it wasn't measured under the same
warm/steady-state conditions as the others.
