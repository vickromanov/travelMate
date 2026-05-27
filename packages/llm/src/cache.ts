/**
 * Semantic response cache (projectStructure.md §7.3 #6): near-identical briefs
 * reuse a prior synthesis instead of paying again. Interface only — skeleton.
 */
import type { LLMRequest, LLMResponse } from "@travelmate/contracts";

export interface SemanticCache {
  /** Returns a cached response if a sufficiently similar request was seen. */
  get(req: LLMRequest): Promise<LLMResponse | null>;
  set(req: LLMRequest, res: LLMResponse): Promise<void>;
}
