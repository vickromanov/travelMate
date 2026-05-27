/**
 * Turns an APPROVED TripPlan into an ordered queue of timed TripModeEvents
 * (e.g. T-15min "leave for dinner"). projectStructure.md §3.4.
 */
import { NotImplemented } from "@travelmate/contracts";
import type { TripPlan, TripModeEvent } from "@travelmate/contracts";

export function buildEventQueue(_plan: TripPlan): TripModeEvent[] {
  throw new NotImplemented("trip-mode.buildEventQueue");
}
