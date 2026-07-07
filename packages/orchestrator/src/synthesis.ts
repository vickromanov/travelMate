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
import { formatResearchForPrompt, type CuratedResearch } from "./curate.js";
import { buildTripSkeleton, type TripSkeleton, type SkeletonDay } from "./skeleton.js";
import { verifyDayLinks } from "./verify-links.js";
import { enforceConsistency } from "./consistency.js";

/** Minimal TripPlan shell so enforceConsistency can run on a single day. */
function emptyPlanShell(): TripPlan {
  return {
    planId: "", title: "", description: "",
    totalEstimatedCost: { amount: 0, currency: "EUR" },
    duration: "", days: [], inferenceChain: [],
  };
}

const SYSTEM = `You are TravelMate's synthesis engine. Generate a complete, zero-thinking travel itinerary.
Output ONLY valid JSON — no markdown, no code fences, no comments, no explanation.
The JSON must be parseable by JSON.parse().`;

const SCHEMA_BLOCK = `
=== CRITICAL BLOCK COUNT REQUIREMENT ===
Every FULL day MUST contain AT LEAST 8 blocks:
  - 3 × DINING  (breakfast 08:00, lunch 12:30, dinner 19:30)
  - 2 × ACTIVITIES (morning + afternoon)
  - 1 × STAYS (accommodation, scheduledTime "15:00" check-in or "21:30")
  - 2 × TRANSPORT (one transfer per major location change)
Do NOT stop after 1 block. Generate ALL blocks for the day before moving to the next day.
EXCEPTION: the ARRIVAL and DEPARTURE days are partial days — see the
ARRIVAL & DEPARTURE DAYS section; they contain only what physically fits.

=== ARRIVAL & DEPARTURE DAYS — RESPECT PHYSICAL REALITY ===
Day 1 is the ARRIVAL day. The traveler is NOT at the destination in the morning
(assume mid-afternoon arrival unless an arrival time is stated).
  - NO breakfast, NO lunch, NO morning activities at the destination on Day 1.
  - Day 1 starts with arrival + hotel check-in (STAYS block, ~15:00), then an
    afternoon/evening program: one light activity, then dinner.
The FINAL day is the DEPARTURE day.
  - Breakfast + one morning activity at most, hotel checkout by ~11:00
    (STAYS block labelled "Checkout"), optionally lunch — then departure.
  - NO dinner or evening program on the final day unless a late departure is stated.
If the traveler states arrival/departure times, schedule around those instead.

=== DOOR-TO-DOOR JOURNEY LEGS (when the origin is known) ===
If the traveler's origin city is known, the itinerary covers the WHOLE journey:
  - Day 1 BEGINS with a TRANSPORT block for the outbound journey (origin → destination),
    using their stated mode (car/train/flight) and stated departure time. Estimate a
    realistic travel duration; check-in comes after the arrival time that implies.
  - The FINAL day ENDS with a TRANSPORT block for the return journey (destination → origin).
  - If a "must be back by" deadline is stated, BACK-COMPUTE the return departure:
    deadline − travel duration − 30 min buffer. Fill the final day's program (checkout,
    lunch, a last activity) up to that departure time — do NOT end the day hours early.
  - Car journeys: include the route (e.g. "via A93"), distance, duration and a
    Google Maps driving directions link between the exact addresses.

=== NAMED ACCOMMODATION ===
If the traveler has already booked or named their hotel, that EXACT property is the
ANCHOR option of EVERY STAYS block — never invent a different default. Other tiers
may offer alternatives, clearly framed as "if you weren't already booked".

=== PRICING — EVERY PRICE IS THE TOTAL FOR THE WHOLE PARTY ===
The "price" of an option is what the ENTIRE party actually pays for that block.
NEVER a per-person or single-room rate. Concretely:
  - STAYS: total for ALL rooms needed for ONE NIGHT — never the whole stay.
    2 adults + 2 children do NOT fit one double room: price a family room or
    2 rooms. SHOW THE MATH in the description — e.g. "2 rooms × EUR 250 =
    EUR 500 per night, two people per room" — and the price field MUST equal
    that total (number of rooms × per-room rate), never the single-room rate.
    ⚠ COMMON MISTAKE: do NOT multiply by the number of nights. A 7-night trip
    with a EUR 300/night hotel has price 300 on EVERY day's STAYS block —
    NOT 2100. The plan sums the days itself.
  - DINING: the full meal for the whole party (4 people = 4 meals + drinks).
  - ACTIVITIES: the sum of all tickets (adult and child rates where they differ).
  - TRANSPORT: the total fare for everyone (or the full fuel/toll cost when driving).
If the traveler states what they actually paid (e.g. "we paid 500 EUR for two rooms"),
use that EXACT amount for the ANCHOR option — never re-estimate a price they gave you.
Prices are best-effort estimates unless stated by the traveler — err realistic, not optimistic.

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
              "priceDetail": "Adults EUR 6, children EUR 3 — family total EUR 18",
              "location": { "lat": 38.7169, "lng": -9.1399, "address": "Full street address, City" },
              "openingHours": "08:00-22:00",
              "phoneNumber": "+XX XX XX XX XX",
              "link": "https://www.venueofficialwebsite.com",
              "linkType": "OFFICIAL",
              "bookingRequired": true,
              "bookingUrl": "https://www.venueofficialwebsite.com/tickets",
              "bookingAdvice": "Timed entry — book 2-3 days ahead, weekends sell out"
            },
            {
              "id": "d1_b1_o2",
              "tier": "SMART-VALUE",
              "title": "High-quality venue at lower cost",
              "description": "Same neighbourhood, significantly cheaper, still highly rated",
              "reasoning": "Smart hack: near-identical quality, lower spend, saves budget for dinner",
              "price": { "amount": 8, "currency": "EUR" },
              "location": { "lat": 38.717, "lng": -9.140, "address": "Rua Augusta 25, Lisbon" },
              "openingHours": "07:30-20:00",
              "phoneNumber": "+351 21 000 0002",
              "link": "https://www.google.com/maps/search/?api=1&query=Venue+Name+City"
            },
            {
              "id": "d1_b1_o3",
              "tier": "PREMIUM",
              "title": "Luxury/top-tier venue",
              "description": "Best-in-class, exclusive, elevated experience",
              "reasoning": "For when the traveler wants to treat themselves — Michelin-worthy or 5-star equivalent",
              "price": { "amount": 45, "currency": "EUR" },
              "location": { "lat": 38.718, "lng": -9.141, "address": "Avenida da Liberdade 100, Lisbon" },
              "openingHours": "12:00-23:00",
              "phoneNumber": "+351 21 000 0003",
              "link": "https://www.luxuryvenuewebsite.com"
            },
            {
              "id": "d1_b1_o4",
              "tier": "INDEPENDENT",
              "title": "Local hidden-gem name",
              "description": "Off-the-beaten-path, no tourist traps, beloved by locals",
              "reasoning": "Avoids all chains and mainstream spots — authentic local experience",
              "price": { "amount": 10, "currency": "EUR" },
              "location": { "lat": 38.716, "lng": -9.139, "address": "Beco do Surra 7, Lisbon" },
              "openingHours": "09:00-19:00",
              "phoneNumber": "+351 21 000 0004",
              "link": "https://www.google.com/maps/search/?api=1&query=Hidden+Gem+City"
            }
          ]
        }
      ]
    }
  ]
}

=== FIELD COMPLETENESS — APPLIES TO ALL 4 OPTIONS OF EVERY BLOCK ===
EVERY option — not just the first — must carry COMPLETE data:
  - "location" with real lat, lng AND a full street "address" (never omit, never "...")
  - "openingHours" and "phoneNumber" for DINING and ACTIVITIES
  - "link" per the link rules below
Never abbreviate fields with "..." or drop them on later options. An option without
an address is useless to a traveler standing in the street.

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
  - link + linkType: THINK about what the traveler actually needs to DO with this
    option, then attach the single most useful link for that action:
      * needs to BUY TICKETS (major museum/attraction/event) → the official ticket
        page, linkType "TICKETS"
      * needs to RESERVE (popular restaurant, hotel not yet booked) → the booking/
        reservation page, linkType "BOOKING"
      * needs INFO (menus, exhibitions) → the official site, linkType "OFFICIAL"
      * needs to FIND it (cafés, parks, viewpoints, most venues) → Google Maps
        search "https://www.google.com/maps/search/?api=1&query=NAME+CITY",
        linkType "MAPS"
      * needs to GET THERE (every TRANSPORT block) → Google Maps directions with
        EXACT venue names, linkType "DIRECTIONS":
        "https://www.google.com/maps/dir/?api=1&origin=EXACT+FROM+NAME+CITY&destination=EXACT+TO+NAME+CITY&travelmode=MODE"
        (MODE: walking, transit, driving or bicycling — never generic names)

  - BOOKING & TICKETS — make purchasing EFFORTLESS (H3). For every option where the
    traveler must or should book/buy in advance (museums with timed entry, tours,
    popular restaurants, shows, thermal baths, hotels not yet booked):
      * "bookingRequired": true
      * "bookingUrl": the ticket/reservation page — SAME anti-hallucination rules as
        links. A TICKETED attraction/tour/hotel must NEVER lack a bookingUrl: when
        the official page is uncertain, use the deterministic search deep link:
        hotels → "https://www.booking.com/searchresults.html?ss=NAME+CITY"
        tours/attractions/shows → "https://www.getyourguide.com/s/?q=NAME+CITY"
        restaurants → official reservation page if certain, otherwise omit bookingUrl
        and set bookingRequired true with the phone number (phoneNumber field) and
        "reserve by phone" guidance in bookingAdvice
        walk-in venues (cafés, parks, markets) → bookingRequired false, no bookingUrl
      * "priceDetail": the per-person breakdown behind the party total —
        "Adults EUR 15, children under 12 free"; include child rates for families
      * "bookingAdvice": HOW to secure it — how far ahead, timed entry, skip-the-line,
        free-cancellation notes ("Book 2-3 days ahead — weekend slots sell out")
    Free venues that need no booking: bookingRequired false, no bookingUrl; you may
    still set priceDetail "Free entry".

    ⚠ ANTI-HALLUCINATION RULE — NEVER INVENT A DOMAIN OR LINK A BARE HOMEPAGE.
    Only output an official/tickets URL when you are CERTAIN that exact domain
    exists (globally known venues: louvre.fr, oktoberfest.de, national museums).
    NEVER link "https://www.booking.com/" or any aggregator homepage — the link
    must land on THIS venue. For hotel bookings when you don't know the exact
    page, use the deterministic deep link:
    "https://www.booking.com/searchresults.html?ss=HOTEL+NAME+CITY" (linkType "BOOKING").
    If you are not 100% sure of any URL, use the Google Maps link — a working,
    venue-specific link ALWAYS beats a guessed one. (Every link you output is
    verified by the system; fabricated ones get replaced.)

    ⚠ LINK MUST BE VENUE-SPECIFIC — NOT A PARENT / REGION SITE.
    A restaurant "Gipfelalm Zugspitze" must NOT link to "zugspitze.de" (that is
    the mountain/region site, not the restaurant). A shop inside a mall does not
    link to the mall's homepage. Rule: the venue's OWN NAME (or a distinctive
    slug from it) must appear in the URL's host or path. If it doesn't, use the
    Google Maps link for that exact venue instead — the map WILL take the
    traveler to the right pin.

=== ZERO-THINKING ACCESS TRANSPARENCY (H3, mandatory) ===
Every ACTIVITIES / LOGISTICS / dining-with-remote-location option must answer
ONE question up front: "How do I get to this and what does it truly cost?"

- If the venue is reachable ONLY by paid transport (mountain summits, remote
  monasteries, islands with ferries, ski areas, national park interiors):
    * "price" MUST include the round-trip access cost for the party. A "Free"
      Zugspitze summit walk is FORBIDDEN — the summit is only reachable by
      cable car / cogwheel train (~EUR 70/person round trip). If the traveler
      is already paying for the cable car in this SAME block (e.g. one option
      is "Cogwheel Train + Summit", another is "Summit Platform Walk"), the
      "Summit Platform Walk" option MUST bundle the cable car cost into its
      price — because without it the option is unreachable.
    * "accessNotes": one sentence explaining how they get there and what's
      included, e.g. "Round-trip Zugspitze Cogwheel Train (~EUR 70/person)
      included in the price — otherwise not reachable".
    * The description must state the same cost transparently.

- If the venue is reachable on foot from the previous block, or otherwise has
  no hidden access cost, set:
    * "accessNotes": "Walk-in / accessible on foot from previous stop" (or
      similar honest one-liner like "Included with your Munich transit pass").

- NEVER present two options in the same block where one includes access and
  another silently omits it — the traveler will assume they're equivalent.
  ALL options in one block must state their access costs the same way.

Zero thinking = zero surprises. If you cannot fit here without hidden cost,
the price you show must reflect that. Period.

scheduledTime must progress realistically through the day.
Add 20-30 min buffer between morning→afternoon, afternoon→evening.
TRANSPORT options: include mode of transport, duration, and from/to place names.
`;

