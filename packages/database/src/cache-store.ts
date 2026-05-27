/**
 * Freshness-scored cache (Redis in prod, memory in test). Keyed by a normalised
 * query hash. Supports stale-while-revalidate reads (projectStructure.md §5).
 */
import type { CacheEntry, Category } from "@travelmate/contracts";

export interface CacheStore {
  /** Returns the entry with its freshnessScore computed, or null on miss. */
  get(key: string): Promise<CacheEntry | null>;
  set(entry: CacheEntry): Promise<void>;
  /** True if absent or freshnessScore < minFreshness → caller should re-fetch. */
  isStale(key: string, minFreshness: number): Promise<boolean>;
  invalidate(category: Category): Promise<void>;
}
