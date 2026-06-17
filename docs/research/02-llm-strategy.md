# Research 2 — Which LLM for every need (minimal required model)

**Question:** Before choosing models: what is the best model for each pipeline need,
using the *minimal* model that passes?

---

## What the evidence says

**Small models are now provably sufficient for extraction-class tasks.**
2026 benchmarks: Claude **Haiku 4.5** posts ~96% quality at ~2.2s median and is the
recommended default for structured-output features; **Gemini Flash** handles ~97% of
extraction/transform tasks at ~1.1s and ~$0.003/run
([ianlpaterson benchmark](https://ianlpaterson.com/blog/llm-benchmark-2026-38-actual-tasks-15-models-for-2-29/),
[JSON extraction comparison — DEV](https://dev.to/shaun_vd_7562913ba77e1e0b/claude-sonnet-46-vs-gpt-41-vs-gemini-25-flash-which-wins-json-extraction-poa)).

**Routing + caching are the two big levers.**
Cascade routing (cheap model first, escalate on *validated* failure) cuts 50–80% of
spend; prompt caching cuts ~90% on repeated input — and our synthesis prompt re-sends
the same large schema every call
([LLM cost handbook](https://blog.xidao.online/en/posts/2026-llm-cost-optimization-handbook/),
[pricing comparison](https://zenvanriel.com/ai-engineer-blog/llm-api-cost-comparison-2026/)).
Schema-validated outputs with a retry-then-escalate loop are the production norm
([structured outputs in real pipelines](https://collinwilkins.com/articles/structured-output)).

**Reference pricing** (per 1M tokens, from the 2026 comparisons): Haiku-class ≈ $1 in /
$5 out · Sonnet-class ≈ $3 / $15 · frontier ≈ $5+ / $25+ · cached input ≈ 10% of list.

## The per-stage model table

| Pipeline stage | Job | Default tier (model class) | Escalates to | Why this is enough |
|---|---|---|---|---|
| **Intent** | free text → `TripBrief` JSON | **fast** (Haiku 4.5 / Gemini Flash) | mid | Short input, strict schema — benchmark-proven small-model territory. |
| **Fetch Planner** | brief → which categories/params | **fast** (+ tool calling) | mid | Mostly deterministic code; LLM only disambiguates. |
| **Synthesis** | candidates → full `TripPlan` | **mid** (Sonnet 4.6-class) | **frontier** (Opus-class), only after 2 schema-validation failures | The one genuinely hard call: long, structured, multi-constraint. |
| **Re-flow** | one edit → patched dependents | none → **fast** | mid | Deterministic dependency walk; LLM only re-ranks cached candidates. |
| **Q&A / refinement** | "make day 2 cheaper" | **fast** | mid | Scoped patch over an existing plan. |

Concrete model IDs live in **one file** (`packages/llm/src/router.ts`), verified against
provider docs at implementation time — never hardcoded elsewhere.

## Token-minimization rules (enforced in `packages/llm`)

1. **Prompt-cache** the static blocks (system prompt, output JSON schema, destination
   context) — the single biggest saver for synthesis.
2. **IDs in, IDs out**: the LLM sees compact candidate summaries (`id, name, ~price,
   area, hours, 1-line why`) and returns **option IDs**; code hydrates full records from
   cache. Keeps synthesis input ~10× smaller and removes fabricated-venue hallucination
   *by construction*.
3. **Validate-then-escalate**: zod-parse every response; retry same tier once with the
   error message; then escalate one tier; hard-fail after frontier.
4. **Per-stage token budgets asserted in CI** — a bloated prompt fails the build.
5. **Stream** synthesis output for perceived latency; **batch API** later for prewarming.

## Cost model (per generated trip, MVP)

| Stage | Est. tokens (in/out) | Tier | Est. cost |
|---|---|---|---|
| Intent | 1.5k / 0.5k | fast | ~$0.004 |
| Planner | 1k / 0.3k | fast | ~$0.003 |
| Synthesis | ~20k in (mostly cached → ~5k effective) / 5k out | mid | ~$0.09 |
| Validation retries (×1.3 avg) | — | — | ~$0.03 |
| Re-flow per edit | 2k / 0.5k | fast | ~$0.005 |
| **Total per plan** | | | **≈ $0.13 — target < $0.20** |

---

## Decision for TravelMate

> Provider-agnostic client, **Anthropic default + Gemini Flash wired as cheap alternate**.
> Stage→tier table above is the law; routing, caching, budgets, and the
> validate-then-escalate loop all live in `packages/llm` and nowhere else.
> Semantic response cache (reuse near-identical briefs) is post-MVP.

## Sources

- [38-task LLM benchmark 2026 — ianlpaterson](https://ianlpaterson.com/blog/llm-benchmark-2026-38-actual-tasks-15-models-for-2-29/)
- [Sonnet 4.6 vs GPT-4.1 vs Gemini Flash JSON extraction — DEV](https://dev.to/shaun_vd_7562913ba77e1e0b/claude-sonnet-46-vs-gpt-41-vs-gemini-25-flash-which-wins-json-extraction-poa)
- [Structured outputs: schema validation for real pipelines](https://collinwilkins.com/articles/structured-output)
- [2026 LLM cost optimization handbook — XiDao](https://blog.xidao.online/en/posts/2026-llm-cost-optimization-handbook/)
- [LLM API cost comparison 2026 — Zen van Riel](https://zenvanriel.com/ai-engineer-blog/llm-api-cost-comparison-2026/)
- [Claude model selection framework — SitePoint](https://www.sitepoint.com/claude-model-selection-framework/)
