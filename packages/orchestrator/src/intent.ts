/**
 * Stage 1 — Intent. Free-form user text → validated TripBrief.
 * Three phases: atomic fact extraction → traveler profile → inference loop.
 * No archetypes (P3). Every assumption logged to onThought BEFORE any fetch (P1).
 */
import type { CrucialInfo, TripBrief, StreamCallbacks, InferenceEntry } from "@travelmate/contracts";
import { TripBriefSchema } from "@travelmate/contracts";
import type { LLMClient } from "@travelmate/llm";

const SYSTEM = `You are TravelMate's intent extractor. Extract a structured trip brief from the provided input.
Output ONLY valid JSON — no markdown, no code fences, no explanation.`;

const CACHEABLE_SCHEMA = `
OUTPUT SCHEMA (output exactly this JSON structure):
{
  "facts": {
    "destination": "string",
    "travelerDescription": "string",
    "tripType": "string",
    "budgetTier": "ECONOMY" | "SMART" | "LUXURY",
    "origin": null or "string",
    "startDate": null or "YYYY-MM-DD",
    "endDate": null or "YYYY-MM-DD",
    "partyAdults": number,
    "partyChildren": number,
    "freeformText": "string"
  },
  "travelerProfile": "Rich 2-4 sentence free-form profile of this specific traveler — their personality, interests, travel style. Never an archetype.",
  "inferenceChain": [
    { "field": "string", "assumed": "string", "reason": "string" }
  ],
  "neededCategories": ["hotels", "dining", "activities", "weather", "places"]
}

INFERENCE RULES:
- Duration: if no end date and no duration mentioned → assume 3 days
- Party size: "couple"/"us"/"we" → 2 adults 0 children; "solo"/"I am" → 1 adult; "family" → 2 adults 2 children; otherwise 2 adults
- Budget: "cheap/budget/hostel/backpacker" → ECONOMY; "comfortable/mid-range" → SMART; "luxury/first-class/Michelin" → LUXURY
- Origin: leave null if not mentioned
- If startDate and no endDate but duration known: compute endDate
- neededCategories: always include hotels, dining, activities, weather, places. Add "flights" only if origin is provided.
- Log EVERY assumption in inferenceChain
`;

function buildUserPrompt(input: CrucialInfo): string {
  return `TRIP INPUT:
Destination: ${input.destination}
Traveler description: ${input.travelerDescription}
Trip type: ${input.tripType}
Budget tier: ${input.budgetTier}
Origin: ${input.origin ?? "not specified"}
Start date: ${input.startDate ?? "not specified"}
End date: ${input.endDate ?? "not specified"}
Adults: ${input.partyAdults ?? "not specified"}
Children: ${input.partyChildren ?? "not specified"}
Free-form text: ${input.freeformText ?? "none"}

Extract the trip brief now.`;
}

export async function extractIntent(
  input: CrucialInfo,
  llm: LLMClient,
  cb: StreamCallbacks,
): Promise<TripBrief> {
  cb.onThought(`Understanding your trip to ${input.destination}…`);

  const res = await llm.run(
    {
      stage: "intent",
      system: SYSTEM,
      cacheableContext: CACHEABLE_SCHEMA,
      user: buildUserPrompt(input),
    },
    (text) => {
      try { JSON.parse(text); return true; } catch { return false; }
    },
  );

  let raw: unknown;
  try {
    raw = JSON.parse(res.text);
  } catch {
    throw new Error(`Intent stage: LLM returned non-JSON: ${res.text.slice(0, 200)}`);
  }

  // Surface the inference chain to the UI immediately (P1: before any fetch)
  const rawChain = (raw as { inferenceChain?: InferenceEntry[] }).inferenceChain ?? [];
  for (const entry of rawChain) {
    cb.onThought(`Assuming ${entry.field}: ${entry.assumed} — ${entry.reason}`);
  }

  const brief = TripBriefSchema.parse(raw);

  cb.onThought(`Trip profile ready. Planning ${brief.facts.partyAdults ?? 2} adults, ${brief.neededCategories.length} data categories needed.`);

  return brief;
}
