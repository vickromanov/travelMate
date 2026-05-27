/** hotels fetcher — picks mock | scraper | api by FETCHER_MODE. Same interface for all. */
import type { FetchRequest, NormalizedResult } from "@travelmate/contracts";
import type { Fetcher } from "../index.js";
import { mockHotels } from "./mock.js";
import { scrapeHotels } from "./scraper.js";

const MODE = process.env.FETCHER_MODE ?? "mock";

export const hotelsFetcher: Fetcher = {
  category: "hotels",
  async fetch(req: FetchRequest): Promise<NormalizedResult> {
    if (MODE === "scraper") return scrapeHotels(req);
    // MODE === "api" → Phase-2 provider slots in here behind this same interface.
    return mockHotels(req);
  },
};
