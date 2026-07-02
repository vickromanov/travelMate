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

## System test — "did we break the product?"

Unit tests prove the code; the system test proves the *product*. It runs the real
pipeline (intent → synthesis, live LLM) for traveler personas and grades every plan
with the deterministic zero-thinking quality validator
(`packages/orchestrator/src/quality.ts` — the same one used at runtime).

```bash
pnpm test:system                  # 1 persona — fast smoke test after any pipeline change
pnpm test:system --all            # full 4-persona matrix (family/solo/couple/business)
pnpm test:system --persona solo   # a single persona by id
```

Reads `GEMINI_API_KEY` from `.env.local` automatically, prints a scored report, writes
JSON to `tooling/reports/`, and exits non-zero on any error-severity issue. Run it after
**any** change to `packages/orchestrator`, `packages/llm`, or the prompts — it is the
fastest way to know the itinerary quality still holds. (It spends real LLM quota, so it
is not part of `pnpm test`.)

## Automated pre-push check

A Husky `pre-push` hook (`.husky/pre-push`) runs `pnpm typecheck && pnpm test` on
**every** push and aborts it if anything fails — so you never push a red commit, and your
PR is green before CI even starts. It mirrors `.github/workflows/ci.yml` and installs
itself when you run `pnpm install` (via the `prepare` script) — nothing to set up.

- Bypass only when you truly must: `git push --no-verify`.
- If `pnpm` isn't found inside the hook (rare — some GUI git clients use a minimal PATH),
  run pushes from your terminal so your shell PATH is available to git.

## Decisions

Anything irreversible (a model default, a data-source choice, a freshness policy switch,
a contract redesign) gets a short ADR in `docs/adr/` so it is not re-litigated.
