/**
 * Unit tests for the zero-thinking quality validator (quality.ts).
 * Builds a known-good fixture plan, then mutates it to trigger each rule.
 * Zero network, zero cost — runs on every `pnpm test`.
 */
import { describe, it, expect } from "vitest";
import type { TripPlan, DayPlan, ItineraryBlock, TravelOption } from "@travelmate/contracts";
import { validatePlanQuality, formatQualityReport, enforceBudgetBySwaps } from "../src/quality.js";

/* ── Fixture builders ─────────────────────────────────────────────────────── */

let optSeq = 0;
function option(tier: TravelOption["tier"], title: string): TravelOption {
  optSeq++;
  return {
    id: `o${optSeq}`,
    tier,
    title,
    description: `${title} description`,
    reasoning: "fits the traveler",
    price: { amount: 20, currency: "EUR" },
    location: { lat: 48.1371, lng: 11.5754, address: "Marienplatz 1, Munich" },
  };
}

function block(
  blockId: string,
  category: ItineraryBlock["category"],
  scheduledTime: string,
  anchorTitle: string,
  overrides: Partial<ItineraryBlock> = {},
): ItineraryBlock {
  const options = [
    option("ANCHOR", anchorTitle),
    option("SMART-VALUE", `${anchorTitle} (value)`),
    option("PREMIUM", `${anchorTitle} (premium)`),
    option("INDEPENDENT", `${anchorTitle} (local)`),
  ];
  if (category === "TRANSPORT") {
    for (const o of options) {
      o.link = `https://www.google.com/maps/dir/?api=1&origin=Hotel+Platzl&destination=${encodeURIComponent(anchorTitle)}&travelmode=transit`;
    }
  }
  return {
    blockId,
    category,
    scheduledTime,
    label: anchorTitle,
    selectedOptionId: options[0]!.id,
    dependencyLogic: "none",
    options,
    ...overrides,
  };
}

function goodDay(dayNumber: number, date: string): DayPlan {
  const d = `d${dayNumber}`;
  return {
    dayNumber,
    date,
    title: `Day ${dayNumber}`,
    theme: "Explore the old town",
    dailyTips: ["Carry cash"],
    blocks: [
      block(`${d}_b1`, "STAYS", "07:00", "Hotel Platzl"),
      block(`${d}_b2`, "DINING", "08:00", "Café Frischhut"),
      block(`${d}_b3`, "TRANSPORT", "09:15", "U-Bahn to Marienplatz"),
      block(`${d}_b4`, "ACTIVITIES", "10:00", "Residenz Museum"),
      block(`${d}_b5`, "DINING", "12:30", "Augustiner Klosterwirt"),
      block(`${d}_b6`, "TRANSPORT", "14:00", "Tram to Nymphenburg"),
      block(`${d}_b7`, "ACTIVITIES", "14:30", "Nymphenburg Palace"),
      block(`${d}_b8`, "DINING", "19:30", "Wirtshaus in der Au"),
    ],
  };
}

function goodPlan(numDays = 2): TripPlan {
  const days: DayPlan[] = [];
  for (let i = 0; i < numDays; i++) {
    const date = new Date(Date.UTC(2026, 8, 19 + i)).toISOString().slice(0, 10);
    days.push(goodDay(i + 1, date));
  }
  return {
    planId: "test-plan",
    title: "Munich Test Trip",
    description: "A test plan",
    totalEstimatedCost: { amount: 1500, currency: "EUR" },
    duration: `${numDays} Days`,
    days,
    inferenceChain: [],
  };
}

/* ── Tests ────────────────────────────────────────────────────────────────── */

