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
 * Gemini free-tier cascade — ordered by RPD capacity to maximise daily throughput.
 * On any error (503, 429, 404, fetch-fail) → skip to next model.
 * Updated 2026-06-24 from API rate-limit dashboard (TravelMateVictor project).
 *
 * RPD = requests per day on free tier:
 *   gemini-3.1-flash-lite-preview → 500  RPD, 15 RPM  (best daily capacity)
 *   gemma-4-31b-it                → 1500 RPD, 15 RPM, unlimited TPM
 *   gemma-4-26b-a4b-it            → 1500 RPD, 15 RPM, unlimited TPM
 *   gemini-2.5-flash              → 20   RPD, 5  RPM  (best quality — conserve)
 *   gemini-2.5-flash-lite         → 20   RPD, 10 RPM
 *   gemini-3-flash-preview        → 20   RPD, 5  RPM
 *   gemini-3.5-flash              → 20   RPD, 5  RPM
 */
export const GEMINI_CASCADE: readonly string[] = [
  "gemini-3.1-flash-lite-preview",
  "gemma-4-31b-it",
  "gemma-4-26b-a4b-it",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
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
