import type { TelemetryChunkRequest, TelemetryChunkResponse } from "@echory/contract";

export interface ChunkEntry {
  request: TelemetryChunkRequest;
  response?: TelemetryChunkResponse;
  status: "pending" | "done" | "error";
  error?: string;
}
