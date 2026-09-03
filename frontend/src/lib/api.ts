import {
  API_TELEMETRY_STREAM_PATH,
  DEFAULT_PORT,
  TelemetryChunkRequestSchema,
  TelemetryChunkResponseSchema,
  type TelemetryChunkRequest,
  type TelemetryChunkResponse,
} from "@echory/contract";

const BACKEND_URL = `http://localhost:${DEFAULT_PORT}${API_TELEMETRY_STREAM_PATH}`;

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
