/**
 * Orchestrator contract test (skeleton): stubs throw NotImplemented until
 * implemented. This file is where, post-implementation, we assert the pipeline
 * consumes CrucialInfo and produces a schema-valid TripPlan using fetcher mocks
 * + the mock LLM + an in-memory DB (zero network/cost — projectStructure.md §8).
 */
import { describe, it, expect, vi } from "vitest";
import { orchestrate } from "../src/index.js";

describe("contract: orchestrator entrypoint", () => {
  it("exposes orchestrate() and invokes onError callback on dependency failure", async () => {
    const onError = vi.fn();
    const onThought = vi.fn();

    await orchestrate(
      {
        destination: "x",
        travelerDescription: "y",
        tripType: "z",
        budgetTier: "SMART",
      },
      {} as never,
      { onThought, onError },
    );

    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });
});
