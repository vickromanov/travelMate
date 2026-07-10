/**
 * Anthropic provider. Sends cached system blocks to save ~90% on repeated
 * calls (projectStructure.md §7.3 #1). Uses the tier from the stage router.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { LLMRequest, LLMResponse, ModelTier } from "@travelmate/contracts";
import type { LLMProvider } from "../index.js";
import { MODEL_TABLE, STAGE_DEFAULT_TIER } from "../router.js";

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
}

export const anthropicProvider: LLMProvider = {
  id: "anthropic",

  async complete(req: LLMRequest, overrideTier?: ModelTier): Promise<LLMResponse> {
    const tier: ModelTier = overrideTier ?? STAGE_DEFAULT_TIER[req.stage];
    const modelId = MODEL_TABLE["anthropic"]![tier];
    const client = getClient();

    const systemBlocks: Array<Anthropic.TextBlockParam & { cache_control?: { type: "ephemeral" } }> = [];

    if (req.cacheableContext) {
      systemBlocks.push({
        type: "text",
        text: req.cacheableContext,
        cache_control: { type: "ephemeral" },
      });
    }

    systemBlocks.push({ type: "text", text: req.system });

    const response = await client.messages.create({
      model: modelId,
      max_tokens: req.stage === "synthesis" ? 8000 : 4096,
      system: systemBlocks as Anthropic.TextBlockParam[],
      messages: [{ role: "user", content: req.user }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const usage = response.usage as Anthropic.Usage & {
      cache_read_input_tokens?: number;
    };

    return {
      text,
      tierUsed: tier,
      modelId,
      usage: {
        inputTokens: usage.input_tokens,
        cachedInputTokens: usage.cache_read_input_tokens ?? 0,
        outputTokens: usage.output_tokens,
      },
      fromCache: false,
    };
  },
};
