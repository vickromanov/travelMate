/**
 * Deterministic zero-thinking quality validator (H3 / P2).
 *
 * Runs AFTER Zod structural validation, both at runtime (post-synthesis, driving
 * one repair round) and in the self-test harness (tooling/system-test). Every rule
 * encodes a promise the product makes: "the traveler never has to think".
 *
 * error   = plan breaks a zero-thinking promise → worth an LLM repair round
 * warning = quality degradation → logged, surfaced, but the plan still ships
 */
import type { TripPlan, DayPlan, ItineraryBlock, Money } from "@travelmate/contracts";

export interface QualityOptions {
  /** Traveler-stated per-day, per-person budget — selected options must fit it. */
  dailyBudgetCap?: Money;
  /** Used to scale the per-person cap to the whole party. Defaults to 1. */
  partyAdults?: number;
  /** With partyAdults, drives the room-configuration check on STAYS options. */
  partyChildren?: number;
}

export interface QualityIssue {
  severity: "error" | "warning";
  rule: string;
  /** "plan" | "day 3" | "day 3, block d3_b2" — where the issue lives. */
  where: string;
  message: string;
  /** dayNumber when the issue is repairable by regenerating that day. */
  dayNumber?: number;
}

export interface QualityReport {
  issues: QualityIssue[];
  errors: number;
  warnings: number;
  /** 100 minus penalties — a quick comparable number for test reports. */
  score: number;
  ok: boolean;
}

const REQUIRED_TIERS = ["ANCHOR", "SMART-VALUE", "PREMIUM", "INDEPENDENT"] as const;

const PLACEHOLDER_RE =
  /\b(your hotel|the hotel\b(?! [A-Z])|a local|nearby (restaurant|café|cafe|hotel)|TBD|placeholder|option [0-9]|venue name|restaurant name|hotel name)\b/i;

function timeToMinutes(t: string): number | null {
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1]!, 10) * 60 + parseInt(m[2]!, 10);
}

