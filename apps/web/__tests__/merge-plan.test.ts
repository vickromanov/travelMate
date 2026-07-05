/**
 * Progressive-delivery merge: incoming partial/final plans must never
 * overwrite a day the traveler already customised.
 */
import { describe, it, expect } from "vitest";
import { mergePlans, totalDaysOf } from "../src/lib/merge-plan";
import type { TripPlan, DayPlan } from "../src/lib/plan-types";

function day(n: number, marker = "server"): DayPlan {
  return {
    dayNumber: n,
    date: `2026-07-0${n + 2}`,
    title: `Day ${n} (${marker})`,
    theme: "",
    dailyTips: [],
    blocks: [],
  };
}

function plan(days: DayPlan[], duration = `${days.length} Days`): TripPlan {
  return {
    planId: "p1",
    title: "Test Trip",
    description: "",
    totalEstimatedCost: { amount: 100, currency: "EUR" },
    duration,
    days,
  };
}

describe("mergePlans", () => {
  it("returns the incoming plan when there is no current plan", () => {
    const incoming = plan([day(1)]);
    expect(mergePlans(null, incoming, new Set())).toBe(incoming);
  });

  it("adopts new days as they stream in", () => {
    const current = plan([day(1)], "3 Days");
    const incoming = plan([day(1), day(2)], "3 Days");
    const merged = mergePlans(current, incoming, new Set());
    expect(merged.days.map((d) => d.dayNumber)).toEqual([1, 2]);
  });

  it("keeps the traveler's version of a swapped day", () => {
    const mine = { ...day(1, "mine") };
    const current = plan([mine], "2 Days");
    const incoming = plan([day(1, "server-v2"), day(2)], "2 Days");
    const merged = mergePlans(current, incoming, new Set([1]));
    expect(merged.days[0]!.title).toBe("Day 1 (mine)");
    expect(merged.days[1]!.title).toBe("Day 2 (server)");
  });

  it("lets the final plan replace untouched days (e.g. repaired ones)", () => {
    const current = plan([day(1, "old"), day(2, "old")], "2 Days");
    const incoming = plan([day(1, "repaired"), day(2, "repaired")], "2 Days");
    const merged = mergePlans(current, incoming, new Set());
    expect(merged.days.every((d) => d.title.includes("repaired"))).toBe(true);
  });
});

describe("totalDaysOf", () => {
  it("reads the total from the duration string", () => {
    expect(totalDaysOf(plan([day(1)], "7 Days"))).toBe(7);
  });

  it("never reports fewer days than already present", () => {
    expect(totalDaysOf(plan([day(1), day(2)], "1 Days"))).toBe(2);
  });
});
