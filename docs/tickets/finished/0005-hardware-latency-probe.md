# 0005 — Hardware latency probe

**Priority:** P0
**Phase:** 3

## Description

Before committing to a model shortlist, measure actual tokens/sec on the available GPU (8GB+
VRAM) for a couple of candidate model sizes (~3B and ~7-8B, quantized) via Ollama. This replaces
guesswork with real numbers before [0006-local-llm-benchmark](0006-local-llm-benchmark.md) picks
its shortlist.

## Definition of done

- At least 2 model sizes pulled and timed with a representative prompt (similar length/shape to
  the actual classification prompt, not a toy "hello world")
- Results (tokens/sec, wall-clock latency for a realistic output length) recorded in this ticket
  or a short results file, so the model shortlist decision is traceable

## Log

### 2026-09-03 — Setup
Ollama was already installed but not running (`ollama serve` started manually). GPU is an NVIDIA
RTX 5080 — Windows/WMI reports 4GB VRAM, but that's a known misreporting bug for high-VRAM cards;
`nvidia-smi` confirms the real figure is 16GB. Several models were already pulled locally from
prior use: `qwen3.5:4b`, `qwen3:8b`, `qwen3.5:9b`, `gemma4:12b`, `gpt-oss:20b`, `gemma4:26b` — no
need to pull anything to get started.

### 2026-09-03 — First probe run was invalid (thinking mode)
Wrote `backend/scripts/hardware-probe.ts` using a draft classification prompt (representative in
length/shape of the real one, exact wording deferred to ticket 0006) against Ollama's OpenAI-
compatible endpoint. Every model hit the 200-token cap with `finish_reason: "length"` and **empty**
content. Inspected a raw response directly: the model was emitting a `reasoning` field (chain-of-
thought) and never reached the actual answer before running out of tokens — all three initially-
tested models (`qwen3.5:4b`, `qwen3:8b`, `qwen3.5:9b`) default to an extended "thinking" mode. That
first dataset was discarded as meaningless.

### 2026-09-03 — Found the fix, found a real architectural constraint
Confirmed Ollama's native `/api/chat` with `"think": false` produces clean JSON and `done_reason:
"stop"`. Also confirmed the OpenAI-compatible endpoint (`/v1/chat/completions`) **ignores** the
`think` field entirely — passing it has no effect, reasoning still leaks through. Spot-checked
`gemma4:12b` too: same reasoning-leak behavior, so this isn't Qwen-specific — every model pulled on
this machine defaults to thinking mode. This is a real constraint on ticket 0007's "one unified
OpenAI-compatible code path" design, not just a probe detail — flagged into ticket 0007's log.

### 2026-09-03 — Re-ran with think:false, pulled a small non-reasoning model for comparison
Rewrote the probe against the native API. Also pulled `llama3.2:1b` (1.3GB, 17s) as an additional
data point since all three original candidates were clearly going to miss the latency budget even
in the best case, and a genuinely small non-reasoning model was worth testing before finalizing.
Full results, method, and the quality-risk implication for ticket 0006 are in
`docs/hardware-probe-results.md`. Headline: only `llama3.2:1b` (174ms avg) clears the 250ms target
with headroom; `qwen3.5:4b` (566ms), `qwen3:8b` (1040ms), and `qwen3.5:9b` (1472ms) all miss it —
the two larger ones by a wide margin. Confirmed `llama3.2:1b` behaves identically on the OpenAI-
compatible endpoint (no thinking mode to suppress), so the unified-provider design stays viable if
it's the model ticket 0006 ultimately picks.

### 2026-09-03 — Forward-flagged findings
Amended tickets 0006 (shortlist framing narrowed by real latency data, quality-vs-latency tension
flagged) and 0007 (native-API-vs-OpenAI-compat dependency on model choice) with Log entries citing
this ticket's results, rather than letting the findings sit only in this ticket's own log where the
next tickets wouldn't necessarily see them.
