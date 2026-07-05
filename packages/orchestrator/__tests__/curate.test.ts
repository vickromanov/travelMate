/**
 * Unit tests for the curation stage — schema resilience and the candidate
 * block injected into the synthesis prompt.
 */
import { describe, it, expect } from "vitest";
import { CuratedItemSchema, formatResearchForPrompt, type CuratedResearch } from "../src/curate.js";

describe("CuratedItemSchema — LLM-omission resilience", () => {
  it("accepts a full item", () => {
    const parsed = CuratedItemSchema.safeParse({
      name: "Park Boheminium",
      why: "Miniature park the kids will love",
      area: "north of the colonnade",
      bestTime: "morning",
      priceHint: "~EUR 30 for the family",
      category: "outdoor",
      tierHint: "ANCHOR",
    });
    expect(parsed.success).toBe(true);
  });

  it("survives an item with only a name", () => {
    const parsed = CuratedItemSchema.safeParse({ name: "Singing Fountain" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.why).toBe("");
  });

  it("rejects a nameless item", () => {
    expect(CuratedItemSchema.safeParse({ why: "no name" }).success).toBe(false);
  });
});

describe("formatResearchForPrompt", () => {
  const research: CuratedResearch = {
    activities: [{ name: "Park Boheminium", why: "kids love it", area: undefined, bestTime: "morning", priceHint: undefined, category: undefined, tierHint: "ANCHOR" }],
    stays: [{ name: "Hotel OLYMPIA", why: "already booked by the traveler", area: undefined, bestTime: undefined, priceHint: undefined, category: "2× double room", tierHint: "ANCHOR" }],
    dining: [],
  };

  it("renders sections only for non-empty categories", () => {
    const block = formatResearchForPrompt(research);
    expect(block).toContain("ACCOMMODATION CANDIDATES");
    expect(block).toContain("ACTIVITY CANDIDATES");
    expect(block).not.toContain("DINING CANDIDATES");
    expect(block).toContain("Park Boheminium");
    expect(block).toContain("already booked by the traveler");
  });

  it("returns an empty string when there is nothing to inject", () => {
    expect(formatResearchForPrompt({ activities: [], stays: [], dining: [] })).toBe("");
  });
});
