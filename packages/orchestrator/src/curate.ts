/**
 * Stage 2b — Curation. The "think first, assemble later" stage.
 *
 * Before any itinerary is written, three focused research passes reason about
 * what actually fits THIS traveler at THIS destination on THESE dates:
 *   1. activities — what is worth doing for this specific party & season
 *   2. stays      — where to sleep (honouring an already-booked hotel)
 *   3. dining     — where to eat, across meal types and price tiers
 *
 * Synthesis then composes the plan FROM these candidates instead of inventing
 * venues mid-write (projectStructure.md §2 stage 2, §7.3 "IDs in, IDs out").
 * When real fetchers land (M2), they feed this same shape — synthesis won't change.
 *
 * Curation degrades gracefully: any failed pass returns an empty list and
 * synthesis falls back to its own knowledge for that category.
 */
import { z } from "zod";
import type { TripBrief, StreamCallbacks } from "@travelmate/contracts";
import type { LLMClient } from "@travelmate/llm";

const optStr = () => z.string().nullish().transform((v) => v ?? undefined);

export const CuratedItemSchema = z.object({
  name: z.string().min(1),
  /** Why THIS item for THIS traveler — the reasoning the user asked for. */
  why: z.string().nullish().transform((v) => v ?? ""),
  area: optStr(),
  bestTime: optStr(),          // "morning", "sunset", "rainy-day backup"
  priceHint: optStr(),         // "~EUR 30 for the family", "free"
  category: optStr(),          // dining: BREAKFAST/LUNCH/DINNER; stays: room hint
  tierHint: optStr(),          // ANCHOR / SMART-VALUE / PREMIUM / INDEPENDENT
});
export type CuratedItem = z.infer<typeof CuratedItemSchema>;

const ItemsSchema = z.object({ items: z.array(CuratedItemSchema) });

export interface CuratedResearch {
  activities: CuratedItem[];
  stays: CuratedItem[];
  dining: CuratedItem[];
}

const SYSTEM = `You are TravelMate's destination researcher — part local expert, part travel journalist.
You THINK about what genuinely fits a specific traveler before recommending anything.
Output ONLY valid JSON: {"items": [...]} — no markdown, no explanation.`;

function contextBlock(brief: TripBrief): string {
  const f = brief.facts;
  const party = `${f.partyAdults ?? 2} adult(s)${(f.partyChildren ?? 0) > 0 ? ` + ${f.partyChildren} child(ren)` : ""}`;
  return `TRAVELER PROFILE: ${brief.travelerProfile}
DESTINATION: ${f.destination}
DATES: ${f.startDate ?? "unknown"} to ${f.endDate ?? "unknown"} (consider season, weather, what is open, local events)
TRIP TYPE: ${f.tripType}
PARTY: ${party}
BUDGET: ${f.budgetTier}${f.budgetDailyCap ? ` (hard cap ${f.budgetDailyCap.currency} ${f.budgetDailyCap.amount}/day per person)` : ""}
ORIGINAL REQUEST (verbatim): ${f.freeformText ?? f.travelerDescription}`;
}

const ITEM_SHAPE = `Each item: {"name": "exact real venue/place name", "why": "1-2 sentences tied to THIS traveler",
"area": "neighbourhood", "bestTime": "when to go", "priceHint": "~EUR X for the whole party",
"category": "...", "tierHint": "ANCHOR" | "SMART-VALUE" | "PREMIUM" | "INDEPENDENT"}`;

function activitiesPrompt(brief: TripBrief): string {
  return `${contextBlock(brief)}

TASK: First, think about what this specific group actually needs — ages and energy levels,
interests, the season and typical weather on these dates, what is open, pacing (how much
fits in a day with this party). Then select the 10-14 BEST activities and experiences.
Mix: must-see anchors, low-key breaks, one rainy-day backup, at least 2 hidden gems.
For families: every pick must genuinely work for the children's ages.
${ITEM_SHAPE} — use "category" for the activity type (museum/outdoor/spa/playground/...).`;
}

function staysPrompt(brief: TripBrief): string {
  return `${contextBlock(brief)}

TASK: Think about what accommodation this party needs (location vs. sights, room
configuration for the party size, amenities that matter for them). Then select the
4-6 BEST real options across price tiers.
IMPORTANT: If the ORIGINAL REQUEST names a hotel they already booked, it MUST be the
first item with tierHint "ANCHOR" and why "already booked by the traveler".
${ITEM_SHAPE} — use "category" for the room configuration this party needs (e.g. "2× double room" or "family room").`;
}

