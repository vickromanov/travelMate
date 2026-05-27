# @travelmate/config

Shared build/test presets. **No runtime code ever lives here.**

- `tsconfig.lib.json` — every package's `tsconfig.json` extends this.
- `eslint.preset.js` — shared lint rules **including the tier import-boundary matrix**
  (projectStructure.md §2). This is where "tiers can't import each other" is enforced.
- `vitest.preset.ts` — shared test/coverage config.

Changing a preset affects every package — treat like a contract change (broad review).
