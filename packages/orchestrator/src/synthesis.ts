/**
 * Stage 3 — Synthesis. TripBrief + fetched data → zero-thinking TripPlan (H3).
 * MVP: runs on LLM knowledge (no real fetched candidates yet).
 * All generated content is marked isEstimate in the source field.
 * Mid-tier LLM, escalates to frontier on 2 validation failures.
 */
import { randomUUID } from "crypto";
import type {
  TripBrief,
  NormalizedResult,
  TripPlan,
  DayPlan,
  StreamCallbacks,
} from "@travelmate/contracts";
import { TripPlanSchema, DayPlanSchema } from "@travelmate/contracts";
import type { LLMClient } from "@travelmate/llm";
import { validatePlanQuality, formatQualityReport, enforceBudgetBySwaps } from "./quality.js";

const SYSTEM = `You are TravelMate's synthesis engine. Generate a complete, zero-thinking travel itinerary.
Output ONLY valid JSON — no markdown, no code fences, no comments, no explanation.
The JSON must be parseable by JSON.parse().`;

const SCHEMA_BLOCK = `
=== SPEED-FIRST SKELETON PLAN ===
Generate a fast skeleton — 3 blocks per day, 1 option (ANCHOR) each. No transport blocks. Keep descriptions SHORT (1 sentence max).

Every day has exactly 3 blocks in this order:
  1. STAYS      07:00  (label = hotel name)
  2. ACTIVITIES 10:00  (best activity for the day)
  3. DINING     19:30  (best dinner spot)

=== EXACT JSON SCHEMA ===
{
  "title": "Catchy trip title",
  "description": "2 sentence overview.",
  "totalEstimatedCost": { "amount": 900, "currency": "EUR" },
  "duration": "3 Days",
  "inferenceChain": [{ "field": "dates", "assumed": "3 nights", "reason": "no dates given" }],
  "days": [
    {
      "dayNumber": 1,
      "date": "YYYY-MM-DD",
      "title": "Day 1: Short title",
      "theme": "One evocative sentence.",
      "dailyTips": ["One quick tip"],
      "blocks": [
        {
          "blockId": "d1_b1",
          "category": "STAYS",
          "scheduledTime": "07:00",
          "label": "Hotel Name",
          "selectedOptionId": "d1_b1_o1",
          "dependencyLogic": "none",
          "options": [
            {
              "id": "d1_b1_o1",
              "tier": "ANCHOR",
              "title": "Real Hotel Name",
              "description": "One sentence on why it fits.",
              "price": { "amount": 120, "currency": "EUR" },
              "location": { "lat": 48.8566, "lng": 2.3522, "address": "City, Country" },
              "link": "https://www.google.com/maps/search/?api=1&query=Hotel+Name+City"
            }
          ]
        },
        {
          "blockId": "d1_b2",
          "category": "ACTIVITIES",
          "scheduledTime": "10:00",
          "label": "Activity Name",
          "selectedOptionId": "d1_b2_o1",
          "dependencyLogic": "none",
          "options": [
            {
              "id": "d1_b2_o1",
              "tier": "ANCHOR",
              "title": "Real Activity/Attraction Name",
              "description": "One sentence on why it fits.",
              "price": { "amount": 20, "currency": "EUR" },
              "location": { "lat": 48.858, "lng": 2.294, "address": "City, Country" },
              "link": "https://www.google.com/maps/search/?api=1&query=Attraction+Name+City"
            }
          ]
        },
        {
          "blockId": "d1_b3",
          "category": "DINING",
          "scheduledTime": "19:30",
          "label": "Dinner",
          "selectedOptionId": "d1_b3_o1",
          "dependencyLogic": "none",
          "options": [
            {
              "id": "d1_b3_o1",
              "tier": "ANCHOR",
              "title": "Real Restaurant Name",
              "description": "One sentence on why it fits.",
              "price": { "amount": 35, "currency": "EUR" },
              "location": { "lat": 48.860, "lng": 2.350, "address": "City, Country" },
              "link": "https://www.google.com/maps/search/?api=1&query=Restaurant+Name+City"
            }
          ]
        }
      ]
    }
  ]
}

=== RULES ===
- ANCHOR only — 1 option per block, tier must be "ANCHOR"
- Use REAL venue names. Never "a local restaurant" or "your hotel"
- Use approximate city-center coordinates (lat/lng). Address = "City, Country" is fine.
- Keep the same ANCHOR hotel name in STAYS label across all days
- Link = Google Maps search URL for the venue
- Output ONLY valid JSON, nothing else
`;

