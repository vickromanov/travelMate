# ADR 0002 — Data sourcing: scrape first, affiliate APIs later

- **Status:** Accepted (skeleton) — provider choices revisited before the API phase
- **Date:** 2026-05-19

## Context

Phase 1 has no provider contracts/budget; the product still needs real data (P1: real
over plausible). Monetization later is affiliate-based.

## Decision

Every fetcher implements one interface and returns a normalised result regardless of
source. Phase 1 = Playwright scrapers (logged-out, public data, robots.txt + ToS
respected, rate-limited, cached hard). Phase 2 = swap in provider/affiliate APIs behind
the same interface — the Orchestrator never changes. `AffiliationMetadata` rides on
every record from day one.

## Candidate API providers (Phase 2 shortlist — from research, not yet committed)

| Category | Candidates | Model |
|---|---|---|
| Flights | Amadeus Self-Service, Duffel, Skyscanner | GDS / aggregator / meta-affiliate |
| Hotels | Hotelbeds, Expedia Rapid, Booking Demand API | bed-bank / OTA / affiliate |
| Dining | OpenTable | affiliate (reservation threshold) |
| Activities | Viator, GetYourGuide, Tiqets | affiliate / partner |
| Events | Ticketmaster Discovery + Partner | info + affiliate |
| Reviews | TripAdvisor Content API | commercial |
| Transit/places | HERE, Moovit, Google | commercial |
| Weather | OpenWeather (or equivalent) | freemium |

## Consequences

- Legal/ethical guardrails for scraping are mandatory (see `projectStructure.md` §6 +
  Sources). A provider switch is a one-package change + an ADR update here.