function addDaysISO(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function anchorTitle(block: ItineraryBlock): string | undefined {
  return block.options.find((o) => o.tier === "ANCHOR")?.title;
}

export function validatePlanQuality(plan: TripPlan, opts: QualityOptions = {}): QualityReport {
  const issues: QualityIssue[] = [];
  const err = (rule: string, where: string, message: string, dayNumber?: number) =>
    issues.push({ severity: "error", rule, where, message, dayNumber });
  const warn = (rule: string, where: string, message: string, dayNumber?: number) =>
    issues.push({ severity: "warning", rule, where, message, dayNumber });

  /* ── Plan-level ─────────────────────────────────────────────────────────── */

  const durationMatch = plan.duration.match(/(\d+)/);
  const declaredDays = durationMatch ? parseInt(durationMatch[1]!, 10) : null;
  if (declaredDays !== null && declaredDays !== plan.days.length) {
    err("duration-days-match", "plan",
      `duration says "${plan.duration}" but plan has ${plan.days.length} day(s)`);
  }
  if (plan.days.length === 0) {
    err("has-days", "plan", "plan contains no days");
    return summarize(issues);
  }

  const firstDate = plan.days[0]!.date;
  const seenBlockIds = new Set<string>();
  const hotelByDay: Array<{ day: number; title: string }> = [];

  /* ── Per-day ────────────────────────────────────────────────────────────── */

  plan.days.forEach((day: DayPlan, i: number) => {
    const where = `day ${day.dayNumber}`;

    if (day.dayNumber !== i + 1) {
      err("day-number-sequence", where, `expected dayNumber ${i + 1}, got ${day.dayNumber}`, day.dayNumber);
    }
    const expectedDate = addDaysISO(firstDate, i);
    if (day.date !== expectedDate) {
      err("dates-sequential", where, `expected date ${expectedDate}, got ${day.date}`, day.dayNumber);
    }

    // Category coverage — the zero-thinking floor. Arrival (first) and
    // departure (last) days are PARTIAL days: the traveler is only at the
    // destination for part of them, so a single meal is legitimate.
    const isArrival = i === 0;
    const isDeparture = i === plan.days.length - 1;
    const partialDay = isArrival || isDeparture;

    const count = (cat: string) => day.blocks.filter((b) => b.category === cat).length;
    if (count("STAYS") < 1) err("stays-coverage", where, "no STAYS block — traveler has no accommodation anchor", day.dayNumber);
    const minDining = partialDay ? 1 : 3;
    if (count("DINING") < minDining) {
      err("dining-coverage", where,
        partialDay
          ? "no DINING block — even a partial arrival/departure day needs at least one meal"
          : `only ${count("DINING")} DINING block(s) — need breakfast, lunch, dinner`,
        day.dayNumber);
    }
    if (count("ACTIVITIES") < 1 && !partialDay) err("activities-coverage", where, "no ACTIVITIES block", day.dayNumber);
    const minTransport = partialDay ? 1 : 2;
    if (count("TRANSPORT") < minTransport) warn("transport-coverage", where, `only ${count("TRANSPORT")} TRANSPORT block(s) — traveler may be stranded between venues`, day.dayNumber);

    // Budget cap (traveler-stated, e.g. "€50/day") — checked against the
    // SELECTED options, i.e. what the traveler actually pays by default
    if (opts.dailyBudgetCap) {
      const capTotal = opts.dailyBudgetCap.amount * Math.max(1, opts.partyAdults ?? 1);
      const dayTotal = day.blocks.reduce((sum, b) => {
        const sel = b.options.find((o) => o.id === b.selectedOptionId) ?? b.options[0];
        return sum + (sel?.price.amount ?? 0);
      }, 0);
      if (dayTotal > capTotal * 1.2) {
        err("budget-cap", where,
          `selected options total ${opts.dailyBudgetCap.currency} ${Math.round(dayTotal)} — exceeds the traveler's ${opts.dailyBudgetCap.currency} ${capTotal}/day budget by more than 20%`,
          day.dayNumber);
      } else if (dayTotal > capTotal) {
        warn("budget-cap", where,
          `selected options total ${opts.dailyBudgetCap.currency} ${Math.round(dayTotal)} — slightly over the ${opts.dailyBudgetCap.currency} ${capTotal}/day budget`,
          day.dayNumber);
      }
    }

    // Meal-slot coverage — arrival days have no morning at the destination,
    // departure days have no evening
    const diningTimes = day.blocks
      .filter((b) => b.category === "DINING")
      .map((b) => timeToMinutes(b.scheduledTime))
      .filter((t): t is number => t !== null);
    if (diningTimes.length > 0) {
      if (!isArrival) {
        if (!diningTimes.some((t) => t < 11 * 60)) warn("breakfast-slot", where, "no DINING block before 11:00", day.dayNumber);
        if (!diningTimes.some((t) => t >= 11 * 60 && t < 16 * 60)) warn("lunch-slot", where, "no DINING block between 11:00-16:00", day.dayNumber);
      }
      if (!isDeparture && !diningTimes.some((t) => t >= 17 * 60)) warn("dinner-slot", where, "no DINING block after 17:00", day.dayNumber);
    }

    // Chronological order
    let prev = -1;
    for (const b of day.blocks) {
      const t = timeToMinutes(b.scheduledTime);
      if (t === null) {
        err("valid-time", `${where}, block ${b.blockId}`, `unparseable scheduledTime "${b.scheduledTime}"`, day.dayNumber);
        continue;
      }
      if (t < prev) {
        err("chronological-order", `${where}, block ${b.blockId}`, `scheduledTime ${b.scheduledTime} is earlier than the previous block`, day.dayNumber);
      }
      prev = t;
    }

    // Per-block invariants
    for (const b of day.blocks) {
      const bWhere = `${where}, block ${b.blockId}`;

      if (seenBlockIds.has(b.blockId)) {
        err("unique-block-ids", bWhere, `duplicate blockId "${b.blockId}"`, day.dayNumber);
      }
      seenBlockIds.add(b.blockId);

      if (!b.options.some((o) => o.id === b.selectedOptionId)) {
        err("selected-option-valid", bWhere, `selectedOptionId "${b.selectedOptionId}" not present in options`, day.dayNumber);
      }

      const tiers = b.options.map((o) => o.tier);
      for (const t of REQUIRED_TIERS) {
        if (!tiers.includes(t)) {
          warn("four-tiers", bWhere, `missing ${t} tier option`, day.dayNumber);
        }
      }

      for (const o of b.options) {
        if (PLACEHOLDER_RE.test(o.title)) {
          err("no-placeholders", bWhere, `option "${o.title}" looks like a placeholder, not a real venue`, day.dayNumber);
        }
        if (!o.description || !o.reasoning) {
          warn("option-completeness", bWhere, `option "${o.title}" is missing its ${!o.description ? "description" : "reasoning"}`, day.dayNumber);
        }
        if (!o.location.address && b.category !== "TRANSPORT") {
          warn("option-completeness", bWhere, `option "${o.title}" has no street address`, day.dayNumber);
        }
        const { lat, lng } = o.location;
        if (lat === 0 && lng === 0) {
          warn("plausible-coords", bWhere, `option "${o.title}" has (0,0) coordinates`, day.dayNumber);
        } else if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
          err("plausible-coords", bWhere, `option "${o.title}" has out-of-range coordinates (${lat}, ${lng})`, day.dayNumber);
        }
      }

      // STAYS pricing must reflect the real party: 3+ people don't fit one
      // double room. Error severity — the repair pass must restate the option
      // with the room count and the multiplied total (rooms × per-room rate).
      const partySize = Math.max(1, opts.partyAdults ?? 1) + (opts.partyChildren ?? 0);
      if (b.category === "STAYS" && partySize > 2) {
        const sel = b.options.find((o) => o.id === b.selectedOptionId) ?? b.options[0];
        if (sel && !/family room|famil|suite|apartment|\d\s*(x|×)\s*(double|twin|room)|two rooms|triple|quad|connecting|rooms ×|rooms for/i.test(`${sel.title} ${sel.description}`)) {
          err("stays-room-config", bWhere,
            `party of ${partySize} but option "${sel.title}" does not state a room configuration — ` +
            `describe the rooms needed (e.g. "2 rooms × EUR 250 = EUR 500/night") and set price to the multiplied total`,
            day.dayNumber);
        }
      }

      // TRANSPORT must tell the traveler how to actually move (H3)
      if (b.category === "TRANSPORT") {
        const anchor = b.options.find((o) => o.tier === "ANCHOR") ?? b.options[0];
        if (anchor?.link && !/maps\/dir|maps\.google|goo\.gl\/maps|google\.com\/maps/.test(anchor.link)) {
          warn("transport-directions-link", bWhere, "ANCHOR transport option link is not a maps/directions URL", day.dayNumber);
        }
      }
    }

    // Hotel consistency across the trip (warning — city moves are legitimate)
    const stays = day.blocks.find((b) => b.category === "STAYS");
    const hotel = stays ? anchorTitle(stays) : undefined;
    if (hotel) hotelByDay.push({ day: day.dayNumber, title: hotel });
  });

  const distinctHotels = new Set(hotelByDay.map((h) => h.title.toLowerCase().trim()));
  if (distinctHotels.size > Math.max(1, Math.ceil(plan.days.length / 3))) {
    warn("hotel-consistency", "plan",
      `${distinctHotels.size} different ANCHOR hotels across ${plan.days.length} days — verify this is an intentional multi-city trip`);
  }

  return summarize(issues);
}

