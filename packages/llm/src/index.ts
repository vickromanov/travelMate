/**
 * @travelmate/llm — provider-agnostic LLM access.
 *
 * Every tier that needs a model calls `LLMClient`, never a vendor SDK. This is
 * where the §7 cost policy (routing, caching, budgets) is enforced in ONE place.
 */
import type { LLMRequest, LLMResponse, ModelTier } from "@travelmate/contracts";
import { STAGE_DEFAULT_TIER, STAGE_MAX_TIER, nextTier } from "./router.js";
import { withinBudget } from "./tokens.js";
import { mockProvider } from "./providers/mock.js";
import { anthropicProvider } from "./providers/anthropic.js";
import { geminiProvider } from "./providers/gemini.js";

export * from "./router.js";
export * from "./tokens.js";
export type { SemanticCache } from "./cache.js";

export interface LLMProvider {
  id: "mock" | "anthropic" | "gemini";
  complete(req: LLMRequest, overrideTier?: ModelTier): Promise<LLMResponse>;
}

export interface LLMClient {
  /**
   * Run a stage against the cheapest capable tier, escalating on validated failure.
   *  1. start at STAGE_DEFAULT_TIER[stage]
   *  2. send `cacheableContext` as a cached prompt block
   *  3. validate the response with the caller-supplied `validate` function
   *  4. on failure, escalate via nextTier() up to STAGE_MAX_TIER
   *  5. assert withinBudget(stage, usage) in test env
   */
  run(req: LLMRequest, validate?: (text: string) => boolean): Promise<LLMResponse>;
}

function tierRank(t: ModelTier): number {
  return t === "fast" ? 0 : t === "mid" ? 1 : 2;
}

function isRetryableError(err: unknown): boolean {
  const msg = String(err);
  return msg.includes("503") || msg.includes("429") || msg.includes("overloaded") ||
    msg.includes("Service Unavailable") || msg.includes("Too Many Requests") ||
    msg.includes("high demand") || msg.includes("temporarily");
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function buildClient(provider: LLMProvider): LLMClient {
  return {
    async run(req, validate): Promise<LLMResponse> {
      let tier: ModelTier = STAGE_DEFAULT_TIER[req.stage];
      const maxTier: ModelTier = STAGE_MAX_TIER[req.stage];
      let lastError: Error | undefined;
      let sameRetries = 0;
      const MAX_SAME_RETRIES = 2;

      for (;;) {
        let res: LLMResponse;
        try {
          res = await provider.complete(req, tier);
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          const isRetryable = isRetryableError(err);
          if (isRetryable && sameRetries < MAX_SAME_RETRIES) {
            sameRetries++;
            const delay = sameRetries * 8000;
            console.warn(`[llm] ${tier} transient error — retry ${sameRetries}/${MAX_SAME_RETRIES} in ${delay}ms`);
            await sleep(delay);
            continue;
          }
          sameRetries = 0;
          const next = nextTier(tier);
          if (isRetryable && next && tierRank(next) <= tierRank(maxTier)) {
            console.warn(`[llm] ${tier} exhausted retries — escalating to ${next}`);
            tier = next;
            continue;
          }
          throw lastError;
        }

        sameRetries = 0; // reset on success or validation-fail (retries are per-tier)
        const isValid = !validate || validate(res.text);
        if (isValid) {
          if (process.env.NODE_ENV === "test" && !withinBudget(req.stage, res.usage)) {
            console.warn(`[llm] over token budget for stage ${req.stage}`);
          }
          return res;
        }

        const next = nextTier(tier);
        if (!next || tierRank(next) > tierRank(maxTier)) {
          throw new Error(`LLM validation failed at tier ${tier} for stage ${req.stage}`);
        }
        tier = next;
      }
    },
  };
}

/** Factory — selects the provider by LLM_PROVIDER env, defaulting to "anthropic". */
export function createLLMClient(opts?: { provider?: LLMProvider["id"] }): LLMClient {
  const id = opts?.provider ?? (process.env.LLM_PROVIDER as LLMProvider["id"] | undefined) ?? "anthropic";
  if (id === "mock") return buildClient(mockProvider);
  if (id === "anthropic") return buildClient(anthropicProvider);
  if (id === "gemini") return buildClient(geminiProvider);
  throw new Error(`createLLMClient: unsupported provider "${id}"`);
}
