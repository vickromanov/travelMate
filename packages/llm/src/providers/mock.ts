/**
 * Deterministic, ZERO-cost, ZERO-network provider for tests.
 */
import type { LLMRequest, LLMResponse } from "@travelmate/contracts";

export const mockProvider = {
  async complete(req: LLMRequest): Promise<LLMResponse> {
    return {
      text: `__MOCK__:${req.stage}`,
      tierUsed: "fast",
      modelId: "mock",
      usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 },
      fromCache: false,
    };
  },
};
