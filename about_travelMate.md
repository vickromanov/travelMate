# about_travelMate.md — What TravelMate Is

> The product definition and guiding philosophy for TravelMate.
> Read this before `projectStructure.md`. This document answers **what** and **why**;
> `projectStructure.md` answers **how**.

---

## 1. One sentence

**TravelMate is an AI travel agent that turns a free-form description of *any* trip for *any* traveler into a single, self-contained, "zero-thinking" itinerary the traveler can edit live and then be guided through, step by step, while travelling.**

---

## 2. The problem we are solving

Planning a trip today means juggling 8–15 browser tabs: a flight meta-search, two hotel
sites, a maps app, three "best restaurants in X" blog posts, a museum's ticketing page,
a weather site, a currency converter, and a notes app to glue it all together. The
information never lives in one place, it goes stale, and nothing tells the traveler
*what to do next* once they have landed.

Generic AI chatbots made this *worse* in one specific way: they produce confident,
beautiful itineraries that are **not real** — invented flight numbers, restaurants that
closed, museums "open" on the day they are shut. Research on building AI travel agents
is blunt about this: *"Without real-time data, an AI agent is just an intelligent
chatbot"* and hallucinated flights/hotels are the number-one failure mode.

TravelMate's wager: combine a strong language model for **understanding the traveler and
composing the plan** with real, freshly-fetched data for **every concrete fact**, and
present the result as something you can act on without ever opening another tab.

---

## 3. The five product highlights

These are the non-negotiable pillars. Every feature must serve at least one; no feature
may break one.

### H1 — One place, not fifteen tabs
All trip information (flights, stays, ground transport, dining, activities, events,
weather, money, logistics) is assembled, reconciled and presented in **one itinerary**.
The traveler never leaves the app to "go check" something.

### H2 — Any trip, any traveler
The engine is **not** a set of templates. A bachelor-party casino weekend, a
three-generation motorhome road trip, and a couple's slow culinary tour through Lyon are
all first-class. There is **no fixed list of traveler archetypes** — the traveler is
described in free-form natural language and the plan adapts to that description.

### H3 — The Zero-Thinking Itinerary
Once the plan is ready, the traveler should never have to think, google, or guess. At
every moment the itinerary states: *what is next, when, where, how to get there from
exactly where you are, what it costs, whether you need to book, and what to know before
you go.* Every step is self-contained. This is the core differentiator and the hardest
thing to get right.

### H4 — Live, dependency-aware editing
During planning, **every step is swappable**, and changing one step re-flows the rest.
Swap the hotel and the breakfast cafés, the airport transfer, and the "walk back to the
hotel" steps all re-resolve around the new location — *without regenerating the whole
trip*. This is a scoped re-flow, not a full re-roll (see `projectStructure.md` →
Re-flow Engine).

### H5 — Trip Mode
When the plan is approved and the trip begins, TravelMate becomes a live companion: it
surfaces the next step at the right time, with walking/transit directions from the
traveler's current position, the QR/booking codes for the next activity, and timely
nudges ("leave in 15 min to make your 19:30 reservation").

---

## 4. What the research says a great travel planner does

Synthesised from a market and best-practice scan (sources at the end). These informed
the pillars above and the anti-goals below.

**What the best tools (Mindtrip, Layla, Wanderlog, et al.) do well**

- **Map-anchored itineraries.** Turning an abstract list into a geographic plan is
  consistently cited as the single biggest "aha". Mindtrip won a 2025 innovation award
  largely on map integration; Wanderlog is praised for route/driving logistics.
- **Live pricing, not estimates.** Layla pulls live prices from Skyscanner/Booking.com.
  Users trust plans with real numbers and distrust "approximately $$$".
- **Visual sense of place.** Layla surfaces creator video so the traveler feels the
  "vibe" before committing. Imagery and sense-of-place matter for confidence.
- **Collaboration.** Group trips need shared viewing/voting; this is a recurring
  request in travel-app UX studies (categories users expect: Trips, Search, Create,
  Explore, Messages).
- **Status transparency.** "Searching for tickets…" indicators tell the user the
  system is fetching real data, not fabricating — this directly builds trust.

**Where the best tools fall short (our opening)**

- Most tools' usefulness *drops sharply after planning* — no real in-trip companion
  (Wanderlog explicitly weak here: no live mode, no day-of guidance). **H5 is our moat.**
- Editing usually means *regenerating* the trip, losing the parts you liked. True
  **dependency-aware re-flow (H4)** is rare.
- "Zero-thinking" completeness (exact next step + how to get there from where you are)
  is almost never delivered end-to-end. **H3 is our moat.**

**What the engineering literature says we must do**

- **Tool calling is the heart of the system** — the LLM decides *when/what* to fetch;
  it must not answer concrete questions from its own memory.
- **RAG / fresh data over a vector or cache store** addresses recency + hallucination.
- **Parallel retrieval** (flights, hotels, dining, events fetched concurrently) plus
  **intent-driven retrieval depth** (cheap intents → shallow; complex itineraries →
  deep, async) is the proven latency pattern.
