/**
 * Wires the stages into the unidirectional flow (projectStructure.md §5).
 * savePlan() is ALWAYS the final write; the UX learns of the result via the
 * Database Observer, never a callback (no onComplete).
 */
import type { CrucialInfo, StreamCallbacks } from "@travelmate/contracts";
import type { Database } from "@travelmate/database";
import type { LLMClient } from "@travelmate/llm";
import { extractIntent } from "./intent.js";
import { buildFetchPlan, resolveData } from "./planner.js";
import { curateResearch } from "./curate.js";
import { synthesizePlan } from "./synthesis.js";

export interface Deps {
  db: Database;
  llm: LLMClient;
}

/**
 * Full plan pipeline:
 *   1  extractIntent → onThought(inferenceChain)   (before any fetch — P1)
 *   2a buildFetchPlan → resolveData (freshness check, only-stale; MVP: empty)
 *   2b curateResearch — think about the best activities/stays/dining for THIS
 *      traveler BEFORE composing anything
 *   3  synthesizePlan — composes from the curated candidates
 *   4  db.plans.savePlan()  ← last write; observer notifies the UX
 */
export async function runPlanPipeline(
  input: CrucialInfo,
  deps: Deps,
  cb: StreamCallbacks,
  planId?: string,
): Promise<void> {
  try {
    // Stage 1: intent
    const brief = await extractIntent(input, deps.llm, cb);

    // Stage 2a: fetch (MVP: empty)
    const fetchPlan = await buildFetchPlan(brief);
    const data = await resolveData(fetchPlan, deps.db);

    // Stage 2b: research the best options for this specific traveler
    const research = await curateResearch(brief, deps.llm, cb);

    // Stage 3: synthesis — use caller-supplied planId so observer subscription matches
    const plan = await synthesizePlan(brief, data, research, deps.llm, cb, planId);

    // Stage 4: persist + notify (order matters — save before notify)
    await deps.db.plans.savePlan(plan);
    deps.db.observer.notify(plan);
  } catch (err) {
    cb.onError(err instanceof Error ? err : new Error(String(err)));
  }
}
