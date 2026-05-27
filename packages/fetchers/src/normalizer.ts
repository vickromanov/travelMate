/**
 * Source-specific raw shape → contracts.NormalizedResult. This is the seam that
 * makes "scrape now, API later" invisible to the Orchestrator (P7). Skeleton.
 */
import { NormalizedResultSchema } from "@travelmate/contracts";
import type {
  Category,
  NormalizedResult,
  AffiliationMetadata,
} from "@travelmate/contracts";

export function normalize(
  category: Category,
  source: "mock" | "scraper" | "api",
  items: Array<Record<string, unknown>>,
  affiliation: AffiliationMetadata,
): NormalizedResult {
  const result: NormalizedResult = {
    category,
    items,
    affiliation,
    source,
    fetchedAt: new Date().toISOString(),
  };
  // Validate at the boundary — a drift here fails the contract test in CI (§8).
  return NormalizedResultSchema.parse(result);
}
