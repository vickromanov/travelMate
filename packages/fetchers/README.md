# @travelmate/fetchers

One module per data category. Every fetcher implements the same `Fetcher` interface
and returns a `NormalizedResult` — **the Orchestrator cannot tell scraping from an API**
(`projectStructure.md` §6, principle P7).

```
src/<category>/
  index.ts    the Fetcher (picks mock | scraper | api by FETCHER_MODE)
  scraper.ts  Phase-1 Playwright scraper (logged-out, public, robots.txt + ToS, rate-limited)
  mock.ts     deterministic fixtures — lets Orchestrator/UX build with zero network/cost
```

Categories: `flights · hotels · dining · activities · events · weather · places`.

- `normalizer.ts` — raw source shape → `NormalizedResult` (the swap seam).
- `affiliation.ts` — stamps `AffiliationMetadata` on every record from day one.
- Phase-2 API providers slot in as `api.ts` behind the **same** interface — the
  Orchestrator does not change. Candidate providers: `docs/adr/0002-data-sources.md`.
