# Research 6 — The most desired capabilities (and how TM implements them)

**Question:** What do travelers actually want from an AI travel agent, where do current
tools fail them, and how does each demand map to a TravelMate feature?

---

## The adoption picture (2026)

- **56% of U.S. leisure travelers** used AI for at least one trip in the past 12 months —
  up from 43% nine months earlier; called *"the fastest behavioral shift in travel
  industry history"* ([Nomad Lawyer](https://nomadlawyer.org/majority-travelers-trips-ai-2026),
  [TakeUp AI](https://takeup.ai/new-research-shows-how-ai-is-changing-travel-planning-in-2026/)).
- What they use it for: **recommendations 75% · itinerary planning 70% · discovery 69% ·
  comparisons 55%** — but **only 13% expect to book through AI**
  ([Travel Daily News](https://www.traveldailynews.com/statistics-trends/travel-outlook-survey-highlights-2026-destinations-and-ai-adoption-trends/)).
  → *Booking execution is NOT an MVP requirement; trustworthy deep-links are.*
- Trust paradox: 78% of AI users have booked based on AI recommendations, yet accuracy,
  real-time pricing, and personalization remain the top friction points
  ([Travala](https://www.travala.com/blog/how-many-travelers-use-ai-for-booking-key-insights-for-2026/),
  [CNBC](https://www.cnbc.com/2026/03/11/ai-travel-planners-tourism-popularity-trust-hallucinations.html)).

## Where current tools fail (the market gap)

Reviewer consensus: *"every single AI trip planner demanded manual fixes for bookings,
outdated hours, and outright fabrications"* — invented restaurants, attractions closed
for years, routes to the wrong town, fabricated opening hours
([MonkeyTravel](https://monkeytravel.app/blog/best-ai-trip-planners-2026-compared),
[Windows News](https://windowsnews.ai/article/best-ai-travel-planners-in-2026-helpful-itineraries-still-need-human-verification.423305),
[Travo](https://travo.me/blog/how-to-avoid-ai-travel-planning-mistakes)).
Tools generating from model memory alone carry the worst hallucination risk.

**→ The #1 capability users want is the boring one: a plan that is TRUE.**
TravelMate's whole pipeline (fetch-then-compose, IDs-in/IDs-out, provenance labels) is
aimed at exactly this gap.

## Demand → feature → phase map

| Demand (evidence-ranked) | TravelMate answer | Where | Phase |
|---|---|---|---|
| 1. **Accurate, real facts** (hours, venues, routes) | fetch-first pipeline; LLM picks from verified candidates only; provenance + "estimate" labels | orchestrator + fetchers | **MVP** |
| 2. **Real prices / budget transparency** | live/cached prices with source labels; per-day budget; total-vs-budget bar | fetchers + UX header | **MVP** |
| 3. **Personalization beyond templates** | free-form traveler profile (no archetypes) drives selection + reasoning shown per pick | intent + synthesis | **MVP** |
| 4. **Logistics realism** (no zigzag, doable days) | travel-time matrix (ORS) + geo-clustering before the LLM; buffer rule | orchestrator pre-selection | **MVP** |
| 5. **Easy modification** | SWAP on every option + scoped re-flow with visible diff | reflow + UX | **MVP** |
| 6. One-place info (no 15 tabs) | the zero-thinking block payload | contracts/UX | **MVP** |
| 7. Booking deep-links | affiliate URLs on options (not in-app booking — 13%!) | fetchers affiliation | v1.1 |
| 8. Share / export | share link; print/PDF; calendar (.ics); JSON-LD page | web | v1.1 |
| 9. Group collaboration / voting | shared plan view → comments → votes | web + database | v1.2 |
| 10. **Adaptive replanning** (rain, closure, delay) + price alerts | Trip Mode: live feed, re-flow on disruption; watch tasks | trip-mode | v2 (the moat) |
| 11. Offline in-trip access | plan JSON cached client-side; offline view | web/mobile | v2 |
| 12. Remembers me across trips | traveler profile persistence | database | v2 |

---

## Decision for TravelMate

> MVP ships demands **1–6** — and #1 (truth) is the existential one: it's the gap every
> review names and the reason the architecture fetches before it composes. Booking
> stays deep-link-only (matches the 13% finding). Trip Mode adaptive replanning is the
> defensible long-term moat and stays v2.

## Sources

- [2026 majority-AI travel shift — Nomad Lawyer](https://nomadlawyer.org/majority-travelers-trips-ai-2026)
- [How travelers use AI in 2026 — TakeUp AI](https://takeup.ai/new-research-shows-how-ai-is-changing-travel-planning-in-2026/)
- [Travel Outlook Survey 2026 — Travel Daily News](https://www.traveldailynews.com/statistics-trends/travel-outlook-survey-highlights-2026-destinations-and-ai-adoption-trends/)
- [AI booking insights — Travala](https://www.travala.com/blog/how-many-travelers-use-ai-for-booking-key-insights-for-2026/)
- [AI travel planners: trust gaps & hallucinations — CNBC](https://www.cnbc.com/2026/03/11/ai-travel-planners-tourism-popularity-trust-hallucinations.html)
- [7 AI trip planners tested — MonkeyTravel](https://monkeytravel.app/blog/best-ai-trip-planners-2026-compared)
- [Still need human verification — Windows News](https://windowsnews.ai/article/best-ai-travel-planners-in-2026-helpful-itineraries-still-need-human-verification.423305)
- [Avoiding AI travel planning mistakes — Travo](https://travo.me/blog/how-to-avoid-ai-travel-planning-mistakes)
