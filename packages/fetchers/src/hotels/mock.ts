/** Deterministic, zero-network mock for the hotels fetcher (projectStructure.md §8). */
import type { FetchRequest, NormalizedResult } from "@travelmate/contracts";
import { normalize } from "../normalizer.js";
import { affiliationFor } from "../affiliation.js";

export async function mockHotels(_req: FetchRequest): Promise<NormalizedResult> {
  // Skeleton: empty (valid) result. Per-tier tests add real fixtures here.
  return normalize("hotels", "mock", [], affiliationFor("hotels", "mock"));
}
