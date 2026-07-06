/**
 * Link verification — no link reaches the traveler without being checked (P1:
 * real over plausible; a hallucinated "official website" is worse than none).
 *
 * Google Maps links are safe BY CONSTRUCTION (search/directions queries over a
 * real venue name — google.com always resolves), so only non-Maps URLs are
 * probed. A dead link is replaced with a Maps search for the venue, and a dead
 * bookingUrl is dropped. Domains are cached per process so repeated venues
 * (e.g. the hotel on every day) cost one probe.
 */
import type { DayPlan, TravelOption } from "@travelmate/contracts";

export type FetchLike = (url: string, init: { method: string; signal: AbortSignal; redirect: "follow" }) => Promise<{ status: number }>;

const TIMEOUT_MS = 4_000;
const CONCURRENCY = 8;

/**
 * Verdicts per ORIGIN, cached for the process lifetime. The PROMISE is cached
 * (not the value) so concurrent probes of the same domain share one request.
 */
const originCache = new Map<string, Promise<boolean>>();

function isMapsLink(url: string): boolean {
  return /(^https?:\/\/)?(www\.)?(google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(url);
}

export function mapsSearchUrl(opt: TravelOption): string {
  const q = encodeURIComponent(`${opt.title} ${opt.location.address}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/**
 * A URL is "alive" when its origin answers ANYTHING but a hard not-found.
 * DNS failures, timeouts and 404/410 kill it; 403/405/429 (bot walls) pass —
 * the domain exists, a human browser will get through.
 */
async function probe(url: string, fetchImpl: FetchLike): Promise<boolean> {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return false; // malformed URL
  }
  const cached = originCache.get(origin);
  if (cached !== undefined) return cached;

  const inFlight = (async () => {
    let alive = false;
    for (const method of ["HEAD", "GET"] as const) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetchImpl(url, { method, signal: controller.signal, redirect: "follow" });
        alive = res.status !== 404 && res.status !== 410;
        clearTimeout(timer);
        break; // got an HTTP answer — no need for the GET fallback
      } catch {
        clearTimeout(timer);
        // HEAD may be rejected outright by some servers — try GET once; a
        // network/DNS error on GET too means the link is dead.
        alive = false;
      }
    }
    return alive;
  })();

  originCache.set(origin, inFlight);
  return inFlight;
}

export interface LinkReport {
  checked: number;
  replaced: number;
}

/**
 * Verify and fix every link in the given days IN PLACE.
 * Runs with bounded concurrency; typical cost is 1-3s per new day.
 */
export async function verifyDayLinks(
  days: DayPlan[],
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<LinkReport> {
  // Collect every option with a probeable URL
  const jobs: Array<{ opt: TravelOption; field: "link" | "bookingUrl"; url: string }> = [];
  for (const day of days) {
    for (const block of day.blocks) {
      for (const opt of block.options) {
        if (opt.link && !isMapsLink(opt.link)) jobs.push({ opt, field: "link", url: opt.link });
        if (opt.bookingUrl && !isMapsLink(opt.bookingUrl)) jobs.push({ opt, field: "bookingUrl", url: opt.bookingUrl });
      }
    }
  }

  let replaced = 0;
  // Bounded concurrency without a dependency
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const slice = jobs.slice(i, i + CONCURRENCY);
    await Promise.all(
      slice.map(async (job) => {
        const alive = await probe(job.url, fetchImpl);
        if (alive) return;
        replaced++;
        if (job.field === "link") {
          // The map NEVER lies: fall back to a search for the real venue
          job.opt.link = mapsSearchUrl(job.opt);
          job.opt.linkType = "MAPS";
        } else {
          job.opt.bookingUrl = undefined; // a dead booking page is worse than none
        }
      }),
    );
  }

  return { checked: jobs.length, replaced };
}

/** Test hook: reset the per-process origin cache. */
export function _resetLinkCache(): void {
  originCache.clear();
}
