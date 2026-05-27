/**
 * In-memory adapter. Lets every other tier unit-test with NO Redis/Postgres
 * (projectStructure.md §8). Skeleton — minimal, deterministic.
 */
import { NotImplemented } from "@travelmate/contracts";
import type { CacheEntry } from "@travelmate/contracts";
import type { CacheStore } from "../cache-store.js";

export function createMemoryCache(): CacheStore {
  const store = new Map<string, CacheEntry>();
  return {
    async get(key) {
      return store.get(key) ?? null;
    },
    async set(entry) {
      store.set(entry.key, entry);
    },
    async isStale(key, minFreshness) {
      const e = store.get(key);
      if (!e) return true;
      return e.freshnessScore < minFreshness;
    },
    async invalidate() {
      throw new NotImplemented("database/memory.invalidate");
    },
  };
}
