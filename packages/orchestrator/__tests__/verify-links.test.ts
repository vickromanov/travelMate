/**
 * Link verification: dead links must be replaced with a Maps search for the
 * real venue; live links and Maps links must pass through untouched.
 * Uses an injected fetch — zero network.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { DayPlan, TravelOption } from "@travelmate/contracts";
import { verifyDayLinks, mapsSearchUrl, _resetLinkCache } from "../src/verify-links.js";
import type { FetchLike } from "../src/verify-links.js";

function opt(link?: string, bookingUrl?: string): TravelOption {
  return {
    id: "o1", tier: "ANCHOR", title: "Grand Boulevards Hotel",
    description: "d", reasoning: "r",
    price: { amount: 100, currency: "EUR" },
    location: { lat: 48.87, lng: 2.34, address: "17 Boulevard Poissonnière, Paris" },
    link, bookingUrl,
  };
}

function day(options: TravelOption[]): DayPlan {
  return {
    dayNumber: 1, date: "2026-07-10", title: "t", theme: "", dailyTips: [],
    blocks: [{
      blockId: "d1_b1", category: "STAYS", scheduledTime: "15:00",
      selectedOptionId: "o1", dependencyLogic: "none",
      options: [options[0]!, { ...options[0]!, id: "o2", tier: "SMART-VALUE" },
                { ...options[0]!, id: "o3", tier: "PREMIUM" }, { ...options[0]!, id: "o4", tier: "INDEPENDENT" }],
    }],
  };
}

const fetchOk: FetchLike = async () => ({ status: 200 });
const fetchDns: FetchLike = async () => { throw new Error("getaddrinfo ENOTFOUND"); };
const fetch404: FetchLike = async () => ({ status: 404 });
const fetchBotWall: FetchLike = async () => ({ status: 403 });

beforeEach(() => _resetLinkCache());

describe("verifyDayLinks", () => {
  it("replaces a DNS-dead link with a Maps search for the venue", async () => {
    const o = opt("https://grandboulevardshotel.com/");
    const d = day([o]);
    const report = await verifyDayLinks([d], fetchDns);
    expect(report.replaced).toBeGreaterThan(0);
    const fixed = d.blocks[0]!.options[0]!;
    expect(fixed.link).toBe(mapsSearchUrl(fixed));
    expect(fixed.link).toContain("google.com/maps/search");
    expect(fixed.linkType).toBe("MAPS");
  });

  it("replaces a 404 link", async () => {
    const d = day([opt("https://example.com/gone")]);
    const report = await verifyDayLinks([d], fetch404);
    expect(report.replaced).toBeGreaterThan(0);
  });

  it("keeps a live link untouched", async () => {
    const url = "https://www.louvre.fr/en/visit";
    const d = day([opt(url)]);
    const report = await verifyDayLinks([d], fetchOk);
    expect(report.replaced).toBe(0);
    expect(d.blocks[0]!.options[0]!.link).toBe(url);
  });

  it("treats bot walls (403) as alive — the domain exists", async () => {
    const d = day([opt("https://www.some-hotel.com")]);
    const report = await verifyDayLinks([d], fetchBotWall);
    expect(report.replaced).toBe(0);
  });

  it("never probes Google Maps links (safe by construction)", async () => {
    let calls = 0;
    const counting: FetchLike = async () => { calls++; return { status: 200 }; };
    const d = day([opt("https://www.google.com/maps/search/?api=1&query=Hotel+Paris")]);
    await verifyDayLinks([d], counting);
    expect(calls).toBe(0);
  });

  it("drops a dead bookingUrl instead of replacing it", async () => {
    const d = day([opt(undefined, "https://dead-booking-site.example/room")]);
    await verifyDayLinks([d], fetchDns);
    expect(d.blocks[0]!.options[0]!.bookingUrl).toBeUndefined();
  });

  it("replaces malformed URLs", async () => {
    const d = day([opt("not-a-url")]);
    const report = await verifyDayLinks([d], fetchOk);
    expect(report.replaced).toBeGreaterThan(0);
  });

  it("caches origins — one probe per domain across options and days", async () => {
    let calls = 0;
    const counting: FetchLike = async () => { calls++; return { status: 200 }; };
    const d = day([opt("https://same-domain.com/a")]);
    // all 4 options share the same link
    for (const o of d.blocks[0]!.options) o.link = "https://same-domain.com/a";
    await verifyDayLinks([d], counting);
    expect(calls).toBe(1);
  });
});
