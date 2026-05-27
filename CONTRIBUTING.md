# Contributing to TravelMate

Read [`about_travelMate.md`](./about_travelMate.md) and
[`projectStructure.md`](./projectStructure.md) before your first change. They are the
source of truth; if code disagrees with them, the code is the bug (or the docs need an
ADR-recorded update first).

## The golden rules

1. **One tier per package.** Put logic in the package that owns it. `apps/*` are thin.
2. **Tiers talk only through `packages/contracts`.** Never import another tier directly.
   The import matrix (`projectStructure.md` §2) is enforced by ESLint + CI.
3. **A contract change is a big deal.** It is the only thing that can break a teammate.
   It needs review from every tier owner and, if irreversible, an ADR in `docs/adr/`.
4. **Cheapest model that passes.** LLM model choices live only in
   `packages/llm/src/router.ts`. Don't hardcode model IDs elsewhere.
5. **Prove it without the others.** Build/test your tier against mocks
   (`fetchers/**/mock.ts`, `llm/providers/mock.ts`, in-memory database). Green contract
   tests = compatible with every other green tier.

## Branches & commits

```
main                 protected, always green, deployable
dev/feat/<name>      new capability
dev/fix/<name>       bug fix
dev/spec/<name>      docs / ADR only
dev/chore/<name>     tooling / deps
```

Commit message: `<type>(<tier>): <what changed>` —
e.g. `feat(orchestrator): scoped re-flow over cached candidates`.
Types: `feat fix refactor spec chore test`. Tiers: the package names above.

## Before every PR

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm test:contracts
```

All green, the PR template filled, CODEOWNERS review obtained. CI must pass to merge.

## Decisions

Anything irreversible (a model default, a data-source choice, a freshness policy switch,
a contract redesign) gets a short ADR in `docs/adr/` so it is not re-litigated.
