/**
 * Wires the four stages into the unidirectional flow (projectStructure.md §5).
 * Order is load-bearing: savePlan() is ALWAYS the final write; the UX learns of
 * the result via the Database Observer, never a callback (no onComplete).
 */
import { NotImplemented } from "@travelmate/contracts";
import type { CrucialInfo, StreamCallbacks } from "@travelmate/contracts";
import type { Database } from "@travelmate/database";
import type { LLMClient } from "@travelmate/llm";

export interface Deps {
  db: Database;
  llm: LLMClient;
}

/**
 * Full plan pipeline:
 *   1 extractIntent → onThought(inferenceChain)   (before any fetch — P1)
 *   2 buildFetchPlan → resolveData (freshness check, parallel, only-stale)
 *   3 synthesizePlan
 *   4 db.savePlan()  ← last write; Observer notifies the UX
 */
export async function runPlanPipeline(
  _input: CrucialInfo,
  _deps: Deps,
  _cb: StreamCallbacks,
): Promise<void> {
  throw new NotImplemented("orchestrator.runPlanPipeline");
}
