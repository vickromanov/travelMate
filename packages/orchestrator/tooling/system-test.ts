/**
 * End-to-end quality gate: generates a real itinerary via the full pipeline,
 * then runs every quality check and reports pass/fail.
 *
 * Usage:  pnpm --filter orchestrator system-test
 * Requires GEMINI_API_KEY in .env.local.
 */
import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env.local") });

import type { CrucialInfo, TripPlan, StreamCallbacks } from "@travelmate/contracts";
import { createDatabase } from "@travelmate/database";
import { createLLMClient } from "@travelmate/llm";
import { runPlanPipeline, type Deps } from "../src/pipeline.js";
import { validatePlanQuality, formatQualityReport } from "../src/quality.js";
import { verifyVenues } from "../src/verify-venues.js";

const input: CrucialInfo = {
  destination: "Munich, Germany",
  travelerDescription: "A couple in their 30s who enjoy history, local food, and walking tours. First time in Munich.",
  tripType: "city break",
  budgetTier: "SMART",
  startDate: "2026-09-19",
  endDate: "2026-09-21",
  partyAdults: 2,
  partyChildren: 0,
  freeformText: "We want to see Marienplatz, try a beer garden, and visit at least one museum.",
};

async function run() {
  console.log("=== TravelMate System Test ===\n");
  console.log(`Destination: ${input.destination}`);
  console.log(`Dates: ${input.startDate} → ${input.endDate}`);
  console.log(`Party: ${input.partyAdults} adults\n`);

  const db = createDatabase("memory");
  const llm = createLLMClient();
  const deps: Deps = { db, llm };

  let generatedPlan: TripPlan | undefined;
  const thoughts: string[] = [];

  const cb: StreamCallbacks = {
    onThought: (t) => {
      thoughts.push(t);
      console.log(`  💭 ${t}`);
    },
    onPartialPlan: () => {},
    onError: (err) => {
      console.error(`\n❌ Pipeline error: ${err.message}`);
      process.exit(1);
    },
  };

  const planId = "system-test-plan";
  db.observer.subscribeToPlan(planId, (plan) => {
    generatedPlan = plan;
  });

  console.log("Generating itinerary…\n");
  const start = Date.now();
  await runPlanPipeline(input, deps, cb, planId);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (!generatedPlan) {
    generatedPlan = await db.plans.getPlan(planId) as TripPlan | undefined;
  }

  if (!generatedPlan) {
    console.error("\n❌ No plan was generated.");
    process.exit(1);
  }

  console.log(`\nGenerated in ${elapsed}s — ${generatedPlan.days.length} days, ${generatedPlan.days.reduce((s, d) => s + d.blocks.length, 0)} blocks.\n`);

  // Quality validation
  console.log("=== Quality Validation ===\n");
  const report = validatePlanQuality(generatedPlan, {
    dailyBudgetCap: input.budgetDailyCap,
    partyAdults: input.partyAdults,
    partyChildren: input.partyChildren,
  });
  console.log(formatQualityReport(report, 30));

  // Venue verification
  console.log("\n=== Venue Verification ===\n");
  const venueCheck = await verifyVenues(generatedPlan, input.destination);
  console.log(`Checked ${venueCheck.checked} venues.`);
  if (venueCheck.flagged.length > 0) {
    for (const f of venueCheck.flagged) {
      console.log(`  ⚠️  [${f.rule}] ${f.where}: ${f.message}`);
    }
  } else {
    console.log("All venues verified.");
  }

  // Summary
  console.log("\n=== Summary ===\n");
  console.log(`Quality score: ${report.score}/100`);
  console.log(`Errors: ${report.errors}`);
  console.log(`Warnings: ${report.warnings}`);
  console.log(`Venue flags: ${venueCheck.flagged.length}`);
  console.log(`Pipeline thoughts: ${thoughts.length}`);

  if (report.errors > 0) {
    console.log("\n❌ FAIL — quality errors remain after repair.");
    process.exit(1);
  }

  console.log("\n✅ PASS — itinerary quality checks passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
