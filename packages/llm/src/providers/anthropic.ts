/**
 * Anthropic provider — UNUSED in multi-provider routing (paid tier, not free).
 * Kept for future use if a paid tier is added.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { LLMRequest, LLMResponse, ModelTier } from "@travelmate/contracts";

const MODEL_TABLE: Record<ModelTier, string> = {
  fast: "claude-haiku-4-5-20251001",
  mid: "claude-sonnet-4-6",
  frontier: "claude-opus-4-8",
};

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
}

export async function anthropicComplete(
  req: LLMRequest,
  tier: ModelTier = "fast",
): Promise<LLMResponse> {
  const modelId = MODEL_TABLE[tier];
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
}
