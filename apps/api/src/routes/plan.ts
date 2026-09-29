/**
 * POST /plan    — validate CrucialInfo, start pipeline, return planId immediately.
 * GET /plan/:id/stream — SSE: thought events + partial plans + plan-ready event.
 * GET /plan/:id — return the saved plan JSON.
 */
import { randomUUID } from "crypto";
import { EventEmitter } from "events";
import type { FastifyInstance } from "fastify";
import {
  CrucialInfoSchema,
  UserPreferencesSchema,
  type TripPlan,
  type MemoryEntry,
} from "@travelmate/contracts";
import { getPrisma } from "@travelmate/database";
import { orchestrate, extractMemories } from "@travelmate/orchestrator";
import { deps } from "../index.js";
import { requireAuth } from "../middleware/session.js";
import { rateLimit } from "../middleware/rate-limit.js";

// Per-plan event bus bridging the pipeline callbacks → SSE connections.
// latestPartial is kept so a client that connects late — or whose EventSource
// silently RECONNECTS mid-generation — immediately receives the days already
// generated instead of waiting blind until "ready".
interface PlanChannel {
  bus: EventEmitter;
  latestPartial?: TripPlan;
}
const planBus = new Map<string, PlanChannel>();

function getChannel(planId: string): PlanChannel {
  if (!planBus.has(planId)) {
    const bus = new EventEmitter();
    bus.on("error", () => {}); // prevent unhandled error crash
    planBus.set(planId, { bus });
  }
  return planBus.get(planId)!;
}

