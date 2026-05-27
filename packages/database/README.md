# @travelmate/database

The single source of truth. Two stores, one lifetime each (projectStructure.md §2
Refinement 3):

- **Cache** (`cache-store.ts`, Redis prod / `adapters/memory.ts` test) — freshness-scored,
  per-category, stale-while-revalidate reads.
- **Persistence** (`persistence.ts`, Postgres) — users, saved/approved trips,
  Trip-Mode progress.
- **Observer** (`observer.ts`) — the UX subscribes and re-renders on `notify`. There is
  no `onComplete`; the UX never gets the plan via a callback (P5).

`freshness.ts` owns the score + `DEBUG_FRESHNESS_HOURS` (one dev knob) and the
production policy table (activated only via an ADR).

Imports **only** `@travelmate/contracts`. The Orchestrator is the sole writer.
