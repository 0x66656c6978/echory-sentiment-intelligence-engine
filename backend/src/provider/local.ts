import type { SentimentProvider, TelemetryChunkRequest, TelemetryChunkResponse } from "@echory/contract";

/**
 * Local (Ollama) provider stub. Implemented for real in the Phase 3 local
 * LLM benchmark ticket — this establishes the interface seam so the
 * provider switch has somewhere real to plug into.
 */
export class LocalProvider implements SentimentProvider {
  readonly name = "local";

  async analyze(_chunk: TelemetryChunkRequest): Promise<Omit<TelemetryChunkResponse, "chunk_id" | "processing_latency_ms">> {
    throw new Error("LocalProvider is not implemented yet — see docs/tickets/open/0006-local-llm-benchmark.md");
  }
}
