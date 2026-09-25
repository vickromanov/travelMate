/**
 * Gemini-native provider — ONLY for Google Search grounding.
 *
 * Regular LLM calls go through the OpenAI-compatible multi-provider router.
 * This file exists solely because Google Search grounding (tools: [{googleSearch}])
 * is a Gemini-specific feature not available via the OpenAI-compat endpoint.
 */
import { GoogleGenAI } from "@google/genai";
import { GEMINI_SEARCH_MODELS } from "../router.js";

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
  return "throttled";
}

const deadModels = new Set<string>();
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const NETWORK_RETRIES = 3;
const NETWORK_BACKOFF_MS = [1_000, 3_000, 8_000];

async function callModel(modelId: string, userText: string, opts: {
  maxOutputTokens: number;
  temperature: number;
  useSearchGrounding?: boolean;
}) {
  const ai = getClient();
  let lastErr: unknown;
  for (let attempt = 0; attempt <= NETWORK_RETRIES; attempt++) {
    try {
      return await ai.models.generateContent({
        model: modelId,
        contents: userText,
        config: {
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
        console.warn(`[gemini-search] ${modelId} network error — retry ${attempt + 1}/${NETWORK_RETRIES} in ${delay}ms`);
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

/**
 * Quick Gemini call with Google Search grounding (tools: [{googleSearch}]).
 * Used by the orchestrator to look up real-world dates for events/festivals
 * and to verify venue existence.
 */
export async function geminiSearchGrounded(prompt: string): Promise<string | null> {
  const searchCapable = GEMINI_SEARCH_MODELS.filter(
    (m) => !deadModels.has(m),
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
