/**
 * @travelmate/fetchers — one fetcher per category, all behind ONE interface so
 * the Orchestrator cannot tell scraping from an API (projectStructure.md §6, P7).
 */
import type {
  Category,
  FetchRequest,
  NormalizedResult,
} from "@travelmate/contracts";

import { flightsFetcher } from "./flights/index.js";
import { hotelsFetcher } from "./hotels/index.js";
import { diningFetcher } from "./dining/index.js";
import { activitiesFetcher } from "./activities/index.js";
import { eventsFetcher } from "./events/index.js";
import { weatherFetcher } from "./weather/index.js";
import { placesFetcher } from "./places/index.js";

export interface Fetcher {
  category: Category;
  /** Throws ContractError on failure; never returns a partial unnormalised shape. */
  fetch(req: FetchRequest): Promise<NormalizedResult>;
}

/** The registry. The env (FETCHER_MODE) decides mock|scraper|api inside each fetcher. */
export const fetchers: Record<Category, Fetcher> = {
  flights: flightsFetcher,
  hotels: hotelsFetcher,
  dining: diningFetcher,
  activities: activitiesFetcher,
  events: eventsFetcher,
  weather: weatherFetcher,
  places: placesFetcher,
};

export function getFetcher(category: Category): Fetcher {
  return fetchers[category];
}

export * from "./normalizer.js";
export * from "./affiliation.js";