function computeNumDays(brief: TripBrief): { numDays: number; start: string } {
  const f = brief.facts;
  // No date at all → 30 days from today (never a hardcoded date)
  const start = f.startDate ?? addDays(new Date().toISOString().slice(0, 10), 30);
  const end = f.endDate;
  const numDays = end
    ? Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000))
    : (() => {
        for (const entry of brief.inferenceChain) {
          const numMatch = entry.assumed.match(/(\d+)\s*(?:days?|nights?)/i);
          if (numMatch?.[1]) return Math.max(1, parseInt(numMatch[1], 10));
          if (/\bweek\b/i.test(entry.assumed)) return 7;
          if (/\bfortnight\b|two\s+weeks/i.test(entry.assumed)) return 14;
        }
        return 3;
      })();
  return { numDays, start };
}

function buildBatchPrompt(
  brief: TripBrief,
  batchStart: number,
  batchEnd: number,
  totalDays: number,
  tripStartDate: string,
  hotelHint?: string,
): string {
  const f = brief.facts;
  const adults = f.partyAdults ?? 2;
  const children = f.partyChildren ?? 0;
  const party = children > 0 ? `${adults} adults + ${children} children` : `${adults} adult${adults > 1 ? "s" : ""}`;

  const assumptionsList = brief.inferenceChain
    .map((e) => `  - ${e.field}: assumed "${e.assumed}" (${e.reason})`)
    .join("\n");

  const hotelLine = hotelHint
    ? `\nIMPORTANT: The traveler is staying at "${hotelHint}" for all nights. Use this exact hotel name in every STAYS block and every TRANSPORT block that references the hotel.`
    : "";

  const cap = f.budgetDailyCap;
  const budgetLine = cap
    ? `\n=== HARD BUDGET CONSTRAINT ===
The traveler stated an explicit budget of ${cap.currency} ${cap.amount} PER DAY.
For EVERY day, the sum of the ANCHOR (default-selected) options — accommodation +
all meals + activities + transport — MUST NOT exceed ${cap.currency} ${cap.amount}.
Pick hostels/guesthouses, street food/markets, free or cheap activities, and public
transport as the ANCHOR options. SMART-VALUE options should be cheaper still.
Only the PREMIUM tier may exceed the cap. totalEstimatedCost must reflect the
ANCHOR selections (≈ ${cap.currency} ${cap.amount * (brief.facts.partyAdults ?? 1)} × ${totalDays} days max).`
    : "";

  return `TRAVELER PROFILE:
${brief.travelerProfile}

ORIGINAL TRAVELER REQUEST (verbatim — honour every stated constraint):
${f.freeformText ?? f.travelerDescription}

TRIP FACTS:
- Destination: ${f.destination}
- Trip type: ${f.tripType}
- Party: ${party}
- Budget: ${f.budgetTier}${cap ? ` (hard cap ${cap.currency} ${cap.amount}/day)` : ""}
- Total trip: ${totalDays} days starting ${tripStartDate}
${hotelLine}${budgetLine}

ASSUMPTIONS ALREADY MADE (echo these in inferenceChain):
${assumptionsList || "  (none)"}

Generate day ${batchStart} of ${totalDays} for this trip.
Day date: ${addDays(tripStartDate, batchStart - 1)}.
Output a JSON object with "days" (array of exactly 1 day) and "inferenceChain" (array).
${batchStart === 1 ? 'Also include "title", "description", "totalEstimatedCost", "duration".' : ""}
Each day has EXACTLY 3 blocks: STAYS (07:00), ACTIVITIES (10:00), DINING (19:30).
Each block has EXACTLY 1 option with tier "ANCHOR". Keep descriptions to 1 sentence.`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function extractJSON(text: string): string {
  // Strip any accidental markdown code fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  // Try to find the outermost object
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
}

const DAYS_PER_BATCH = 1;

async function synthesizeBatch(
  brief: TripBrief,
  batchStart: number,
  batchEnd: number,
  totalDays: number,
  tripStartDate: string,
  llm: LLMClient,
  hotelHint?: string,
): Promise<Record<string, unknown>> {
  const expectedDays = batchEnd - batchStart + 1;

  const res = await llm.run(
    {
      stage: "synthesis",
      system: SYSTEM,
      cacheableContext: SCHEMA_BLOCK,
      user: buildBatchPrompt(brief, batchStart, batchEnd, totalDays, tripStartDate, hotelHint),
    },
    (text) => {
      try {
        const json = extractJSON(text);
        const raw = JSON.parse(json) as Record<string, unknown>;
        const days = raw["days"] as Array<{ blocks?: Array<{ options?: unknown[] }> }> | undefined;
        if (!Array.isArray(days) || days.length < expectedDays) return false;
        return days.every((d) => Array.isArray(d.blocks) && d.blocks.length >= 2 &&
          d.blocks.every((b) => Array.isArray(b.options) && b.options.length >= 1));
      } catch {
        return false;
      }
    },
  );

  const json = extractJSON(res.text);
  return JSON.parse(json) as Record<string, unknown>;
}

export async function synthesizePlan(
  brief: TripBrief,
  _data: NormalizedResult[],
  llm: LLMClient,
  cb: StreamCallbacks,
  planId?: string,
): Promise<TripPlan> {
  const { numDays, start } = computeNumDays(brief);
  cb.onThought(`Composing your ${numDays}-day itinerary for ${brief.facts.destination}…`);
  cb.onThought(`Writing a ${brief.facts.partyAdults ?? 2}-person plan, budget: ${brief.facts.budgetTier}…`);

  // Split into batches of DAYS_PER_BATCH to stay within model output limits
  const batches: Array<{ start: number; end: number }> = [];
  for (let d = 1; d <= numDays; d += DAYS_PER_BATCH) {
    batches.push({ start: d, end: Math.min(d + DAYS_PER_BATCH - 1, numDays) });
  }

  let merged: Record<string, unknown> | undefined;
  const allDays: unknown[] = [];
  let hotelHint: string | undefined;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]!;
    cb.onThought(`Generating days ${batch.start}–${batch.end} of ${numDays}…`);

    const raw = await synthesizeBatch(
      brief, batch.start, batch.end, numDays, start, llm, hotelHint,
    );

    // Extract hotel name from first batch to keep it consistent
    if (i === 0) {
      merged = raw;
      try {
        const days = raw["days"] as Array<{ blocks: Array<{ category: string; options: Array<{ tier: string; title: string }> }> }>;
        const staysBlock = days[0]?.blocks.find((b) => b.category === "STAYS");
        const anchor = staysBlock?.options.find((o) => o.tier === "ANCHOR");
        if (anchor) hotelHint = anchor.title;
      } catch { /* ignore */ }
    }

    const batchDays = raw["days"] as unknown[];
    allDays.push(...(batchDays ?? []));
  }

  if (!merged) throw new Error("Synthesis: no batches produced output");
  merged["days"] = allDays;

  cb.onThought("All days generated — validating structure…");

  // Inject planId
  merged["planId"] = planId ?? randomUUID();

  let plan;
  try {
    plan = TripPlanSchema.parse(merged);
  } catch (err) {
    const issues = (err as { issues?: Array<{ path: unknown[]; message: string }> }).issues;
    const first = issues?.[0];
    console.error(`[synthesis] Zod parse failed — path: ${JSON.stringify(first?.path)}, msg: ${first?.message}`);
    throw err;
  }

  // Post-process: sort blocks within each day by scheduledTime
  sortBlocks(plan);

  // Quality gate (H3): deterministic checks + ONE scoped repair round on errors
  const qualityOpts = {
    dailyBudgetCap: brief.facts.budgetDailyCap,
    partyAdults: brief.facts.partyAdults,
  };
  let report = validatePlanQuality(plan, qualityOpts);

  // Budget overruns are fixed deterministically first: swap selected options to
  // the cheaper alternatives already in the plan — no LLM, instant, loss-free.
  if (!report.ok && qualityOpts.dailyBudgetCap) {
    const swaps = enforceBudgetBySwaps(plan, qualityOpts);
    if (swaps > 0) {
      cb.onThought(`Swapped ${swaps} option(s) to cheaper alternatives to honour the ${qualityOpts.dailyBudgetCap.currency} ${qualityOpts.dailyBudgetCap.amount}/day budget.`);
      report = validatePlanQuality(plan, qualityOpts);
    }
  }

  // Whatever remains goes through ONE scoped LLM repair round
  if (!report.ok) {
    cb.onThought(`Quality check found ${report.errors} issue(s) — running a repair pass…`);
    plan = await repairPlan(plan, report.issues, llm, cb, brief);
    sortBlocks(plan);
    report = validatePlanQuality(plan, qualityOpts);
  }
  cb.onThought(formatQualityReport(report, 5));

  cb.onThought(`Plan ready — ${plan.days.length} days, ${plan.days.reduce((s, d) => s + d.blocks.length, 0)} blocks.`);

  return plan;
}

