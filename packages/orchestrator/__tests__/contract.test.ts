/**
 * Orchestrator contract test (skeleton): stubs throw NotImplemented until
 * implemented. This file is where, post-implementation, we assert the pipeline
 * consumes CrucialInfo and produces a schema-valid TripPlan using fetcher mocks
 * + the mock LLM + an in-memory DB (zero network/cost — projectStructure.md §8).
 */
import { describe, it, expect } from "vitest";
import { orchestrate } from "../src/index.js";

describe("contract: orchestrator entrypoint", () => {
  it("exposes orchestrate() (unimplemented in skeleton)", async () => {
    await expect(
      orchestrate(
        {
          destination: "x",
          travelerDescription: "y",
          tripType: "z",
          budgetTier: "SMART",
        },
        {} as never,
        { onThought: () => {}, onError: () => {} },
      ),
    ).rejects.toThrow(/Not implemented/);
  });
});
