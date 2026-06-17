// Shared Vitest preset. Each package's vitest.config.ts merges this.
// Coverage thresholds are placeholders for the skeleton phase — raise as code lands.
import { defineConfig } from "vitest/config";

export const vitestPreset = defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      // TODO(team): raise to ~80% once tiers have real implementations.
      thresholds: { lines: 0, functions: 0, branches: 0, statements: 0 }
    }
  }
});

export default vitestPreset;
