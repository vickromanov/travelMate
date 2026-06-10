# Research 3 — Necessary information & the best sources

**Question:** Before creating the fetchers: what are ALL the information types a
zero-thinking itinerary needs, and what is the best source for each?

---

## Part A — the complete category list

Derived by walking a traveler through one full day and noting every fact they'd
otherwise google. Checked against the three vision trips (Black Forest motorhome ·
Vegas friends · Thailand culinary couple):

| # | Category | What it must contain | Vision-trip check |
|---|---|---|---|
| 1 | **Flights / intercity** | routes, times, duration, price, baggage | Vegas, Thailand |
| 2 | **Stays** | hotels, apartments, **campsites** (motorhome!), price, location, amenities | Black Forest = campsites |
| 3 | **Ground transport** | transit lines, walk routes, taxi estimates, **car/RV rental, parking**, travel-time matrix | RV rental + parking is make-or-break for motorhome trips |
| 4 | **Dining** | profile-matched restaurants, hours, price level, reservation need, dietary | the core of the culinary trip |
| 5 | **Activities / attractions** | POIs, hours, duration, ticket price, booking requirement | casinos/shows, forest trails |
| 6 | **Events** | concerts, shows, exhibitions on the trip dates | Vegas shows |
| 7 | **Weather** | daily forecast / climate normals for dates | scheduling + packing |
| 8 | **Places / geo** | geocoding, distances, travel times between blocks | the glue for door-to-door |
| 9 | **Practical info** | currency/FX, emergency numbers, tipping, plugs, visa pointers | every trip |

## Part B — best source per category (3 phases)

Key research finding: **most categories have free, legal, structured APIs — scraping is
only needed where live *prices* live behind commercial walls (flights, hotels).** This
refines "scrape everything first": scraping is brittle (anti-bot, ToS risk) and slower
to build than calling a free API.

| Category | Phase 1 (MVP — free/open) | Phase 2 (affiliate/commercial) | Scrape? |
|---|---|---|---|
| Flights | **Duffel test mode** (sandbox, dev-realistic) → **Travelpayouts/Kiwi** (free affiliate, cached real prices) | Skyscanner affiliate, Amadeus Self-Service, Duffel live | Only as stopgap; Google Flights scraping is the classic but most anti-bot-hardened target |
| Stays | **Travelpayouts hotels** (free affiliate) + **OSM/Overpass** `tourism=camp_site` for campsites | Booking Demand API, Expedia Rapid | Booking.com scrape as fallback, carefully rate-limited |
| Ground transport | **OpenRouteService / OSRM** (routing + travel-time matrix), OSM parking data | HERE/Moovit transit, Google Routes | No |
| Dining | **Overpass** (`amenity=restaurant|cafe` + cuisine/hours tags) + **OpenTripMap** | Google Places (cheap, accurate hours), OpenTable affiliate | TripAdvisor scraping is ToS-hostile — avoid |
| Activities | **OpenTripMap** (free POI DB w/ Wikipedia extracts) + **Overpass** + Wikivoyage (CC) | Viator / GetYourGuide / Tiqets affiliate (ticketing!) | Only for specific ticket prices |
| Events | **Ticketmaster Discovery API** (free key, 230k events) + Eventbrite | Ticketmaster Partner (booking), PredictHQ | No |
| Weather | **Open-Meteo** (free, no API key, forecast + climate normals) | — (it's enough) | No |
| Places/geo | **Nominatim** (free geocoding) | Google Geocoding | No |
| Practical | LLM knowledge + **ECB/exchangerate FX feed**; curated static data | — | No |

Sources for the free stack: [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API),
[OpenTripMap](https://dev.opentripmap.org/product), [openrouteservice](https://openrouteservice.org/),
[Nominatim](https://nominatim.org/), [Duffel test mode](https://duffel.com/docs/api/overview/test-mode/duffel-airways),
[Travelpayouts API](https://support.travelpayouts.com/hc/en-us/categories/200358578-API-and-data),
[flight APIs with free tiers](https://thunderbit.com/blog/best-flight-api-with-free-tiers).

## Part C — non-negotiable sourcing rules

1. **Every record carries `source` + `fetchedAt` + `AffiliationMetadata`** — provenance
   from day one (also the answer to the accuracy crisis in research 6).
2. **Facts the pipeline can't verify are labelled estimates** in the UI — never silently
   presented as fetched truth (price trends from Travelpayouts are cached, not live —
   that's fine *if labelled*).
3. Scrapers: logged-out public pages only, robots.txt + ToS respected, rate-limited,
   cached hard — and always behind the same `Fetcher` interface so swapping
   scraper→API never touches the Orchestrator.
4. One fetcher = one category; **`places` is built first** — every other category needs
   coordinates and travel times.

---

## Decision for TravelMate

> **Free-API-first, scrape-only-where-priced, affiliate-phase-2.**
> MVP wiring: places=Nominatim+ORS · weather=Open-Meteo · dining/activities=Overpass+
> OpenTripMap · events=Ticketmaster Discovery · flights=Duffel test→Travelpayouts ·
> stays=Travelpayouts+OSM campsites. Every fetcher returns the same `NormalizedResult`
> with provenance; estimates are explicitly flagged.

## Sources

- [Overpass API — OSM Wiki](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [OpenTripMap POI API](https://dev.opentripmap.org/product)
- [openrouteservice.org](https://openrouteservice.org/)
- [Nominatim geocoding](https://nominatim.org/)
- [Duffel test mode docs](https://duffel.com/docs/api/overview/test-mode/duffel-airways)
- [Travelpayouts API help center](https://support.travelpayouts.com/hc/en-us/categories/200358578-API-and-data)
- [10 Best Flight APIs 2026: free tiers — Thunderbit](https://thunderbit.com/blog/best-flight-api-with-free-tiers)
- [Travel & booking APIs — AltexSoft](https://www.altexsoft.com/blog/travel-and-booking-apis-for-online-travel-and-tourism-service-providers/) (phase-2 commercial map)
