/**
 * Stage 4 — Re-flow (Highlight H4). Given one edited block, recompute ONLY its
 * dependents from already-cached data. Walks `ItineraryBlock.dependencyLogic`.
 * Often NO LLM at all; at most a tiny `fast`-tier re-rank over cached candidates.
 *
 * ⚠️ Stage 3 (Synthesis) is NEVER run here. No re-fetch. This split is the single
 * most important cost decision in the project (projectStructure.md §2 + §7.3 #7).
 */
import { NotImplemented } from "@travelmate/contracts";
import type { TripPlan, PlanEdit } from "@travelmate/contracts";
import type { Database } from "@travelmate/database";
import type { LLMClient } from "@travelmate/llm";

export async function reflow(
  _edit: PlanEdit,
  _db: Database,
  _llm: LLMClient,
): Promise<TripPlan> {
  throw new NotImplemented("orchestrator.reflow");
}
