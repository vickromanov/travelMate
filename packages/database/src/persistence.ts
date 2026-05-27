/**
 * Long-lived state (Postgres): users, saved/approved trips, Trip-Mode progress.
 * Separate lifetime/store from the cache — conflating them is the trap
 * projectStructure.md §2 Refinement 3 calls out.
 */
import type { TripPlan } from "@travelmate/contracts";

export interface PersistenceStore {
  savePlan(plan: TripPlan): Promise<void>;
  getPlan(planId: string): Promise<TripPlan | null>;
  approvePlan(planId: string): Promise<void>;
  listPlans(userId: string): Promise<TripPlan[]>;
}
