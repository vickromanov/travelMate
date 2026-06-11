/**
 * THE ONLY PLACE MODEL IDS APPEAR IN THE CODEBASE. projectStructure.md §7.4.
 *
 * Each Orchestrator stage declares the cheapest capable tier and escalates only
 * on a *validated* failure. Changing a model = a one-file, ADR-recorded change.
 */
import type { LLMStage, ModelTier } from "@travelmate/contracts";

/** Concrete model per (provider, tier) — used by Anthropic. Gemini uses GEMINI_CASCADE instead. */
export const MODEL_TABLE: Record<string, Record<ModelTier, string>> = {
  anthropic: {
    fast: "claude-haiku-4-5-20251001",
    mid: "claude-sonnet-4-6",
    frontier: "claude-opus-4-8",
  },
  mock: { fast: "mock", mid: "mock", frontier: "mock" },
};

/**
 * Gemini free-tier cascade — ordered most-to-least capable.
 * On any error (503, 429, 404) → skip to next model.
 * Verified against Google AI Studio rate limits 2026-06-10.
 *
 * RPD = requests per day on free tier:
 *   gemini-3.5-flash              → 20  (newest generation — try first; skip on 404)
 *   gemini-3.1-flash-lite-preview → 500 (highest daily free quota)
 *   gemini-3-flash-preview        → 20
 *   gemini-2.5-flash              → 20  (proven working)
 *   gemini-2.5-flash-lite         → 20
 *   gemma-4-31b-it                → 1,500 (unlimited TPM — best high-volume fallback)
 *   gemma-4-26b-a4b-it            → 1,500 (unlimited TPM)
 */
export const GEMINI_CASCADE: readonly string[] = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemma-4-31b-it",
  "gemma-4-26b-a4b-it",
] as const;

/** Default tier per stage (projectStructure.md §7.2). Escalation goes fast→mid→frontier. */
export const STAGE_DEFAULT_TIER: Record<LLMStage, ModelTier> = {
  intent: "fast",
  "fetch-planner": "fast",
  synthesis: "mid",
  reflow: "fast",
  qa: "fast",
};

/** Max escalation tier per stage. Synthesis is the only path allowed to reach frontier. */
export const STAGE_MAX_TIER: Record<LLMStage, ModelTier> = {
  intent: "mid",
  "fetch-planner": "mid",
  synthesis: "frontier",
  reflow: "mid",
  qa: "mid",
};

export function nextTier(t: ModelTier): ModelTier | null {
  return t === "fast" ? "mid" : t === "mid" ? "frontier" : null;
}
