/**
 * Generic OpenAI-compatible chat-completions client.
 *
 * All three providers (Groq, Cerebras, Gemini) expose the same
 * POST /chat/completions shape — this module handles one call + error
 * classification so the routing loop stays clean.
 */

export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  envKey: string;
}

export const PROVIDERS: Record<string, ProviderConfig> = {
  groq: {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    envKey: "GROQ_API_KEY",
  },
  cerebras: {
    id: "cerebras",
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    envKey: "CEREBRAS_API_KEY",
  },
  gemini: {
    id: "gemini",
    name: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    envKey: "GEMINI_API_KEY",
  },
};

export type ErrorKind = "retryable" | "fatal";

export interface ChatResult {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly kind: ErrorKind,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

function classifyStatus(status: number): ErrorKind {
  if (status === 429 || status >= 500) return "retryable";
  return "fatal";
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const secs = Number(header);
  if (!Number.isNaN(secs) && secs > 0 && secs <= 120) return secs * 1000;
  return undefined;
}

const REQUEST_TIMEOUT_MS = 120_000;

export async function chatComplete(
  providerId: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  opts: { maxTokens: number; temperature: number },
): Promise<ChatResult> {
  const cfg = PROVIDERS[providerId];
  if (!cfg) throw new ProviderError(`Unknown provider "${providerId}"`, "fatal");

  const apiKey = process.env[cfg.envKey];
  if (!apiKey) throw new ProviderError(`${cfg.envKey} is not set`, "fatal");

  const url = `${cfg.baseUrl}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("abort")) {
      throw new ProviderError(`${cfg.name}/${model}: request timed out after ${REQUEST_TIMEOUT_MS}ms`, "retryable");
    }
    throw new ProviderError(`${cfg.name}/${model}: network error — ${msg}`, "retryable");
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const kind = classifyStatus(res.status);
    const retryAfterMs = parseRetryAfter(res.headers.get("retry-after"));
    let body = "";
    try { body = (await res.text()).slice(0, 200); } catch {}
    throw new ProviderError(
      `${cfg.name}/${model}: HTTP ${res.status} — ${body}`,
      kind,
      retryAfterMs,
    );
  }

  const json = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const text = json.choices?.[0]?.message?.content ?? "";
  return {
    text,
    usage: {
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0,
    },
  };
}

/** Log which keys are present at startup. */
export function logProviderAvailability(): void {
  for (const [id, cfg] of Object.entries(PROVIDERS)) {
    const hasKey = !!process.env[cfg.envKey];
    console.log(`[llm] ${cfg.name} (${id}): ${hasKey ? "✓ key present" : "✗ " + cfg.envKey + " missing — will skip"}`);
  }
}
