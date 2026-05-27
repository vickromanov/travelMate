// Shared ESLint flat config preset.
//
// The `boundaries` rules below MECHANICALLY enforce the import matrix from
// projectStructure.md §2 — a cross-tier import fails CI. Element type patterns
// are wired here; each package extends this preset.
//
// Skeleton: rule bodies are intentionally minimal — tighten when tiers gain code.

import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...tseslint.configs.recommended,
  {
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "contracts", pattern: "packages/contracts/*" },
        { type: "llm", pattern: "packages/llm/*" },
        { type: "fetchers", pattern: "packages/fetchers/*" },
        { type: "orchestrator", pattern: "packages/orchestrator/*" },
        { type: "database", pattern: "packages/database/*" },
        { type: "trip-mode", pattern: "packages/trip-mode/*" },
        { type: "ui", pattern: "packages/ui/*" },
        { type: "app", pattern: "apps/*" }
      ]
    },
    rules: {
      // Allowed-import matrix — see projectStructure.md §2.
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: "contracts", allow: [] },
            { from: "llm", allow: ["contracts"] },
            { from: "fetchers", allow: ["contracts", "llm"] },
            { from: "database", allow: ["contracts"] },
            { from: "orchestrator", allow: ["contracts", "fetchers", "database", "llm"] },
            { from: "trip-mode", allow: ["contracts", "database"] },
            { from: "ui", allow: ["contracts"] },
            { from: "app", allow: ["contracts", "database", "trip-mode", "ui"] }
          ]
        }
      ]
    }
  }
];
