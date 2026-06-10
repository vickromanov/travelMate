/**
 * @travelmate/database — the single source of truth.
 *
 * Composes the cache + persistence + observer behind one `Database` facade.
 * Imports ONLY @travelmate/contracts. The Orchestrator writes; the UX reads +
 * subscribes. Nothing else touches it (import matrix, projectStructure.md §2).
 */
import type { CacheStore } from "./cache-store.js";
import type { PersistenceStore } from "./persistence.js";
import type { PlanObserver } from "./observer.js";
import {
  createMemoryCache,
  createMemoryPlanStore,
  createMemoryObserver,
} from "./adapters/memory.js";

export * from "./freshness.js";
export type { CacheStore } from "./cache-store.js";
export type { PersistenceStore } from "./persistence.js";
export type { PlanObserver, PlanListener } from "./observer.js";
export { createMemoryCache, createMemoryPlanStore, createMemoryObserver } from "./adapters/memory.js";
export { createRedisCache } from "./adapters/redis.js";
export { createPostgresStore } from "./adapters/postgres.js";

export interface Database {
  cache: CacheStore;
  plans: PersistenceStore;
  observer: PlanObserver;
}

/**
 * Factory. "memory" uses the in-memory adapters (tests + dev).
 * DATABASE_MODE env switches this in the API server.
 */
export function createDatabase(mode: string = process.env.DATABASE_MODE ?? "memory"): Database {
  if (mode === "memory") {
    return {
      cache: createMemoryCache(),
      plans: createMemoryPlanStore(),
      observer: createMemoryObserver(),
    };
  }
  throw new Error(`createDatabase: unsupported mode "${mode}". Only "memory" is implemented.`);
}
