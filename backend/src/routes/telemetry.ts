import type { FastifyInstance } from "fastify";
import { TelemetryChunkRequestSchema, API_TELEMETRY_STREAM_PATH, type TelemetryChunkResponse } from "@echory/contract";
import type { SentimentProvider } from "@echory/contract";
import { sessionStore } from "../session/store.js";
import { logLLMCall } from "../observability/llmLogger.js";

export async function telemetryRoutes(app: FastifyInstance, provider: SentimentProvider): Promise<void> {
  app.post(API_TELEMETRY_STREAM_PATH, async (request, reply) => {
    const parsed = TelemetryChunkRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    }

    const chunk = parsed.data;
    const start = Date.now();
    const { classification, observability } = await provider.analyze(chunk);
    const processingLatencyMs = Date.now() - start;

    const response: TelemetryChunkResponse = {
      chunk_id: chunk.chunk_id,
      processing_latency_ms: processingLatencyMs,
      ...classification,
    };

    sessionStore.append(chunk.session_id, response, chunk.timestamp_ms);

    // Only providers that made a real LLM call populate `observability` (the
    // rule-based placeholder never does) — logging just follows that signal
    // rather than special-casing on provider name.
    if (observability) {
      logLLMCall({
        timestamp: new Date().toISOString(),
        chunk_id: chunk.chunk_id,
        session_id: chunk.session_id,
        provider: provider.name,
        model: observability.model ?? "unknown",
        latency_ms: processingLatencyMs,
        prompt: observability.prompt ?? "",
        raw_response: observability.rawResponse ?? "",
        parsed_result: classification,
        token_counts: observability.tokenCounts,
      });
    }

    return reply.send(response);
  });
}
