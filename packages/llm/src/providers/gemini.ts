/**
 * Google Gemini provider — built on @google/genai (the supported SDK; the old
 * @google/generative-ai was EOL 2025-11-30).
 *
 * Error policy (classifyError):
 *   network   → retry the SAME model with backoff (a network blip affects every
 *               model equally — cascading would just burn RPD quota for nothing)
 *   dead      → 404/permission errors: mark the model dead for this process and
 *               never try it again this session
 *   throttled → 429/503/quota: skip to the next model in the cascade
 * The outer buildClient tier-escalation handles validation failures on top of this.
 */
import { GoogleGenAI } from "@google/genai";
import type { LLMRequest, LLMResponse, ModelTier } from "@travelmate/contracts";
import type { LLMProvider } from "../index.js";
import { GEMINI_CASCADE, STAGE_DEFAULT_TIER } from "../router.js";

let client: GoogleGenAI | undefined;
function getClient(): GoogleGenAI {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  client = new GoogleGenAI({ apiKey, httpOptions: { timeout: 180_000 } });
  return client;
}

type ErrorKind = "network" | "dead" | "throttled";

function classifyError(err: unknown): ErrorKind {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();
  if (
    msg.includes("fetch failed") || msg.includes("econnreset") ||
    msg.includes("etimedout") || msg.includes("enotfound") ||
    msg.includes("network") || msg.includes("socket") || msg.includes("timeout")
  ) return "network";
  if (
    msg.includes("404") || msg.includes("not found") ||
    msg.includes("api key not valid") || msg.includes("permission")
  ) return "dead";
  return "throttled"; // 429 / 503 / overloaded / anything else → next model
}

/** Models that returned 404/permission errors — skipped for the rest of the process. */
const deadModels = new Set<string>();

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const NETWORK_RETRIES = 3;
const NETWORK_BACKOFF_MS = [1_000, 3_000, 8_000];

interface GenOptions {
  systemInstruction?: string;
  maxOutputTokens: number;
  temperature: number;
  useSearchGrounding?: boolean;
}

/**
 * One model call with network-level retry. Throws with a `kind` so the cascade
 * loop can decide whether to skip the model or give up.
 */
async function callModel(modelId: string, userText: string, opts: GenOptions) {
  const ai = getClient();
  let lastErr: unknown;
  for (let attempt = 0; attempt <= NETWORK_RETRIES; attempt++) {
    try {
      return await ai.models.generateContent({
        model: modelId,
        contents: userText,
        config: {
          ...(opts.systemInstruction ? { systemInstruction: opts.systemInstruction } : {}),
          maxOutputTokens: opts.maxOutputTokens,
          temperature: opts.temperature,
          ...(opts.useSearchGrounding ? { tools: [{ googleSearch: {} }] } : {}),
        },
      });
    } catch (err) {
      lastErr = err;
      const kind = classifyError(err);
      if (kind === "network" && attempt < NETWORK_RETRIES) {
        const delay = NETWORK_BACKOFF_MS[attempt] ?? 8_000;
        console.warn(`[gemini] ${modelId} network error — retry ${attempt + 1}/${NETWORK_RETRIES} in ${delay}ms`);
        await sleep(delay);
        continue;
      }
      throw Object.assign(
        lastErr instanceof Error ? lastErr : new Error(String(lastErr)),
        { kind },
      );
    }
  }
  throw lastErr;
}

export const geminiProvider: LLMProvider = {
  id: "gemini",

  async complete(req: LLMRequest, overrideTier?: ModelTier): Promise<LLMResponse> {
    // Tier sets generation params; model selection is purely cascade-based.
    const tier: ModelTier = overrideTier ?? STAGE_DEFAULT_TIER[req.stage];
    const isSynthesis = req.stage === "synthesis";

    const systemParts: string[] = [];
    if (req.system) systemParts.push(req.system);
    if (req.cacheableContext) systemParts.push(req.cacheableContext);
    const systemInstruction = systemParts.join("\n\n");

    let lastError: Error | undefined;

    for (const modelId of GEMINI_CASCADE) {
      if (deadModels.has(modelId)) continue;
      try {
        const response = await callModel(modelId, req.user, {
          systemInstruction,
          maxOutputTokens: isSynthesis ? 65536 : 4096,
          temperature: isSynthesis ? 0.7 : 0.3,
        });
        const usage = response.usageMetadata;
        return {
          text: response.text ?? "",
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
        const kind = (err as { kind?: ErrorKind }).kind ?? "throttled";
        if (kind === "dead") {
          deadModels.add(modelId);
          console.warn(`[gemini] ${modelId} unavailable (${lastError.message.slice(0, 80)}) — marked dead for this session`);
        } else {
          console.warn(`[gemini] ${modelId} failed (${lastError.message.slice(0, 80)}) — trying next model`);
        }
      }
    }

    throw lastError ?? new Error("All Gemini cascade models exhausted");
  },
};

/**
 * Quick Gemini call with Google Search grounding (tools: [{googleSearch}]).
 * Used by the orchestrator to look up real-world dates for events/festivals.
 * Gemma models do not support tools, so only gemini-* models are tried.
 */
export async function geminiSearchGrounded(prompt: string): Promise<string | null> {
  const searchCapable = GEMINI_CASCADE.filter(
    (m) => m.startsWith("gemini-") && !deadModels.has(m),
  );

  for (const modelId of searchCapable) {
    try {
      const response = await callModel(modelId, prompt, {
        maxOutputTokens: 2048,
        temperature: 0.1,
        useSearchGrounding: true,
      });
      const text = response.text;
      if (text) return text;
    } catch (err) {
      const kind = (err as { kind?: ErrorKind }).kind ?? "throttled";
      const msg = err instanceof Error ? err.message.slice(0, 80) : String(err);
      if (kind === "dead") deadModels.add(modelId);
      console.warn(`[gemini-search] ${modelId} failed (${msg}) — trying next`);
    }
  }
  return null;
}
