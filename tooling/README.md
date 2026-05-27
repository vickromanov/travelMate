# tooling/

Repo scripts that are **not shipped** in any package.

- `check-contracts.mjs` — fast guard run in CI/pre-push: every tier's
  `__tests__/contract.test.ts` must be green. This is the tripwire that makes parallel
  work safe (`projectStructure.md` §8–§9). Skeleton placeholder for now.

Add codegen, fixture builders, and release scripts here as the project grows.
