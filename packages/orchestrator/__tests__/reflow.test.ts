/**
 * Re-flow engine (H4): swapping one card must update every dependent card —
 * hotel continuity across days, name references, and attached transport legs —
 * and nothing else. Mock LLM + mock DB, zero network (all fixture links are
 * Maps links, which the verifier never probes).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TripPlan, DayPlan, ItineraryBlock, TravelOption } from "@travelmate/contracts";
import type { Database } from "@travelmate/database";
import type { LLMClient } from "@travelmate/llm";
import { reflow, deriveDependents } from "../src/reflow.js";

/* ── Fixtures ─────────────────────────────────────────────────────────────── */

let seq = 0;
function opt(tier: TravelOption["tier"], title: string, extras: Partial<TravelOption> = {}): TravelOption {
  seq++;
  return {
    id: `o${seq}`, tier, title,
    description: `${title} description`,
    reasoning: "fits",
    price: { amount: 20, currency: "EUR" },
    location: { lat: 48.13, lng: 11.57, address: "Munich" },
    link: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(title)}+Munich`,
    ...extras,
  };
}

function block(blockId: string, category: ItineraryBlock["category"], time: string, titles: [string, string, string, string], extras: Partial<ItineraryBlock> = {}): ItineraryBlock {
  const options = [
    opt("ANCHOR", titles[0]),
    opt("SMART-VALUE", titles[1]),
    opt("PREMIUM", titles[2]),
    opt("INDEPENDENT", titles[3]),
  ];
  return {
    blockId, category, scheduledTime: time,
    selectedOptionId: options[0]!.id,
    dependencyLogic: "none",
    options,
    ...extras,
  };
}

function fixturePlan(): TripPlan {
  const day1: DayPlan = {
    dayNumber: 1, date: "2026-09-19", title: "Day 1", theme: "", dailyTips: [],
    blocks: [
      block("d1_b1", "STAYS", "07:00", ["Hotel Platzl", "Hotel Cocoon", "Hotel MIO", "Laimer Hof"]),
      block("d1_b2", "DINING", "08:00", ["Breakfast at Hotel Platzl", "Café Frischhut", "Dallmayr", "Café Jasmin"]),
      block("d1_b3", "TRANSPORT", "09:15", ["U-Bahn to Residenz", "Tram to Residenz", "Taxi to Residenz", "Walk to Residenz"], {
        options: undefined as never, // replaced below
      }),
      block("d1_b4", "ACTIVITIES", "10:00", ["Residenz Museum", "Deutsches Museum", "Private tour", "Eisbach Wave"]),
      block("d1_b5", "TRANSPORT", "17:00", ["Return to Hotel Platzl", "Tram back to Hotel Platzl", "Taxi to Hotel Platzl", "Walk to Hotel Platzl"]),
      block("d1_b6", "DINING", "19:30", ["Wirtshaus in der Au", "Augustiner", "Tantris", "Fraunhofer"]),
    ],
  };
  // d1_b3 needs proper directions links with a travelmode to test rebuild
  day1.blocks[2] = block("d1_b3", "TRANSPORT", "09:15", ["U-Bahn to Residenz", "Tram to Residenz", "Taxi to Residenz", "Walk to Residenz"]);
  for (const o of day1.blocks[2]!.options) {
    o.link = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent("Breakfast at Hotel Platzl")}&destination=${encodeURIComponent("Residenz Museum")}&travelmode=transit`;
  }

  const day2: DayPlan = {
    dayNumber: 2, date: "2026-09-20", title: "Day 2", theme: "", dailyTips: [],
    blocks: [
      block("d2_b1", "STAYS", "07:00", ["Hotel Platzl", "Hotel Cocoon", "Hotel MIO", "Laimer Hof"]),
      block("d2_b2", "DINING", "08:00", ["Breakfast at Hotel Platzl", "Café Frischhut", "Dallmayr", "Café Jasmin"]),
      block("d2_b3", "ACTIVITIES", "10:00", ["English Garden", "Olympiapark", "BMW World", "Flaucher"]),
    ],
  };

  return {
    planId: "plan-1", title: "Munich Trip", description: "",
    totalEstimatedCost: { amount: 1000, currency: "EUR" },
    duration: "2 Days", days: [day1, day2], inferenceChain: [],
  };
}

