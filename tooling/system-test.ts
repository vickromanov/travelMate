/**
 * TravelMate system test — the "did we break the product?" check.
 *
 * Runs the REAL pipeline (intent → synthesis, live LLM) for one or more traveler
 * personas, then grades every plan with the same deterministic quality validator
 * used at runtime. Run it after any change that could affect plan generation.
 *
 * Usage (from the repo root):
 *   pnpm test:system                  # 1 persona (fast, cheap smoke test)
 *   pnpm test:system --all            # all personas (full matrix)
 *   pnpm test:system --persona solo   # one persona by id
 *
 * Reads GEMINI_API_KEY / LLM_PROVIDER from .env.local automatically.
 * Writes a JSON report to tooling/reports/ and exits non-zero on any
 * error-severity quality issue — safe to wire into CI later.
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { CrucialInfo, TripPlan } from "@travelmate/contracts";
import { createLLMClient } from "@travelmate/llm";
import {
  extractIntent,
  buildFetchPlan,
  resolveData,
  curateResearch,
  synthesizePlan,
  validatePlanQuality,
  formatQualityReport,
  type QualityReport,
} from "@travelmate/orchestrator";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* ── Load .env.local without a dotenv dependency ──────────────────────────── */

function loadEnvLocal(): void {
  const envPath = resolve(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, rawVal] = m;
    if (process.env[key!] !== undefined) continue;
    process.env[key!] = rawVal!.replace(/^["']|["']$/g, "");
  }
}

/* ── Personas — one per major traveler archetype dimension (H2) ───────────── */

interface Persona {
  id: string;
  label: string;
  input: CrucialInfo;
}

const PERSONAS: Persona[] = [
  {
    id: "family",
    label: "Family week in Munich during Oktoberfest",
    input: {
      destination: "Munich",
      travelerDescription:
        "Family of 4 (kids 8 and 11) visiting Munich and its area for one week during Oktoberfest time",
      tripType: "family",
      budgetTier: "SMART",
      freeformText: "Family trip of one week in Munich and its area during Oktoberfest time",
    },
  },
  {
    id: "solo",
    label: "Solo backpacker, 5 days Lisbon",
    input: {
      destination: "Lisbon",
      travelerDescription: "Solo backpacker, 5 days in Lisbon, budget €50/day, wants fado and surfing",
      tripType: "backpacking",
      budgetTier: "ECONOMY",
      freeformText: "Solo backpacker, 5 days Lisbon, budget €50/day, want to see fado and surf",
    },
  },
  {
    id: "couple",
    label: "Luxury couple, romantic Paris weekend",
    input: {
      destination: "Paris",
      travelerDescription: "Couple celebrating an anniversary, luxury romantic weekend, Michelin dining",
      tripType: "romantic",
      budgetTier: "LUXURY",
      freeformText: "Romantic luxury weekend in Paris for our anniversary, want one Michelin dinner",
    },
  },
  {
    id: "business",
    label: "Business traveler, 2 days Berlin",
    input: {
      destination: "Berlin",
      travelerDescription: "Business traveler, 2 days in Berlin, meetings near Potsdamer Platz, efficient schedule",
      tripType: "business",
      budgetTier: "SMART",
      freeformText: "2-day business trip to Berlin, meetings near Potsdamer Platz, dinners suitable for clients",
    },
  },
];

/* ── Runner ───────────────────────────────────────────────────────────────── */

interface PersonaResult {
  persona: string;
  label: string;
  passed: boolean;
  durationMs: number;
  days?: number;
  blocks?: number;
  score?: number;
  errors?: number;
  warnings?: number;
  issues?: QualityReport["issues"];
  failure?: string;
}

async function runPersona(persona: Persona): Promise<PersonaResult> {
  const llm = createLLMClient();
  const thoughts: string[] = [];
  const cb = {
    onThought: (t: string) => {
      thoughts.push(t);
      console.log(`    · ${t}`);
    },
    onError: (e: Error) => console.error(`    ! ${e.message}`),
  };

  const started = Date.now();
  try {
    const brief = await extractIntent(persona.input, llm, cb);
    const fetchPlan = await buildFetchPlan(brief);
    const data = await resolveData(fetchPlan, undefined as never); // MVP: no fetchers yet
    const research = await curateResearch(brief, llm, cb);
    const plan: TripPlan = await synthesizePlan(brief, data, research, llm, cb);

    const report = validatePlanQuality(plan, {
      dailyBudgetCap: brief.facts.budgetDailyCap,
      partyAdults: brief.facts.partyAdults,
      partyChildren: brief.facts.partyChildren,
    });
    const blocks = plan.days.reduce((s, d) => s + d.blocks.length, 0);
    console.log(`\n${formatQualityReport(report)}\n`);

    return {
      persona: persona.id,
      label: persona.label,
      passed: report.ok,
      durationMs: Date.now() - started,
      days: plan.days.length,
      blocks,
      score: report.score,
      errors: report.errors,
      warnings: report.warnings,
      issues: report.issues,
    };
  } catch (err) {
    return {
      persona: persona.id,
      label: persona.label,
      passed: false,
      durationMs: Date.now() - started,
      failure: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  if (!process.env.GEMINI_API_KEY && (process.env.LLM_PROVIDER ?? "gemini") === "gemini") {
    console.error("GEMINI_API_KEY is not set (checked env + .env.local) — cannot run the system test.");
    process.exit(2);
  }

  const args = process.argv.slice(2);
  const personaArg = args.includes("--persona") ? args[args.indexOf("--persona") + 1] : undefined;
  const selected = args.includes("--all")
    ? PERSONAS
    : personaArg
      ? PERSONAS.filter((p) => p.id === personaArg)
      : PERSONAS.slice(0, 1);

  if (selected.length === 0) {
    console.error(`Unknown persona "${personaArg}". Available: ${PERSONAS.map((p) => p.id).join(", ")}`);
    process.exit(2);
  }

  console.log(`TravelMate system test — ${selected.length} persona(s), provider: ${process.env.LLM_PROVIDER ?? "gemini"}\n`);

  const results: PersonaResult[] = [];
  for (const persona of selected) {
    console.log(`▶ ${persona.label}`);
    results.push(await runPersona(persona));
  }

  // Report
  console.log("═".repeat(72));
  for (const r of results) {
    const status = r.passed ? "PASS" : "FAIL";
    const details = r.failure
      ? `pipeline failed: ${r.failure.slice(0, 80)}`
      : `score ${r.score}/100 · ${r.days} days · ${r.blocks} blocks · ${r.errors} err / ${r.warnings} warn`;
    console.log(`  [${status}] ${r.label} (${Math.round(r.durationMs / 1000)}s) — ${details}`);
  }
  console.log("═".repeat(72));

  const reportDir = resolve(ROOT, "tooling", "reports");
  mkdirSync(reportDir, { recursive: true });
  const reportPath = resolve(reportDir, `system-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(reportPath, JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2));
  console.log(`Report written to ${reportPath.replace(ROOT + "/", "")}`);

  process.exit(results.every((r) => r.passed) ? 0 : 1);
}

void main();
