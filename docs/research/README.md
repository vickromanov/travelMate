# Research — index

Six research tracks completed before implementation, per the product owner's directive:
*"first make a deep research what is the best and the correct way to do so."*

Each document ends with a **Decision for TravelMate** box and its sources. The decisions
feed directly into [`../implementation-plan.md`](../implementation-plan.md).

| # | Document | Question | One-line conclusion |
|---|---|---|---|
| 1 | [01-user-interaction.md](./01-user-interaction.md) | How should users communicate with TM? | **Hybrid**: one free-text brief + auto-extracted editable chips + ≤1 clarifying question; edits by direct manipulation, not chat round-trips. |
| 2 | [02-llm-strategy.md](./02-llm-strategy.md) | Which model for which need? | **Tiered routing**: Haiku-class for extraction/re-rank, Sonnet-class only for synthesis, frontier only on validated failure. Prompt caching mandatory. |
| 3 | [03-data-sources.md](./03-data-sources.md) | What data is needed and from where? | 9 categories; **free/open APIs cover most of them legally** — scraping only where no free source exists (flight/hotel prices); affiliate APIs in phase 2. |
| 4 | [04-itinerary-presentation.md](./04-itinerary-presentation.md) | How to present the itinerary? | **Day-by-day timeline spine + synchronized map**, three zoom levels, transport connectors between blocks, swap via bottom-sheet with reasoning. |
| 5 | [05-data-formats.md](./05-data-formats.md) | What format for storage + transfer? | **JSON validated by zod end-to-end**; JSON-Schema at the LLM boundary; Postgres `jsonb` + Redis; SSE for streaming. schema.org names as vocabulary. |
| 6 | [06-user-capabilities.md](./06-user-capabilities.md) | What do users actually want? | **Accuracy is the market gap** (every competitor hallucinates hours/venues); then real prices, adaptive replanning, personalization. Booking itself is NOT expected (13%). |