function mockDb(plan: TripPlan) {
  const saved: TripPlan[] = [];
  const notify = vi.fn();
  const db = {
    plans: {
      getPlan: async (id: string) => (id === plan.planId ? plan : null),
      savePlan: async (p: TripPlan) => { saved.push(p); },
    },
    observer: { notify, subscribeToPlan: () => () => {} },
  } as unknown as Database;
  return { db, saved, notify };
}

const llmFail = { run: async () => { throw new Error("LLM down"); } } as unknown as LLMClient;

function llmReturning(blocks: ItineraryBlock[]): LLMClient {
  return {
    run: async (_req: unknown, validate?: (t: string) => boolean) => {
      const text = JSON.stringify({ blocks });
      if (validate && !validate(text)) throw new Error("mock validation failed");
      return { text, tierUsed: "fast", modelId: "mock", usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 }, fromCache: false };
    },
  } as unknown as LLMClient;
}

beforeEach(() => { seq = 0; });

/* ── deriveDependents ─────────────────────────────────────────────────────── */

describe("deriveDependents", () => {
  it("finds hotel continuity, references and attached transports for a STAYS swap", () => {
    const plan = fixturePlan();
    const deps = deriveDependents(plan, "d1_b1", "Hotel Platzl");
    // day 2 slept in the same hotel
    expect(deps.staysToFollow.map((s) => s.block.blockId)).toEqual(["d2_b1"]);
    // breakfast cards + return transport mention the hotel by name
    const refIds = new Set(deps.references.map((r) => r.block.blockId));
    expect(refIds.has("d1_b2")).toBe(true);
    expect(refIds.has("d1_b5")).toBe(true);
    expect(refIds.has("d2_b2")).toBe(true);
    // b1 is followed by DINING, not TRANSPORT — no positionally attached leg
    expect(deps.transports).toEqual([]);
  });

  it("finds the attached transport legs for an ACTIVITY swap", () => {
    const plan = fixturePlan();
    const deps = deriveDependents(plan, "d1_b4", "Residenz Museum");
    const ids = deps.transports.map((t) => t.block.blockId).sort();
    expect(ids).toEqual(["d1_b3", "d1_b5"]);
    // endpoints: b3 arrives AT the activity, b5 departs FROM it
    const b3 = deps.transports.find((t) => t.block.blockId === "d1_b3")!;
    expect(b3.to).toBe("Residenz Museum");
    expect(b3.from).toBe("Breakfast at Hotel Platzl");
    const b5 = deps.transports.find((t) => t.block.blockId === "d1_b5")!;
    expect(b5.from).toBe("Residenz Museum");
    expect(b5.to).toBe("Wirtshaus in der Au");
  });
});

/* ── reflow ───────────────────────────────────────────────────────────────── */

describe("reflow — hotel swap (cross-day continuity)", () => {
  it("propagates the new hotel to other nights and patches every reference", async () => {
    const plan = fixturePlan();
    const { db, saved, notify } = mockDb(plan);
    const stays = plan.days[0]!.blocks[0]!;
    const cocoon = stays.options.find((o) => o.title === "Hotel Cocoon")!;

    const result = await reflow(
      { planId: "plan-1", blockId: "d1_b1", newOptionId: cocoon.id },
      db, llmFail,
    );

    // day 2 follows the new hotel
    const d2Stays = result.plan.days[1]!.blocks[0]!;
    const d2Selected = d2Stays.options.find((o) => o.id === d2Stays.selectedOptionId)!;
    expect(d2Selected.title).toBe("Hotel Cocoon");

    // name references patched on BOTH days
    const d1Breakfast = result.plan.days[0]!.blocks[1]!;
    expect(d1Breakfast.options[0]!.title).toBe("Breakfast at Hotel Cocoon");
    const d1Return = result.plan.days[0]!.blocks.find((b) => b.blockId === "d1_b5")!;
    expect(d1Return.options[0]!.title).toContain("Hotel Cocoon");
    const d2Breakfast = result.plan.days[1]!.blocks[1]!;
    expect(d2Breakfast.options[0]!.title).toBe("Breakfast at Hotel Cocoon");

    // changed set covers the dependents, plan persisted + observer notified
    expect(result.changedBlockIds).toEqual(expect.arrayContaining(["d1_b1", "d1_b2", "d1_b5", "d2_b1", "d2_b2"]));
    expect(saved.length).toBe(1);
    expect(notify).toHaveBeenCalledOnce();
  });
});

