/**
 * The Observer. The UX subscribes here and re-renders on notify — it NEVER reads
 * a plan via a callback from the Orchestrator (no onComplete). This is what keeps
 * the Single-Source-of-Truth rule honest (P5, projectStructure.md §4).
 */
import type { TripPlan } from "@travelmate/contracts";

export type PlanListener = (plan: TripPlan) => void;

export interface PlanObserver {
  subscribeToPlan(planId: string, listener: PlanListener): () => void;
  /** Called by the persistence layer after savePlan — fans out to subscribers. */
  notify(plan: TripPlan): void;
}
