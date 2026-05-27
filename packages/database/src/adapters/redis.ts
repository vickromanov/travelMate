/** Redis-backed CacheStore (production). Skeleton stub — driver added later. */
import { NotImplemented } from "@travelmate/contracts";
import type { CacheStore } from "../cache-store.js";

export function createRedisCache(_url: string): CacheStore {
  throw new NotImplemented("database/redis");
}
