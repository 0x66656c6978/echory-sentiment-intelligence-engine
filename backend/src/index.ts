import { join } from "node:path";
import { DEFAULT_PORT } from "@echory/contract";
import { buildApp } from "./app.js";
import { loadDotEnv } from "./env.js";

loadDotEnv(join(process.cwd(), ".env"));

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : DEFAULT_PORT;

const app = await buildApp();

app
  .listen({ port: PORT, host: "0.0.0.0" })
  .then(() => {
    app.log.info(`Sentiment Intelligence Engine backend running on http://localhost:${PORT}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
