import { join } from "node:path";
import { DEFAULT_PORT } from "@echory/contract";
import { buildApp } from "./app.js";
import { loadDotEnv } from "./env.js";
import { initLangfuse, langfuseEnabled, shutdownLangfuse } from "./observability/langfuse.js";

loadDotEnv(join(process.cwd(), ".env"));

// Must run after loadDotEnv() -- see the ordering note in langfuse.ts.
initLangfuse();

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : DEFAULT_PORT;

const app = await buildApp();
app.log.info(`Langfuse tracing: ${langfuseEnabled ? "enabled" : "disabled (no LANGFUSE_* keys set)"}`);

app
  .listen({ port: PORT, host: "0.0.0.0" })
  .then(() => {
    app.log.info(`Sentiment Intelligence Engine backend running on http://localhost:${PORT}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });

// Best-effort flush of any pending Langfuse spans before the process exits --
// no-op when Langfuse is disabled.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    shutdownLangfuse()
      .catch(() => {})
      .finally(() => process.exit(0));
  });
}
