import { DEFAULT_PORT } from "@echory/contract";
import { buildApp } from "./app.js";

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
