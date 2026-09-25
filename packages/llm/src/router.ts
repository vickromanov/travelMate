/**
 * THE ONLY PLACE MODEL IDS APPEAR IN THE CODEBASE. projectStructure.md §7.4.
 *
 * MODEL_ROUTING maps each pipeline stage to an ordered list of (provider, model)
 * candidates — smallest sufficient model first. On error (429, 5xx, timeout)
 * the next candidate is tried automatically.
 */
import type { LLMStage, ModelTier } from "@travelmate/contracts";

// ── Model routing table ─────────────────────────────────────────────────────

export interface ModelCandidate {
  provider: "groq" | "cerebras" | "gemini";
  model: string;
}

/**
 * Per-stage candidate lists. Cheapest / fastest first; quality last.
 *
 * Free-tier limits (verified 2026-09-25):
 *   Groq:     openai/gpt-oss-20b  — 30 RPM, 1K RPD, 8K TPM
 *             openai/gpt-oss-120b — 30 RPM, 1K RPD, 8K TPM
 *             qwen/qwen3.8-27b    — 30 RPM, 1K RPD, 8K TPM
 *   Cerebras: qwen-3.8-27b        — 5 RPM, 1M TPD
 *             gpt-oss-120b        — 5 RPM, 1M TPD
 *   Gemini:   gemini-3.5-flash    — free tier
 *             gemini-3.8-flash    — free tier
 */
export const MODEL_ROUTING: Record<LLMStage, ModelCandidate[]> = {
  intent: [
    { provider: "groq", model: "openai/gpt-oss-20b" },
    { provider: "cerebras", model: "qwen-3.8-27b" },
    { provider: "groq", model: "openai/gpt-oss-120b" },
    { provider: "gemini", model: "gemini-3.5-flash" },
    { provider: "gemini", model: "gemini-3.8-flash" },
  ],
  "fetch-planner": [
    { provider: "groq", model: "openai/gpt-oss-20b" },
    { provider: "cerebras", model: "qwen-3.8-27b" },
    { provider: "gemini", model: "gemini-3.5-flash" },
  ],
  synthesis: [
    { provider: "groq", model: "openai/gpt-oss-120b" },
    { provider: "cerebras", model: "gpt-oss-120b" },
    { provider: "groq", model: "qwen/qwen3.8-27b" },
    { provider: "cerebras", model: "qwen-3.8-27b" },
    { provider: "gemini", model: "gemini-3.8-flash" },
  ],
  reflow: [
    { provider: "groq", model: "openai/gpt-oss-20b" },
    { provider: "cerebras", model: "qwen-3.8-27b" },
    { provider: "groq", model: "openai/gpt-oss-120b" },
    { provider: "gemini", model: "gemini-3.5-flash" },
  ],
  qa: [
    { provider: "groq", model: "openai/gpt-oss-20b" },
    { provider: "cerebras", model: "qwen-3.8-27b" },
    { provider: "gemini", model: "gemini-3.5-flash" },
  ],
};

// ── Stage parameters ────────────────────────────────────────────────────────

export interface StageParams {
  maxOutputTokens: number;
  temperature: number;
}

export const STAGE_PARAMS: Record<LLMStage, StageParams> = {
  intent: { maxOutputTokens: 4096, temperature: 0.3 },
  "fetch-planner": { maxOutputTokens: 4096, temperature: 0.3 },
  synthesis: { maxOutputTokens: 65536, temperature: 0.7 },
  reflow: { maxOutputTokens: 4096, temperature: 0.3 },
  qa: { maxOutputTokens: 4096, temperature: 0.3 },
};

// ── Tier inference (for response metadata) ──────────────────────────────────

export function inferTier(stage: LLMStage, candidateIndex: number): ModelTier {
  const list = MODEL_ROUTING[stage];
  const third = Math.max(1, Math.ceil(list.length / 3));
  if (candidateIndex < third) return "fast";
  if (candidateIndex < third * 2) return "mid";
  return "frontier";
}

// ── Gemini-native search grounding cascade ──────────────────────────────────
// Only used by geminiSearchGrounded (Google Search tool requires the native
// Gemini SDK, NOT the OpenAI-compat endpoint).

export const GEMINI_SEARCH_MODELS: readonly string[] = [
  "gemini-3.5-flash",
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite",
] as const;

// ── Legacy exports (kept for backward compat; unused by new routing) ────────

export const STAGE_DEFAULT_TIER: Record<LLMStage, ModelTier> = {
  intent: "fast",
  "fetch-planner": "fast",
  synthesis: "mid",
  reflow: "fast",
  qa: "fast",
};

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