export function computeNumDays(brief: TripBrief): { numDays: number; start: string } {
  const f = brief.facts;
  // No date at all → 30 days from today (never a hardcoded date)
  const start = f.startDate ?? addDays(new Date().toISOString().slice(0, 10), 30);
  const end = f.endDate;
  // endDate is the LAST day of the trip, so the count is INCLUSIVE:
  // "03.07 to 05.07" = arrival day + full day + departure day = 3 days, not 2.
  const numDays = end
    ? Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1)
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
  researchBlock = "",
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
- Origin: ${f.origin ?? "not stated — start the itinerary at the destination"}
- Trip type: ${f.tripType}
- Party: ${party}
- Budget: ${f.budgetTier}${cap ? ` (hard cap ${cap.currency} ${cap.amount}/day)` : ""}
- Total trip: ${totalDays} days starting ${tripStartDate}
${hotelLine}${budgetLine}

ASSUMPTIONS ALREADY MADE (echo these in inferenceChain):
${assumptionsList || "  (none)"}
${researchBlock}
Generate days ${batchStart} through ${batchEnd} of the ${totalDays}-day itinerary.
Day ${batchStart} starts on date ${addDays(tripStartDate, batchStart - 1)}.
Output a JSON object with: "days" (array of ${batchEnd - batchStart + 1} day objects), "inferenceChain" (array).
${batchStart === 1 ? 'Also include: "title" (string), "description" (string), "totalEstimatedCost" ({amount, currency}), "duration" (string).' : ""}
${batchStart === 1 ? `REMINDER: Day 1 is the ARRIVAL day — start with check-in in the afternoon, NO breakfast/lunch/morning program at the destination.` : ""}
${batchEnd === totalDays ? `REMINDER: Day ${totalDays} is the DEPARTURE day — breakfast, checkout ~11:00, at most one morning activity, NO evening program.` : ""}
Each FULL day must have AT LEAST 8 blocks (1 STAYS + 3 DINING + 2 ACTIVITIES + 2 TRANSPORT);
arrival/departure days contain only what physically fits their partial schedule.
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
  hotelHint: string | undefined,
  researchBlock: string,
): Promise<Record<string, unknown>> {
  const expectedDays = batchEnd - batchStart + 1;
  let res;
  try {
    res = await runBatchLLM();
  } catch (err) {
    // Translate the internal "validation failed at tier X" into something a
    // traveler can act on; the real reasons are in the server log (see reject()).
    throw new Error(
      `The AI could not produce a valid schedule for day${expectedDays > 1 ? "s" : ""} ` +
      `${batchStart}${expectedDays > 1 ? `–${batchEnd}` : ""} after several attempts. ` +
      `This is usually temporary — please try again. (${err instanceof Error ? err.message : err})`,
    );
  }

  const json = extractJSON(res.text);
  return JSON.parse(json) as Record<string, unknown>;

  function runBatchLLM() {
    return llm.run(
    {
      stage: "synthesis",
      system: SYSTEM,
      cacheableContext: SCHEMA_BLOCK,
      user: buildBatchPrompt(brief, batchStart, batchEnd, totalDays, tripStartDate, hotelHint, researchBlock),
    },
    (text) => {
      // ALWAYS log the reason on rejection — silent validation failures cost
      // us a full escalate-to-frontier cycle once; never again.
      const reject = (reason: string) => {
        console.warn(`[synthesis] batch ${batchStart}-${batchEnd} response rejected: ${reason}`);
        return false;
      };
      try {
        const json = extractJSON(text);
        const raw = JSON.parse(json) as Record<string, unknown>;
        const days = raw["days"] as Array<{ blocks?: unknown[] }> | undefined;
        if (!Array.isArray(days)) return reject("no days array");
        if (days.length < expectedDays) return reject(`expected ${expectedDays} days, got ${days.length}`);
        for (let i = 0; i < days.length; i++) {
          const dayNumber = batchStart + i;
          // Arrival (1) and departure (totalDays) days are partial — as few as
          // 2 blocks (check-in + dinner) is a legitimate schedule.
          const minBlocks = dayNumber === 1 || dayNumber === totalDays ? 2 : 3;
          const blocks = days[i]?.blocks;
          if (!Array.isArray(blocks) || blocks.length < minBlocks) {
            return reject(`day ${dayNumber} has ${Array.isArray(blocks) ? blocks.length : "no"} blocks (min ${minBlocks})`);
          }
        }
        return true;
      } catch (err) {
        return reject(`unparseable JSON (${err instanceof Error ? err.message.slice(0, 60) : err})`);
      }
    },
    );
  }
}

