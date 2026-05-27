/**
 * Token accounting + per-stage budgets. A prompt change that blows the budget
 * fails the build, not the invoice (projectStructure.md §7.3 #10).
 */
import type { LLMStage, TokenUsage } from "@travelmate/contracts";

/** Skeleton placeholder budgets (input tokens). Tune with real prompts + an ADR. */
export const STAGE_TOKEN_BUDGET: Record<LLMStage, number> = {
  intent: 1_500,
  "fetch-planner": 2_000,
  synthesis: 25_000, // large, but mostly prompt-cached schema/context
  reflow: 3_000,
  qa: 1_500,
};

export function withinBudget(stage: LLMStage, usage: TokenUsage): boolean {
  // Cached input is ~free; charge it at a fraction toward the budget.
  const effective = usage.inputTokens + Math.ceil(usage.cachedInputTokens * 0.1);
  return effective <= STAGE_TOKEN_BUDGET[stage];
}
