/**
 * Stage 1 — Intent. Free-form user text → validated TripBrief.
 * Three phases: atomic fact extraction → traveler profile → inference loop.
 * No archetypes (P3). Every assumption logged to onThought BEFORE any fetch (P1).
 */
import type { CrucialInfo, TripBrief, StreamCallbacks, InferenceEntry } from "@travelmate/contracts";
import { TripBriefSchema } from "@travelmate/contracts";
import type { LLMClient } from "@travelmate/llm";
import { geminiSearchGrounded } from "@travelmate/llm";

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
- DATES: If the EVENT DATES section below provides verified dates, use those EXACTLY
  for startDate/endDate. Otherwise:
    • "week"/"a week" → 7 days; "long weekend" → 4 days; "weekend" → 3 days;
      "fortnight"/"two weeks" → 14 days; "N days"/"N nights" → N days.
    • If no duration mentioned → default to 3 days.
    • Season words: "summer" → Jun-Aug; "winter" → Dec-Feb; "spring" → Mar-May; "fall"/"autumn" → Sep-Nov.
    • Month names: "in October" → 1st of that month, next occurrence.
    • If no date context at all → 30 days from today.
    • ALWAYS set BOTH startDate and endDate (compute endDate = startDate + duration).
- Party size: "couple"/"us"/"we" → 2 adults 0 children; "solo"/"I am" → 1 adult; "family" → 2 adults 2 children; otherwise 2 adults
- Budget: "cheap/budget/hostel/backpacker" → ECONOMY; "comfortable/mid-range" → SMART; "luxury/first-class/Michelin" → LUXURY
- Origin: leave null if not mentioned
- neededCategories: always include hotels, dining, activities, weather, places. Add "flights" only if origin is provided.
- Log EVERY assumption in inferenceChain
`;

/**
 * Pre-step: detect event/festival references and look up real dates via Google Search.
 * Returns a date context string to inject into the intent prompt, or null.
 */
async function resolveEventDates(
  input: CrucialInfo,
  cb: StreamCallbacks,
): Promise<string | null> {
  if (input.startDate && input.endDate) return null;

  const text = `${input.destination} ${input.travelerDescription} ${input.tripType} ${input.freeformText ?? ""}`;
  const today = new Date().toISOString().slice(0, 10);

  const searchPrompt = `Today is ${today}.

A traveler described their trip as: "${text}"

Does this description reference a specific event, festival, holiday, celebration, or seasonal occasion
(e.g. Oktoberfest, Carnival, Cherry Blossom season, Christmas markets, Holi, Songkran, etc.)?

If YES: search for the EXACT official dates of the next upcoming occurrence of that event.
Return ONLY this JSON (no markdown, no explanation):
{"event": "Event Name", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "source": "where you found the dates"}

If NO event/festival/seasonal occasion is referenced, return ONLY:
{"event": null}`;

  cb.onThought("Checking for event dates…");

  const result = await geminiSearchGrounded(searchPrompt);
  if (!result) return null;

  try {
    const jsonStr = result.includes("{") ? result.slice(result.indexOf("{"), result.lastIndexOf("}") + 1) : result;
    const parsed = JSON.parse(jsonStr) as { event: string | null; startDate?: string; endDate?: string; source?: string };
    if (!parsed.event || !parsed.startDate) return null;

    const dateInfo = `EVENT DATES (verified via Google Search):\n` +
      `  Event: ${parsed.event}\n` +
      `  Start: ${parsed.startDate}\n` +
      `  End: ${parsed.endDate ?? parsed.startDate}\n` +
      `  Source: ${parsed.source ?? "Google Search"}\n` +
      `  → Use these dates for startDate/endDate. If the traveler asked for a shorter duration ` +
      `(e.g. "a week"), center it within the event window. Log the source in inferenceChain.`;

    cb.onThought(`Found: ${parsed.event} runs ${parsed.startDate} → ${parsed.endDate ?? parsed.startDate} (${parsed.source ?? "Google Search"})`);
    return dateInfo;
  } catch {
    return null;
  }
}

function buildUserPrompt(input: CrucialInfo, eventDates: string | null): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Today's date: ${today}

${eventDates ?? "EVENT DATES: none found — infer from context or use defaults."}

TRIP INPUT:
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

  // Pre-step: resolve event/festival dates via Google Search grounding
  const eventDates = await resolveEventDates(input, cb);

  const res = await llm.run(
    {
      stage: "intent",
      system: SYSTEM,
      cacheableContext: CACHEABLE_SCHEMA,
      user: buildUserPrompt(input, eventDates),
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
