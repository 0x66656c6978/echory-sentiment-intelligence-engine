import type { SentimentProvider, TelemetryChunkRequest, TelemetryChunkResponse } from "@echory/contract";

/**
 * Cloud (free-tier) provider stub — the latency safety net behind the
 * LLM_PROVIDER switch. Implemented for real in the Phase 3
 * provider-switch-cloud-fallback ticket.
 */
export class CloudProvider implements SentimentProvider {
  readonly name = "cloud";

  async analyze(_chunk: TelemetryChunkRequest): Promise<Omit<TelemetryChunkResponse, "chunk_id" | "processing_latency_ms">> {
    throw new Error("CloudProvider is not implemented yet — see docs/tickets/open/0007-provider-switch-cloud-fallback.md");
  }
}
