# @travelmate/mobile — reserved (not scaffolded yet)

**Web-first, mobile-ready** (your chosen scope). This directory is intentionally a
placeholder. The architecture already makes the mobile app a drop-in later with **no
refactor**, because:

- All cross-tier types/validation live in `@travelmate/contracts` (shared as-is).
- Presentational components in `@travelmate/ui` are kept RN-safe.
- The mobile app, like `apps/web`, will be a thin UX shell that talks to `apps/api`
  and subscribes to the Database Observer — it will **not** fetch or call the LLM (P5).

When mobile work starts: scaffold Expo/React Native here, add it to
`pnpm-workspace.yaml` (already globbed via `apps/*`), reuse `@travelmate/ui` +
`@travelmate/contracts`, and record the decision in `docs/adr/`.
