# @travelmate/contracts

The spine. Every inter-tier message is here as a **TypeScript type + a zod schema**.

- Imports nothing internal (leaf package).
- Every other tier imports *only* this to talk to another tier.
- Changing anything here can break a teammate → it is co-owned and change-gated
  (`.github/CODEOWNERS`, `projectStructure.md` §9). Add an ADR for irreversible changes.

| Module | Boundary |
|---|---|
| `common.ts` | shared primitives, `Category`, errors (`NotImplemented`) |
| `trip.ts` | `CrucialInfo`, `TripBrief`, `TripPlan`/`DayPlan`/`ItineraryBlock`/`TravelOption`, `PlanEdit` |
| `fetcher.ts` | `FetchRequest`, `NormalizedResult`, `AffiliationMetadata`, `FetchPlan` |
| `cache.ts` | `CacheEntry`, `FreshnessPolicy` |
| `llm.ts` | `LLMRequest`/`LLMResponse`, `ModelTier`, `LLMStage`, `TokenUsage` |
| `tripmode.ts` | `TripModeEvent` |
| `stream.ts` | `StreamCallbacks` (no `onComplete` — by design) |

Rule: if a value crosses a package boundary, validate it against its schema **at** the
boundary. `__tests__/contracts.test.ts` is the pattern every tier copies.
