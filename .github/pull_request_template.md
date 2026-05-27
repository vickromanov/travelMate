<!-- PR title: <type>(<tier>): <what changed>  e.g. feat(orchestrator): scoped re-flow -->

## What & why

<!-- One paragraph. Link the issue. Reference the principle/highlight it serves
     (about_travelMate.md) or the section it implements (projectStructure.md). -->

## Tier(s) touched

- [ ] contracts  ⚠️ a contract change needs review from every tier owner (see §9)
- [ ] orchestrator
- [ ] fetchers
- [ ] database
- [ ] llm
- [ ] trip-mode
- [ ] web / ui
- [ ] tooling / docs / ci

## Checklist

- [ ] No cross-tier import added (import matrix, projectStructure.md §2)
- [ ] Contract tests pass (`pnpm test:contracts`)
- [ ] `pnpm typecheck lint test build` green locally
- [ ] If a contract changed: every consuming tier updated + ADR added if irreversible
- [ ] If an LLM stage/model changed: `packages/llm/src/router.ts` only + token budget still passes
- [ ] Docs updated if behaviour diverges from about_travelMate.md / projectStructure.md
