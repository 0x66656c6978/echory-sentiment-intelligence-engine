import type { FastifyInstance } from "fastify";
import { TelemetryChunkRequestSchema, API_TELEMETRY_STREAM_PATH, type TelemetryChunkResponse } from "@echory/contract";
import type { SentimentProvider } from "@echory/contract";
import { sessionStore } from "../session/store.js";

export async function telemetryRoutes(app: FastifyInstance, provider: SentimentProvider): Promise<void> {
  app.post(API_TELEMETRY_STREAM_PATH, async (request, reply) => {
    const parsed = TelemetryChunkRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    }

    const chunk = parsed.data;
    const start = Date.now();
    const analysis = await provider.analyze(chunk);
    const processingLatencyMs = Date.now() - start;

    const response: TelemetryChunkResponse = {
      chunk_id: chunk.chunk_id,
      processing_latency_ms: processingLatencyMs,
      ...analysis,
    };

    sessionStore.append(chunk.session_id, response, chunk.timestamp_ms);

    return reply.send(response);
  });
}
