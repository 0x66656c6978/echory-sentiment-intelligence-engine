import type { FastifyInstance } from "fastify";
import { API_SESSION_SUMMARY_ROUTE_PATTERN } from "@echory/contract";
import { sessionStore } from "../session/store.js";

/**
 * Track B requirement, included for completeness (ticket 0010) -- not
 * required for Track A, but the schema and underlying per-chunk data
 * (sessionStore) already existed, so the only real gap was this route.
 */
export async function sessionSummaryRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { session_id: string } }>(API_SESSION_SUMMARY_ROUTE_PATTERN, async (request, reply) => {
    const summary = sessionStore.summarize(request.params.session_id);
    if (!summary) {
      return reply.status(404).send({
        error: "not_found",
        message: `No session found with id "${request.params.session_id}"`,
      });
    }
    return reply.send(summary);
  });
}
