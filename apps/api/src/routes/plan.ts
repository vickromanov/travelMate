/**
 * POST /plan    — validate CrucialInfo, start pipeline, return planId immediately.
 * GET /plan/:id/stream — SSE: thought events + plan-ready event.
 * GET /plan/:id — return the saved plan JSON.
 */
import { randomUUID } from "crypto";
import { EventEmitter } from "events";
import type { FastifyInstance } from "fastify";
import { CrucialInfoSchema, type TripPlan } from "@travelmate/contracts";
import { orchestrate } from "@travelmate/orchestrator";
import { deps } from "../index.js";

// Per-plan event bus bridging the pipeline callbacks → SSE connections
const planBus = new Map<string, EventEmitter>();

function getBus(planId: string): EventEmitter {
  if (!planBus.has(planId)) planBus.set(planId, new EventEmitter());
  return planBus.get(planId)!;
}

function sseWrite(reply: { raw: { write: (s: string) => void } }, event: string, data: unknown) {
  reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function planRoutes(app: FastifyInstance) {
  // POST /plan
  app.post<{ Body: unknown }>("/plan", async (request, reply) => {
    let info;
    try {
      info = CrucialInfoSchema.parse(request.body);
    } catch (err) {
      return reply.status(400).send({ code: "INVALID_INPUT", message: String(err) });
    }

    const planId = randomUUID();
    const bus = getBus(planId);

    // Subscribe to DB observer before starting the pipeline so we never miss the notify
    const unsubscribe = deps.db.observer.subscribeToPlan(planId, (plan: TripPlan) => {
      bus.emit("ready", plan);
    });

    // Fire-and-forget: pipeline runs while client connects to SSE
    void orchestrate(info, deps, {
      onThought: (thought) => bus.emit("thought", thought),
      onError: (err) => {
        bus.emit("error", err.message);
        unsubscribe();
        planBus.delete(planId);
      },
    }).then(() => {
      // Pipeline done — unsubscribe after a brief delay to let SSE drain
      setTimeout(() => { unsubscribe(); planBus.delete(planId); }, 30_000);
    });

    return reply.send({ planId });
  });

  // GET /plan/:id/stream — SSE
  app.get<{ Params: { id: string } }>("/plan/:id/stream", (request, reply) => {
    const { id } = request.params;
    const bus = getBus(id);

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    reply.raw.flushHeaders?.();

    const onThought = (thought: string) => sseWrite(reply, "thought", { text: thought });
    const onReady = (plan: TripPlan) => {
      sseWrite(reply, "ready", plan);
      cleanup();
      reply.raw.end();
    };
    const onError = (message: string) => {
      sseWrite(reply, "error", { message });
      cleanup();
      reply.raw.end();
    };

    function cleanup() {
      bus.off("thought", onThought);
      bus.off("ready", onReady);
      bus.off("error", onError);
    }

    bus.on("thought", onThought);
    bus.on("ready", onReady);
    bus.on("error", onError);

    request.raw.on("close", cleanup);

    // Keep the reply open (Fastify would auto-close otherwise)
    return reply;
  });

  // GET /plan/:id — fetch saved plan
  app.get<{ Params: { id: string } }>("/plan/:id", async (request, reply) => {
    const plan = await deps.db.plans.getPlan(request.params.id);
    if (!plan) return reply.status(404).send({ code: "NOT_FOUND" });
    return reply.send(plan);
  });
}
