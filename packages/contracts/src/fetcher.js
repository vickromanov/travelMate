/**
 * Orchestrator ↔ Fetchers boundary. The Orchestrator cannot tell scraping from an
 * API — every source returns the same NormalizedResult. projectStructure.md §6.
 */
import { z } from "zod";
import { CategorySchema } from "./common.js";
/** Revenue/attribution — rides on every fetched record from day one. */
export const AffiliationMetadataSchema = z.object({
    trackingId: z.string(),
    referralSource: z.string(),
    campaignId: z.string(),
    conversionType: z.enum(["click", "lead", "booking", "impression"]),
});
/** One category's fetch request. `params` is category-specific (validated per fetcher). */
export const FetchRequestSchema = z.object({
    category: CategorySchema,
    params: z.record(z.unknown()),
    /** Required freshness 0..1; below this the cached entry is refetched. */
    minFreshness: z.number().min(0).max(1).default(0.5),
});
/** What every fetcher returns, regardless of source. `items` shape is per-category. */
export const NormalizedResultSchema = z.object({
    category: CategorySchema,
    items: z.array(z.record(z.unknown())),
    affiliation: AffiliationMetadataSchema,
    source: z.enum(["mock", "scraper", "api"]),
    fetchedAt: z.string().datetime(),
});
/** Fetch Planner output: which categories to fetch and how fresh they must be. */
export const FetchPlanSchema = z.object({
    requests: z.array(FetchRequestSchema),
});
//# sourceMappingURL=fetcher.js.map