function diningPrompt(brief: TripBrief): string {
  return `${contextBlock(brief)}

TASK: Think about how this party eats on this kind of trip — meal rhythm, kids' menus if
relevant, local specialties they must try, budget reality. Then select 10-15 BEST real
venues covering ALL meal types: breakfast spots, lunch options near the main sights,
dinner venues (mix of tiers), plus 1-2 café/snack stops.
${ITEM_SHAPE} — use "category" for the meal type: BREAKFAST / LUNCH / DINNER / CAFE.`;
}

async function runPass(
  label: string,
  prompt: string,
  llm: LLMClient,
): Promise<CuratedItem[]> {
  try {
    const res = await llm.run(
      { stage: "fetch-planner", system: SYSTEM, user: prompt },
      (text) => {
        try {
          const raw = JSON.parse(extractJSON(text)) as { items?: unknown[] };
          return Array.isArray(raw.items) && raw.items.length >= 3;
        } catch {
          return false;
        }
      },
    );
    const parsed = ItemsSchema.safeParse(JSON.parse(extractJSON(res.text)));
    if (!parsed.success) {
      console.warn(`[curate] ${label} pass returned unparseable items — degrading to none`);
      return [];
    }
    return parsed.data.items;
  } catch (err) {
    console.warn(`[curate] ${label} pass failed (${err instanceof Error ? err.message.slice(0, 80) : err}) — degrading to none`);
    return [];
  }
}

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
}

/**
 * Run all three research passes in parallel. Streams progress to onThought so
 * the traveler SEES the thinking ("status transparency" — about_travelMate.md §4).
 */
export async function curateResearch(
  brief: TripBrief,
  llm: LLMClient,
  cb: StreamCallbacks,
): Promise<CuratedResearch> {
  const dest = brief.facts.destination;
  cb.onThought(`Researching what suits this group best in ${dest}…`);
  cb.onThought(`Thinking through activities, places to stay and where to eat for these exact dates…`);

  const [activities, stays, dining] = await Promise.all([
    runPass("activities", activitiesPrompt(brief), llm),
    runPass("stays", staysPrompt(brief), llm),
    runPass("dining", diningPrompt(brief), llm),
  ]);

  if (activities.length) cb.onThought(`Shortlisted ${activities.length} activities — e.g. ${activities.slice(0, 3).map((a) => a.name).join(", ")}…`);
  if (stays.length) cb.onThought(`Found ${stays.length} accommodation options (${stays[0]!.name} leads).`);
  if (dining.length) cb.onThought(`Picked ${dining.length} places to eat, covering every meal of the day.`);
  if (!activities.length && !stays.length && !dining.length) {
    cb.onThought("Research passes unavailable right now — composing from general knowledge instead.");
  }

  return { activities, stays, dining };
}

/** Compact candidate block for the synthesis prompt ("IDs in", §7.3). */
export function formatResearchForPrompt(research: CuratedResearch): string {
  const fmt = (items: CuratedItem[]) =>
    items
      .map((i) => {
        const bits = [
          i.area && `area: ${i.area}`,
          i.category && `type: ${i.category}`,
          i.bestTime && `best: ${i.bestTime}`,
          i.priceHint && `price: ${i.priceHint}`,
          i.tierHint && `tier: ${i.tierHint}`,
        ].filter(Boolean).join(", ");
        return `  - ${i.name}${bits ? ` (${bits})` : ""} — ${i.why}`;
      })
      .join("\n");

  const sections: string[] = [];
  if (research.stays.length) sections.push(`ACCOMMODATION CANDIDATES (researched for this traveler):\n${fmt(research.stays)}`);
  if (research.activities.length) sections.push(`ACTIVITY CANDIDATES (researched for this traveler):\n${fmt(research.activities)}`);
  if (research.dining.length) sections.push(`DINING CANDIDATES (researched for this traveler):\n${fmt(research.dining)}`);
  if (sections.length === 0) return "";

  return `
=== RESEARCHED CANDIDATES — BUILD THE ITINERARY FROM THESE ===
These were selected specifically for this traveler, party, dates and trip type.
Compose the itinerary PRIMARILY from them: candidates fill the ANCHOR and other
tier slots according to their tierHint and the traveler's budget. Add venues of
your own ONLY to fill gaps (e.g. a transport leg, a snack stop near a route).
Respect each candidate's bestTime when scheduling.

${sections.join("\n\n")}
`;
}
