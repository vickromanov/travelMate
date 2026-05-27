/** Deterministic, zero-network mock for the activities fetcher (projectStructure.md §8). */
import type { FetchRequest, NormalizedResult } from "@travelmate/contracts";
import { normalize } from "../normalizer.js";
import { affiliationFor } from "../affiliation.js";

export async function mockActivities(_req: FetchRequest): Promise<NormalizedResult> {
  // Skeleton: empty (valid) result. Per-tier tests add real fixtures here.
  return normalize("activities", "mock", [], affiliationFor("activities", "mock"));
}
