/**
 * POST /modify — one edit → scoped re-flow (Highlight H4). Never re-synthesises.
 * Returns the patched plan plus the ids of every block the re-flow touched,
 * so the UX can highlight exactly what changed.
 */
import type { FastifyInstance } from "fastify";
import { PlanEditSchema } from "@travelmate/contracts";
import { orchestrateEdit } from "@travelmate/orchestrator";
import { deps } from "../index.js";
import { requireAuth } from "../middleware/session.js";
import { rateLimit } from "../middleware/rate-limit.js";

export async function modifyRoutes(app: FastifyInstance) {
  // SEC-2: requireAuth — unauthenticated users cannot trigger re-flow (LLM spend).
  // SEC-6: Per-user rate limit on this LLM-backed endpoint.
  const llmRateLimit = rateLimit({ max: 30, windowMs: 60_000, keyBy: "user" });

  app.post<{ Body: unknown }>("/modify", { preHandler: [requireAuth, llmRateLimit] }, async (request, reply) => {
    let edit;
    try {
      edit = PlanEditSchema.parse(request.body);
    } catch (err) {
      // SEC-8: Never return raw ZodError text to the client
      return reply.status(400).send({ code: "INVALID_INPUT", message: "Invalid edit request" });
    }

    try {
      const result = await orchestrateEdit(edit, deps, {
        onThought: (t) => request.log.info({ reflow: t }),
      });
      return reply.send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // SEC-8: Determine not-found by the error message (no reliable error type yet) but
      // avoid leaking internal error details — use a sanitized message.
      const isNotFound = /not found/i.test(message);
      return reply.status(isNotFound ? 404 : 500).send({
        code: isNotFound ? "NOT_FOUND" : "REFLOW_FAILED",
        message: isNotFound ? "Plan not found" : "Re-flow failed",
      });
    }
  });
}