describe("reflow — activity swap (attached transports)", () => {
  it("re-resolves attached transport legs via the LLM", async () => {
    const plan = fixturePlan();
    const { db } = mockDb(plan);
    const activity = plan.days[0]!.blocks[3]!;
    const newOpt = activity.options.find((o) => o.title === "Deutsches Museum")!;

    // The mock LLM returns re-resolved copies of both legs
    const freshB3 = { ...plan.days[0]!.blocks[2]!, label: "S-Bahn to Deutsches Museum" };
    const freshB5 = { ...plan.days[0]!.blocks[4]!, label: "Tram from Deutsches Museum" };
    const result = await reflow(
      { planId: "plan-1", blockId: "d1_b4", newOptionId: newOpt.id },
      db, llmReturning([freshB3, freshB5]),
    );

    expect(result.plan.days[0]!.blocks[2]!.label).toBe("S-Bahn to Deutsches Museum");
    expect(result.plan.days[0]!.blocks[4]!.label).toBe("Tram from Deutsches Museum");
    expect(result.changedBlockIds).toEqual(expect.arrayContaining(["d1_b4", "d1_b3", "d1_b5"]));
  });

  it("falls back deterministically when the LLM fails: names patched, directions rebuilt", async () => {
    const plan = fixturePlan();
    const { db } = mockDb(plan);
    const activity = plan.days[0]!.blocks[3]!;
    const newOpt = activity.options.find((o) => o.title === "Deutsches Museum")!;

    const result = await reflow(
      { planId: "plan-1", blockId: "d1_b4", newOptionId: newOpt.id },
      db, llmFail,
    );

    const b3 = result.plan.days[0]!.blocks[2]!;
    const link = b3.options[0]!.link!;
    expect(link).toContain("destination=Deutsches%20Museum");
    expect(link).toContain("travelmode=transit"); // old mode preserved
    expect(b3.options[0]!.linkType).toBe("DIRECTIONS");
    // untouched blocks stay untouched
    expect(result.changedBlockIds).not.toContain("d1_b6");
  });
});

describe("reflow — edges", () => {
  it("same-venue swap (different tier, same title) touches nothing else", async () => {
    const plan = fixturePlan();
    // give the PREMIUM option the same title as the anchor
    const stays = plan.days[0]!.blocks[0]!;
    stays.options[2]!.title = "Hotel Platzl";
    const { db } = mockDb(plan);

    const result = await reflow(
      { planId: "plan-1", blockId: "d1_b1", newOptionId: stays.options[2]!.id },
      db, llmFail,
    );
    expect(result.changedBlockIds).toEqual(["d1_b1"]);
  });

  it("throws for an unknown plan / block / option", async () => {
    const plan = fixturePlan();
    const { db } = mockDb(plan);
    await expect(reflow({ planId: "nope", blockId: "d1_b1", newOptionId: "o1" }, db, llmFail)).rejects.toThrow(/not found/i);
    await expect(reflow({ planId: "plan-1", blockId: "nope", newOptionId: "o1" }, db, llmFail)).rejects.toThrow(/not found/i);
    await expect(reflow({ planId: "plan-1", blockId: "d1_b1", newOptionId: "nope" }, db, llmFail)).rejects.toThrow(/not found/i);
  });
});
