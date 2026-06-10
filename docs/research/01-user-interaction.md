# Research 1 — How should the user communicate with TravelMate?

**Question:** Before creating the UI: what is the most convenient way for a user to
describe a trip ("couple, culinary, romantic, Thailand") and then work with the result?

---

## What the evidence says

**Pure chat vs pure form is a false choice — the research consensus is hybrid.**

- Conversational input reduces cognitive strain because information is requested in
  chunks, and it fits users who *"may not know where to start"* — exactly the trip-dreaming
  state. 69% of leisure travelers already report anxiety with classic form-driven booking
  flows ([Toptal](https://www.toptal.com/designers/ux/end-of-web-forms-conversational-uis-chatbots)).
- BUT forms beat chat where data is precise and repeatable (dates, party size, budget):
  *"forms remain the most efficient pattern for collecting precise, repeatable data"*
  ([Medium/Bootcamp](https://medium.com/design-bootcamp/agentic-ux-in-enterprise-when-to-use-conversational-agents-vs-traditional-forms-93cf588eac21)).
- The strongest pattern: *"conversation to start, forms to finish — with confirmation as
  the bridge"*; best conversational UIs *"blend chat with structured UI elements —
  buttons, cards, carousels"* ([AI Design Patterns](https://www.aiuxdesign.guide/patterns/conversational-ui),
  [Onething](https://www.onething.design/post/best-practices-for-conversational-ui-design)).
- Status transparency during AI work ("Searching real prices…") measurably builds trust
  (carried over from the market scan in `about_travelMate.md`).

**What this means for the three interaction moments:**

1. **Input** — one free-text box invites "any trip, any traveler" (a form with dropdowns
   would silently kill H2 — you cannot enumerate "motorhome with grandma" in a dropdown).
   But the four crucial slots (destination, traveler description, trip type, budget) are
   precise data → they should be **extracted automatically and shown as editable chips**,
   not re-asked in chat.
2. **Clarification** — interrogating users turn-by-turn is the most common chatbot
   failure. TM asks **at most one** clarifying question, and only if a crucial slot is
   truly unextractable; everything else is inferred and *visibly logged* ("Assumed 2
   adults — you said 'couple'").
3. **Editing** — once the itinerary exists, edits are **direct manipulation** (tap Swap
   on the block, pick an alternative), not chat round-trips. Chat stays available for
   free-form requests the buttons can't express ("make day 2 cheaper", "more street
   food").

---

## Decision for TravelMate

> **Hybrid brief-first input.**
> 1. One prominent free-text field: *"Describe your trip — who's going and what you
>    dream of."* Example prompts shown as tappable starters.
> 2. As the user types/submits, the four **Crucial Info chips** (destination · travelers ·
>    trip type · budget) fill themselves via extraction and are tap-to-edit. Missing
>    optional fields get logged defaults, never a second interrogation. Max **one**
>    clarifying question.
> 3. During generation: a streamed **"thinking feed"** (what's being inferred, what's
>    being fetched) — the trust-building transparency layer.
> 4. After generation: **Swap buttons on every option** (the user's core requirement)
>    + a persistent chat box for free-form refinements.
> 5. Voice input: deferred (post-MVP); the architecture (free-text in) already supports it.

**Implications:** `TripDescribe` component = textarea + chips + starters; `CrucialInfo`
contract unchanged; intent stage must return extraction confidence per slot so the UI
knows which chips to highlight for confirmation.

## Sources

- [The end of web forms — Toptal](https://www.toptal.com/designers/ux/end-of-web-forms-conversational-uis-chatbots)
- [Conversational agents vs traditional forms — Bootcamp/Medium](https://medium.com/design-bootcamp/agentic-ux-in-enterprise-when-to-use-conversational-agents-vs-traditional-forms-93cf588eac21)
- [Conversational UI design patterns — AI Design Patterns](https://www.aiuxdesign.guide/patterns/conversational-ui)
- [10 Best Practices for Conversational UI — Onething](https://www.onething.design/post/best-practices-for-conversational-ui-design)
- [UX for Conversational AI — NeuronUX](https://www.neuronux.com/post/ux-design-for-conversational-ai-and-chatbots)
- [The chat box isn't a UI paradigm — UX Collective](https://uxdesign.cc/the-chat-box-isnt-a-ui-paradigm-it-s-what-shipped-96e931d92769)
