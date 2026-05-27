# @travelmate/llm

Provider-agnostic LLM access and the home of the **cost strategy**
(`projectStructure.md` §7).

- `router.ts` — **the only file with model IDs.** Stage→tier defaults, escalation,
  per-provider model table. Changing a model is a one-file, ADR-recorded change.
- `tokens.ts` — per-stage token budgets (asserted in tests — a bloated prompt fails CI).
- `cache.ts` — semantic response cache interface.
- `providers/{mock,anthropic,gemini}.ts` — `mock` is deterministic + zero-cost so
  every other tier tests without spend.

Other tiers call `createLLMClient().run(req)` only. They never see a vendor SDK.
