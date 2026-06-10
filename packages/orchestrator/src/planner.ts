/**
 * Stage 2 — Fetch Planner. TripBrief → FetchPlan → NormalizedResult[].
 * MVP: returns an empty fetch plan (synthesis runs on LLM knowledge).
 * Real fetchers wire in at M2 behind the same interface — the Orchestrator won't change.
 */
import type { TripBrief, FetchPlan, NormalizedResult } from "@travelmate/contracts";
import type { Database } from "@travelmate/database";

export async function buildFetchPlan(_brief: TripBrief): Promise<FetchPlan> {
  // MVP: no live fetchers yet — synthesis uses LLM knowledge, all estimates labelled.
  return { requests: [] };
}

export async function resolveData(
  _plan: FetchPlan,
  _db: Database,
): Promise<NormalizedResult[]> {
  // MVP: nothing to fetch. Returns empty array.
  // M2: run each FetchRequest against the matching fetcher, check freshness first.
  return [];
}
