/**
 * Database ↔ Orchestrator boundary. Freshness model — projectStructure.md §5.
 */
import { z } from "zod";
import { CategorySchema } from "./common.js";
/** Per-category staleness policy. One DEBUG knob during dev (see §5). */
export const FreshnessPolicySchema = z.object({
    category: CategorySchema,
    /** Seconds after which the entry starts going stale. */
    maxAgeSeconds: z.number().int().positive(),
    /** Extra window where stale data is served while refreshing in the background. */
    staleWhileRevalidateSeconds: z.number().int().nonnegative(),
});
export const CacheEntrySchema = z.object({
    key: z.string().min(1), // normalised query hash
    category: CategorySchema,
    value: z.unknown(),
    fetchedAt: z.string().datetime(),
    /** Computed on read: 1 = just fetched, 0 = fully stale. */
    freshnessScore: z.number().min(0).max(1),
    policy: FreshnessPolicySchema,
});
//# sourceMappingURL=cache.js.map