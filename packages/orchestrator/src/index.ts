/**
 * @travelmate/orchestrator — the brain. The ONLY package that writes to the
 * Database. NEVER imported by the UX (import matrix, projectStructure.md §2).
 */
import type { CrucialInfo, PlanEdit, StreamCallbacks } from "@travelmate/contracts";
import { NotImplemented } from "@travelmate/contracts";
import { runPlanPipeline, type Deps } from "./pipeline.js";

export * from "./pipeline.js";
export { extractIntent } from "./intent.js";
export { buildFetchPlan, resolveData } from "./planner.js";
export { curateResearch, formatResearchForPrompt } from "./curate.js";
export type { CuratedResearch, CuratedItem } from "./curate.js";
export { synthesizePlan } from "./synthesis.js";
export { reflow } from "./reflow.js";
export { validatePlanQuality, formatQualityReport } from "./quality.js";
export type { QualityIssue, QualityReport } from "./quality.js";

/** Public entrypoint A: build a brand-new plan from user input. */
export async function orchestrate(
  input: CrucialInfo,
  deps: Deps,
  cb: StreamCallbacks,
  planId?: string,
): Promise<void> {
  return runPlanPipeline(input, deps, cb, planId);
}

/** Public entrypoint B: apply one edit via scoped re-flow (H4). */
export async function orchestrateEdit(
  _edit: PlanEdit,
  _deps: Deps,
): Promise<void> {
  throw new NotImplemented("orchestrator.orchestrateEdit");
}
