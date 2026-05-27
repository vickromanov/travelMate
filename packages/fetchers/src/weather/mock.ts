/** Deterministic, zero-network mock for the weather fetcher (projectStructure.md §8). */
import type { FetchRequest, NormalizedResult } from "@travelmate/contracts";
import { normalize } from "../normalizer.js";
import { affiliationFor } from "../affiliation.js";

export async function mockWeather(_req: FetchRequest): Promise<NormalizedResult> {
  // Skeleton: empty (valid) result. Per-tier tests add real fixtures here.
  return normalize("weather", "mock", [], affiliationFor("weather", "mock"));
}
