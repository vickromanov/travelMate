# Research 4 — The best way to present the itinerary

**Question:** Before building the itinerary view: how should a zero-thinking plan be
presented so the traveler always knows what's next without being overwhelmed?

---

## What the evidence says

- **The day-by-day timeline is the universal spine.** Every strong template/product
  breaks the trip into days with morning/afternoon/evening slots, exact times, and
  transport segments listed *between* activities
  ([Stippl](https://www.stippl.io/blog/free-travel-itinerary-template),
  [Tripstone](https://tripstone.app/blog/travel-itinerary-template)).
- **Map + timeline together is the differentiator.** The market scan (about_travelMate.md)
  found map-anchoring is the single biggest "aha" (Mindtrip's award; Wanderlog's praised
  logistics view). Templates that pair itinerary sections with maps and images "work best."
- **Buffer time is a documented best practice** — experienced planners add 20–30 min per
  half-day as cushion; an AI that schedules back-to-back with zero slack produces plans
  that fail on contact with reality ([Tripstone](https://tripstone.app/blog/travel-itinerary-template)).
- **Group by location for multi-city/road trips** (country → city → day) — directly
  relevant to the motorhome use case
  ([Asana template](https://asana.com/templates/travel-planner)).
- **Progressive disclosure beats the wall of text.** Zero-thinking means *the next fact
  is one glance away*, not *every fact is on screen*. Case studies consistently show
  overview → day → detail layering ([UI/UX case study](https://jacquelai-portfolio-befd09.webflow.io/project/travel-planning-app)).
- Sharing/commenting on a live itinerary is an expected capability for group trips.

## The three-altitude model

```
ALTITUDE 1 — Trip overview          ALTITUDE 2 — Day timeline           ALTITUDE 3 — Block detail
┌──────────────────────┐            ┌──────────────────────┐            ┌──────────────────────┐
│ Rome · 4 days · $1.8k│            │ DAY 2 — Ancient Rome │            │ 🍝 Trattoria Da Enzo │
│ ✈ Jun 12 → Jun 16    │            │ ☀ 24° sunny          │            │ 19:30 · ~€35pp       │
│ [Day1][Day2][Day3]…  │            │ 09:00 ☕ Breakfast    │            │ ⭐ why: rustic Roman… │
│ weather strip        │            │   ↓ 🚶 8 min          │            │ 📍 Via dei Vascel…   │
│ bookings checklist   │            │ 09:45 🏛 Colosseum    │            │ 🕐 Tue–Sun 12–23     │
│ total budget bar     │            │   [SWAP] [✓ booked]  │            │ ☎ +39 06 …  [BOOK]  │
└──────────────────────┘            │   ↓ 🚇 Metro B 12min │            │ 👔 casual · 🌱 veg ok │
        click day ──────────────►   │ 12:30 🍕 Lunch …     │   click ►  │ [SWAP for 2 others]  │
                                    │ (map panel synced)   │            └──────────────────────┘
                                    └──────────────────────┘
```

- **Timeline spine:** time-ordered block cards; **transport connectors** rendered
  *between* cards (`↓ 🚶 8 min · ↓ 🚇 Metro B, 3 stops, €1.50`) — door-to-door made visible.
- **Synchronized map:** desktop = split view (timeline left, map right, hover-sync);
  mobile = toggle / bottom sheet. Day's blocks numbered on the map in visit order.
- **Block card (collapsed):** emoji/category icon, title, time, price, one-line "why",
  SWAP button, booking status. **Expanded:** the full zero-thinking payload (hours,
  phone, address, what-to-bring, dress code, booking link).
- **Swap interaction:** tap SWAP → bottom sheet with the block's 2–3 alternatives (same
  category/tier) each with reasoning → pick → scoped re-flow runs → **changed dependent
  blocks pulse-highlight** so the user sees exactly what adjusted (trust through
  visibility).
- **Trip header:** dates, party, total cost vs budget bar, weather strip, "bookings
  needed" checklist (the only to-do list the user ever sees).
- **Buffer rule:** the synthesis stage schedules 20–30 min slack per half-day; the
  timeline renders it as breathing room, not as fake activities.

## Map technology choice

MVP: **MapLibre GL + OpenStreetMap tiles** — free, no key, open-source, and consistent
with the OSM-based data stack (research 3). Google Maps deferred to phase 2 (cost +
key management) unless place-accuracy demands it sooner.

---

## Decision for TravelMate

> **Three-altitude presentation: Trip overview → Day timeline (the spine, with transport
> connectors and a synced MapLibre map) → Block detail card.** Swap = bottom sheet with
> reasoning + visible re-flow diff. Buffer time is a scheduling rule, not an afterthought.
> Print/offline view post-MVP (but the plan JSON is offline-cacheable by design).

## Sources

- [What a travel itinerary must include — Stippl](https://www.stippl.io/blog/free-travel-itinerary-template)
- [Itinerary template guide — Tripstone](https://tripstone.app/blog/travel-itinerary-template)
- [Travel planner template — Asana](https://asana.com/templates/travel-planner)
- [Optimising the travel planning experience — UX case study](https://jacquelai-portfolio-befd09.webflow.io/project/travel-planning-app)
- [MapLibre GL](https://maplibre.org/) · market-scan findings in `about_travelMate.md`
