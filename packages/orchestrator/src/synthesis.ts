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
              "description": "What this place is and what makes it special",
              "reasoning": "Why THIS traveler will love this specific choice",
              "price": { "amount": 15, "currency": "EUR" },
              "location": { "lat": 48.8566, "lng": 2.3522, "address": "Full street address, City" },
              "openingHours": "08:00-22:00",
              "phoneNumber": "+XX XX XX XX XX"
            },
            {
              "id": "d1_b1_o2",
              "tier": "SMART-VALUE",
              "title": "Another specific venue",
              "description": "...",
              "reasoning": "...",
              "price": { "amount": 8, "currency": "EUR" },
              "location": { "lat": 48.857, "lng": 2.353, "address": "..." },
              "openingHours": "...",
              "phoneNumber": "..."
            }
          ]
        }
      ]
    }
  ]
}

=== RULES ===
EVERY day must include ALL of these block categories:
  - DINING × 3: breakfast (08:00-09:30), lunch (12:30-14:00), dinner (19:30-21:00)
  - ACTIVITIES × 1-2: morning activity, afternoon activity
  - STAYS × 1: accommodation block (scheduledTime: "21:30" or "check-in time")
  - TRANSPORT × 2+: transfer between each major location change

EVERY block must have EXACTLY 2 options (3 if premium variant makes sense).
Option tiers: first = ANCHOR (best recommendation), second = SMART-VALUE (budget/alt), third = PREMIUM or INDEPENDENT.

EVERY option must have:
  - Real, specific venue name (not "a local café")
  - Real approximate coordinates (lat/lng) for the destination city
  - Realistic price for the budget tier
  - Genuine reasoning tied to this specific traveler's profile

scheduledTime must progress realistically through the day.
Add 20-30 min buffer between morning→afternoon, afternoon→evening.

TRANSPORT block options must describe how to get from A to B (include mode, duration, from/to names).
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
Provide EXACTLY ${numDays} day objects.`;
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
        return Array.isArray(raw["days"]) && (raw["days"] as unknown[]).length > 0;
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

  // Inject planId (never let the LLM set it)
  raw["planId"] = randomUUID();

  const plan = TripPlanSchema.parse(raw);

  cb.onThought(`Plan ready — ${plan.days.length} days, ${plan.days.reduce((s, d) => s + d.blocks.length, 0)} blocks.`);

  return plan;
}
