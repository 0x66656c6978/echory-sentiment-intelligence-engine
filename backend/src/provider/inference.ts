import type { SentimentProvider, TelemetryChunkRequest, TelemetryChunkResponse } from "@echory/contract";

/**
 * Generic OpenAI-compatible inference provider, configured entirely via env vars
 * (INFERENCE_BASE_URL, INFERENCE_MODEL, optional INFERENCE_API_KEY) rather than
 * hardcoded per-vendor classes — per Pascal's explicit request (2026-09-03 email):
 * Echory needs to be able to point this backend at an external model via config
 * alone if their local/containerized inference has problems on their side.
 *
 * Works against Ollama's OpenAI-compatible endpoint (http://localhost:11434/v1)
 * for the local path, or any real OpenAI-compatible cloud API (Groq, etc.) for
 * the cloud/fallback path — same code, different env vars.
 *
 * Implemented for real in the Phase 3 tickets: 0006 picks the model/prompt via
 * the local LLM benchmark, 0007 finishes this HTTP call and response parsing.
 */
export class InferenceProvider implements SentimentProvider {
  readonly name = "inference";

  async analyze(
    _chunk: TelemetryChunkRequest,
  ): Promise<Omit<TelemetryChunkResponse, "chunk_id" | "processing_latency_ms">> {
    throw new Error("InferenceProvider is not implemented yet — see docs/tickets/open/0007-provider-switch-cloud-fallback.md");
  }
}
