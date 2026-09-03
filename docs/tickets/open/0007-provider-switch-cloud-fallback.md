# 0007 — Provider switch + cloud fallback

**Priority:** P1
**Phase:** 3

## Description

Wire up the `LLM_PROVIDER=local|cloud` env switch sketched in
[0001-backend-bootstrap](0001-backend-bootstrap.md) for real: `local` uses the model selected in
[0006-local-llm-benchmark](0006-local-llm-benchmark.md) via Ollama, `cloud` uses a free-tier
provider (Groq or Gemini Flash) with the same prompt. This is the latency safety net — if local
inference can't reliably hit the target on grading hardware, cloud is a one-line config change.

## Definition of done

- Both providers implement the same interface (same prompt template, same response parsing)
- Switching `.env`'s `LLM_PROVIDER` value changes behavior with no code changes
- `.env.example` documents both paths, including how to get a free Groq/Gemini API key
- README/SETUP.md documents the `ollama pull <model>` step needed for the local path

## Log

_No work logged yet._