describe("validatePlanQuality — good plan", () => {
  it("passes a well-formed plan with no errors", () => {
    const report = validatePlanQuality(goodPlan());
    expect(report.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(90);
  });
});

describe("validatePlanQuality — plan-level rules", () => {
  it("flags duration/day-count mismatch", () => {
    const plan = goodPlan(2);
    plan.duration = "7 Days";
    const report = validatePlanQuality(plan);
    expect(report.issues.some((i) => i.rule === "duration-days-match")).toBe(true);
    expect(report.ok).toBe(false);
  });

  it("flags an empty plan", () => {
    const plan = goodPlan();
    plan.days = [];
    expect(validatePlanQuality(plan).issues.some((i) => i.rule === "has-days")).toBe(true);
  });

  it("flags non-sequential dates", () => {
    const plan = goodPlan(2);
    plan.days[1]!.date = "2026-09-25"; // gap
    expect(validatePlanQuality(plan).issues.some((i) => i.rule === "dates-sequential")).toBe(true);
  });

  it("warns when the hotel changes every day", () => {
    const plan = goodPlan(2);
    // Rename day 2's hotel anchor
    const stays = plan.days[1]!.blocks.find((b) => b.category === "STAYS")!;
    for (const o of stays.options) o.title = "Totally Different Hotel";
    const report = validatePlanQuality(plan);
    expect(report.issues.some((i) => i.rule === "hotel-consistency")).toBe(true);
  });
});

describe("validatePlanQuality — day-level rules", () => {
  it("flags a day with no STAYS block", () => {
    const plan = goodPlan(1);
    plan.days[0]!.blocks = plan.days[0]!.blocks.filter((b) => b.category !== "STAYS");
    const report = validatePlanQuality(plan);
    expect(report.issues.some((i) => i.rule === "stays-coverage" && i.dayNumber === 1)).toBe(true);
  });

  it("flags a FULL day with fewer than 3 DINING blocks", () => {
    const plan = goodPlan(3);
    // day 2 is a full (middle) day — strip its dinner
    plan.days[1]!.blocks = plan.days[1]!.blocks.filter((b) => b.blockId !== "d2_b8");
    expect(validatePlanQuality(plan).issues.some((i) => i.rule === "dining-coverage" && i.dayNumber === 2)).toBe(true);
  });

  it("allows a partial ARRIVAL day with check-in, one activity and dinner only", () => {
    const plan = goodPlan(3);
    // arrival day: STAYS + evening transport + dinner
    plan.days[0]!.blocks = plan.days[0]!.blocks.filter((b) =>
      ["d1_b1", "d1_b7", "d1_b8"].includes(b.blockId));
    const report = validatePlanQuality(plan);
    expect(report.issues.some((i) => i.rule === "dining-coverage" && i.dayNumber === 1)).toBe(false);
    expect(report.issues.some((i) => i.rule === "activities-coverage" && i.dayNumber === 1)).toBe(false);
    expect(report.issues.some((i) => i.rule === "breakfast-slot" && i.dayNumber === 1)).toBe(false);
  });

  it("still requires at least one meal on a partial day", () => {
    const plan = goodPlan(2);
    plan.days[0]!.blocks = plan.days[0]!.blocks.filter((b) => b.category !== "DINING");
    expect(validatePlanQuality(plan).issues.some((i) => i.rule === "dining-coverage" && i.dayNumber === 1)).toBe(true);
  });

  it("flags out-of-order blocks", () => {
    const plan = goodPlan(1);
    plan.days[0]!.blocks[0]!.scheduledTime = "23:00"; // STAYS after everything else
    expect(validatePlanQuality(plan).issues.some((i) => i.rule === "chronological-order")).toBe(true);
  });

  it("flags duplicate blockIds", () => {
    const plan = goodPlan(1);
    plan.days[0]!.blocks[1]!.blockId = plan.days[0]!.blocks[0]!.blockId;
    expect(validatePlanQuality(plan).issues.some((i) => i.rule === "unique-block-ids")).toBe(true);
  });

  it("flags a selectedOptionId that is not in options", () => {
    const plan = goodPlan(1);
    plan.days[0]!.blocks[0]!.selectedOptionId = "nonexistent";
    expect(validatePlanQuality(plan).issues.some((i) => i.rule === "selected-option-valid")).toBe(true);
  });
});

describe("validatePlanQuality — option-level rules", () => {
  it("flags placeholder venue names", () => {
    const plan = goodPlan(1);
    plan.days[0]!.blocks[1]!.options[0]!.title = "A local café near your hotel";
    expect(validatePlanQuality(plan).issues.some((i) => i.rule === "no-placeholders")).toBe(true);
  });

  it("flags out-of-range coordinates as errors", () => {
    const plan = goodPlan(1);
    plan.days[0]!.blocks[1]!.options[0]!.location.lat = 123;
    const report = validatePlanQuality(plan);
    expect(report.issues.some((i) => i.rule === "plausible-coords" && i.severity === "error")).toBe(true);
  });

  it("warns on (0,0) coordinates", () => {
    const plan = goodPlan(1);
    plan.days[0]!.blocks[1]!.options[0]!.location.lat = 0;
    plan.days[0]!.blocks[1]!.options[0]!.location.lng = 0;
    const report = validatePlanQuality(plan);
    expect(report.issues.some((i) => i.rule === "plausible-coords" && i.severity === "warning")).toBe(true);
  });

  it("warns when a tier is missing", () => {
    const plan = goodPlan(1);
    plan.days[0]!.blocks[1]!.options[3]!.tier = "ANCHOR"; // duplicate ANCHOR, no INDEPENDENT
    expect(validatePlanQuality(plan).issues.some((i) => i.rule === "four-tiers")).toBe(true);
  });

  it("warns when a transport anchor link is not a directions URL", () => {
    const plan = goodPlan(1);
    const transport = plan.days[0]!.blocks.find((b) => b.category === "TRANSPORT")!;
    transport.options[0]!.link = "https://example.com/some-page";
    expect(validatePlanQuality(plan).issues.some((i) => i.rule === "transport-directions-link")).toBe(true);
  });
});

describe("validatePlanQuality — budget cap", () => {
  // goodDay has 8 blocks × €20 selected ANCHOR = €160/day
  it("passes when selected options fit the budget", () => {
    const report = validatePlanQuality(goodPlan(1), {
      dailyBudgetCap: { amount: 200, currency: "EUR" },
    });
    expect(report.issues.some((i) => i.rule === "budget-cap")).toBe(false);
  });

  it("errors when selected options exceed the cap by >20%", () => {
    const report = validatePlanQuality(goodPlan(1), {
      dailyBudgetCap: { amount: 50, currency: "EUR" },
    });
    expect(report.issues.some((i) => i.rule === "budget-cap" && i.severity === "error")).toBe(true);
    expect(report.ok).toBe(false);
  });

  it("warns when slightly over the cap", () => {
    const report = validatePlanQuality(goodPlan(1), {
      dailyBudgetCap: { amount: 150, currency: "EUR" },
    });
    const issue = report.issues.find((i) => i.rule === "budget-cap");
    expect(issue?.severity).toBe("warning");
  });

  it("scales the cap by party size", () => {
    // €160/day total, cap €50 × 4 adults = €200 → within budget
    const report = validatePlanQuality(goodPlan(1), {
      dailyBudgetCap: { amount: 50, currency: "EUR" },
      partyAdults: 4,
    });
    expect(report.issues.some((i) => i.rule === "budget-cap")).toBe(false);
  });

  it("ignores budget when no cap is provided", () => {
    expect(validatePlanQuality(goodPlan(1)).issues.some((i) => i.rule === "budget-cap")).toBe(false);
  });
});

describe("validatePlanQuality — party-aware stays pricing", () => {
  it("errors when a party of 4 gets a STAYS option without a room configuration", () => {
    const plan = goodPlan(1);
    const report = validatePlanQuality(plan, { partyAdults: 2, partyChildren: 2 });
    const issue = report.issues.find((i) => i.rule === "stays-room-config");
    expect(issue?.severity).toBe("error"); // error → triggers the repair pass
    expect(report.ok).toBe(false);
  });

  it("passes when the STAYS option shows the room math", () => {
    const plan = goodPlan(1);
    const stays = plan.days[0]!.blocks.find((b) => b.category === "STAYS")!;
    for (const o of stays.options) o.description = "2 rooms × EUR 250 = EUR 500/night, breakfast included";
    const report = validatePlanQuality(plan, { partyAdults: 2, partyChildren: 2 });
    expect(report.issues.some((i) => i.rule === "stays-room-config")).toBe(false);
  });

  it("accepts a family room as a valid configuration", () => {
    const plan = goodPlan(1);
    const stays = plan.days[0]!.blocks.find((b) => b.category === "STAYS")!;
    for (const o of stays.options) o.description = "Spacious family room for 4 with two extra beds";
    const report = validatePlanQuality(plan, { partyAdults: 2, partyChildren: 2 });
    expect(report.issues.some((i) => i.rule === "stays-room-config")).toBe(false);
  });

  it("does not flag a couple", () => {
    const report = validatePlanQuality(goodPlan(1), { partyAdults: 2, partyChildren: 0 });
    expect(report.issues.some((i) => i.rule === "stays-room-config")).toBe(false);
  });
});

describe("enforceBudgetBySwaps", () => {
  function planWithCheaperOptions(): TripPlan {
    const plan = goodPlan(1);
    // Give every block a cheap alternative: SMART-VALUE at €5 (ANCHOR selected at €20)
    for (const b of plan.days[0]!.blocks) {
      const value = b.options.find((o) => o.tier === "SMART-VALUE")!;
      value.price = { amount: 5, currency: "EUR" };
    }
    return plan; // selected total: 8 × €20 = €160; fully swapped: 8 × €5 = €40
  }

  it("swaps selected options until the day fits the cap", () => {
    const plan = planWithCheaperOptions();
    const swaps = enforceBudgetBySwaps(plan, { dailyBudgetCap: { amount: 50, currency: "EUR" } });
    expect(swaps).toBeGreaterThan(0);
    const report = validatePlanQuality(plan, { dailyBudgetCap: { amount: 50, currency: "EUR" } });
    expect(report.issues.some((i) => i.rule === "budget-cap")).toBe(false);
  });

  it("swaps as few blocks as possible (largest savings first)", () => {
    const plan = planWithCheaperOptions();
    // cap 150: only €10 over — one €15 saving swap should be enough
    const swaps = enforceBudgetBySwaps(plan, { dailyBudgetCap: { amount: 150, currency: "EUR" } });
    expect(swaps).toBe(1);
  });

  it("does nothing when already within budget", () => {
    const plan = planWithCheaperOptions();
    expect(enforceBudgetBySwaps(plan, { dailyBudgetCap: { amount: 200, currency: "EUR" } })).toBe(0);
  });

  it("gives up gracefully when no cheaper options exist", () => {
    const plan = goodPlan(1); // all options €20 — nothing cheaper to swap to
    const swaps = enforceBudgetBySwaps(plan, { dailyBudgetCap: { amount: 50, currency: "EUR" } });
    expect(swaps).toBe(0);
  });

  it("no-ops without a cap", () => {
    expect(enforceBudgetBySwaps(planWithCheaperOptions(), {})).toBe(0);
  });
});

describe("formatQualityReport", () => {
  it("summarises issues compactly", () => {
    const plan = goodPlan(1);
    plan.days[0]!.blocks[0]!.selectedOptionId = "nope";
    const text = formatQualityReport(validatePlanQuality(plan));
    expect(text).toContain("selected-option-valid");
    expect(text).toContain("error");
  });

  it("reports a clean bill of health", () => {
    expect(formatQualityReport(validatePlanQuality(goodPlan()))).toContain("passed");
  });
});
