/**
 * PDF export smoke test — renders a realistic 2-day fixture plan through the
 * SAME document component the browser uses and writes it to disk.
 *
 *   pnpm --filter @travelmate/web test:pdf [output.pdf]
 *
 * Asserts the output is a real multi-page PDF. Run after any change to
 * src/pdf/ — if this passes, the browser download path renders identically.
 */
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { writeFileSync } from "fs";
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { ItineraryPdfDocument } from "../src/pdf/itinerary-pdf";
import type { TripPlan, Block, TravelOption } from "../src/lib/plan-types";

let seq = 0;
function opt(tier: string, title: string, price: number, extras: Partial<TravelOption> = {}): TravelOption {
  seq++;
  return {
    id: `o${seq}`, tier, title,
    description: `${title} — a great fit for this traveler.`,
    reasoning: "Matches the traveler profile.",
    price: { amount: price, currency: "EUR" },
    location: { lat: 38.71, lng: -9.14, address: `${title} street 1, Lisbon` },
    openingHours: "08:00-22:00",
    phoneNumber: "+351 21 000 0000",
    link: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(title)}+Lisbon`,
    ...extras,
  };
}

function block(id: string, category: string, time: string, label: string, price: number): Block {
  const options = [
    opt("ANCHOR", label, price),
    opt("SMART-VALUE", `${label} (value)`, Math.round(price * 0.6)),
    opt("PREMIUM", `${label} (premium)`, price * 3),
    opt("INDEPENDENT", `${label} (local)`, Math.round(price * 0.8)),
  ];
  return {
    blockId: id, category, scheduledTime: time, label,
    selectedOptionId: options[0]!.id, dependencyLogic: "none", options,
  };
}

const plan: TripPlan = {
  planId: "pdf-smoke",
  title: "Lisbon on a Shoestring: Fado, Surf & Soul",
  description:
    "Five sun-soaked days through Alfama's alleys, Atlantic surf at Carcavelos and late-night fado — all under €50 a day.",
  totalEstimatedCost: { amount: 245, currency: "EUR" },
  duration: "2 Days",
  days: [1, 2].map((n) => ({
    dayNumber: n,
    date: `2026-08-0${n}`,
    title: n === 1 ? "Alfama & Fado" : "Surf Day at Carcavelos",
    theme: n === 1 ? "Old town wandering" : "Atlantic waves",
    dailyTips: ["Validate your Viva Viagem card", "Carry cash for small cafés"],
    blocks: [
      block(`d${n}_b1`, "STAYS", "07:00", "Home Lisbon Hostel", 22),
      block(`d${n}_b2`, "DINING", "08:00", "Breakfast at Fábrica Coffee", 6),
      block(`d${n}_b3`, "TRANSPORT", "09:15", "Tram 28 to Alfama", 3),
      (() => {
        const b = block(`d${n}_b4`, "ACTIVITIES", "10:00", n === 1 ? "São Jorge Castle" : "Surf lesson", 10);
        const sel = b.options.find((o) => o.id === b.selectedOptionId)!;
        sel.bookingRequired = true;
        sel.bookingUrl = "https://www.getyourguide.com/s/?q=Sao+Jorge+Castle+Lisbon";
        sel.priceDetail = "Adults EUR 10, under 12 free";
        sel.bookingAdvice = "Timed entry — book a day ahead";
        return b;
      })(),
      block(`d${n}_b5`, "DINING", "13:00", "Lunch at Time Out Market", 9),
      block(`d${n}_b6`, "ACTIVITIES", "15:00", n === 1 ? "Miradouro walk" : "Beach afternoon", 0),
      block(`d${n}_b7`, "TRANSPORT", "18:30", "Train back to Cais do Sodré", 2),
      block(`d${n}_b8`, "DINING", "20:00", n === 1 ? "Fado dinner at Tasca do Chico" : "Dinner at Cervejaria Ramiro", 15),
    ],
  })),
};

async function main() {
  const element = createElement(ItineraryPdfDocument, { plan }) as unknown as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);

  const out = process.argv[2] ?? "/tmp/travelmate-itinerary-smoke.pdf";
  writeFileSync(out, buffer);

  const head = buffer.subarray(0, 8).toString("latin1");
  const pages = (buffer.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

  if (!head.startsWith("%PDF-")) throw new Error(`not a PDF (header: ${head})`);
  if (buffer.length < 5_000) throw new Error(`suspiciously small PDF (${buffer.length} bytes)`);
  if (pages < 2) throw new Error(`expected ≥2 pages for a 2-day plan, found ${pages}`);

  console.log(`PDF OK — ${buffer.length.toLocaleString()} bytes, ${pages} pages → ${out}`);
}

main().catch((err) => { console.error("PDF smoke test FAILED:", err); process.exit(1); });
