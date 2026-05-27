# TravelMate

> An AI travel agent that turns a free-form description of **any** trip for **any**
> traveler into a single, self-contained, "zero-thinking" itinerary the traveler can
> edit live and then be guided through, step by step, while travelling.

📖 **Start here:**
1. [`about_travelMate.md`](./about_travelMate.md) — what TravelMate is and why (product).
2. [`projectStructure.md`](./projectStructure.md) — how it is built (architecture, every
   folder explained, diagrams, the LLM/cost strategy, the testing model).

> ⚠️ **Skeleton phase.** This repo is structure + interfaces only. Implementations are
> stubs that throw `NotImplemented`. The two docs above are the source of truth; code
> follows them. Nothing is built yet — by design.

## Layout (one line each — full detail in `projectStructure.md` §1)

| Path | Tier | Role |
|---|---|---|
| `apps/web` | UX | Next.js — render & edit the plan. Reads Database only. |
| `apps/mobile` | UX | Reserved for Expo (web-first, mobile-ready). |
| `apps/api` | host | Thin HTTP shell over Orchestrator + Trip Mode. |
| `packages/contracts` | shared | The only cross-tier vocabulary. Everyone imports this. |
| `packages/orchestrator` | brain | intent → fetch-plan → synthesis → re-flow. |
| `packages/fetchers` | data | One module per category. Scrape now, API later. |
| `packages/database` | state | Freshness-scored cache + persistence. |
| `packages/llm` | model | Provider-agnostic router, prompt cache, token budget. |
| `packages/trip-mode` | live | In-trip next-step engine + notifications. |
| `packages/ui` | shared | Presentational components. |
| `packages/config` | shared | tsconfig / eslint / prettier / vitest presets. |

## Develop

```bash
nvm use            # Node from .nvmrc
corepack enable    # pnpm from package.json "packageManager"
pnpm install

pnpm typecheck     # tsc across the graph
pnpm lint          # incl. tier import-boundary enforcement
pnpm test          # vitest unit + contract tests
pnpm test:contracts
pnpm build         # turbo build graph
pnpm dev           # run apps in dev (once implemented)
```

Everything runs through Turborepo and only re-runs the packages a change affects.

## Working in parallel

Three people, one tier each, never blocked — because every boundary is a typed +
zod-validated contract in `packages/contracts`, every tier ships against mocks, and the
import matrix is CI-enforced. See `projectStructure.md` §9 and `CONTRIBUTING.md`.

## License

MIT (placeholder — confirm with the team before public release).
