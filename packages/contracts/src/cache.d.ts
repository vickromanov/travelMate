/**
 * Database ↔ Orchestrator boundary. Freshness model — projectStructure.md §5.
 */
import { z } from "zod";
/** Per-category staleness policy. One DEBUG knob during dev (see §5). */
export declare const FreshnessPolicySchema: z.ZodObject<{
    category: z.ZodEnum<["flights", "hotels", "dining", "activities", "events", "weather", "places"]>;
    /** Seconds after which the entry starts going stale. */
    maxAgeSeconds: z.ZodNumber;
    /** Extra window where stale data is served while refreshing in the background. */
    staleWhileRevalidateSeconds: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    category: "flights" | "hotels" | "dining" | "activities" | "events" | "weather" | "places";
    maxAgeSeconds: number;
    staleWhileRevalidateSeconds: number;
}, {
    category: "flights" | "hotels" | "dining" | "activities" | "events" | "weather" | "places";
    maxAgeSeconds: number;
    staleWhileRevalidateSeconds: number;
}>;
export type FreshnessPolicy = z.infer<typeof FreshnessPolicySchema>;
export declare const CacheEntrySchema: z.ZodObject<{
    key: z.ZodString;
    category: z.ZodEnum<["flights", "hotels", "dining", "activities", "events", "weather", "places"]>;
    value: z.ZodUnknown;
    fetchedAt: z.ZodString;
    /** Computed on read: 1 = just fetched, 0 = fully stale. */
    freshnessScore: z.ZodNumber;
    policy: z.ZodObject<{
        category: z.ZodEnum<["flights", "hotels", "dining", "activities", "events", "weather", "places"]>;
        /** Seconds after which the entry starts going stale. */
        maxAgeSeconds: z.ZodNumber;
        /** Extra window where stale data is served while refreshing in the background. */
        staleWhileRevalidateSeconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        category: "flights" | "hotels" | "dining" | "activities" | "events" | "weather" | "places";
        maxAgeSeconds: number;
        staleWhileRevalidateSeconds: number;
    }, {
        category: "flights" | "hotels" | "dining" | "activities" | "events" | "weather" | "places";
        maxAgeSeconds: number;
        staleWhileRevalidateSeconds: number;
    }>;
}, "strip", z.ZodTypeAny, {
    category: "flights" | "hotels" | "dining" | "activities" | "events" | "weather" | "places";
    fetchedAt: string;
    key: string;
    freshnessScore: number;
    policy: {
        category: "flights" | "hotels" | "dining" | "activities" | "events" | "weather" | "places";
        maxAgeSeconds: number;
        staleWhileRevalidateSeconds: number;
    };
    value?: unknown;
}, {
    category: "flights" | "hotels" | "dining" | "activities" | "events" | "weather" | "places";
    fetchedAt: string;
    key: string;
    freshnessScore: number;
    policy: {
        category: "flights" | "hotels" | "dining" | "activities" | "events" | "weather" | "places";
        maxAgeSeconds: number;
        staleWhileRevalidateSeconds: number;
    };
    value?: unknown;
}>;
export type CacheEntry = z.infer<typeof CacheEntrySchema>;
//# sourceMappingURL=cache.d.ts.map