/** Deterministic, zero-network mock for the flights fetcher (projectStructure.md §8). */
import type { FetchRequest, NormalizedResult } from "@travelmate/contracts";
import { normalize } from "../normalizer.js";
import { affiliationFor } from "../affiliation.js";

export async function mockFlights(_req: FetchRequest): Promise<NormalizedResult> {
  // Skeleton: empty (valid) result. Per-tier tests add real fixtures here.
  return normalize("flights", "mock", [], affiliationFor("flights", "mock"));
}
