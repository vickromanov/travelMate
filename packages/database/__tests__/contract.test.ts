/**
 * Database contract test: the freshness score is the heart of the re-fetch
 * decision (projectStructure.md §5), so it is unit-tested even in the skeleton.
 */
import { describe, it, expect } from "vitest";
import { freshnessScore } from "../src/freshness.js";

describe("contract: freshnessScore", () => {
  it("is 1 right after fetch and 0 once past maxAge", () => {
    const now = new Date().toISOString();
    expect(freshnessScore(now, 3600)).toBeCloseTo(1, 1);
    const old = new Date(Date.now() - 7200_000).toISOString();
    expect(freshnessScore(old, 3600)).toBe(0);
  });
});
