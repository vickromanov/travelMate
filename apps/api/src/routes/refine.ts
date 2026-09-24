/**
 * POST /plan/refine — SSE endpoint for chat-based itinerary refinement.
 *
 * SEC-1 fixes applied:
 * - requireAuth: only authenticated users can call this endpoint.
 * - planId-based loading: the route loads the plan from the DB and ignores the
 *   client's copy of the plan body (prevents plan-takeover / stored-XSS).
 * - Rate limiting: per-user limit on this LLM-backed endpoint.
 * - observer.notify: called after save so subscribers (SSE channels) receive the update.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { refinePlan } from "@travelmate/orchestrator";
import { deps } from "../index.js";
import { requireAuth } from "../middleware/session.js";
import { rateLimit } from "../middleware/rate-limit.js";

const RefineBodySchema = z.object({
  message: z.string().min(1, "message is required"),
  planId: z.string().min(1, "planId is required"),
});

function sseWrite(raw: { write: (s: string) => void }, event: string, data: unknown) {
  raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function refineRoutes(app: FastifyInstance) {
  // SEC-6: Stricter rate limit on this LLM endpoint — per authenticated user.
  const llmRateLimit = rateLimit({ max: 10, windowMs: 60_000, keyBy: "user" });

  app.post<{ Body: unknown }>(
    "/plan/refine",
    { preHandler: [requireAuth, llmRateLimit] },
    (request, reply) => {
      // SEC-1: Parse only message + planId from the body — ignore any plan the client sends.
      const parsed = RefineBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          code: "INVALID_INPUT",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
        });
      }
      const { message, planId } = parsed.data;

      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.setHeader("X-Accel-Buffering", "no");
      const origin = request.headers.origin;
      const allowed = process.env.CORS_ORIGIN ?? "http://localhost:3000";
      if (origin === allowed) {
        reply.raw.setHeader("Access-Control-Allow-Origin", allowed);
        reply.raw.setHeader("Access-Control-Allow-Credentials", "true");
      }
      reply.raw.flushHeaders?.();

      let closed = false;
      request.raw.on("close", () => { closed = true; });

      void (async () => {
        try {
          // SEC-1: Load the plan from the DB — never trust the client's copy.
          const plan = await deps.db.plans.getPlan(planId);
          if (!plan) {
            if (!closed) {
              sseWrite(reply.raw, "error", { message: "Plan not found" });
              reply.raw.end();
            }
            return;
          }

          // TODO (REL-1 / SEC-2): Once the Postgres adapter stores userId on plans,
          // enforce ownership here: if (plan.userId !== request.user!.id) → 403.
          // For now the in-memory store has no userId, so we skip the ownership check.

          const result = await refinePlan(plan, message.trim(), deps.llm, {
            onThought: (thought) => {
              if (!closed) sseWrite(reply.raw, "thought", { text: thought });
            },
            onPartialPlan: (partial) => {
              if (!closed) sseWrite(reply.raw, "partial", partial);
            },
            onError: (err) => {
              if (!closed) sseWrite(reply.raw, "error", { message: err.message });
            },
          });

          if (!closed) {
            // SEC-1: Orchestrator is the sole writer — save via the DB layer.
            await deps.db.plans.savePlan(result.plan);
            // SEC-1: Notify observers so SSE subscribers on other channels receive the update.
            deps.db.observer.notify(result.plan);
            sseWrite(reply.raw, "ready", result.plan);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!closed) sseWrite(reply.raw, "error", { message: msg });
        } finally {
          if (!closed) reply.raw.end();
        }
      })();

      return reply;
    },
  );
}
