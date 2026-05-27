/**
 * @travelmate/database — the single source of truth.
 *
 * Composes the cache + persistence + observer behind one `Database` facade.
 * Imports ONLY @travelmate/contracts. The Orchestrator writes; the UX reads +
 * subscribes. Nothing else touches it (import matrix, projectStructure.md §2).
 */
import { NotImplemented } from "@travelmate/contracts";
import type { CacheStore } from "./cache-store.js";
import type { PersistenceStore } from "./persistence.js";
import type { PlanObserver } from "./observer.js";

export * from "./freshness.js";
export type { CacheStore } from "./cache-store.js";
export type { PersistenceStore } from "./persistence.js";
export type { PlanObserver, PlanListener } from "./observer.js";
export { createMemoryCache } from "./adapters/memory.js";
export { createRedisCache } from "./adapters/redis.js";
export { createPostgresStore } from "./adapters/postgres.js";

export interface Database {
  cache: CacheStore;
  plans: PersistenceStore;
  observer: PlanObserver;
}

/** Factory — DATABASE_MODE selects memory | redis+postgres. Skeleton stub. */
export function createDatabase(_mode?: string): Database {
  throw new NotImplemented("database.createDatabase");
}
