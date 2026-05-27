/** activities fetcher — picks mock | scraper | api by FETCHER_MODE. Same interface for all. */
import type { FetchRequest, NormalizedResult } from "@travelmate/contracts";
import type { Fetcher } from "../index.js";
import { mockActivities } from "./mock.js";
import { scrapeActivities } from "./scraper.js";

const MODE = process.env.FETCHER_MODE ?? "mock";

export const activitiesFetcher: Fetcher = {
  category: "activities",
  async fetch(req: FetchRequest): Promise<NormalizedResult> {
    if (MODE === "scraper") return scrapeActivities(req);
    // MODE === "api" → Phase-2 provider slots in here behind this same interface.
    return mockActivities(req);
  },
};
