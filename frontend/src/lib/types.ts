import type { MitigationFeedbackAction, TelemetryChunkRequest, TelemetryChunkResponse } from "@echory/contract";

export interface ChunkEntry {
  request: TelemetryChunkRequest;
  response?: TelemetryChunkResponse;
  status: "pending" | "done" | "error";
  error?: string;
  /** Whether the negotiator acted on this chunk's mitigation_suggestion -- unset until reported through the Mitigation Panel. */
  mitigationFeedback?: MitigationFeedbackAction;
}
