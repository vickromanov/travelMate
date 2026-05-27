/**
 * Anthropic provider (default in production). Skeleton stub.
 * Implementation must use prompt caching for `req.cacheableContext`
 * (projectStructure.md §7.3 #1). SDK dependency added in the implementation phase.
 */
import { NotImplemented } from "@travelmate/contracts";
import type { LLMRequest, LLMResponse } from "@travelmate/contracts";
import type { LLMProvider } from "../index.js";

export const anthropicProvider: LLMProvider = {
  id: "anthropic",
  async complete(_req: LLMRequest): Promise<LLMResponse> {
    throw new NotImplemented("llm/providers/anthropic.complete");
  },
};
