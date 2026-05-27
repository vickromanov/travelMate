#!/usr/bin/env node
/**
 * Contract guard (skeleton placeholder).
 *
 * Intent: run only the `contract` tests across every tier and fail loudly if any
 * boundary drifted from @travelmate/contracts. Wired into CI + pre-push so a
 * teammate's shape change is caught on THEIR pr, not in integration
 * (projectStructure.md §8–§9). Implementation lands with the test phase.
 */
console.log(
  "[check-contracts] skeleton placeholder — see projectStructure.md §8. " +
    "Run `pnpm test:contracts` for the real contract suite.",
);
process.exit(0);
