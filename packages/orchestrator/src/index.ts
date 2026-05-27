/**
 * @travelmate/orchestrator — the brain. The ONLY package that writes to the
 * Database. NEVER imported by the UX (import matrix, projectStructure.md §2).
 */
import { NotImplemented } from "@travelmate/contracts";
import type { CrucialInfo, PlanEdit, StreamCallbacks } from "@travelmate/contracts";
import type { Deps } from "./pipeline.js";

export * from "./pipeline.js";
export { extractIntent } from "./intent.js";
export { buildFetchPlan, resolveData } from "./planner.js";
export { synthesizePlan } from "./synthesis.js";
export { reflow } from "./reflow.js";

/** Public entrypoint A: build a brand-new plan from user input. */
export async function orchestrate(
  _input: CrucialInfo,
  _deps: Deps,
  _cb: StreamCallbacks,
): Promise<void> {
  throw new NotImplemented("orchestrator.orchestrate");
}

/** Public entrypoint B: apply one edit via scoped re-flow (H4). */
export async function orchestrateEdit(
  _edit: PlanEdit,
  _deps: Deps,
): Promise<void> {
  throw new NotImplemented("orchestrator.orchestrateEdit");
}
