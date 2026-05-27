# @travelmate/ui

Shared presentational components — **props in, markup out, nothing else**. No
fetching, no LLM, no Database writes (principle P5). Imports only
`@travelmate/contracts` for prop types. Kept RN-safe so `apps/mobile` reuses these
later with no refactor (web-first, mobile-ready).

- `ItineraryView` — renders the plan, surfaces per-block swap (the swap handler is
  injected; the component never calls the Orchestrator).
- `TripDescribe` — free-form trip/traveler collector + Crucial-Info validation.
