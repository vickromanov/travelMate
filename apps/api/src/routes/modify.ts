/**
 * POST /modify — one edit → scoped re-flow (Highlight H4). Never re-synthesises.
 * Returns the patched plan plus the ids of every block the re-flow touched,
 * so the UX can highlight exactly what changed.
 */
import type { FastifyInstance } from "fastify";
import { PlanEditSchema } from "@travelmate/contracts";
import { orchestrateEdit } from "@travelmate/orchestrator";
import { deps } from "../index.js";

export async function modifyRoutes(app: FastifyInstance) {
  app.post<{ Body: unknown }>("/modify", async (request, reply) => {
    let edit;
    try {
      edit = PlanEditSchema.parse(request.body);
    } catch (err) {
      return reply.status(400).send({ code: "INVALID_INPUT", message: String(err) });
    }

    try {
      const result = await orchestrateEdit(edit, deps, {
        onThought: (t) => request.log.info({ reflow: t }),
      });
      return reply.send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const notFound = /not found/i.test(message);
      return reply.status(notFound ? 404 : 500).send({
        code: notFound ? "NOT_FOUND" : "REFLOW_FAILED",
        message,
      });
    }
  });
}
