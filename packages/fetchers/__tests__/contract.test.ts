/**
 * Fetchers contract test: every category's mock output must satisfy the shared
 * NormalizedResult schema. If a fetcher drifts, this goes red in CI (§8).
 */
import { describe, it, expect } from "vitest";
import { NormalizedResultSchema, type Category } from "@travelmate/contracts";
import { fetchers } from "../src/index.js";

const categories = Object.keys(fetchers) as Category[];

describe("contract: every fetcher returns a NormalizedResult", () => {
  it.each(categories)("%s mock output parses", async (category) => {
    const res = await fetchers[category].fetch({
      category,
      params: {},
      minFreshness: 0,
    });
    expect(NormalizedResultSchema.safeParse(res).success).toBe(true);
    expect(res.affiliation).toBeDefined();
  });
});
