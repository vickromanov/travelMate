/**
 * Google Gemini provider — uses full GEMINI_CASCADE for resilience.
 * On ANY model error (503, 429, 404, etc.) → tries the next model in the cascade.
 * The outer buildClient tier-escalation handles validation failures on top of this.
 */
import {
  GoogleGenerativeAI,
  type GenerateContentRequest,
  type Content,
} from "@google/generative-ai";
import type { LLMRequest, LLMResponse, ModelTier } from "@travelmate/contracts";
import type { LLMProvider } from "../index.js";
import { GEMINI_CASCADE, STAGE_DEFAULT_TIER } from "../router.js";

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(apiKey);
}

export const geminiProvider: LLMProvider = {
  id: "gemini",

  async complete(req: LLMRequest, overrideTier?: ModelTier): Promise<LLMResponse> {
    // Tier is used to set generation params; model selection is purely cascade-based.
    const tier: ModelTier = overrideTier ?? STAGE_DEFAULT_TIER[req.stage];
    const isSynthesis = req.stage === "synthesis";

    const systemParts: string[] = [];
    if (req.system) systemParts.push(req.system);
    if (req.cacheableContext) systemParts.push(req.cacheableContext);
    const systemInstruction = systemParts.join("\n\n");

    const contents: Content[] = [
      { role: "user", parts: [{ text: req.user }] },
    ];
    const request: GenerateContentRequest = { contents };

    const genAI = getClient();
    let lastError: Error | undefined;

    for (let i = 0; i < GEMINI_CASCADE.length; i++) {
      const modelId = GEMINI_CASCADE[i]!;
      try {
        const model = genAI.getGenerativeModel({
          model: modelId,
          systemInstruction,
          generationConfig: {
            maxOutputTokens: isSynthesis ? 16000 : 4096,
            temperature: isSynthesis ? 0.7 : 0.3,
          },
        });

        const result = await model.generateContent(request);
        const response = result.response;
        const text = response.text();
        const usage = response.usageMetadata;

        return {
          text,
          tierUsed: tier,
          modelId,
          usage: {
            inputTokens: usage?.promptTokenCount ?? 0,
            cachedInputTokens: usage?.cachedContentTokenCount ?? 0,
            outputTokens: usage?.candidatesTokenCount ?? 0,
          },
          fromCache: false,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (i < GEMINI_CASCADE.length - 1) {
          const next = GEMINI_CASCADE[i + 1];
          console.warn(`[gemini] ${modelId} failed (${lastError.message.slice(0, 80)}) — trying ${next}`);
          continue;
        }
      }
    }

    throw lastError ?? new Error("All Gemini cascade models exhausted");
  },
};
