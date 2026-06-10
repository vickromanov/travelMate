/**
 * The ONLY way the web app talks to the backend: POST to apps/api. The UX must
 * NEVER import the Orchestrator/Fetchers/LLM (import matrix §2). After POST, the
 * UX subscribes to the plan via the Database Observer — it does not read the
 * plan from the HTTP response (P5, no onComplete).
 */
import { NotImplemented } from "@travelmate/contracts";
import type { CrucialInfo, PlanEdit } from "@travelmate/contracts";

// Server URL — set NEXT_PUBLIC_API_BASE_URL in .env.local to override.
export const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export async function requestPlan(_info: CrucialInfo): Promise<void> {
  void BASE;
  throw new NotImplemented("web.api-client.requestPlan");
}

export async function requestEdit(_edit: PlanEdit): Promise<void> {
  throw new NotImplemented("web.api-client.requestEdit");
}