function sseWrite(reply: { raw: { write: (s: string) => void } }, event: string, data: unknown) {
  reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function planRoutes(app: FastifyInstance) {
  const planRateLimit = rateLimit({ max: 5, windowMs: 60_000, keyBy: "user" });

  // POST /plan
  app.post<{ Body: unknown }>("/plan", { preHandler: [planRateLimit] }, async (request, reply) => {
    let info;
    try {
      info = CrucialInfoSchema.parse(request.body);
    } catch (_err) {
      // SEC-8: Return a sanitized message, not raw ZodError internals
      return reply.status(400).send({ code: "INVALID_INPUT", message: "Invalid plan request" });
    }

    let userMemories: Array<{ category: string; fact: string }> = [];

    if (request.user) {
      const prisma = getPrisma();
      const row = await prisma.user.findUnique({
        where: { id: request.user.id },
        select: { preferences: true, memories: true },
      });
      if (row?.preferences && !info.userPreferences) {
        const prefs = UserPreferencesSchema.safeParse(row.preferences);
        if (prefs.success) {
          info = { ...info, userPreferences: prefs.data };
          if (prefs.data.homeCity && !info.origin) {
            info = { ...info, origin: prefs.data.homeCity };
          }
        }
      }
      if (Array.isArray(row?.memories)) {
        userMemories = (row.memories as MemoryEntry[])
          .map((m) => ({ category: m.category, fact: m.fact }));
      }
    }

    const userId = request.user?.id ?? null;
    const planId = randomUUID();
    const channel = getChannel(planId);
    const { bus } = channel;

    // Subscribe to DB observer before starting the pipeline so we never miss the notify
    const unsubscribe = deps.db.observer.subscribeToPlan(planId, (plan: TripPlan) => {
      bus.emit("ready", plan);
    });

    // Fire-and-forget: pipeline runs while client connects to SSE
    void orchestrate(info, deps, {
      onThought: (thought) => bus.emit("thought", thought),
      onPartialPlan: (partial) => {
        channel.latestPartial = partial;
        bus.emit("partial", partial);
      },
      onError: (err) => {
        bus.emit("error", err.message);
        unsubscribe();
        planBus.delete(planId);
      },
    }, { planId, memories: userMemories }).then(async () => {
      if (userId) {
        try {
          const plan = await deps.db.plans.getPlan(planId);
          if (plan) {
            const prisma = getPrisma();
            await prisma.trip.create({
              data: {
                userId,
                title: plan.title ?? info.destination,
                brief: info.freeformText ?? info.travelerDescription,
                data: JSON.parse(JSON.stringify(plan)),
              },
            });
          }
        } catch (err) {
          console.error("[plan] Failed to save trip:", err);
        }
      }
      setTimeout(() => { unsubscribe(); planBus.delete(planId); }, 30_000);
    });

    // Fire-and-forget: extract memories from the trip description (non-blocking)
    if (userId) {
      const tripText = `${info.destination} ${info.travelerDescription} ${info.freeformText ?? ""}`.trim();
      void (async () => {
        try {
          const prisma = getPrisma();
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { memories: true },
          });
          const existing = Array.isArray(user?.memories)
            ? (user.memories as MemoryEntry[])
            : [];
          const extracted = await extractMemories(tripText, existing, deps.llm);
          if (extracted.length === 0) return;
          const now = new Date().toISOString();
          const newEntries: MemoryEntry[] = extracted.map((e) => ({
            id: randomUUID(),
            category: e.category,
            fact: e.fact,
            source: "auto",
            createdAt: now,
            updatedAt: now,
          }));
          const merged = [...existing, ...newEntries].slice(0, 50);
          await prisma.user.update({
            where: { id: userId },
            data: { memories: JSON.parse(JSON.stringify(merged)) },
          });
        } catch (err) {
          console.error("[plan] Memory extraction failed (non-critical):", err);
        }
      })();
    }

    return reply.send({ planId });
  });

  // GET /plan/:id/stream — SSE
  // SEC-2 TODO: EventSource does not support custom headers, so we cannot require a
  // session cookie here without a signed stream-token pattern. The planId is a
  // randomly-generated UUID (256-bit equivalent via randomUUID) — guessing it is
  // not practical. A proper fix (short-lived signed stream token issued by POST /plan)
  // is tracked in REL-3. The endpoint is deliberately left open for now.
  app.get<{ Params: { id: string } }>("/plan/:id/stream", (request, reply) => {
    const { id } = request.params;
    const channel = getChannel(id);
    const { bus } = channel;

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    // @fastify/cors only runs on Fastify's response pipeline; raw writes bypass it.
    const origin = request.headers.origin;
    const allowed = process.env.CORS_ORIGIN ?? "http://localhost:3000";
    if (origin === allowed) {
      reply.raw.setHeader("Access-Control-Allow-Origin", allowed);
      reply.raw.setHeader("Access-Control-Allow-Credentials", "true");
    }
    reply.raw.flushHeaders?.();

    const onThought = (thought: string) => sseWrite(reply, "thought", { text: thought });
    const onPartial = (plan: TripPlan) => sseWrite(reply, "partial", plan);
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
      bus.off("partial", onPartial);
      bus.off("ready", onReady);
      bus.off("error", onError);
    }

    bus.on("thought", onThought);
    bus.on("partial", onPartial);
    bus.on("ready", onReady);
    bus.on("error", onError);

    // Replay: a late or RECONNECTING client immediately gets the days that are
    // already generated — it never waits blind while "day 2" is being written.
    if (channel.latestPartial) {
      sseWrite(reply, "partial", channel.latestPartial);
    }

    request.raw.on("close", cleanup);

    // Keep the reply open (Fastify would auto-close otherwise)
    return reply;
  });

  // GET /plan/:id — fetch saved plan (auth required)
  // SEC-2: Requires auth + verifies the plan belongs to the logged-in user.
  app.get<{ Params: { id: string } }>("/plan/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const plan = await deps.db.plans.getPlan(request.params.id);
    if (!plan) return reply.status(404).send({ code: "NOT_FOUND" });

    // Cross-check ownership via the Prisma Trip table (written on generation).
    // The in-memory PersistenceStore has no userId, so we fall back to the DB.
    // TODO (REL-1): Once Postgres PersistenceStore stores userId on every plan,
    // replace this with plan.userId !== request.user!.id.
    const prisma = getPrisma();
    const trip = await prisma.trip.findFirst({
      where: { userId: request.user!.id, data: { path: ["planId"], equals: request.params.id } },
      select: { id: true },
    }).catch(() => null);
    if (!trip) {
      return reply.status(403).send({ code: "FORBIDDEN", message: "Access denied" });
    }

    return reply.send(plan);
  });
}
