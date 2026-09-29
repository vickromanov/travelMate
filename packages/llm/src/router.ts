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
  provider: "groq" | "gemini" | "nvidia" | "openrouter" | "huggingface";
  model: string;
}

/**
 * Per-stage candidate lists. Cheapest / fastest first; quality last.
 *
 * Free-tier limits (verified 2026-09-29):
 *   Groq:         openai/gpt-oss-20b  — 30 RPM, 1K RPD
 *                 openai/gpt-oss-120b — 30 RPM, 1K RPD
 *                 qwen/qwen3.8-27b    — 30 RPM, 1K RPD
 *   Gemini:       gemini-3.5-flash    — free tier, 500 RPD
 *                 gemini-3.8-flash    — free tier, 500 RPD
 *   NVIDIA NIM:   requires "Public API Endpoints" account permission
 *                 deepseek-ai/deepseek-v4.1-flash — 40 RPM (once enabled)
 *   OpenRouter:   nvidia/nemotron-3-super-120b-a12b:free — 20 RPM, 50 RPD
 *   Hugging Face: Qwen/Qwen2.5-72B-Instruct — ~1K RPD
 */
export const MODEL_ROUTING: Record<LLMStage, ModelCandidate[]> = {
  intent: [
    { provider: "groq", model: "openai/gpt-oss-20b" },
    { provider: "groq", model: "openai/gpt-oss-120b" },
    { provider: "huggingface", model: "Qwen/Qwen2.5-72B-Instruct" },
    { provider: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free" },
    { provider: "gemini", model: "gemini-3.5-flash" },
  ],
  "fetch-planner": [
    { provider: "groq", model: "openai/gpt-oss-20b" },
    { provider: "huggingface", model: "Qwen/Qwen2.5-72B-Instruct" },
    { provider: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free" },
    { provider: "gemini", model: "gemini-3.5-flash" },
  ],
  synthesis: [
    { provider: "groq", model: "openai/gpt-oss-120b" },
    { provider: "groq", model: "qwen/qwen3.8-27b" },
    { provider: "huggingface", model: "Qwen/Qwen2.5-72B-Instruct" },
    { provider: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free" },
    { provider: "gemini", model: "gemini-3.8-flash" },
  ],
  reflow: [
    { provider: "groq", model: "openai/gpt-oss-20b" },
    { provider: "groq", model: "openai/gpt-oss-120b" },
    { provider: "huggingface", model: "Qwen/Qwen2.5-72B-Instruct" },
    { provider: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free" },
    { provider: "gemini", model: "gemini-3.5-flash" },
  ],
  qa: [
    { provider: "groq", model: "openai/gpt-oss-20b" },
    { provider: "huggingface", model: "Qwen/Qwen2.5-72B-Instruct" },
    { provider: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free" },
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
  synthesis: { maxOutputTokens: 16384, temperature: 0.7 },
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
