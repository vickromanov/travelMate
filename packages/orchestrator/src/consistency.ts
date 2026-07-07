/**
 * Cross-field consistency layer (H3 zero-thinking).
 *
 * Schema-valid JSON can still be logically self-contradictory: the LLM sets
 * price, accessNotes and bookingRequired INDEPENDENTLY, so a EUR 180 "Cable Car
 * Combo" can end up flagged "no booking needed — just walk in". Research on
 * structured-output reliability is blunt: native structured output does not
 * prevent semantic errors — you must DERIVE dependent fields from facts and
 * check cross-field constraints deterministically.
 *
 * This module runs AFTER Zod parsing and BEFORE the quality gate. It FIXES what
 * it safely can in code (no LLM); the quality validator then flags anything
 * that still contradicts, feeding the scoped repair pass.
 */
import type { TripPlan, TravelOption, ItineraryBlock } from "@travelmate/contracts";

/** Words that prove reaching/using this option COSTS money (a ticket exists). */
const PAID_ACCESS_RE =
  /\b(cable ?car|cogwheel|funicular|gondola|ferry|seilbahn|zahnradbahn|tram(?:way)?|shuttle|lift|included in the [^.]*\b(ticket|fee|combo|fare|pass)|round-?trip|entry fee|admission)\b/i;

/** Signals a genuinely free, walk-up experience (no ticket, no reservation). */
const FREE_WALKIN_RE =
  /\b(free entry|no ticket|no booking|walk-?in|free to enter|open access|public (square|park|street|promenade)|stroll|viewpoint|free of charge)\b/i;

function venueSlug(opt: TravelOption): string {
  return encodeURIComponent(`${opt.title} ${opt.location.address}`.trim());
}

/** Deterministic ticket/booking deep links per category — venue-specific. */
function ticketUrlFor(category: string, opt: TravelOption): string | undefined {
  const q = venueSlug(opt);
  switch (category) {
    case "ACTIVITIES": return `https://www.getyourguide.com/s/?q=${q}`;
    case "STAYS":      return `https://www.booking.com/searchresults.html?ss=${q}`;
    default:           return undefined; // DINING → reserve by phone; TRANSPORT → n/a
  }
}

/**
 * True when an option is genuinely a free walk-in: costs nothing AND nothing in
 * its text implies a paid ticket/transport to use it.
 */
export function isFreeWalkIn(opt: TravelOption): boolean {
  if (opt.bookingRequired || opt.bookingUrl) return false;
  if (opt.price.amount > 0) return false;
  const text = `${opt.description} ${opt.reasoning} ${opt.accessNotes ?? ""}`;
  if (PAID_ACCESS_RE.test(text)) return false;
  return true;
}

export interface ConsistencyReport {
  fixed: number;
}

/**
 * Normalise every option in the plan so booking / access / price fields agree.
 * Mutates in place. Rules:
 *  - A priced ACTIVITIES/STAYS option, or any option whose access requires paid
 *    transport, MUST be bookable → set bookingRequired, and give it a booking
 *    link (or phone-reserve for dining) so the traveler can actually pay.
 *  - accessNotes must never be silent when paid transport is involved.
 *  - Transport directions links must carry the mode the title implies.
 */
export function enforceConsistency(plan: TripPlan): ConsistencyReport {
  let fixed = 0;

  for (const day of plan.days) {
    for (const block of day.blocks) {
      for (const opt of block.options) {
        fixed += reconcileBooking(block.category, opt);
      }
      if (block.category === "TRANSPORT") {
        for (const opt of block.options) fixed += reconcileTransportLink(opt);
      }
    }
  }

  return { fixed };
}

/** Make booking/price/access agree for one option. Returns #fields changed. */
function reconcileBooking(category: string, opt: TravelOption): number {
  let changed = 0;
  const text = `${opt.description} ${opt.reasoning} ${opt.accessNotes ?? ""}`;
  const paidAccess = PAID_ACCESS_RE.test(text);

  // A priced ticketed experience, or one gated behind paid transport, is NOT
  // walk-in — it must be bookable.
  const mustBeBookable =
    (category === "ACTIVITIES" && opt.price.amount > 0) ||
    (category === "STAYS") ||
    paidAccess;

  if (mustBeBookable && !opt.bookingRequired) {
    // Don't force DINING (walk-in restaurants are legitimate) unless paid access.
    if (category !== "DINING" || paidAccess) {
      opt.bookingRequired = true;
      changed++;
    }
  }

  // Guarantee a way to actually book/buy when booking is required.
  if (opt.bookingRequired && !opt.bookingUrl) {
    const url = ticketUrlFor(category, opt);
    if (url) {
      opt.bookingUrl = url;
      changed++;
    } else if (category === "DINING" && !opt.phoneNumber) {
      // Dining with no page and no phone — at least point at the venue.
      opt.bookingUrl = `https://www.google.com/maps/search/?api=1&query=${venueSlug(opt)}`;
      changed++;
    }
  }

  // accessNotes must not stay silent when paid transport is required to arrive.
  if (paidAccess && (!opt.accessNotes || opt.accessNotes.length < 8)) {
    const m = text.match(PAID_ACCESS_RE);
    opt.accessNotes = `Requires paid transport to reach (${m?.[0] ?? "cable car / ticket"}) — included in the price.`;
    changed++;
  }

  return changed;
}

/**
 * A transport directions link must use the travel mode the option describes and
 * carry a real origin+destination. "Drive via B23" with travelmode=transit (or a
 * bare maps search) shows no useful route.
 */
function reconcileTransportLink(opt: TravelOption): number {
  const desired = intendedMode(`${opt.title} ${opt.description}`);
  if (!opt.link) return 0;

  const isDir = /google\.[a-z.]+\/maps\/dir/i.test(opt.link);
  let changed = 0;

  if (isDir) {
    try {
      const u = new URL(opt.link);
      const origin = u.searchParams.get("origin");
      const dest = u.searchParams.get("destination");
      const mode = u.searchParams.get("travelmode");
      if (!origin || !dest) return 0; // endpoints missing — reflow/synthesis owns this
      if (mode !== desired) {
        u.searchParams.set("travelmode", desired);
        opt.link = u.toString();
        opt.linkType = "DIRECTIONS";
        changed++;
      }
    } catch { /* malformed — verify-links will handle */ }
  }
  return changed;
}

function intendedMode(text: string): "driving" | "walking" | "bicycling" | "transit" {
  const t = text.toLowerCase();
  if (/\b(drive|driving|car|by car|taxi|rideshare|uber|self-?drive|rental car|motorway|autobahn|via [ab]\d)\b/.test(t)) return "driving";
  if (/\b(walk|walking|on foot|stroll|footpath|promenade)\b/.test(t)) return "walking";
  if (/\b(bike|bicycle|cycling|cycle|e-?bike)\b/.test(t)) return "bicycling";
  return "transit"; // train, bus, tram, metro, ferry, cable car, default
}
