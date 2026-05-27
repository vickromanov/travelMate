/**
 * The freshness model (projectStructure.md §5). One DEBUG knob during dev; the
 * per-category production policies are switched on deliberately (cost/latency),
 * never silently — that switch gets an ADR.
 */
import type { Category, FreshnessPolicy } from "@travelmate/contracts";

/** Single development knob — ALL categories use this until prod policies are enabled. */
export const DEBUG_FRESHNESS_HOURS = Number(
  process.env.DEBUG_FRESHNESS_HOURS ?? 24,
);

/** Production policies (projectStructure.md §5 table). Not active until the ADR flips it. */
export const PROD_POLICIES: Record<Category, FreshnessPolicy> = {
  flights: { category: "flights", maxAgeSeconds: 1800, staleWhileRevalidateSeconds: 3600 },
  hotels: { category: "hotels", maxAgeSeconds: 7200, staleWhileRevalidateSeconds: 7200 },
  dining: { category: "dining", maxAgeSeconds: 604800, staleWhileRevalidateSeconds: 604800 },
  activities: { category: "activities", maxAgeSeconds: 604800, staleWhileRevalidateSeconds: 604800 },
  events: { category: "events", maxAgeSeconds: 86400, staleWhileRevalidateSeconds: 86400 },
  weather: { category: "weather", maxAgeSeconds: 10800, staleWhileRevalidateSeconds: 10800 },
  places: { category: "places", maxAgeSeconds: 2592000, staleWhileRevalidateSeconds: 2592000 },
};

/** 1 = just fetched, 0 = fully stale. Linear within maxAge for the skeleton. */
export function freshnessScore(fetchedAtIso: string, maxAgeSeconds: number): number {
  const ageSec = (Date.now() - new Date(fetchedAtIso).getTime()) / 1000;
  if (ageSec <= 0) return 1;
  if (ageSec >= maxAgeSeconds) return 0;
  return 1 - ageSec / maxAgeSeconds;
}
