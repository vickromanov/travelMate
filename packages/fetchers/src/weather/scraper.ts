/**
 * Phase-1 Playwright scraper for weather. Logged-out, public data only,
 * robots.txt + ToS respected, rate-limited, results cached hard
 * (projectStructure.md §6 + Sources). Skeleton stub.
 */
import { NotImplemented } from "@travelmate/contracts";
import type { FetchRequest, NormalizedResult } from "@travelmate/contracts";

export async function scrapeWeather(_req: FetchRequest): Promise<NormalizedResult> {
  throw new NotImplemented("fetchers/weather/scraper");
}