export async function synthesizePlan(
  brief: TripBrief,
  _data: NormalizedResult[],
  research: CuratedResearch | null,
  llm: LLMClient,
  cb: StreamCallbacks,
  planId?: string,
): Promise<TripPlan> {
  const { numDays, start } = computeNumDays(brief);
  const researchBlock = research ? formatResearchForPrompt(research) : "";
  const pid = planId ?? randomUUID();
  cb.onThought(`Composing your ${numDays}-day itinerary for ${brief.facts.destination}…`);

  // Progressive path: skeleton (hotel per night + activity distribution),
  // then ONE DAY PER CALL, each streamed to the UX the moment it validates.
  // Any skeleton failure falls back to the proven 3-day batch path.
  const skeleton = research
    ? await buildTripSkeleton(brief, research, numDays, start, llm, cb)
    : null;

  let merged: Record<string, unknown>;
  if (skeleton) {
    merged = await synthesizeProgressive(brief, skeleton, researchBlock, numDays, llm, cb, pid);
  } else {
    cb.onThought(
      researchBlock
        ? `Assembling the days from the researched shortlist…`
        : `Writing a ${brief.facts.partyAdults ?? 2}-person plan, budget: ${brief.facts.budgetTier}…`,
    );
    merged = await synthesizeBatched(brief, researchBlock, numDays, start, llm, cb);
  }

  cb.onThought("All days generated — validating structure…");

  // Inject planId
  merged["planId"] = pid;

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

  // Cross-field consistency (H3): derive booking/access/mode from facts so a
  // priced ticket can never read "just walk in", etc. Deterministic, no LLM.
  const cons = enforceConsistency(plan);
  if (cons.fixed > 0) {
    cb.onThought(`Reconciled ${cons.fixed} booking/access field(s) so every card is internally consistent.`);
  }

  // Quality gate (H3): deterministic checks + ONE scoped repair round on errors
  const qualityOpts = {
    dailyBudgetCap: brief.facts.budgetDailyCap,
    partyAdults: brief.facts.partyAdults,
    partyChildren: brief.facts.partyChildren,
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

  // Final link sweep: covers the batch path and any repaired/replaced days.
  // The origin cache makes re-checking already-verified venues free.
  const links = await verifyDayLinks(plan.days);
  if (links.replaced > 0) {
    cb.onThought(`Link check: ${links.checked} verified, ${links.replaced} dead link(s) replaced with map links.`);
  }

  cb.onThought(`Plan ready — ${plan.days.length} days, ${plan.days.reduce((s, d) => s + d.blocks.length, 0)} blocks.`);

  return plan;
}

/** The pre-skeleton path: 3 days per call, no streaming. Kept as the fallback. */
async function synthesizeBatched(
  brief: TripBrief,
  researchBlock: string,
  numDays: number,
  start: string,
  llm: LLMClient,
  cb: StreamCallbacks,
): Promise<Record<string, unknown>> {
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
      brief, batch.start, batch.end, numDays, start, llm, hotelHint, researchBlock,
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
  return merged;
}

/**
 * The progressive path: one focused LLM call PER DAY, guided by the skeleton.
 * After each day validates, a partial TripPlan (days so far) is streamed via
 * onPartialPlan — the traveler reviews day 1 while day 2 is being written.
 */
async function synthesizeProgressive(
  brief: TripBrief,
  skeleton: TripSkeleton,
  researchBlock: string,
  numDays: number,
  llm: LLMClient,
  cb: StreamCallbacks,
  pid: string,
): Promise<Record<string, unknown>> {
  const days: DayPlan[] = [];

  const sumSelected = () =>
    days.reduce(
      (sum, d) =>
        sum +
        d.blocks.reduce((s, b) => {
          const sel = b.options.find((o) => o.id === b.selectedOptionId) ?? b.options[0];
          return s + (sel?.price.amount ?? 0);
        }, 0),
      0,
    );
  const currencyOf = () => days[0]?.blocks[0]?.options[0]?.price.currency ?? "EUR";

  const partialPlan = (): TripPlan => ({
    planId: pid,
    title: skeleton.title || `${brief.facts.destination} itinerary`,
    description: skeleton.description || "",
    totalEstimatedCost: skeleton.totalEstimatedCost ?? { amount: Math.round(sumSelected()), currency: currencyOf() },
    duration: `${numDays} Days`,
    days: [...days],
    inferenceChain: brief.inferenceChain,
  });

  for (const sd of skeleton.days) {
    cb.onThought(`Writing day ${sd.dayNumber} of ${numDays}${sd.title ? ` — ${sd.title}` : ""}…`);
    const prevDay = days[days.length - 1];
    const day = await synthesizeDay(brief, sd, numDays, researchBlock, prevDay, llm);

    // Reconcile booking/access/mode contradictions BEFORE the day streams (H3)
    enforceConsistency({ ...emptyPlanShell(), days: [day] });

    // Every link is checked BEFORE the traveler can click it (P1)
    const links = await verifyDayLinks([day]);
    if (links.replaced > 0) {
      cb.onThought(`Checked ${links.checked} links on day ${sd.dayNumber} — replaced ${links.replaced} dead one(s) with verified map links.`);
    }

    days.push(day);
    cb.onThought(`Day ${sd.dayNumber} ready — ${day.blocks.length} blocks. ${sd.dayNumber < numDays ? "You can start reviewing it while I write the rest." : ""}`);
    cb.onPartialPlan?.(partialPlan());
  }

  return {
    title: skeleton.title || `${brief.facts.destination} itinerary`,
    description: skeleton.description || "",
    totalEstimatedCost: skeleton.totalEstimatedCost ?? { amount: Math.round(sumSelected()), currency: currencyOf() },
    duration: `${numDays} Days`,
    days,
    inferenceChain: [],
  };
}

/** Generate ONE day from its skeleton entry. Retries once on schema failure. */
async function synthesizeDay(
  brief: TripBrief,
  sd: SkeletonDay,
  totalDays: number,
  researchBlock: string,
  prevDay: DayPlan | undefined,
  llm: LLMClient,
): Promise<DayPlan> {
  const minBlocks = sd.dayNumber === 1 || sd.dayNumber === totalDays ? 2 : 3;

  const extractDay = (text: string): unknown => {
    const raw = JSON.parse(extractJSON(text)) as Record<string, unknown>;
    // Accept every shape the model produces: {"day": {...}}, {"days": [{...}]}
    // (the cacheable schema block teaches the days-array habit), or a bare day.
    if (raw["day"] && typeof raw["day"] === "object") return raw["day"];
    if (Array.isArray(raw["days"])) return (raw["days"] as unknown[])[0];
    return raw;
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    let res;
    try {
      res = await llm.run(
        {
          stage: "synthesis",
          system: SYSTEM,
          cacheableContext: SCHEMA_BLOCK,
          user: buildDayPrompt(brief, sd, totalDays, researchBlock, prevDay),
        },
        (text) => {
          try {
            const day = extractDay(text) as { dayNumber?: number; blocks?: unknown[] };
            if (!Array.isArray(day.blocks) || day.blocks.length < minBlocks) {
              console.warn(`[synthesis] day ${sd.dayNumber} rejected: ${Array.isArray(day.blocks) ? day.blocks.length : "no"} blocks (min ${minBlocks})`);
              return false;
            }
            return true;
          } catch (err) {
            console.warn(`[synthesis] day ${sd.dayNumber} rejected: unparseable (${err instanceof Error ? err.message.slice(0, 50) : err})`);
            return false;
          }
        },
      );
    } catch (err) {
      throw new Error(
        `The AI could not produce a valid schedule for day ${sd.dayNumber} after several attempts. ` +
        `This is usually temporary — please try again. (${err instanceof Error ? err.message : err})`,
      );
    }

    const parsed = DayPlanSchema.safeParse(extractDay(res.text));
    if (parsed.success) {
      const day = parsed.data;
      // Normalise against the skeleton (the model occasionally drifts)
      day.dayNumber = sd.dayNumber;
      day.date = sd.date;
      day.blocks.sort((a, b) => {
        const ta = a.scheduledTime.replace(":", "").padStart(4, "0");
        const tb = b.scheduledTime.replace(":", "").padStart(4, "0");
        return ta.localeCompare(tb);
      });
      return day;
    }
    console.warn(`[synthesis] day ${sd.dayNumber} failed Zod (attempt ${attempt}/2): ${parsed.error.issues[0]?.message}`);
  }
  throw new Error(`Day ${sd.dayNumber} could not be generated in a valid format — please try again.`);
}

function buildDayPrompt(
  brief: TripBrief,
  sd: SkeletonDay,
  totalDays: number,
  researchBlock: string,
  prevDay: DayPlan | undefined,
): string {
  const f = brief.facts;
  const adults = f.partyAdults ?? 2;
  const children = f.partyChildren ?? 0;
  const party = children > 0 ? `${adults} adults + ${children} children` : `${adults} adult${adults > 1 ? "s" : ""}`;
  const cap = f.budgetDailyCap;

  const prevEnd = prevDay
    ? prevDay.blocks[prevDay.blocks.length - 1]?.options.find(
        (o) => o.id === prevDay.blocks[prevDay.blocks.length - 1]!.selectedOptionId,
      )?.title
    : undefined;

  return `TRAVELER PROFILE:
${brief.travelerProfile}

ORIGINAL TRAVELER REQUEST (verbatim — honour every stated constraint):
${f.freeformText ?? f.travelerDescription}

TRIP FACTS:
- Destination: ${f.destination}
- Origin: ${f.origin ?? "not stated — start the itinerary at the destination"}
- Party: ${party} | Budget: ${f.budgetTier}${cap ? ` (HARD CAP ${cap.currency} ${cap.amount}/day — ANCHOR selections of this day must sum within it)` : ""}
- This is day ${sd.dayNumber} of ${totalDays}.
${sd.dayNumber === 1 ? "- Day 1 is the ARRIVAL day: no destination breakfast/lunch/morning program; begin with the journey/check-in." : ""}
${sd.dayNumber === totalDays ? `- Day ${totalDays} is the DEPARTURE day: checkout ~11:00, end with the return journey, no evening program.` : ""}
${researchBlock}
=== TODAY'S STRUCTURE (decided by the trip architect — follow it) ===
- Date: ${sd.date} | Title: ${sd.title || "(compose one)"} | Theme: ${sd.theme || "(compose one)"}
- Base: ${sd.base ?? f.destination}
- Tonight's hotel: ${sd.hotel || "(pick from candidates)"}${sd.roomConfig ? ` (${sd.roomConfig})` : ""}
- Morning: ${sd.morning ?? "(free)"}
- Afternoon: ${sd.afternoon ?? "(free)"}
- Evening: ${sd.evening ?? "(free)"}
${prevEnd ? `- The previous day ended at: ${prevEnd} (start today from there).` : ""}

Generate ONLY this single day, expanding today's structure into full blocks with
transport between venues, meals, exact times and 4 options per block.
Output a JSON object: {"day": { "dayNumber": ${sd.dayNumber}, "date": "${sd.date}", "title": "...",
"theme": "...", "dailyTips": [...], "blocks": [ ...same block schema as always... ] }}`;
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
