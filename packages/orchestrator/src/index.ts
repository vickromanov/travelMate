/**
 * @travelmate/orchestrator — the brain. The ONLY package that writes to the
 * Database. NEVER imported by the UX (import matrix, projectStructure.md §2).
 */
import type { CrucialInfo, PlanEdit, StreamCallbacks } from "@travelmate/contracts";
import { runPlanPipeline, type Deps, type PipelineOptions } from "./pipeline.js";
import { reflow, type ReflowResult } from "./reflow.js";

export * from "./pipeline.js";
export { extractIntent } from "./intent.js";
export { buildFetchPlan, resolveData } from "./planner.js";
export { curateResearch, formatResearchForPrompt } from "./curate.js";
export type { CuratedResearch, CuratedItem } from "./curate.js";
export { buildTripSkeleton } from "./skeleton.js";
export type { TripSkeleton, SkeletonDay } from "./skeleton.js";
export { synthesizePlan } from "./synthesis.js";
export { reflow, deriveDependents } from "./reflow.js";
export type { ReflowResult } from "./reflow.js";
export { refinePlan } from "./refine.js";
export type { RefineResult } from "./refine.js";
export { validatePlanQuality, formatQualityReport } from "./quality.js";
export type { QualityIssue, QualityReport } from "./quality.js";
export { verifyDayLinks, mapsSearchUrl } from "./verify-links.js";
export type { LinkReport } from "./verify-links.js";
export { enforceConsistency, isFreeWalkIn } from "./consistency.js";
export type { ConsistencyReport } from "./consistency.js";
export { verifyVenues } from "./verify-venues.js";
export type { VenueCheckResult } from "./verify-venues.js";
export { extractMemories } from "./memory.js";
export type { ExtractedMemory } from "./memory.js";

/** Public entrypoint A: build a brand-new plan from user input. */
export async function orchestrate(
  input: CrucialInfo,
  deps: Deps,
  cb: StreamCallbacks,
  planIdOrOpts?: string | PipelineOptions,
): Promise<void> {
  return runPlanPipeline(input, deps, cb, planIdOrOpts);
}

/** Public entrypoint B: apply one edit via scoped re-flow (H4). */
export async function orchestrateEdit(
  edit: PlanEdit,
  deps: Deps,
  cb?: Pick<StreamCallbacks, "onThought">,
): Promise<ReflowResult> {
  return reflow(edit, deps.db, deps.llm, cb);
}
