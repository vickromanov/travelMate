/**
 * Orchestrator → UX streaming callbacks.
 *
 * ⚠️ There is intentionally NO `onComplete`. The UX learns a plan is ready by
 * subscribing to the Database Observer, never via a callback. This keeps the
 * Single-Source-of-Truth rule honest (about_travelMate.md P5, projectStructure.md §4).
 */
import type { TripPlan } from "./trip.js";

export interface StreamCallbacks {
  /** Inference-chain entries + progress, streamed before any heavy work (P1). */
  onThought: (thought: string) => void;
  /**
   * Progressive delivery (§7.3 #9): a valid TripPlan containing the days
   * generated SO FAR — emitted after each day completes so the UX can render
   * day 1 while day 2+ are still being written. The FINAL plan still arrives
   * via the Database Observer; partials are for display only, never persisted.
   */
  onPartialPlan?: (partial: TripPlan) => void;
  onError: (error: Error) => void;
}
