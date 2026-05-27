/** Postgres-backed PersistenceStore (production). Skeleton stub — driver added later. */
import { NotImplemented } from "@travelmate/contracts";
import type { PersistenceStore } from "../persistence.js";

export function createPostgresStore(_url: string): PersistenceStore {
  throw new NotImplemented("database/postgres");
}
