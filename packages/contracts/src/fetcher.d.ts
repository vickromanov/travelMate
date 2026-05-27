/**
 * Orchestrator ↔ Fetchers boundary. The Orchestrator cannot tell scraping from an
 * API — every source returns the same NormalizedResult. projectStructure.md §6.
 */
import { z } from "zod";
/** Revenue/attribution — rides on every fetched record from day one. */
export declare const AffiliationMetadataSchema: z.ZodObject<{
    trackingId: z.ZodString;
    referralSource: z.ZodString;
    campaignId: z.ZodString;
    conversionType: z.ZodEnum<["click", "lead", "booking", "impression"]>;
}, "strip", z.ZodTypeAny, {
    trackingId: string;
    referralSource: string;
    campaignId: string;
    conversionType: "click" | "lead" | "booking" | "impression";
}, {
    trackingId: string;
    referralSource: string;
    campaignId: string;
    conversionType: "click" | "lead" | "booking" | "impression";
}>;
export type AffiliationMetadata = z.infer<typeof AffiliationMetadataSchema>;
/** One category's fetch request. `params` is category-specific (validated per fetcher). */
export declare const FetchRequestSchema: z.ZodObject<{
    category: z.ZodEnum<["flights", "hotels", "dining", "activities", "events", "weather", "places"]>;
    params: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    /** Required freshness 0..1; below this the cached entry is refetched. */
    minFreshness: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    params: Record<string, unknown>;
    category: "flights" | "hotels" | "dining" | "activities" | "events" | "weather" | "places";
    minFreshness: number;
}, {
    params: Record<string, unknown>;
    category: "flights" | "hotels" | "dining" | "activities" | "events" | "weather" | "places";
    minFreshness?: number | undefined;
}>;
export type FetchRequest = z.infer<typeof FetchRequestSchema>;
/** What every fetcher returns, regardless of source. `items` shape is per-category. */
export declare const NormalizedResultSchema: z.ZodObject<{
    category: z.ZodEnum<["flights", "hotels", "dining", "activities", "events", "weather", "places"]>;
    items: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">;
    affiliation: z.ZodObject<{
        trackingId: z.ZodString;
        referralSource: z.ZodString;
        campaignId: z.ZodString;
        conversionType: z.ZodEnum<["click", "lead", "booking", "impression"]>;
    }, "strip", z.ZodTypeAny, {
        trackingId: string;
        referralSource: string;
        campaignId: string;
        conversionType: "click" | "lead" | "booking" | "impression";
    }, {
        trackingId: string;
        referralSource: string;
        campaignId: string;
        conversionType: "click" | "lead" | "booking" | "impression";
    }>;
    source: z.ZodEnum<["mock", "scraper", "api"]>;
    fetchedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    category: "flights" | "hotels" | "dining" | "activities" | "events" | "weather" | "places";
    items: Record<string, unknown>[];
    affiliation: {
        trackingId: string;
        referralSource: string;
        campaignId: string;
        conversionType: "click" | "lead" | "booking" | "impression";
    };
    source: "mock" | "scraper" | "api";
    fetchedAt: string;
}, {
    category: "flights" | "hotels" | "dining" | "activities" | "events" | "weather" | "places";
    items: Record<string, unknown>[];
    affiliation: {
        trackingId: string;
        referralSource: string;
        campaignId: string;
        conversionType: "click" | "lead" | "booking" | "impression";
    };
    source: "mock" | "scraper" | "api";
    fetchedAt: string;
}>;
export type NormalizedResult = z.infer<typeof NormalizedResultSchema>;
/** Fetch Planner output: which categories to fetch and how fresh they must be. */
export declare const FetchPlanSchema: z.ZodObject<{
    requests: z.ZodArray<z.ZodObject<{
        category: z.ZodEnum<["flights", "hotels", "dining", "activities", "events", "weather", "places"]>;
        params: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        /** Required freshness 0..1; below this the cached entry is refetched. */
        minFreshness: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        params: Record<string, unknown>;
        category: "flights" | "hotels" | "dining" | "activities" | "events" | "weather" | "places";
        minFreshness: number;
    }, {
        params: Record<string, unknown>;
        category: "flights" | "hotels" | "dining" | "activities" | "events" | "weather" | "places";
        minFreshness?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    requests: {
        params: Record<string, unknown>;
        category: "flights" | "hotels" | "dining" | "activities" | "events" | "weather" | "places";
        minFreshness: number;
    }[];
}, {
    requests: {
        params: Record<string, unknown>;
        category: "flights" | "hotels" | "dining" | "activities" | "events" | "weather" | "places";
        minFreshness?: number | undefined;
    }[];
}>;
export type FetchPlan = z.infer<typeof FetchPlanSchema>;
//# sourceMappingURL=fetcher.d.ts.map