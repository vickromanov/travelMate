/**
 * @travelmate/llm — provider-agnostic LLM access.
 *
 * Every tier that needs a model calls `LLMClient`, never a vendor SDK. This is
 * where the §7 cost policy (routing, caching, budgets) is enforced in ONE place.
 */
import { NotImplemented } from "@travelmate/contracts";
import type { LLMRequest, LLMResponse } from "@travelmate/contracts";
import { STAGE_DEFAULT_TIER } from "./router.js";

export * from "./router.js";
export * from "./tokens.js";
export type { SemanticCache } from "./cache.js";

export interface LLMProvider {
  id: "mock" | "anthropic" | "gemini";
  complete(req: LLMRequest): Promise<LLMResponse>;
}

export interface LLMClient {
  /**
   * Run a stage. Implementation responsibilities (projectStructure.md §7):
   *  1. start at STAGE_DEFAULT_TIER[stage]
   *  2. send `cacheableContext` as a cached prompt block
   *  3. validate the response against `req.expects`
   *  4. on validated failure, escalate via nextTier() up to STAGE_MAX_TIER
   *  5. consult/populate the SemanticCache
   *  6. assert withinBudget(stage, usage)
   */
  run(req: LLMRequest): Promise<LLMResponse>;
}

/** Factory — selects the provider by env (LLM_PROVIDER). Skeleton stub. */
export function createLLMClient(_opts?: {
  provider?: LLMProvider["id"];
}): LLMClient {
  return {
    async run(req: LLMRequest): Promise<LLMResponse> {
      void STAGE_DEFAULT_TIER[req.stage];
      throw new NotImplemented("llm.LLMClient.run");
    },
  };
}
