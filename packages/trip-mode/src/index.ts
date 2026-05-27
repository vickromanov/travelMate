/**
 * @travelmate/trip-mode — Highlight H5. Reads the approved plan from the
 * Database, runs the scheduler + state machine, emits TripModeEvents the UX
 * subscribes to. Imports only contracts + database (import matrix §2).
 */
import { NotImplemented } from "@travelmate/contracts";
import type { Database } from "@travelmate/database";

export * from "./scheduler.js";
export * from "./state-machine.js";
export * from "./notifications.js";

export interface TripModeEngine {
  /** Begin live guidance for an approved plan. */
  start(planId: string): Promise<void>;
  /** Feed a position/time tick; may emit events + notifications. */
  tick(planId: string, at: string): Promise<void>;
  stop(planId: string): Promise<void>;
}

export function createTripModeEngine(_db: Database): TripModeEngine {
  throw new NotImplemented("trip-mode.createTripModeEngine");
}