function sortBlocks(plan: TripPlan): void {
  for (const day of plan.days) {
    day.blocks.sort((a, b) => {
      const ta = a.scheduledTime.replace(":", "").padStart(4, "0");
      const tb = b.scheduledTime.replace(":", "").padStart(4, "0");
      return ta.localeCompare(tb);
    });
  }
}

/**
 * One scoped repair round: regenerate ONLY the days that have error-severity
 * issues, feeding the model its own output plus the concrete rule violations.
 * A day whose repair fails validation keeps its original version — repair can
 * only improve the plan, never lose it.
 */
async function repairPlan(
  plan: TripPlan,
  issues: import("./quality.js").QualityIssue[],
  llm: LLMClient,
  cb: StreamCallbacks,
  brief: TripBrief,
): Promise<TripPlan> {
  const brokenDayNumbers = [
    ...new Set(
      issues
        .filter((i) => i.severity === "error" && i.dayNumber !== undefined)
        .map((i) => i.dayNumber!),
    ),
  ].sort((a, b) => a - b);
  if (brokenDayNumbers.length === 0) return plan;

  const repaired = new Map<number, DayPlan>();

  // Repair in small chunks to stay inside output-token limits
  for (let i = 0; i < brokenDayNumbers.length; i += DAYS_PER_BATCH) {
    const chunk = brokenDayNumbers.slice(i, i + DAYS_PER_BATCH);
    const chunkDays = plan.days.filter((d) => chunk.includes(d.dayNumber));
    const chunkIssues = issues.filter(
      (iss) => iss.severity === "error" && iss.dayNumber !== undefined && chunk.includes(iss.dayNumber),
    );

    const cap = brief.facts.budgetDailyCap;
    const capLine = cap
      ? `\nHARD CONSTRAINT: the traveler's budget is ${cap.currency} ${cap.amount} per day — the ANCHOR (selected) options of each day must sum within it.`
      : "";

    const prompt = `The following itinerary day(s) FAILED quality validation.

CURRENT JSON:
${JSON.stringify({ days: chunkDays })}

VALIDATION ERRORS TO FIX:
${chunkIssues.map((iss) => `- [${iss.rule}] ${iss.where}: ${iss.message}`).join("\n")}
${capLine}
Fix ONLY these problems. Keep everything that is already correct (venues, prices, options) unchanged.
Output a JSON object: {"days": [ ...the corrected day objects, same schema... ]}`;

    try {
      const res = await llm.run(
        { stage: "synthesis", system: SYSTEM, cacheableContext: SCHEMA_BLOCK, user: prompt },
        (text) => {
          try {
            const raw = JSON.parse(extractJSON(text)) as { days?: unknown[] };
            return Array.isArray(raw.days) && raw.days.length === chunk.length;
          } catch {
            return false;
          }
        },
      );
      const raw = JSON.parse(extractJSON(res.text)) as { days: unknown[] };
      for (const rawDay of raw.days) {
        const parsed = DayPlanSchema.safeParse(rawDay);
        if (parsed.success && chunk.includes(parsed.data.dayNumber)) {
          repaired.set(parsed.data.dayNumber, parsed.data);
        }
      }
    } catch (err) {
      cb.onThought(`Repair pass for day(s) ${chunk.join(", ")} did not improve the plan — keeping the original.`);
      console.warn(`[synthesis] repair chunk failed: ${err instanceof Error ? err.message.slice(0, 120) : err}`);
    }
  }

  if (repaired.size === 0) {
    cb.onThought("Repair output did not pass schema validation — keeping the original days.");
    return plan;
  }
  cb.onThought(`Repaired ${repaired.size} day(s).`);
  return {
    ...plan,
    days: plan.days.map((d) => repaired.get(d.dayNumber) ?? d),
  };
}
