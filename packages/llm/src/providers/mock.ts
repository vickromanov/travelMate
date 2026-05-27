/**
 * Deterministic, ZERO-cost, ZERO-network provider. Lets the Orchestrator and UX
 * be built and tested without spending a cent or hitting a rate limit
 * (projectStructure.md §8).
 */
import type { LLMRequest, LLMResponse } from "@travelmate/contracts";
import type { LLMProvider } from "../index.js";

export const mockProvider: LLMProvider = {
  id: "mock",
  async complete(req: LLMRequest): Promise<LLMResponse> {
    // Skeleton: echo a deterministic stub keyed by stage. Real fixtures land with
    // each tier's tests.
    return {
      text: `__MOCK__:${req.stage}`,
      tierUsed: "fast",
      modelId: "mock",
      usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 },
      fromCache: false,
    };
  },
};