- **Decompose intent, route models, cache prompts** to control cost (see the LLM
  strategy section of `projectStructure.md` — this is a major design pillar, not an
  afterthought).
- **MVP discipline:** nail 3 core functions (conversational plan, real flight+stay
  data, contextual answers) before breadth. Scope creep at MVP is the top project
  failure mode.

---

## 5. Product principles (use these to settle arguments)

| # | Principle | Practical test |
|---|---|---|
| P1 | **Real over plausible** | If we cannot fetch it, we do not state it as fact. A gap is labelled, never invented. |
| P2 | **Zero-thinking** | Could a tired traveler with 10% battery and no signal still execute the next step from the cached plan alone? If no, the block is incomplete. |
| P3 | **No archetypes** | The traveler is described in free text. If you find an `enum TravelerType`, it is a bug. |
| P4 | **Edit, don't regenerate** | A single change must re-flow only its dependents, preserving everything the user already liked. |
| P5 | **Tiers don't leak** | UX never fetches. Fetchers never know about UX. The contract package is the only shared vocabulary. |
| P6 | **Cheapest model that passes** | Every LLM call starts at the cheapest capable model and escalates only on validated failure. |
| P7 | **Swappable sources** | Scraper today, affiliate API tomorrow — the Orchestrator must not be able to tell the difference. |

---

## 6. Explicit non-goals / anti-patterns

- **Not** a chatbot that free-associates an itinerary from model memory.
- **Not** a template gallery ("Top 10 Paris itineraries").
- **No fixed traveler archetypes** baked into code or prompts.
- **No** UX-tier direct calls to flight/hotel/LLM services — ever (P5).
- **No** "regenerate the whole trip" as the only way to make an edit (P4).
- **No** scope creep before the MVP triad works: *(1) conversational plan,
  (2) real flights + stays, (3) contextual answers*.
- **No** silent staleness — every fact carries a freshness signal.

---

## 7. What "good" looks like (success criteria)

1. A first-time user describes a trip in 2–3 sentences and receives a complete,
   real-data itinerary with zero further required input (sensible logged defaults
   for anything unstated).
2. Every itinerary block passes the P2 "10% battery, no signal" test.
3. Swapping the hotel re-flows all proximity-dependent blocks in seconds, touching
   nothing the user already customised, and **without** a full LLM re-synthesis.
4. In Trip Mode, the user is never left wondering "what now?" — the next step and how
   to reach it is always one glance away.
5. Cost per generated trip stays within target because cheap models + prompt caching +
   scoped re-flow do most of the work (frontier models are the exception, not default).

---

## 8. Glossary

| Term | Meaning |
|---|---|
| **Trip Brief** | The structured, validated description of the trip + traveler produced from the user's free-form input. The contract between UX and Orchestrator. |
| **Itinerary / Trip Plan** | The full assembled plan: days → blocks → swappable options. The contract between Orchestrator and UX (via the Database). |
| **Block** | One scheduled unit of the trip (a meal, a transfer, an activity) with 2–4 swappable options. |
| **Re-flow** | Recomputing only the blocks that depend on a changed block, not the whole trip. |
| **Freshness score** | A per-cache-entry signal of how stale fetched data is, driving re-fetch decisions. |
| **Trip Mode** | The post-approval, in-trip live companion experience (H5). |

---

## Sources

- [Best AI Travel Planner (2026) — Stardrift](https://stardrift.ai/resources/best-ai-travel-planners-2026)
- [I Tested 7 AI Trip Planners in 2026 — MonkeyTravel](https://monkeytravel.app/blog/best-ai-trip-planners-2026-compared)
- [AI Travel Planners Tested — Layla](https://layla.ai/blog/news-and-tips/ai-travel-planners-comparison)
- [UX Case Study: Simplifying Travel Planning — Tiffany Ng (Medium)](https://ngtiffanytw.medium.com/ux-case-study-simplifying-travel-planning-c2ebccaa02e3)
- [Best practices for UX design in the travel industry — Torresburriel Estudio (Medium)](https://uxtbe.medium.com/best-practices-for-ux-design-in-the-travel-industry-a033968a3bd0)
- [How to Build an AI Travel Agent: MVP to Production — Anadea](https://anadea.info/blog/how-to-build-ai-travel-agent/)
- [Building Production-Grade AI Travel Agents in 2026 — Hitreader](https://www.hitreader.com/building-production-grade-ai-travel-agents-in-2026-a-step-by-step-guide-to-langchain-scalable-architectures-and-real-world-deployment/)
- [Aimpoint Digital: AI Agent Systems for Building Travel Itineraries — Databricks](https://www.databricks.com/blog/aimpoint-digital-ai-agent-systems)
- [Vaiage: A Multi-Agent Solution to Personalized Travel Planning — arXiv 2505.10922](https://arxiv.org/abs/2505.10922)
- [Travel and Booking APIs — AltexSoft](https://www.altexsoft.com/blog/travel-and-booking-apis-for-online-travel-and-tourism-service-providers/)