function summarize(issues: QualityIssue[]): QualityReport {
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  return {
    issues,
    errors,
    warnings,
    score: Math.max(0, 100 - errors * 10 - warnings * 2),
    ok: errors === 0,
  };
}

/**
 * Deterministic budget enforcement — NO LLM (projectStructure.md §3.3 spirit:
 * re-pick options from what is already generated). For each day over the cap,
 * greedily swaps the selected option to a cheaper alternative on the block with
 * the largest saving, until the day fits or no cheaper alternatives remain.
 * Mutates the plan in place; returns the number of swaps performed.
 */
export function enforceBudgetBySwaps(plan: TripPlan, opts: QualityOptions): number {
  const cap = opts.dailyBudgetCap;
  if (!cap) return 0;
  const capTotal = cap.amount * Math.max(1, opts.partyAdults ?? 1);
  let swaps = 0;

  for (const day of plan.days) {
    const selectedPrice = (b: ItineraryBlock) =>
      (b.options.find((o) => o.id === b.selectedOptionId) ?? b.options[0])?.price.amount ?? 0;
    let total = day.blocks.reduce((s, b) => s + selectedPrice(b), 0);

    while (total > capTotal) {
      // Find the block where switching to its cheapest option saves the most
      let bestBlock: ItineraryBlock | undefined;
      let bestOptionId: string | undefined;
      let bestSaving = 0;
      for (const b of day.blocks) {
        const current = selectedPrice(b);
        for (const o of b.options) {
          const saving = current - o.price.amount;
          if (saving > bestSaving) {
            bestSaving = saving;
            bestBlock = b;
            bestOptionId = o.id;
          }
        }
      }
      if (!bestBlock || !bestOptionId) break; // nothing cheaper anywhere — give up
      bestBlock.selectedOptionId = bestOptionId;
      total -= bestSaving;
      swaps++;
    }
  }
  return swaps;
}

/** Compact human-readable digest for onThought / test reports. */
export function formatQualityReport(report: QualityReport, maxLines = 12): string {
  if (report.issues.length === 0) return "Quality check passed — no issues.";
  const lines = report.issues
    .slice(0, maxLines)
    .map((i) => `[${i.severity}] ${i.rule} @ ${i.where}: ${i.message}`);
  const more = report.issues.length - maxLines;
  if (more > 0) lines.push(`…and ${more} more issue(s)`);
  lines.unshift(`Quality score ${report.score}/100 — ${report.errors} error(s), ${report.warnings} warning(s)`);
  return lines.join("\n");
}
