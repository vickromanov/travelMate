# @travelmate/orchestrator

The brain. Four explicit stages (projectStructure.md §2 Refinement 1):

| Stage | File | LLM tier | Note |
|---|---|---|---|
| 1 Intent | `intent.ts` | fast | text → `TripBrief`; inference logged to `onThought` **before** any fetch (P1) |
| 2 Fetch Planner | `planner.ts` | fast | `TripBrief` → `FetchPlan`; freshness check; parallel fetch of **only** stale/missing |
| 3 Synthesis | `synthesis.ts` | mid → frontier | the one expensive call; cached prompt; IDs-in/IDs-out |
| 4 Re-flow | `reflow.ts` | fast / none | scoped patch on edit; **never** runs stage 3; no re-fetch |

`pipeline.ts` wires them in the unidirectional order; `savePlan()` is always the last
write and the UX learns via the Database Observer (no `onComplete`).

**Sole writer to the Database. Never imported by the UX.** Builds/tests entirely
against fetcher mocks + the mock LLM + in-memory DB — no network, no cost.
