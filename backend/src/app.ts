import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";
import { telemetryRoutes } from "./routes/telemetry.js";
import { getProvider } from "./provider/index.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  await app.register(cors);

  const provider = getProvider();
  app.log.info(`Sentiment provider: ${provider.name}`);

  await app.register(healthRoutes);
  await telemetryRoutes(app, provider);

  return app;
}
