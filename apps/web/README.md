# @travelmate/web

UX tier (web) — Next.js App Router. **Reads the Database and subscribes to its
Observer; renders `@travelmate/ui`. It NEVER fetches data or calls the LLM** (principle
P5, import matrix `projectStructure.md` §2).

- `app/` — routes (skeleton placeholders).
- `src/lib/api-client.ts` — the only backend touchpoint: POST to `apps/api`, then
  subscribe to the plan via the Database Observer (the plan does not come back in the
  HTTP response — there is no `onComplete`).

Skeleton phase: pages are placeholders; nothing is wired. `apps/mobile` will reuse
`@travelmate/ui` and `@travelmate/contracts` with no refactor (web-first, mobile-ready).
