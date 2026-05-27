/**
 * Per-trip state machine: tracks now / next / done across blocks, advances on
 * arrival or time, folds in the traveler's current position. Skeleton.
 */
import { NotImplemented } from "@travelmate/contracts";
import type { TripModeEvent } from "@travelmate/contracts";

export interface TripState {
  planId: string;
  currentBlockId: string | null;
  doneBlockIds: string[];
}

export function advance(
  _state: TripState,
  _trigger: { kind: "time" | "arrived"; at: string },
): { state: TripState; emit: TripModeEvent[] } {
  throw new NotImplemented("trip-mode.advance");
}
