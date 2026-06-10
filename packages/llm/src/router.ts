/**
 * THE ONLY PLACE MODEL IDS APPEAR IN THE CODEBASE. projectStructure.md §7.4.
 *
 * Each Orchestrator stage declares the cheapest capable tier and escalates only
 * on a *validated* failure. Changing a model = a one-file, ADR-recorded change.
 *
 * Provider model strings are placeholders for the skeleton — confirm exact IDs
 * with the provider before the implementation phase, and record in an ADR.
 */
import type { LLMStage, ModelTier } from "@travelmate/contracts";

/** Concrete model per (provider, tier). Verified 2026-06 against provider docs. */
export const MODEL_TABLE: Record<string, Record<ModelTier, string>> = {
  anthropic: {
    fast: "claude-haiku-4-5-20251001",
    mid: "claude-sonnet-4-6",
    frontier: "claude-opus-4-8",
  },
  gemini: {
    fast: "gemini-2.5-flash",
    mid: "gemini-2.5-pro",
    frontier: "gemini-2.5-pro",
  },
  mock: { fast: "mock", mid: "mock", frontier: "mock" },
};

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
