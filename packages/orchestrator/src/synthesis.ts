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
import { validatePlanQuality, formatQualityReport } from "./quality.js";

const SYSTEM = `You are TravelMate's synthesis engine. Generate a complete, zero-thinking travel itinerary.
Output ONLY valid JSON — no markdown, no code fences, no comments, no explanation.
The JSON must be parseable by JSON.parse().`;

const SCHEMA_BLOCK = `
=== CRITICAL BLOCK COUNT REQUIREMENT ===
Every single day MUST contain AT LEAST 8 blocks:
  - 3 × DINING  (breakfast 08:00, lunch 12:30, dinner 19:30)
  - 2 × ACTIVITIES (morning + afternoon)
  - 1 × STAYS (accommodation, scheduledTime "15:00" check-in or "21:30")
  - 2 × TRANSPORT (one transfer per major location change)
Do NOT stop after 1 block. Generate ALL blocks for the day before moving to the next day.

=== REQUIRED JSON OUTPUT SCHEMA ===

{
  "title": "short catchy trip title",
  "description": "2-3 sentence overview of the trip",
  "totalEstimatedCost": { "amount": 1200, "currency": "EUR" },
  "duration": "N Days",
  "inferenceChain": [{ "field": "...", "assumed": "...", "reason": "..." }],
  "days": [
    {
      "dayNumber": 1,
      "date": "YYYY-MM-DD",
      "title": "Day 1 title",
      "theme": "Theme sentence",
      "dailyTips": ["tip 1", "tip 2"],
      "blocks": [
        {
          "blockId": "d1_b1",
          "category": "DINING",
          "scheduledTime": "08:30",
          "label": "Breakfast",
          "selectedOptionId": "d1_b1_o1",
          "dependencyLogic": "none",
          "options": [
            {
              "id": "d1_b1_o1",
              "tier": "ANCHOR",
              "title": "Specific venue name",
              "description": "What it is and why it's the best baseline fit for this trip archetype",
              "reasoning": "The default backbone — perfectly matches the primary traveler profile",
              "price": { "amount": 15, "currency": "EUR" },
              "location": { "lat": 38.7169, "lng": -9.1399, "address": "Full street address, City" },
              "openingHours": "08:00-22:00",
              "phoneNumber": "+XX XX XX XX XX",
              "link": "https://www.venueofficialwebsite.com"
            },
            {
              "id": "d1_b1_o2",
              "tier": "SMART-VALUE",
              "title": "High-quality venue at lower cost",
              "description": "Same neighbourhood, significantly cheaper, still highly rated",
              "reasoning": "Smart hack: near-identical quality, lower spend, saves budget for dinner",
              "price": { "amount": 8, "currency": "EUR" },
              "location": { "lat": 38.717, "lng": -9.140, "address": "..." },
              "openingHours": "...",
              "phoneNumber": "..."
            },
            {
              "id": "d1_b1_o3",
              "tier": "PREMIUM",
              "title": "Luxury/top-tier venue",
              "description": "Best-in-class, exclusive, elevated experience",
              "reasoning": "For when the traveler wants to treat themselves — Michelin-worthy or 5-star equivalent",
              "price": { "amount": 45, "currency": "EUR" },
              "location": { "lat": 38.718, "lng": -9.141, "address": "..." },
              "openingHours": "...",
              "phoneNumber": "..."
            },
            {
              "id": "d1_b1_o4",
              "tier": "INDEPENDENT",
              "title": "Local hidden-gem name",
              "description": "Off-the-beaten-path, no tourist traps, beloved by locals",
              "reasoning": "Avoids all chains and mainstream spots — authentic local experience",
              "price": { "amount": 10, "currency": "EUR" },
              "location": { "lat": 38.716, "lng": -9.139, "address": "..." },
              "openingHours": "...",
              "phoneNumber": "..."
            }
          ]
        }
      ]
    }
  ]
}

=== THE FOUR OPTION TIERS — MANDATORY ON EVERY BLOCK ===

Every block MUST contain EXACTLY 4 options in this order:

1. ANCHOR — The absolute best-fit baseline for this specific trip archetype and traveler profile.
   The Orchestrator selects this as the default. It is the logistical and mathematical anchor
   around which the rest of the day is built. It must be highly rated and perfectly suited to
   the primary traveler type (family-friendly, solo-friendly, etc.).

2. SMART-VALUE — The optimized cost/quality/logistics balance.
   High-tier quality at a significantly reduced price. Minimizes transit time or spend without
   sacrificing comfort. This is the "smart hack" for travelers who want the most value.

3. PREMIUM — The luxury upgrade option.
   Top-tier, exclusive, elevated. Think Michelin-starred restaurants, 5-star hotels, business
   class transfers, private tours. Still respects the geographic routing of the day.

4. INDEPENDENT — The off-the-beaten-path local gem.
   Completely avoids tourist traps and corporate chains. Local secrets, boutique stays,
   hidden-gem dining, cultural authenticity. For travelers who want to live like a local.

=== BLOCK RULES ===
EVERY day must include ALL of these block categories:
  - STAYS × 1: the FIRST block of every day. Use the hotel name as the label.
    The same hotel should be used for consecutive nights (unless the itinerary moves cities).
    scheduledTime: "07:00" (start of day) or actual check-in time on arrival day.
  - DINING × 3: breakfast (08:00-09:30), lunch (12:30-14:00), dinner (19:30-21:00)
  - ACTIVITIES × 1-2: morning activity, afternoon activity
  - TRANSPORT between EVERY pair of consecutive non-transport blocks whose locations
    are more than ~400m apart. Think of it as "how does the traveler physically get
    from block A to block B?" If they need to walk more than 5 min, take transit,
    taxi, or drive — add a TRANSPORT block between them with correct from/to.

=== BLOCK ORDERING — CRITICAL ===
Blocks in each day's "blocks" array MUST be in strict chronological order by scheduledTime.
08:00 comes before 09:00 comes before 10:00. NEVER place a later-scheduled block before
an earlier one. Build the day linearly: wake up → breakfast → transport → activity → transport → lunch → etc.

=== HOTEL CONSISTENCY ===
Pick ONE hotel (per city) for the ANCHOR tier and keep it the same across all nights.
All TRANSPORT blocks that reference the hotel must use its EXACT name as origin or destination —
never say "Hotel" or "Your Hotel" — always "Hotel Platzl" or whatever the actual name is.
The TRANSPORT link must point to Google Maps directions with the exact hotel name.

EVERY option must have:
  - Real, specific venue/place name (never "a local café" or "nearby restaurant")
  - Real approximate coordinates (lat/lng) for the destination city
  - Realistic price for the budget tier
  - Genuine reasoning tied to THIS specific traveler's profile
  - openingHours and phoneNumber for DINING and ACTIVITIES options
  - link: the single most useful URL for this option, chosen by category:
      DINING    → official restaurant website (e.g. "https://restaurantname.com") if well-known,
                  otherwise Google Maps search: "https://www.google.com/maps/search/?api=1&query=NAME+CITY"
      ACTIVITIES → official venue/attraction website (e.g. "https://museu.gov.pt"),
                  otherwise Google Maps: "https://www.google.com/maps/search/?api=1&query=NAME+CITY"
      STAYS      → hotel official website or booking page
      TRANSPORT  → Google Maps directions URL with EXACT venue names:
                  "https://www.google.com/maps/dir/?api=1&origin=EXACT+FROM+NAME+CITY&destination=EXACT+TO+NAME+CITY&travelmode=MODE"
                  where MODE is: walking, transit, driving, or bicycling
                  NEVER use generic names — use the exact venue/hotel name from the preceding/following block.
      LOGISTICS  → Google Maps search for the relevant place

scheduledTime must progress realistically through the day.
Add 20-30 min buffer between morning→afternoon, afternoon→evening.
TRANSPORT options: include mode of transport, duration, and from/to place names.
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

  return `TRAVELER PROFILE:
