/**
 * Google Gemini provider. Uses the @google/generative-ai SDK.
 * Prompt caching is handled via system instruction (static context → cached by Gemini).
 */
import {
  GoogleGenerativeAI,
  type GenerateContentRequest,
  type Content,
} from "@google/generative-ai";
import type { LLMRequest, LLMResponse, ModelTier } from "@travelmate/contracts";
import type { LLMProvider } from "../index.js";
import { MODEL_TABLE, STAGE_DEFAULT_TIER } from "../router.js";

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(apiKey);
}

export const geminiProvider: LLMProvider = {
  id: "gemini",

  async complete(req: LLMRequest, overrideTier?: ModelTier): Promise<LLMResponse> {
    const tier: ModelTier = overrideTier ?? STAGE_DEFAULT_TIER[req.stage];
    const modelId = MODEL_TABLE["gemini"]![tier];
    const genAI = getClient();

    // Combine system + cacheableContext into one system instruction
    const systemParts: string[] = [];
    if (req.system) systemParts.push(req.system);
    if (req.cacheableContext) systemParts.push(req.cacheableContext);

    const model = genAI.getGenerativeModel({
      model: modelId,
      systemInstruction: systemParts.join("\n\n"),
      generationConfig: {
        maxOutputTokens: req.stage === "synthesis" ? 16000 : 4096,
        temperature: req.stage === "synthesis" ? 0.7 : 0.3,
      },
    });

    const contents: Content[] = [
      { role: "user", parts: [{ text: req.user }] },
    ];

    const request: GenerateContentRequest = { contents };
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
  },
};
