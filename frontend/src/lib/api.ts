import {
  API_MITIGATION_FEEDBACK_PATH,
  API_TELEMETRY_STREAM_PATH,
  DEFAULT_PORT,
  TelemetryChunkRequestSchema,
  TelemetryChunkResponseSchema,
  type MitigationFeedbackAction,
  type TelemetryChunkRequest,
  type TelemetryChunkResponse,
} from "@echory/contract";

const BACKEND_ORIGIN = `http://localhost:${DEFAULT_PORT}`;
const BACKEND_URL = `${BACKEND_ORIGIN}${API_TELEMETRY_STREAM_PATH}`;

/**
 * Single place the real backend is called from — isolated so swapping the
 * fixture-backed view for this real path (or vice versa) is a one-line
 * change in App.tsx, not a rewrite.
 */
export async function sendChunk(chunk: TelemetryChunkRequest): Promise<TelemetryChunkResponse> {
  TelemetryChunkRequestSchema.parse(chunk);

  const res = await fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(chunk),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Backend responded ${res.status}: ${body}`);
  }

  return TelemetryChunkResponseSchema.parse(await res.json());
}

/**
 * Records whether the negotiator acted on a chunk's mitigation_suggestion --
 * dashboard-only feature, not part of the mandatory Track A/B contract.
 * Throws on failure so the caller can decide how to surface it rather than
 * silently pretending the click did something it didn't.
 */
export async function sendMitigationFeedback(
  sessionId: string,
  chunkId: string,
  action: MitigationFeedbackAction,
): Promise<void> {
  const res = await fetch(`${BACKEND_ORIGIN}${API_MITIGATION_FEEDBACK_PATH(sessionId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chunk_id: chunkId, action }),
  });

  if (!res.ok) {
    throw new Error(`Backend responded ${res.status}: ${await res.text()}`);
  }
}
