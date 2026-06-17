# Research 5 — The most suitable data format (fetchers → orchestrator → UX)

**Question:** Before fixing the structure in which data is stored and transferred
between tiers: what format fits travel data best?

---

## Candidates examined

| Format | Verdict | Why |
|---|---|---|
| **JSON + zod schemas** | ✅ **chosen** | Native to the all-TypeScript stack; human-readable (reviewable in PRs, debuggable); streams well (SSE/NDJSON); **LLM-native** — structured-output modes are JSON-Schema based; stored as-is in Postgres `jsonb`, Redis, and browser caches. zod gives one source of truth for compile-time types AND runtime validation at every tier boundary. |
| OpenTravel (OTA) XML | ❌ | Heavyweight B2B/GDS legacy interchange; built for airline⇄agency messaging, not an internal app model. |
| IATA NDC XML | ❌ as internal format | Airline distribution standard; only relevant later *inside* a flights fetcher that talks to NDC aggregators — normalized away at the boundary. |
| Protobuf/gRPC | ❌ | Binary efficiency we don't need at our scale; loses human-readability; poor fit for LLM I/O and rapid contract evolution. |
| schema.org `Trip`/`TouristTrip` JSON-LD | ◐ **vocabulary + export target** | A real, public itinerary vocabulary (`TouristTrip` + ordered `itinerary` via `ItemList`, `FoodEstablishment`, `Event`, `LodgingBusiness`). Too loose as an internal contract, but we align *names* with it where natural and can emit JSON-LD later for SEO/share pages ([schema.org/TouristTrip](https://schema.org/TouristTrip), [schema.org/Trip](https://schema.org/Trip)). |

## The format architecture (one pattern at every boundary)

```
Fetcher (raw source: HTML/JSON/XML)
   └─ normalizer → NormalizedResult (JSON, zod-parsed AT the boundary)
Orchestrator ↔ LLM
   └─ JSON Schema derived from zod (structured output) · compact candidate summaries in,
      OPTION IDs out → hydrate from cache (never let the LLM "write" venue facts)
Orchestrator → Database
   └─ TripPlan JSON · CacheEntry envelope {key, category, value, fetchedAt,
      freshnessScore, policy} adds provenance/freshness to every stored value
Database → UX
   └─ same TripPlan JSON via subscription · streaming = SSE (thoughts) + plan-ready event
Storage
   └─ Redis: cache entries (string/JSON, TTL) · Postgres: `jsonb` plan documents +
      relational user/booking tables · browser: same JSON, offline-cacheable
```

Why **IDs-in/IDs-out** matters beyond cost (research 2): it makes the *format itself*
anti-hallucination — the LLM physically cannot emit a restaurant that isn't in the
fetched candidate set, because it can only reference IDs that code then resolves.

## Transport protocol choice

REST + JSON for commands (`POST /plan`, `POST /modify`), **SSE** for the streamed
thinking feed and plan-ready notification. tRPC was considered (attractive in a TS
monorepo) but rejected for now: it couples web↔api deployments, while plain REST keeps
`apps/api` swappable and mobile-friendly. GraphQL: overkill for ~4 endpoints.

---

## Decision for TravelMate

> **JSON everywhere, zod-validated at every tier boundary** (already the `contracts`
> spine). JSON Schema (auto-derived from zod) at the LLM boundary; `CacheEntry` envelope
> for provenance + freshness on all fetched data; Postgres `jsonb` + Redis for storage;
> REST + SSE on the wire. schema.org vocabulary alignment where natural; JSON-LD export
> is a cheap later win.

## Sources

- [schema.org/TouristTrip](https://schema.org/TouristTrip) · [schema.org/Trip](https://schema.org/Trip) · [schema.org/itinerary](https://schema.org/itinerary)
- [TouristTrip/Trip type introduction — schemaorg GitHub](https://github.com/schemaorg/schemaorg/issues/1810)
- [Structured outputs: schema validation for real pipelines](https://collinwilkins.com/articles/structured-output)
- [Stale-while-revalidate — web.dev](https://web.dev/articles/stale-while-revalidate) (freshness envelope rationale)
- [Travel schema markup strategies — Black Bear Media](https://blackbearmedia.io/11-powerful-schema-markup-strategies-for-travel-websites/) (JSON-LD export angle)
