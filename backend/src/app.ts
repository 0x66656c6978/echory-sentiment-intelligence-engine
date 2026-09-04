import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import type { SentimentProvider } from "@echory/contract";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";
import { telemetryRoutes } from "./routes/telemetry.js";
import { sessionSummaryRoutes } from "./routes/sessionSummary.js";
import { mitigationFeedbackRoutes } from "./routes/mitigationFeedback.js";
import { getProvider } from "./provider/index.js";

/**
 * `overrideProvider` exists for tests that need to exercise a specific
 * provider (e.g. one that returns observability data) without going through
 * the LLM_PROVIDER env var — production code should never pass it.
 */
export async function buildApp(overrideProvider?: SentimentProvider): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  await app.register(cors);

  const provider = overrideProvider ?? getProvider();
  app.log.info(`Sentiment provider: ${provider.name}`);

  await app.register(healthRoutes);
  await telemetryRoutes(app, provider);
  await sessionSummaryRoutes(app);
  await mitigationFeedbackRoutes(app);

  // Normalizes every failure mode Fastify can produce before/outside our own
  // route handlers (malformed JSON, empty body, wrong Content-Type, any
  // unhandled exception) into one consistent contract. Without this, API
  // consumers see three different error shapes and even a different status
  // code (415 for a missing Content-Type) depending on how a request is
  // malformed, instead of one predictable 400 shape. Zod validation failures
  // inside telemetryRoutes reply directly and never reach this handler.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error);

    const isClientError = typeof error.statusCode === "number" && error.statusCode < 500;
    if (isClientError) {
      return reply.status(400).send({
        error: "invalid_request",
        details: { formErrors: [error.message], fieldErrors: {} },
      });
    }

    return reply.status(500).send({
      error: "internal_error",
      message: "Unexpected server error",
    });
  });

  return app;
}
