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

_No work logged yet._
