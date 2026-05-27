/**
 * Gemini provider (cheap high-volume fallback). Skeleton stub.
 * SDK dependency added in the implementation phase.
 */
import { NotImplemented } from "@travelmate/contracts";
import type { LLMRequest, LLMResponse } from "@travelmate/contracts";
import type { LLMProvider } from "../index.js";

export const geminiProvider: LLMProvider = {
  id: "gemini",
  async complete(_req: LLMRequest): Promise<LLMResponse> {
    throw new NotImplemented("llm/providers/gemini.complete");
  },
};
