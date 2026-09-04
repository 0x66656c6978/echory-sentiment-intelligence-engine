import type { FastifyInstance } from "fastify";
import { API_MITIGATION_FEEDBACK_ROUTE_PATTERN, MitigationFeedbackRequestSchema } from "@echory/contract";
import { sessionStore } from "../session/store.js";

/**
 * Dashboard-only feature (not part of the mandatory Track A/B contract):
 * lets the Mitigation Panel's "Used it" / "Not now" buttons actually record
 * something, instead of being local-only UI state that resets on the next
 * chunk with nothing to show for it.
 */
export async function mitigationFeedbackRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { session_id: string } }>(API_MITIGATION_FEEDBACK_ROUTE_PATTERN, async (request, reply) => {
    const parsed = MitigationFeedbackRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    }

    const { session_id } = request.params;
    const { chunk_id, action } = parsed.data;
    const recorded = sessionStore.recordMitigationFeedback(session_id, chunk_id, action);
    if (!recorded) {
      return reply.status(404).send({
        error: "not_found",
        message: `No chunk "${chunk_id}" found in session "${session_id}"`,
      });
    }

    return reply.status(204).send();
  });
}
