# @travelmate/api

Thin HTTP host. Validates request bodies against `@travelmate/contracts` zod schemas
at the boundary, then delegates to `@travelmate/orchestrator` / `@travelmate/trip-mode`.

| Route | Delegates to | Highlight |
|---|---|---|
| `POST /plan` | orchestrator plan pipeline | H1–H3 |
| `POST /modify` | orchestrator scoped re-flow | H4 |
| `POST /trip-mode/start` · `/tick` | trip-mode engine | H5 |

**No business logic lives here.** The client never gets the plan in the HTTP response —
it subscribes to the plan via the Database Observer (no `onComplete`, P5). HTTP
framework is chosen in the implementation phase.
