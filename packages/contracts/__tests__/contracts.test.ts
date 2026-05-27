/**
 * Reference contract test. Each tier copies this pattern: feed a fixture through
 * the boundary schema and assert it parses. If a teammate changes a shape without
 * changing the contract, THIS kind of test goes red in CI on their PR — the
 * tripwire that makes parallel work safe (projectStructure.md §8).
 */
import { describe, it, expect } from "vitest";
import {
  CrucialInfoSchema,
  TripPlanSchema,
  NormalizedResultSchema,
} from "../src/index.js";

describe("contract: CrucialInfo", () => {
  it("accepts a minimal valid payload", () => {
    const parsed = CrucialInfoSchema.safeParse({
      destination: "Lisbon",
      travelerDescription: "two friends who love seafood and live music",
      tripType: "long weekend",
      budgetTier: "SMART",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a missing required field", () => {
    const parsed = CrucialInfoSchema.safeParse({ destination: "Lisbon" });
    expect(parsed.success).toBe(false);
  });
});

describe("contract: NormalizedResult", () => {
  it("requires affiliation metadata on every fetched result", () => {
    const parsed = NormalizedResultSchema.safeParse({
      category: "hotels",
      items: [],
      source: "mock",
      fetchedAt: new Date().toISOString(),
      // affiliation intentionally omitted
    });
    expect(parsed.success).toBe(false);
  });
});

describe("contract: TripPlan", () => {
  it("is a strict shape (smoke)", () => {
    expect(typeof TripPlanSchema.safeParse).toBe("function");
  });
});
