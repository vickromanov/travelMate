/**
 * Unit tests for synthesis helpers — currently the inclusive date math.
 * Regression: "03.07 to 05.07" must be a 3-day trip (arrival + full + departure),
 * not end-minus-start = 2.
 */
import { describe, it, expect } from "vitest";
import type { TripBrief } from "@travelmate/contracts";
import { computeNumDays } from "../src/synthesis.js";

function brief(overrides: Partial<TripBrief["facts"]> = {}, chain: TripBrief["inferenceChain"] = []): TripBrief {
  return {
    facts: {
      destination: "Marianske Lazne",
      travelerDescription: "family of 4",
      tripType: "family",
      budgetTier: "SMART",
      ...overrides,
    },
    travelerProfile: "A family with two kids.",
    inferenceChain: chain,
    neededCategories: ["hotels"],
  };
}

describe("computeNumDays — inclusive date range", () => {
  it("counts 03.07→05.07 as 3 days", () => {
    const { numDays, start } = computeNumDays(brief({ startDate: "2026-07-03", endDate: "2026-07-05" }));
    expect(numDays).toBe(3);
    expect(start).toBe("2026-07-03");
  });

  it("counts a same-day trip as 1 day", () => {
    expect(computeNumDays(brief({ startDate: "2026-07-03", endDate: "2026-07-03" })).numDays).toBe(1);
  });

  it("counts a whole week Sat→Fri as 7 days", () => {
    expect(computeNumDays(brief({ startDate: "2026-09-19", endDate: "2026-09-25" })).numDays).toBe(7);
  });

  it("falls back to the inference chain when endDate is missing", () => {
    const b = brief({ startDate: "2026-07-03" }, [
      { field: "duration", assumed: "a week", reason: "user said week" },
    ]);
    expect(computeNumDays(b).numDays).toBe(7);
  });

  it("defaults to 3 days with no signals at all", () => {
    expect(computeNumDays(brief({ startDate: "2026-07-03" })).numDays).toBe(3);
  });
});
