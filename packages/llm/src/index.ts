/**
 * @travelmate/llm — provider-agnostic LLM access.
 *
 * Routes each pipeline stage across multiple providers (Groq, Cerebras,
 * Gemini) via OpenAI-compatible chat-completions endpoints. On 429, 5xx,
 * or timeout the next candidate in MODEL_ROUTING is tried automatically.
 */
import type { LLMRequest, LLMResponse, ModelTier } from "@travelmate/contracts";
import { MODEL_ROUTING, STAGE_PARAMS, inferTier } from "./router.js";
import { withinBudget } from "./tokens.js";
import { mockProvider } from "./providers/mock.js";
import {
  chatComplete,
  ProviderError,
  logProviderAvailability,
  PROVIDERS,
} from "./providers/openai-compat.js";

export * from "./router.js";
export * from "./tokens.js";
export type { SemanticCache } from "./cache.js";
export { geminiSearchGrounded } from "./providers/gemini.js";

export interface LLMClient {
  /**
   * Run a stage against the cheapest sufficient model, falling over to the
   * next candidate on provider error or validation failure.
   */
  run(req: LLMRequest, validate?: (text: string) => boolean): Promise<LLMResponse>;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function buildMultiProviderClient(): LLMClient {
  logProviderAvailability();

  return {
    async run(req, validate): Promise<LLMResponse> {
      const candidates = MODEL_ROUTING[req.stage];
      const params = STAGE_PARAMS[req.stage];
      let lastError: Error | undefined;

      for (let i = 0; i < candidates.length; i++) {
        const { provider, model } = candidates[i]!;

        if (!process.env[PROVIDERS[provider]!.envKey]) continue;

        const messages = [
          ...(req.system
            ? [{ role: "system" as const, content: req.cacheableContext ? `${req.cacheableContext}\n\n${req.system}` : req.system }]
            : []),
          { role: "user" as const, content: req.user },
        ];

        try {
          const result = await chatComplete(provider, model, messages, {
            maxTokens: params.maxOutputTokens,
            temperature: params.temperature,
            timeoutMs: params.timeoutMs,
          });

          const tier: ModelTier = inferTier(req.stage, i);
          const response: LLMResponse = {
            text: result.text,
            tierUsed: tier,
            modelId: `${provider}/${model}`,
            usage: {
              inputTokens: result.usage.inputTokens,
              cachedInputTokens: 0,
              outputTokens: result.usage.outputTokens,
            },
            fromCache: false,
          };

          const isValid = !validate || validate(response.text);
          if (isValid) {
            if (process.env.NODE_ENV === "test" && !withinBudget(req.stage, response.usage)) {
              console.warn(`[llm] over token budget for stage ${req.stage}`);
            }
            console.log(`[llm] ${req.stage} served by ${provider}/${model}`);
            return response;
          }

          console.warn(`[llm] ${provider}/${model} returned invalid output for ${req.stage} — trying next candidate`);
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));

          if (err instanceof ProviderError) {
            if (err.kind === "fatal") {
              console.warn(`[llm] ${provider}/${model} fatal error — skipping: ${err.message.slice(0, 120)}`);
              continue;
            }
            if (err.retryAfterMs) {
              const waitMs = Math.min(err.retryAfterMs, 30_000);
              console.warn(`[llm] ${provider}/${model} rate-limited — waiting ${waitMs}ms then trying next`);
              await sleep(waitMs);
            } else {
              console.warn(`[llm] ${provider}/${model} retryable error — trying next: ${err.message.slice(0, 120)}`);
            }
          } else {
            console.warn(`[llm] ${provider}/${model} unexpected error — trying next: ${lastError.message.slice(0, 120)}`);
          }
        }
      }

      throw lastError ?? new Error(`All candidates exhausted for stage ${req.stage}`);
    },
  };
}

function buildMockClient(): LLMClient {
  return {
    async run(req): Promise<LLMResponse> {
      return mockProvider.complete(req);
    },
  };
}

export function createLLMClient(opts?: { provider?: "mock" }): LLMClient {
  const isMock = opts?.provider === "mock" || process.env.LLM_PROVIDER === "mock";
  if (isMock) return buildMockClient();
  return buildMultiProviderClient();
}
