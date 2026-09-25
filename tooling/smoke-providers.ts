#!/usr/bin/env npx tsx
/**
 * Smoke test — fires one cheap chat-completion per provider and reports which work.
 *
 * Usage (from repo root):
 *   pnpm smoke            # or: npx tsx tooling/smoke-providers.ts
 *
 * Reads GROQ_API_KEY, CEREBRAS_API_KEY, GEMINI_API_KEY from .env.local.
 * Exits 0 if at least one provider works; exits 1 if ALL fail.
 */
import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "../.env.local") });

interface ProviderTest {
  name: string;
  envKey: string;
  baseUrl: string;
  model: string;
}

const providers: ProviderTest[] = [
  {
    name: "Groq",
    envKey: "GROQ_API_KEY",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-20b",
  },
  {
    name: "Cerebras",
    envKey: "CEREBRAS_API_KEY",
    baseUrl: "https://api.cerebras.ai/v1",
    model: "qwen-3.8-27b",
  },
  {
    name: "Gemini (OpenAI-compat)",
    envKey: "GEMINI_API_KEY",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-3.5-flash",
  },
];

async function testProvider(p: ProviderTest): Promise<{ ok: boolean; detail: string; ms: number }> {
  const apiKey = process.env[p.envKey];
  if (!apiKey) {
    return { ok: false, detail: `${p.envKey} not set`, ms: 0 };
  }

  const start = Date.now();
  try {
    const res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: p.model,
        messages: [{ role: "user", content: "Reply with exactly: OK" }],
        max_tokens: 8,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const ms = Date.now() - start;

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, detail: `HTTP ${res.status} — ${body.slice(0, 120)}`, ms };
    }

    const json = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    const reply = json.choices?.[0]?.message?.content ?? "(empty)";
    const actualModel = json.model ?? p.model;
    return { ok: true, detail: `model=${actualModel} reply="${reply.trim()}"`, ms };
  } catch (err) {
    const ms = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, detail: msg.slice(0, 120), ms };
  }
}

async function main() {
  console.log("TravelMate provider smoke test\n");

  let anyOk = false;
  for (const p of providers) {
    process.stdout.write(`  ${p.name} (${p.model})... `);
    const result = await testProvider(p);

    if (result.ok) {
      console.log(`✓ ${result.ms}ms — ${result.detail}`);
      anyOk = true;
    } else {
      console.log(`✗ ${result.ms}ms — ${result.detail}`);
    }
  }

  console.log(anyOk ? "\nAt least one provider works." : "\nAll providers failed!");
  process.exit(anyOk ? 0 : 1);
}

main();
