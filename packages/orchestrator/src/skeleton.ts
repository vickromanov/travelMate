/**
 * Stage 2c — Trip skeleton. The cheap structural pass that makes PER-DAY
 * generation possible (and therefore progressive delivery).
 *
 * One fast LLM call decides, for the whole trip at once:
 *   - where the party sleeps EACH night (multi-base trips are fine — e.g.
 *     3 nights in Munich, then 2 at Neuschwanstein)
 *   - which curated activities land on which day (morning/afternoon/evening)
 *   - each day's title and theme
 *
 * Per-day synthesis then expands one skeleton day at a time without any
 * cross-day drift: hotel continuity and activity distribution are already
 * fixed here. If this stage fails, synthesis falls back to 3-day batching.
 */
import { z } from "zod";
import type { TripBrief, StreamCallbacks } from "@travelmate/contracts";
import type { LLMClient } from "@travelmate/llm";
import type { CuratedResearch } from "./curate.js";
import { formatResearchForPrompt } from "./curate.js";

const optStr = () => z.string().nullish().transform((v) => v ?? undefined);

export const SkeletonDaySchema = z.object({
  dayNumber: z.number().int().positive(),
  date: z.string(),
  title: z.string().nullish().transform((v) => v ?? ""),
  theme: z.string().nullish().transform((v) => v ?? ""),
  /** Where the party sleeps THIS night — exact property name. */
  hotel: z.string().nullish().transform((v) => v ?? ""),
  roomConfig: optStr(),
  morning: optStr(),
  afternoon: optStr(),
  evening: optStr(),
  /** City/area the day is based in (drives transport legs on move days). */
  base: optStr(),
});
export type SkeletonDay = z.infer<typeof SkeletonDaySchema>;

export const TripSkeletonSchema = z.object({
  title: z.string().nullish().transform((v) => v ?? ""),
  description: z.string().nullish().transform((v) => v ?? ""),
  totalEstimatedCost: z
    .object({ amount: z.number(), currency: z.string() })
    .nullish()
    .transform((v) => v ?? undefined),
  days: z.array(SkeletonDaySchema).min(1),
});
export type TripSkeleton = z.infer<typeof TripSkeletonSchema>;

const SYSTEM = `You are TravelMate's trip architect. You design the STRUCTURE of a trip — where to sleep
each night and what happens on each day — before any details are written.
Output ONLY valid JSON — no markdown, no explanation.`;

function skeletonPrompt(
  brief: TripBrief,
  research: CuratedResearch,
  numDays: number,
  startDate: string,
): string {
  const f = brief.facts;
  const party = `${f.partyAdults ?? 2} adult(s)${(f.partyChildren ?? 0) > 0 ? ` + ${f.partyChildren} child(ren)` : ""}`;

  return `TRAVELER PROFILE: ${brief.travelerProfile}
ORIGINAL REQUEST (verbatim): ${f.freeformText ?? f.travelerDescription}
DESTINATION: ${f.destination} | ORIGIN: ${f.origin ?? "not stated"}
PARTY: ${party} | BUDGET: ${f.budgetTier}${f.budgetDailyCap ? ` (cap ${f.budgetDailyCap.currency} ${f.budgetDailyCap.amount}/day/person)` : ""}
TRIP: ${numDays} days starting ${startDate}. Day 1 = ARRIVAL day (afternoon start unless stated), day ${numDays} = DEPARTURE day.
${formatResearchForPrompt(research)}

TASK: Design the day-by-day STRUCTURE of this trip:
1. ACCOMMODATION per night: usually ONE base for the whole trip, but if the geography is
   better served by moving (e.g. 3 nights city + 2 nights mountains), split bases — never
   move for a single night unless distances demand it. Use the researched stay candidates;
   an already-booked hotel is EVERY night's hotel unless the traveler said otherwise.
   State the room configuration for this party.
2. Distribute the researched activities across the days: geography-clustered (same area on
   the same day), pacing appropriate for this party, candidates' bestTime respected,
   arrival/departure days kept light.
3. Give each day a short title and theme.

Return EXACTLY this JSON:
{
  "title": "catchy trip title",
  "description": "2-3 sentence overview",
  "totalEstimatedCost": { "amount": 1200, "currency": "EUR" },
  "days": [
    {
      "dayNumber": 1,
      "date": "${startDate}",
      "title": "…", "theme": "…",
      "base": "city/area for this day",
      "hotel": "exact property name for THIS night",
      "roomConfig": "e.g. 2× double room or family room",
      "morning": "activity/plan or 'travel from X'",
      "afternoon": "…",
      "evening": "…"
    }
  ]
}
"days" MUST contain exactly ${numDays} entries with sequential dates from ${startDate}.
The DEPARTURE day's "hotel" is the checkout hotel (same as the previous night).`;
}

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
}

/** Build the trip skeleton. Returns null on failure — callers fall back to batching. */
export async function buildTripSkeleton(
  brief: TripBrief,
  research: CuratedResearch,
  numDays: number,
  startDate: string,
  llm: LLMClient,
  cb: StreamCallbacks,
): Promise<TripSkeleton | null> {
  cb.onThought(`Designing the trip structure — where to sleep each night, what happens each day…`);
  try {
    const res = await llm.run(
      { stage: "fetch-planner", system: SYSTEM, user: skeletonPrompt(brief, research, numDays, startDate) },
      (text) => {
        try {
          const raw = JSON.parse(extractJSON(text)) as { days?: unknown[] };
          return Array.isArray(raw.days) && raw.days.length === numDays;
        } catch {
          return false;
        }
      },
    );
    const parsed = TripSkeletonSchema.safeParse(JSON.parse(extractJSON(res.text)));
    if (!parsed.success || parsed.data.days.length !== numDays) {
      console.warn(`[skeleton] unparseable or wrong day count — falling back to batch synthesis`);
      return null;
    }

    const hotels = [...new Set(parsed.data.days.map((d) => d.hotel).filter(Boolean))];
    if (hotels.length === 1) {
      cb.onThought(`Base camp: ${hotels[0]} for the whole stay.`);
    } else if (hotels.length > 1) {
      cb.onThought(`Trip uses ${hotels.length} bases: ${hotels.join(" → ")}.`);
    }
    return parsed.data;
  } catch (err) {
    console.warn(`[skeleton] failed (${err instanceof Error ? err.message.slice(0, 80) : err}) — falling back to batch synthesis`);
    return null;
  }
}
