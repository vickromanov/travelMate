/**
 * Venue existence verification via Gemini Search Grounding.
 *
 * Batches all unique ANCHOR venues from the plan into 1-2 grounded search
 * calls, checking whether each venue exists and is currently open. Returns
 * flagged venues as quality warnings so the traveler sees them but the plan
 * still ships.
 */
import type { TripPlan, ItineraryBlock } from "@travelmate/contracts";
import { geminiSearchGrounded } from "@travelmate/llm";
import type { QualityIssue } from "./quality.js";

export interface VenueCheckResult {
  checked: number;
  flagged: QualityIssue[];
}

interface VenueEntry {
  title: string;
  category: ItineraryBlock["category"];
  dayNumber: number;
  blockId: string;
  dayOfWeek: string;
}

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return DAYS_OF_WEEK[d.getUTCDay()]!;
}

export async function verifyVenues(plan: TripPlan, destination: string): Promise<VenueCheckResult> {
  const seen = new Set<string>();
  const venues: VenueEntry[] = [];

  for (const day of plan.days) {
    const dow = getDayOfWeek(day.date);
    for (const b of day.blocks) {
      if (b.category === "TRANSPORT") continue;
      const anchor = b.options.find((o) => o.tier === "ANCHOR") ?? b.options[0];
      if (!anchor) continue;
      const key = anchor.title.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      venues.push({
        title: anchor.title,
        category: b.category,
        dayNumber: day.dayNumber,
        blockId: b.blockId,
        dayOfWeek: dow,
      });
    }
  }

  if (venues.length === 0) return { checked: 0, flagged: [] };

  const MAX_PER_BATCH = 15;
  const flagged: QualityIssue[] = [];

  for (let i = 0; i < venues.length; i += MAX_PER_BATCH) {
    const batch = venues.slice(i, i + MAX_PER_BATCH);
    const venueList = batch
      .map((v, idx) => `${idx + 1}. "${v.title}" (${v.category}, visiting on ${v.dayOfWeek})`)
      .join("\n");

    const prompt = `I'm planning a trip to ${destination}. For each venue below, verify using current information:
1. Does this venue/restaurant/hotel actually exist at this destination?
2. Is it permanently closed?
3. Is it typically open on the stated day of the week?

VENUES:
${venueList}

Respond ONLY with a JSON array. Each element: {"index": <number>, "exists": true/false, "permanentlyClosed": true/false, "closedOnDay": true/false, "note": "brief explanation if any issue"}.
If the venue exists and is open, set all booleans appropriately and note can be empty.
Output ONLY the JSON array — no markdown, no explanation.`;

    try {
      const response = await geminiSearchGrounded(prompt);
      if (!response) continue;

      const cleaned = response.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
      let results: Array<{ index: number; exists: boolean; permanentlyClosed: boolean; closedOnDay: boolean; note?: string }>;
      try {
        results = JSON.parse(cleaned);
      } catch {
        console.warn("[verify-venues] Could not parse Gemini response as JSON");
        continue;
      }

      if (!Array.isArray(results)) continue;

      for (const r of results) {
        const venue = batch[r.index - 1];
        if (!venue) continue;

        if (!r.exists) {
          flagged.push({
            severity: "warning",
            rule: "venue-existence",
            where: `day ${venue.dayNumber}, block ${venue.blockId}`,
            message: `"${venue.title}" may not exist at ${destination}${r.note ? ` — ${r.note}` : ""}`,
            dayNumber: venue.dayNumber,
          });
        } else if (r.permanentlyClosed) {
          flagged.push({
            severity: "warning",
            rule: "venue-closed",
            where: `day ${venue.dayNumber}, block ${venue.blockId}`,
            message: `"${venue.title}" appears to be permanently closed${r.note ? ` — ${r.note}` : ""}`,
            dayNumber: venue.dayNumber,
          });
        } else if (r.closedOnDay) {
          flagged.push({
            severity: "warning",
            rule: "venue-day-closed",
            where: `day ${venue.dayNumber}, block ${venue.blockId}`,
            message: `"${venue.title}" may be closed on ${venue.dayOfWeek}${r.note ? ` — ${r.note}` : ""}`,
            dayNumber: venue.dayNumber,
          });
        }
      }
    } catch (err) {
      console.warn(`[verify-venues] Grounding call failed: ${err instanceof Error ? err.message.slice(0, 120) : err}`);
    }
  }

  return { checked: venues.length, flagged };
}
