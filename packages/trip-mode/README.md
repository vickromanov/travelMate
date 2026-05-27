# @travelmate/trip-mode

Highlight **H5** — the live in-trip companion. Its own subsystem because it is a
time-driven state machine, not "more UX" and not "more Orchestrator"
(projectStructure.md §2 Refinement 4, §3.4).

- `scheduler.ts` — approved `TripPlan` → ordered queue of timed `TripModeEvent`s.
- `state-machine.ts` — per-trip now/next/done; advances on time or arrival.
- `notifications.ts` — dispatches events as push/local notifications.

Reads the approved plan from `@travelmate/database`, emits `TripModeEvent`s the UX
subscribes to. Never imports the Orchestrator or Fetchers.
