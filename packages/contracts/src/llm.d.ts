/**
 * any tier → LLM boundary. Provider-agnostic. Cost policy lives in @travelmate/llm
 * (router.ts is the ONLY place model IDs appear). projectStructure.md §7.
 */
import { z } from "zod";
/** Capability tiers — the router maps these to concrete provider models. */
export declare const ModelTierSchema: z.ZodEnum<["fast", "mid", "frontier"]>;
export type ModelTier = z.infer<typeof ModelTierSchema>;
/** Orchestrator stages, each declaring its default tier (§7.2). */
export declare const LLMStageSchema: z.ZodEnum<["intent", "fetch-planner", "synthesis", "reflow", "qa"]>;
export type LLMStage = z.infer<typeof LLMStageSchema>;
export declare const LLMRequestSchema: z.ZodObject<{
    stage: z.ZodEnum<["intent", "fetch-planner", "synthesis", "reflow", "qa"]>;
    system: z.ZodString;
    /** Marked content is sent as a cached prompt block (~90% input saving, §7.3). */
    cacheableContext: z.ZodOptional<z.ZodString>;
    user: z.ZodString;
    /** zod schema name the response must satisfy; drives validate-then-escalate. */
    expects: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    stage: "intent" | "fetch-planner" | "synthesis" | "reflow" | "qa";
    system: string;
    user: string;
    cacheableContext?: string | undefined;
    expects?: string | undefined;
}, {
    stage: "intent" | "fetch-planner" | "synthesis" | "reflow" | "qa";
    system: string;
    user: string;
    cacheableContext?: string | undefined;
    expects?: string | undefined;
}>;
export type LLMRequest = z.infer<typeof LLMRequestSchema>;
export declare const TokenUsageSchema: z.ZodObject<{
    inputTokens: z.ZodNumber;
    cachedInputTokens: z.ZodNumber;
    outputTokens: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
}, {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
}>;
export type TokenUsage = z.infer<typeof TokenUsageSchema>;
export declare const LLMResponseSchema: z.ZodObject<{
    text: z.ZodString;
    tierUsed: z.ZodEnum<["fast", "mid", "frontier"]>;
    modelId: z.ZodString;
    usage: z.ZodObject<{
        inputTokens: z.ZodNumber;
        cachedInputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        inputTokens: number;
        cachedInputTokens: number;
        outputTokens: number;
    }, {
        inputTokens: number;
        cachedInputTokens: number;
        outputTokens: number;
    }>;
    /** True if served from the semantic response cache (§7.3 #6). */
    fromCache: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    text: string;
    tierUsed: "fast" | "mid" | "frontier";
    modelId: string;
    usage: {
        inputTokens: number;
        cachedInputTokens: number;
        outputTokens: number;
    };
    fromCache: boolean;
}, {
    text: string;
    tierUsed: "fast" | "mid" | "frontier";
    modelId: string;
    usage: {
        inputTokens: number;
        cachedInputTokens: number;
        outputTokens: number;
    };
    fromCache: boolean;
}>;
export type LLMResponse = z.infer<typeof LLMResponseSchema>;
//# sourceMappingURL=llm.d.ts.map