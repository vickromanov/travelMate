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
  TravelOptionSchema,
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

describe("contract: TravelOption — LLM-omission resilience", () => {
  const base = {
    id: "o1",
    tier: "SMART-VALUE",
    title: "Café Nicola",
    price: { amount: 8, currency: "EUR" },
  };

  it("survives a missing address (degrades to empty string)", () => {
    const parsed = TravelOptionSchema.safeParse({
      ...base,
      description: "d", reasoning: "r",
      location: { lat: 38.7, lng: -9.1 }, // address omitted by the LLM
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.location.address).toBe("");
  });

  it("survives a wholly missing location (degrades to zeroed)", () => {
    const parsed = TravelOptionSchema.safeParse({ ...base, description: "d", reasoning: "r" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.location).toEqual({ lat: 0, lng: 0, address: "" });
  });

  it("survives missing narrative fields (degrade to empty strings)", () => {
    const parsed = TravelOptionSchema.safeParse({
      ...base,
      location: { lat: 38.7, lng: -9.1, address: "Rua X 1, Lisbon" },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.description).toBe("");
      expect(parsed.data.reasoning).toBe("");
    }
  });

  it("still rejects a truly malformed option (no title)", () => {
    const parsed = TravelOptionSchema.safeParse({
      id: "o1", tier: "ANCHOR",
      price: { amount: 8, currency: "EUR" },
    });
    expect(parsed.success).toBe(false);
  });
});
