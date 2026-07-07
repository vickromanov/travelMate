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
 * Verdicts per URL, cached for the process lifetime. Keyed by full URL (not
 * origin) so a hallucinated path on a real domain — booking.com/hotel/wrong —
 * is still caught. The PROMISE is cached so concurrent probes of the same URL
 * share one request.
 */
const urlCache = new Map<string, Promise<boolean>>();

/** Deep links we construct ourselves — correct by construction, never probed. */
function isSafeConstructed(url: string): boolean {
  return isMapsLink(url) ||
    /booking\.com\/searchresults\.html\?ss=/i.test(url) ||
    /getyourguide\.com\/s\/?\?q=/i.test(url);
}

function isMapsLink(url: string): boolean {
  return /(^https?:\/\/)?(www\.)?(google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(url);
}

export function mapsSearchUrl(opt: TravelOption): string {
  const q = encodeURIComponent(`${opt.title} ${opt.location.address}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** Deterministic Booking.com deep link — lands on THIS hotel, never a homepage. */
export function bookingSearchUrl(opt: TravelOption): string {
  const q = encodeURIComponent(`${opt.title} ${opt.location.address}`.trim());
  return `https://www.booking.com/searchresults.html?ss=${q}`;
}

const AGGREGATOR_HOST_RE =
  /(^|\.)(booking\.com|tripadvisor\.[a-z.]+|expedia\.[a-z.]+|airbnb\.[a-z.]+|getyourguide\.[a-z.]+|viator\.com|opentable\.[a-z.]+|skyscanner\.[a-z.]+|hotels\.com|agoda\.com|kayak\.[a-z.]+)$/i;

/**
 * A bare AGGREGATOR homepage (booking.com, tripadvisor.com, …) is a working
 * URL but a USELESS card link — the traveler still has to search for the venue
 * by hand. A venue's OWN homepage (hotel-laimer-hof.de) is a fine link and is
 * left for the liveness probe instead.
 */
function isUselessAggregatorHomepage(url: string): boolean {
  try {
    const u = new URL(url);
    const isHomepage = (u.pathname === "/" || u.pathname === "") && !u.search && !u.hash;
    return isHomepage && AGGREGATOR_HOST_RE.test(u.hostname);
  } catch {
    return false; // malformed — the probe path handles it
  }
}

function isBookingHost(url: string): boolean {
  try {
    return /(^|\.)booking\.com$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Distinctive slugs from a venue title: words ≥4 chars, lower-cased, ASCII-folded. */
function venueSlugs(title: string): string[] {
  const generic = new Set([
    "hotel", "restaurant", "cafe", "café", "museum", "park", "palace",
    "bar", "pub", "the", "and", "der", "die", "das", "for", "von",
    "san", "santa", "st", "saint", "san", "grand", "royal", "old", "new",
    "central", "national", "state", "haus", "house", "platz", "tour", "square",
    "cable", "car", "train", "cogwheel", "summit", "walk", "guide", "private",
  ]);
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !generic.has(w));
}

/**
 * A generic-parent-domain trap: the link is alive but points to a REGION /
 * PARENT site rather than the specific venue. Example: "Gipfelalm Zugspitze"
 * restaurant linking to zugspitze.de (the whole mountain's tourism site).
 *
 * Rule: THE MOST DISTINCTIVE slug from the venue name (the FIRST non-generic
 * word — usually the venue's own name, not the location qualifier) must
 * appear in the URL. "Gipfelalm Zugspitze" → "gipfelalm" must be present;
 * a link that only carries "zugspitze" points at the mountain, not the
 * restaurant.
 */
function looksVenueSpecific(url: string, title: string): boolean {
  try {
    const u = new URL(url);
    const haystack = `${u.hostname} ${decodeURIComponent(u.pathname)} ${decodeURIComponent(u.search)}`
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "");
    const slugs = venueSlugs(title);
    if (slugs.length === 0) return true; // nothing distinctive to check
    // Cheap check for a plausible venue-specific URL: the first (most
    // distinctive) slug is present anywhere in host+path.
    return haystack.includes(slugs[0]!);
  } catch {
    return true; // malformed URLs handled elsewhere
  }
}

/**
 * A URL is "alive" when its origin answers ANYTHING but a hard not-found.
 * DNS failures, timeouts and 404/410 kill it; 403/405/429 (bot walls) pass —
 * the domain exists, a human browser will get through.
 */
async function probe(url: string, fetchImpl: FetchLike): Promise<boolean> {
  try {
    new URL(url);
  } catch {
    return false; // malformed URL
  }
  const cached = urlCache.get(url);
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

  urlCache.set(url, inFlight);
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
  let replaced = 0;

  // Pass 1 — deterministic rewrites, no probe needed:
  //   (a) aggregator homepages → venue deep link
  //   (b) generic-parent-domain traps (Gipfelalm Zugspitze → zugspitze.de) →
  //       the map, which is always venue-specific
  // A venue-specific deep link is always more useful than a technically-alive
  // parent-region site.
  for (const day of days) {
    for (const block of day.blocks) {
      for (const opt of block.options) {
        // The map / directions we generate ourselves are correct by
        // construction — nothing to rewrite here.
        const linkNeedsRewrite =
          opt.link &&
          !isMapsLink(opt.link) &&
          (isUselessAggregatorHomepage(opt.link) || !looksVenueSpecific(opt.link, opt.title));
        if (linkNeedsRewrite) {
          if (opt.link && isBookingHost(opt.link)) {
            opt.link = bookingSearchUrl(opt);
            opt.linkType = "BOOKING";
          } else {
            opt.link = mapsSearchUrl(opt);
            opt.linkType = "MAPS";
          }
          replaced++;
        }
        const bookingNeedsRewrite =
          opt.bookingUrl &&
          (isUselessAggregatorHomepage(opt.bookingUrl) ||
            (!isSafeConstructed(opt.bookingUrl) && !looksVenueSpecific(opt.bookingUrl, opt.title)));
        if (bookingNeedsRewrite && opt.bookingUrl) {
          // Rewrite to a venue-specific booking search when possible; drop otherwise.
          opt.bookingUrl = isBookingHost(opt.bookingUrl) ? bookingSearchUrl(opt) : undefined;
          replaced++;
        }
      }
    }
  }

  // Pass 2 — probe every remaining URL (per-URL, so wrong paths on real
  // domains are caught too)
  const jobs: Array<{ opt: TravelOption; field: "link" | "bookingUrl"; url: string }> = [];
  for (const day of days) {
    for (const block of day.blocks) {
      for (const opt of block.options) {
        if (opt.link && !isSafeConstructed(opt.link)) jobs.push({ opt, field: "link", url: opt.link });
        if (opt.bookingUrl && !isSafeConstructed(opt.bookingUrl)) jobs.push({ opt, field: "bookingUrl", url: opt.bookingUrl });
      }
    }
  }
  // Bounded concurrency without a dependency
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const slice = jobs.slice(i, i + CONCURRENCY);
    await Promise.all(
      slice.map(async (job) => {
        const alive = await probe(job.url, fetchImpl);
        if (alive) return;
        replaced++;
        // Dead booking.com path → deterministic booking deep link for the
        // venue; anything else dead → the map, which never lies.
        if (job.field === "link") {
          if (isBookingHost(job.url)) {
            job.opt.link = bookingSearchUrl(job.opt);
            job.opt.linkType = "BOOKING";
          } else {
            job.opt.link = mapsSearchUrl(job.opt);
            job.opt.linkType = "MAPS";
          }
        } else {
          job.opt.bookingUrl = isBookingHost(job.url) ? bookingSearchUrl(job.opt) : undefined;
        }
      }),
    );
  }

  return { checked: jobs.length, replaced };
}

/** Test hook: reset the per-process URL cache. */
export function _resetLinkCache(): void {
  urlCache.clear();
}
