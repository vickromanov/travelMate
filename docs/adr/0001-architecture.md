# ADR 0001 — Tiered monorepo with a contracts spine

- **Status:** Accepted (skeleton)
- **Date:** 2026-05-19

## Context

TravelMate must be built in parallel by a small team, span web + (later) mobile, fetch
real data (scraping first, APIs later), and keep LLM cost controllable. The brief
proposed four functions: UX, Orchestrator, Fetchers, Database.

## Decision

- Keep the four tiers; refine the Orchestrator into four explicit stages
  (intent · fetch-planner · synthesis · re-flow) so live editing (H4) is a cheap scoped
  patch, never a full re-synthesis.
- Promote the inter-tier interface to a first-class `packages/contracts` package (TS
  types + zod schemas) — the single mechanism enabling safe parallel work.
- Split Database into cache (freshness-scored) + persistence (users/trips).
- Make Trip Mode (H5) its own subsystem; make LLM access an abstracted package.
- pnpm + Turborepo monorepo; TypeScript everywhere; Next.js web; `apps/mobile` reserved.

Full rationale: `projectStructure.md` §2.

## Consequences

- Tiers never import each other → enforced by ESLint boundaries + CI.
- A contract change is the only thing that can break a teammate → co-owned, change-gated.
- Each tier is buildable/testable against mocks alone → nobody is blocked.
