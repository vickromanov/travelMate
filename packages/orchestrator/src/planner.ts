/**
 * Stage 2 — Fetch Planner. TripBrief → FetchPlan. Checks the Database FIRST;
 * only stale/missing categories are fetched, in parallel. Mostly deterministic
 * (light LLM only to disambiguate). projectStructure.md §2 Refinement 1.
 */
import { NotImplemented } from "@travelmate/contracts";
import type {
  TripBrief,
  FetchPlan,
  NormalizedResult,
} from "@travelmate/contracts";
import type { Database } from "@travelmate/database";

export async function buildFetchPlan(_brief: TripBrief): Promise<FetchPlan> {
  throw new NotImplemented("orchestrator.buildFetchPlan");
}

/** Freshness check + parallel fetch of only the stale/missing categories. */
export async function resolveData(
  _plan: FetchPlan,
  _db: Database,
): Promise<NormalizedResult[]> {
  throw new NotImplemented("orchestrator.resolveData");
}
