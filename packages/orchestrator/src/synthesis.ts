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
  StreamCallbacks,
} from "@travelmate/contracts";
import { TripPlanSchema } from "@travelmate/contracts";
import type { LLMClient } from "@travelmate/llm";

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
              "phoneNumber": "+XX XX XX XX XX"
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
  - DINING × 3: breakfast (08:00-09:30), lunch (12:30-14:00), dinner (19:30-21:00)
  - ACTIVITIES × 1-2: morning activity, afternoon activity
  - STAYS × 1: accommodation block (scheduledTime: "21:30" or check-in time)
  - TRANSPORT × 2+: transfer between each major location change

EVERY option must have:
  - Real, specific venue/place name (never "a local café" or "nearby restaurant")
  - Real approximate coordinates (lat/lng) for the destination city
  - Realistic price for the budget tier
  - Genuine reasoning tied to THIS specific traveler's profile
  - openingHours and phoneNumber for DINING and ACTIVITIES options

scheduledTime must progress realistically through the day.
Add 20-30 min buffer between morning→afternoon, afternoon→evening.
TRANSPORT options: include mode of transport, duration, and from/to place names.
`;

function buildUserPrompt(brief: TripBrief): string {
  const f = brief.facts;
  const adults = f.partyAdults ?? 2;
  const children = f.partyChildren ?? 0;
  const party = children > 0 ? `${adults} adults + ${children} children` : `${adults} adult${adults > 1 ? "s" : ""}`;

  const assumptionsList = brief.inferenceChain
    .map((e) => `  - ${e.field}: assumed "${e.assumed}" (${e.reason})`)
    .join("\n");

  const start = f.startDate ?? "2026-11-01";
  const end = f.endDate;
  const numDays = end
    ? Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000))
    : 3;

  return `TRAVELER PROFILE:
${brief.travelerProfile}

TRIP FACTS:
- Destination: ${f.destination}
- Trip type: ${f.tripType}
- Party: ${party}
- Budget: ${f.budgetTier}
- Dates: ${start} to ${end ?? `(${numDays} days from start)`}
- Duration: ${numDays} days

ASSUMPTIONS ALREADY MADE (echo these in inferenceChain):
${assumptionsList || "  (none)"}

Generate the complete ${numDays}-day itinerary now. Start date is ${start}.
Provide EXACTLY ${numDays} day objects, each with AT LEAST 8 blocks (3 DINING + 2 ACTIVITIES + 1 STAYS + 2 TRANSPORT).
Every block must have EXACTLY 4 options: ANCHOR, SMART-VALUE, PREMIUM, INDEPENDENT.`;
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

export async function synthesizePlan(
  brief: TripBrief,
  _data: NormalizedResult[],
  llm: LLMClient,
  cb: StreamCallbacks,
  planId?: string,
): Promise<TripPlan> {
  cb.onThought(`Composing your itinerary for ${brief.facts.destination}…`);
  cb.onThought(`Writing a ${brief.facts.partyAdults ?? 2}-person plan, budget: ${brief.facts.budgetTier}…`);

  const res = await llm.run(
    {
      stage: "synthesis",
      system: SYSTEM,
      cacheableContext: SCHEMA_BLOCK,
      user: buildUserPrompt(brief),
    },
    (text) => {
      try {
        const json = extractJSON(text);
        const raw = JSON.parse(json) as Record<string, unknown>;
        const days = raw["days"] as Array<{ blocks?: unknown[] }> | undefined;
        if (!Array.isArray(days) || days.length === 0) return false;
        // Every day must have at least 4 blocks (minimum viable: 3 dining + 1 activity)
        return days.every((d) => Array.isArray(d.blocks) && d.blocks.length >= 4);
      } catch {
        return false;
      }
    },
  );

  cb.onThought("Itinerary generated — validating structure…");

  const json = extractJSON(res.text);
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new Error(`Synthesis: LLM returned non-JSON. Preview: ${res.text.slice(0, 300)}`);
  }

  // Inject planId — use caller-supplied ID so the observer subscription matches
  raw["planId"] = planId ?? randomUUID();

  const plan = TripPlanSchema.parse(raw);

  cb.onThought(`Plan ready — ${plan.days.length} days, ${plan.days.reduce((s, d) => s + d.blocks.length, 0)} blocks.`);

  return plan;
}
