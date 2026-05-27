/**
 * Orchestrator → UX streaming callbacks.
 *
 * ⚠️ There is intentionally NO `onComplete`. The UX learns a plan is ready by
 * subscribing to the Database Observer, never via a callback. This keeps the
 * Single-Source-of-Truth rule honest (about_travelMate.md P5, projectStructure.md §4).
 */
export interface StreamCallbacks {
    /** Inference-chain entries + progress, streamed before any heavy work (P1). */
    onThought: (thought: string) => void;
    /** Optional partial itinerary for perceived-latency streaming (§7.3 #9). */
    onPartialPlan?: (partial: unknown) => void;
    onError: (error: Error) => void;
}
//# sourceMappingURL=stream.d.ts.map