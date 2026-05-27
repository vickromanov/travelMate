/** flights fetcher — picks mock | scraper | api by FETCHER_MODE. Same interface for all. */
import type { FetchRequest, NormalizedResult } from "@travelmate/contracts";
import type { Fetcher } from "../index.js";
import { mockFlights } from "./mock.js";
import { scrapeFlights } from "./scraper.js";

const MODE = process.env.FETCHER_MODE ?? "mock";

export const flightsFetcher: Fetcher = {
  category: "flights",
  async fetch(req: FetchRequest): Promise<NormalizedResult> {
    if (MODE === "scraper") return scrapeFlights(req);
    // MODE === "api" → Phase-2 provider slots in here behind this same interface.
    return mockFlights(req);
  },
};
