/**
 * Complete in-memory implementation of all three Database interfaces.
 * Used for all tests and for the API server until Postgres/Redis are wired.
 */
import { EventEmitter } from "events";
import { NotImplemented } from "@travelmate/contracts";
import type { CacheEntry, Category, TripPlan } from "@travelmate/contracts";
import type { CacheStore } from "../cache-store.js";
import type { PersistenceStore } from "../persistence.js";
import type { PlanObserver, PlanListener } from "../observer.js";

// ── Cache ────────────────────────────────────────────────────────────────────

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
    async invalidate(_category: Category) {
      throw new NotImplemented("database/memory.invalidate");
    },
  };
}

// ── Persistence ──────────────────────────────────────────────────────────────

export function createMemoryPlanStore(): PersistenceStore {
  const plans = new Map<string, TripPlan>();
  return {
    async savePlan(plan) {
      plans.set(plan.planId, plan);
    },
    async getPlan(planId) {
      return plans.get(planId) ?? null;
    },
    async approvePlan(_planId) {
      // no-op for memory: approval state not needed in MVP
    },
    async listPlans(_userId) {
      return [...plans.values()];
    },
  };
}

// ── Observer ─────────────────────────────────────────────────────────────────

class MemoryObserver extends EventEmitter implements PlanObserver {
  subscribeToPlan(planId: string, listener: PlanListener): () => void {
    const key = `plan:${planId}`;
    this.on(key, listener);
    return () => { this.off(key, listener); };
  }

  notify(plan: TripPlan): void {
    this.emit(`plan:${plan.planId}`, plan);
  }
}

export function createMemoryObserver(): PlanObserver {
  return new MemoryObserver();
}
