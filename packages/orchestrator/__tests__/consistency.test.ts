/**
 * Cross-field consistency: a priced/gated option can never read "walk-in";
 * transport directions links carry the mode the title implies.
 */
import { describe, it, expect } from "vitest";
import type { TripPlan, DayPlan, ItineraryBlock, TravelOption } from "@travelmate/contracts";
import { enforceConsistency, isFreeWalkIn } from "../src/consistency.js";

let seq = 0;
function opt(overrides: Partial<TravelOption> = {}): TravelOption {
  seq++;
  return {
    id: `o${seq}`, tier: "ANCHOR", title: `Venue ${seq}`,
    description: "d", reasoning: "r",
    price: { amount: 0, currency: "EUR" },
    location: { lat: 47.4, lng: 11.0, address: "Garmisch" },
    ...overrides,
  };
}

function block(category: ItineraryBlock["category"], options: TravelOption[]): ItineraryBlock {
  return {
    blockId: "b1", category, scheduledTime: "10:00",
    selectedOptionId: options[0]!.id, dependencyLogic: "none", options,
  };
}

function planWith(block: ItineraryBlock): TripPlan {
  const day: DayPlan = { dayNumber: 1, date: "2026-07-10", title: "t", theme: "", dailyTips: [], blocks: [block] };
  return {
    planId: "p", title: "t", description: "",
    totalEstimatedCost: { amount: 0, currency: "EUR" },
    duration: "1 Days", days: [day], inferenceChain: [],
  };
}

describe("isFreeWalkIn", () => {
  it("true for a genuinely free option", () => {
    expect(isFreeWalkIn(opt({ price: { amount: 0, currency: "EUR" }, description: "Free public promenade" }))).toBe(true);
  });
  it("false when priced", () => {
    expect(isFreeWalkIn(opt({ price: { amount: 100, currency: "EUR" } }))).toBe(false);
  });
  it("false when gated by paid transport even if price is 0", () => {
    expect(isFreeWalkIn(opt({ price: { amount: 0, currency: "EUR" }, accessNotes: "Includes round-trip cable car" }))).toBe(false);
  });
  it("false when bookingRequired", () => {
    expect(isFreeWalkIn(opt({ bookingRequired: true }))).toBe(false);
  });
});

describe("enforceConsistency — booking derivation", () => {
  it("makes a priced activity bookable (the EUR 180 combo bug)", () => {
    const o = opt({ title: "Cogwheel Train & Cable Car Combo", price: { amount: 180, currency: "EUR" }, accessNotes: "Access included in the combined ticket." });
    const plan = planWith(block("ACTIVITIES", [o]));
    const report = enforceConsistency(plan);
    expect(report.fixed).toBeGreaterThan(0);
    expect(o.bookingRequired).toBe(true);
    expect(o.bookingUrl).toContain("getyourguide.com/s/?q=");
    expect(isFreeWalkIn(o)).toBe(false);
  });

  it("makes a free-but-gated summit walk bookable (the AlpspiX bug)", () => {
    const o = opt({ title: "AlpspiX Viewing Platform", price: { amount: 0, currency: "EUR" }, accessNotes: "Includes round-trip cable car to Osterfelderkopf." });
    const plan = planWith(block("ACTIVITIES", [o]));
    enforceConsistency(plan);
    expect(o.bookingRequired).toBe(true);
    expect(o.bookingUrl).toBeTruthy();
    expect(isFreeWalkIn(o)).toBe(false);
  });

  it("leaves a genuinely free walk-in activity untouched", () => {
    const o = opt({ title: "Marienplatz Stroll", price: { amount: 0, currency: "EUR" }, description: "Free public square, walk in any time." });
    const plan = planWith(block("ACTIVITIES", [o]));
    enforceConsistency(plan);
    expect(o.bookingRequired).toBeUndefined();
    expect(o.bookingUrl).toBeUndefined();
    expect(isFreeWalkIn(o)).toBe(true);
  });

  it("does NOT force walk-in restaurants to require booking", () => {
    const o = opt({ title: "Café Frischhut", price: { amount: 8, currency: "EUR" }, description: "Cozy café, walk in for a Schmalznudel." });
    const plan = planWith(block("DINING", [o]));
    enforceConsistency(plan);
    expect(o.bookingRequired).toBeUndefined();
  });

  it("gives a STAYS option a booking link", () => {
    const o = opt({ title: "Hotel Alpina", price: { amount: 120, currency: "EUR" } });
    const plan = planWith(block("STAYS", [o]));
    enforceConsistency(plan);
    expect(o.bookingRequired).toBe(true);
    expect(o.bookingUrl).toContain("booking.com/searchresults");
  });
});

describe("enforceConsistency — transport link mode", () => {
  function dirLink(mode: string) {
    return `https://www.google.com/maps/dir/?api=1&origin=Garmisch&destination=Alpspitzbahn&travelmode=${mode}`;
  }

  it("fixes a Drive option whose link says transit (the B23 bug)", () => {
    const o = opt({ title: "Drive via B23", description: "20-minute drive from Garmisch", link: dirLink("transit"), linkType: "DIRECTIONS" });
    const plan = planWith(block("TRANSPORT", [o]));
    const report = enforceConsistency(plan);
    expect(report.fixed).toBeGreaterThan(0);
    expect(o.link).toContain("travelmode=driving");
  });

  it("sets walking mode for a walk option", () => {
    const o = opt({ title: "Walk to the Eibsee", description: "Pleasant 15-minute walk", link: dirLink("driving"), linkType: "DIRECTIONS" });
    const plan = planWith(block("TRANSPORT", [o]));
    enforceConsistency(plan);
    expect(o.link).toContain("travelmode=walking");
  });

  it("keeps transit for a train option (stamps departure_time only)", () => {
    const o = opt({ title: "Regional Train (BRB)", description: "Direct train", link: dirLink("transit"), linkType: "DIRECTIONS" });
    const plan = planWith(block("TRANSPORT", [o]));
    const report = enforceConsistency(plan);
    expect(report.fixed).toBe(1); // departure_time stamped, mode unchanged
    expect(o.link).toContain("travelmode=transit");
    expect(o.link).toContain("departure_time=");
    // departure_time must land on the same weekday as the day's date
    const epoch = parseInt(o.link!.match(/departure_time=(\d+)/)![1]!, 10);
    const proxyDow = new Date(epoch * 1000).getUTCDay();
    const tripDow = new Date("2026-07-10T00:00:00Z").getUTCDay();
    expect(proxyDow).toBe(tripDow);
  });

  it("does not touch a directions link missing its endpoints", () => {
    const o = opt({ title: "Drive somewhere", link: "https://www.google.com/maps/dir/?api=1&travelmode=transit" });
    const plan = planWith(block("TRANSPORT", [o]));
    enforceConsistency(plan);
    expect(o.link).toContain("travelmode=transit"); // untouched — endpoints owned elsewhere
  });
});