${brief.travelerProfile}

TRIP FACTS:
- Destination: ${f.destination}
- Trip type: ${f.tripType}
- Party: ${party}
- Budget: ${f.budgetTier}
- Total trip: ${totalDays} days starting ${tripStartDate}
${hotelLine}

ASSUMPTIONS ALREADY MADE (echo these in inferenceChain):
${assumptionsList || "  (none)"}

Generate days ${batchStart} through ${batchEnd} of the ${totalDays}-day itinerary.
Day ${batchStart} starts on date ${addDays(tripStartDate, batchStart - 1)}.
Output a JSON object with: "days" (array of ${batchEnd - batchStart + 1} day objects), "inferenceChain" (array).
${batchStart === 1 ? 'Also include: "title" (string), "description" (string), "totalEstimatedCost" ({amount, currency}), "duration" (string).' : ""}
Each day must have AT LEAST 8 blocks (1 STAYS + 3 DINING + 2 ACTIVITIES + 2 TRANSPORT).
Every block must have EXACTLY 4 options: ANCHOR, SMART-VALUE, PREMIUM, INDEPENDENT.`;
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

const DAYS_PER_BATCH = 3;

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
        const days = raw["days"] as Array<{ blocks?: unknown[] }> | undefined;
        if (!Array.isArray(days) || days.length < expectedDays) return false;
        return days.every((d) => Array.isArray(d.blocks) && d.blocks.length >= 3);
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
  let report = validatePlanQuality(plan);
  if (!report.ok) {
    cb.onThought(`Quality check found ${report.errors} issue(s) — running a repair pass…`);
    plan = await repairPlan(plan, report.issues, llm, cb);
    sortBlocks(plan);
    report = validatePlanQuality(plan);
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

    const prompt = `The following itinerary day(s) FAILED quality validation.

CURRENT JSON:
${JSON.stringify({ days: chunkDays })}

VALIDATION ERRORS TO FIX:
${chunkIssues.map((iss) => `- [${iss.rule}] ${iss.where}: ${iss.message}`).join("\n")}

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

  if (repaired.size === 0) return plan;
  cb.onThought(`Repaired ${repaired.size} day(s).`);
  return {
    ...plan,
    days: plan.days.map((d) => repaired.get(d.dayNumber) ?? d),
  };
}
