/**
 * apps/api — HTTP host. Fastify server with SSE for the plan pipeline.
 * Singleton db + llm shared across all requests.
 */
// Load .env.local before any other module reads process.env
import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env.local") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { createDatabase } from "@travelmate/database";
import { createLLMClient } from "@travelmate/llm";
import type { Deps } from "@travelmate/orchestrator";
import { planRoutes } from "./routes/plan.js";

export const db = createDatabase("memory");
export const llm = createLLMClient();
export const deps: Deps = { db, llm };

export async function startServer(port = Number(process.env.API_PORT ?? 8080)) {
  const app = Fastify({ logger: { level: "info" } });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000", // Next.js dev default
    methods: ["GET", "POST", "OPTIONS"],
  });

  await app.register(planRoutes);

  app.get("/health", async () => ({ status: "ok" }));

  await app.listen({ port, host: "0.0.0.0" });
  console.log(`[api] listening on http://localhost:${port}`);
}

// Entry point when run directly
const isMain = process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js");
if (isMain) {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
