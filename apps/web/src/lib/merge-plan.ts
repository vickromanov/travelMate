/**
 * Merging progressive plan updates without losing the traveler's work.
 *
 * Partial plans stream in day by day; the final plan arrives last (possibly
 * with repaired days). If the traveler already swapped options on a day they
 * are reviewing, an incoming update must NOT overwrite that day — their
 * choices win over regeneration (H4 spirit: edit, don't regenerate).
 */
import type { TripPlan } from "./plan-types";

export function mergePlans(
  current: TripPlan | null,
  incoming: TripPlan,
  swappedDayNumbers: ReadonlySet<number>,
): TripPlan {
  if (!current) return incoming;

  const currentByNumber = new Map(current.days.map((d) => [d.dayNumber, d]));
  const days = incoming.days.map((incomingDay) => {
    const existing = currentByNumber.get(incomingDay.dayNumber);
    // A day the traveler touched keeps THEIR version
    return existing && swappedDayNumbers.has(incomingDay.dayNumber) ? existing : incomingDay;
  });

  return { ...incoming, days };
}

/** "7 Days" → 7. Falls back to the day count we already have. */
export function totalDaysOf(plan: TripPlan): number {
  const m = plan.duration.match(/(\d+)/);
  const n = m ? parseInt(m[1]!, 10) : NaN;
  return Number.isFinite(n) && n >= plan.days.length ? n : plan.days.length;
}
