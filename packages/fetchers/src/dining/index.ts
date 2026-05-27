/** dining fetcher — picks mock | scraper | api by FETCHER_MODE. Same interface for all. */
import type { FetchRequest, NormalizedResult } from "@travelmate/contracts";
import type { Fetcher } from "../index.js";
import { mockDining } from "./mock.js";
import { scrapeDining } from "./scraper.js";

const MODE = process.env.FETCHER_MODE ?? "mock";

export const diningFetcher: Fetcher = {
  category: "dining",
  async fetch(req: FetchRequest): Promise<NormalizedResult> {
    if (MODE === "scraper") return scrapeDining(req);
    // MODE === "api" → Phase-2 provider slots in here behind this same interface.
    return mockDining(req);
  },
};
