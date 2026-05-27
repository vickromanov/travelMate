/**
 * any tier → LLM boundary. Provider-agnostic. Cost policy lives in @travelmate/llm
 * (router.ts is the ONLY place model IDs appear). projectStructure.md §7.
 */
import { z } from "zod";
/** Capability tiers — the router maps these to concrete provider models. */
export const ModelTierSchema = z.enum(["fast", "mid", "frontier"]);
/** Orchestrator stages, each declaring its default tier (§7.2). */
export const LLMStageSchema = z.enum([
    "intent",
    "fetch-planner",
    "synthesis",
    "reflow",
    "qa",
]);
export const LLMRequestSchema = z.object({
    stage: LLMStageSchema,
    system: z.string(),
    /** Marked content is sent as a cached prompt block (~90% input saving, §7.3). */
    cacheableContext: z.string().optional(),
    user: z.string(),
    /** zod schema name the response must satisfy; drives validate-then-escalate. */
    expects: z.string().optional(),
});
export const TokenUsageSchema = z.object({
    inputTokens: z.number().int().nonnegative(),
    cachedInputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
});
export const LLMResponseSchema = z.object({
    text: z.string(),
    tierUsed: ModelTierSchema,
    modelId: z.string(),
    usage: TokenUsageSchema,
    /** True if served from the semantic response cache (§7.3 #6). */
    fromCache: z.boolean(),
});
//# sourceMappingURL=llm.js.map