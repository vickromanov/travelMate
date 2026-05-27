/** weather fetcher — picks mock | scraper | api by FETCHER_MODE. Same interface for all. */
import type { FetchRequest, NormalizedResult } from "@travelmate/contracts";
import type { Fetcher } from "../index.js";
import { mockWeather } from "./mock.js";
import { scrapeWeather } from "./scraper.js";

const MODE = process.env.FETCHER_MODE ?? "mock";

export const weatherFetcher: Fetcher = {
  category: "weather",
  async fetch(req: FetchRequest): Promise<NormalizedResult> {
    if (MODE === "scraper") return scrapeWeather(req);
    // MODE === "api" → Phase-2 provider slots in here behind this same interface.
    return mockWeather(req);
  },
};
