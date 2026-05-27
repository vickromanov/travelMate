/**
 * Stamps AffiliationMetadata on every fetched record from day one — even during
 * the scraping phase — so monetization is never a later retrofit
 * (about_travelMate.md revenue note, projectStructure.md §6).
 */
import type { AffiliationMetadata, Category } from "@travelmate/contracts";

export function affiliationFor(
  category: Category,
  source: "mock" | "scraper" | "api",
): AffiliationMetadata {
  // Skeleton placeholder IDs — real tracking/campaign IDs wired in the API phase.
  return {
    trackingId: `TRAVELMATE_${category.toUpperCase()}`,
    referralSource: source,
    campaignId: "TRAVELMATE_AFF_001",
    conversionType: source === "api" ? "booking" : "click",
  };
}
