"use client";
import { useState, useRef, useEffect } from "react";
import type { Money, TravelOption, Block, DayPlan, TripPlan } from "../src/lib/plan-types";
import { linkActionLabel, bookingActionLabel, isFreeWalkIn } from "../src/lib/plan-types";
import { mergePlans, totalDaysOf } from "../src/lib/merge-plan";
import { downloadItineraryPdf } from "../src/pdf/export-pdf";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

// ── Swap logic ───────────────────────────────────────────────────────────────

function swapOption(plan: TripPlan, blockId: string, newOptionId: string): TripPlan {
  const updated = structuredClone(plan);

  // Find the block being swapped
  let swappedBlock: Block | undefined;
  for (const day of updated.days) {
    const block = day.blocks.find((b) => b.blockId === blockId);
    if (block) { swappedBlock = block; break; }
  }
  if (!swappedBlock) return updated;

  const oldOptionId = swappedBlock.selectedOptionId;
  swappedBlock.selectedOptionId = newOptionId;

  // If a STAYS block was swapped, update dependent TRANSPORT blocks
  if (swappedBlock.category === "STAYS") {
    const oldHotel = swappedBlock.options.find((o) => o.id === oldOptionId);
    const newHotel = swappedBlock.options.find((o) => o.id === newOptionId);
    if (oldHotel && newHotel && oldHotel.title !== newHotel.title) {
      updateDependentTransport(updated, oldHotel.title, newHotel);
    }
  }

  return updated;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replace every occurrence of `from` with `to`, case-insensitively. */
function replaceAllCI(text: string, from: string, to: string): string {
  return text.replace(new RegExp(escapeRegExp(from), "gi"), to);
}

function updateDependentTransport(plan: TripPlan, oldHotelName: string, newHotel: TravelOption) {
  // The hotel name appears in links in three shapes: plain, "+"-encoded, %-encoded
  const oldForms: Array<[string, string]> = [
    [oldHotelName, newHotel.title],
    [oldHotelName.replace(/ /g, "+"), newHotel.title.replace(/ /g, "+")],
    [encodeURIComponent(oldHotelName), encodeURIComponent(newHotel.title)],
  ];

  for (const day of plan.days) {
    for (const block of day.blocks) {
      if (block.category !== "TRANSPORT") continue;
      for (const opt of block.options) {
        if (opt.link) {
          for (const [from, to] of oldForms) {
            opt.link = replaceAllCI(opt.link, from, to);
          }
        }
        opt.title = replaceAllCI(opt.title, oldHotelName, newHotel.title);
        opt.description = replaceAllCI(opt.description, oldHotelName, newHotel.title);
      }
    }
  }
}

// ── Category & tier metadata ──────────────────────────────────────────────────

const CAT_META: Record<string, { icon: string; color: string; soft: string; label: string }> = {
  STAYS:      { icon: "🏨", color: "var(--cat-stays)",      soft: "var(--cat-stays-soft)",      label: "Stay" },
  DINING:     { icon: "🍽️", color: "var(--cat-dining)",     soft: "var(--cat-dining-soft)",     label: "Dining" },
  TRANSPORT:  { icon: "🚆", color: "var(--cat-transport)",  soft: "var(--cat-transport-soft)",  label: "Transport" },
  ACTIVITIES: { icon: "🎯", color: "var(--cat-activities)", soft: "var(--cat-activities-soft)", label: "Activity" },
  LOGISTICS:  { icon: "📋", color: "var(--cat-logistics)",  soft: "var(--cat-logistics-soft)",  label: "Logistics" },
};
const catMeta = (c: string) => CAT_META[c] ?? CAT_META.LOGISTICS!;

const TIER_META: Record<string, { label: string; color: string; soft: string }> = {
  ANCHOR:        { label: "⚓ Anchor",     color: "var(--tier-anchor)",      soft: "rgba(28,36,51,0.08)" },
  "SMART-VALUE": { label: "💡 Smart value", color: "var(--tier-value)",      soft: "var(--cat-activities-soft)" },
  PREMIUM:       { label: "👑 Premium",    color: "var(--tier-premium)",     soft: "#f8f1da" },
  INDEPENDENT:   { label: "🧭 Local gem",  color: "var(--tier-independent)", soft: "var(--teal-soft)" },
};

function fmtMoney(m: Money): string {
  return m.amount > 0 ? `~${m.currency} ${m.amount.toLocaleString()}` : "Free";
}

function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", opts);
  } catch {
    return iso;
  }
}

// ── Input form ────────────────────────────────────────────────────────────────

const EXAMPLES = [
  "Two of us, romantic culinary week in Thailand in November, love street food but want one fancy dinner",
  "Family of 4 — motorhome road trip through the Black Forest in August, kids 8 and 11",
  "Solo backpacker, 5 days Lisbon, budget €50/day, want to see fado and surf",
  "Friends trip, 4 guys, Las Vegas long weekend, shows, clubs, some hiking on Sunday",
];

function InputScreen({ onSubmit }: { onSubmit: (brief: string) => void }) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  function useTemplate(ex: string) {
    setText(ex);
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    cardRef.current?.classList.remove("flash-updated");
    void cardRef.current?.offsetWidth;
    cardRef.current?.classList.add("flash-updated");
    const ta = textareaRef.current;
    if (ta) {
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(ex.length, ex.length);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "72px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 44, animation: "fadeUp 0.5s ease" }}>
        <div style={{ fontSize: 13, letterSpacing: 3, textTransform: "uppercase", color: "var(--teal)", fontWeight: 600, marginBottom: 14 }}>
          ✈ Your AI travel agent
        </div>
        <h1 style={{ fontSize: 54, fontWeight: 900, lineHeight: 1.05, marginBottom: 14, color: "var(--navy)" }}>
          Where to next?
        </h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 17, maxWidth: 460, margin: "0 auto" }}>
          Describe your trip in your own words. Get a complete, zero-thinking
          itinerary — every meal, ride and moment planned.
        </p>
      </div>

      <div ref={cardRef} className="card" style={{ padding: 8, boxShadow: "var(--shadow-lg)", animation: "fadeUp 0.5s ease 0.08s backwards" }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Who's going, where, when, what kind of trip — tell me everything…"
          style={{
            width: "100%", minHeight: 120, padding: "16px 18px",
            background: "transparent", border: "none",
            resize: "vertical", outline: "none", lineHeight: 1.6, fontSize: 15.5,
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) {
              onSubmit(text.trim());
            }
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 8px 8px" }}>
          <button
            className="btn-primary"
            onClick={() => text.trim() && onSubmit(text.trim())}
            disabled={!text.trim()}
            style={{ padding: "12px 30px", fontSize: 15 }}
          >
            Plan my trip →
          </button>
        </div>
      </div>

      <div style={{ marginTop: 36, animation: "fadeUp 0.5s ease 0.16s backwards" }}>
        <p style={{ color: "var(--muted)", fontSize: 12.5, marginBottom: 12, textAlign: "center", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>
          Or try one of these
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {EXAMPLES.map((ex) => (
            <button key={ex} className="example-chip" onClick={() => useTemplate(ex)} style={{ padding: "11px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <span>{ex}</span>
              <span style={{ color: "var(--teal)", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0, fontSize: 12.5 }}>Use ↑</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Thinking screen (immersive — PR#10) ───────────────────────────────────────

// Curated HQ Unsplash travel photos (ambient background)
const TRAVEL_PHOTOS: string[] = [
  "photo-1469854523086-cc02fe5d8800",
  "photo-1488646953014-85cb44e25828",
  "photo-1476514525535-07fb3b4ae5f1",
  "photo-1530789253388-582c481c54b0",
  "photo-1500259571355-332da5cb07aa",
  "photo-1506929562872-bb421503ef21",
  "photo-1543158181-e6f9f6712055",
  "photo-1552832230-c0197dd311b5",
  "photo-1523906834658-6e24ef2386f9",
  "photo-1513581166391-887a96ddeafd",
];

// ── Destination-aware travel tips ─────────────────────────────────────────────
const DESTINATION_TIPS: Record<string, string[]> = {
  bavaria: [
    "💡 Bavaria is home to over 6,000 beer gardens — try a Maß at a traditional one",
    "🏰 Neuschwanstein Castle inspired the Disney fairy-tale castle",
    "🏔️ The Zugspitze is Germany's highest peak at 2,962 m",
    "🥨 Don't miss a fresh Brezn (pretzel) with Obatzda cheese",
    "🎶 Munich's Viktualienmarkt has been running since 1807",
  ],
  germany: [
    "🍺 Germany has over 1,300 breweries — more than any other country in Europe",
    "🏰 There are over 20,000 castles and castle ruins across Germany",
    "🚄 The ICE trains reach speeds of 300 km/h — perfect for city-hopping",
    "🌲 The Black Forest inspired many of the Brothers Grimm fairy tales",
    "🎄 German Christmas markets date back to the 14th century",
  ],
  thailand: [
    "🙏 A traditional Thai greeting (wai) involves pressing palms together",
    "🍜 Bangkok's street food scene was ranked best in the world by CNN",
    "🏝️ Thailand has 1,430 islands — most still untouched by tourism",
    "🐘 Elephant Nature Park in Chiang Mai is an ethical sanctuary",
    "🌺 The floating markets of Damnoen Saduak are over 100 years old",
  ],
  japan: [
    "🗼 Tokyo has more Michelin-starred restaurants than any other city",
    "🚅 The Shinkansen bullet trains have an average delay of under 1 minute",
    "🌸 Cherry blossom season (hanami) typically peaks in late March to mid-April",
    "♨️ Japan has over 27,000 natural hot spring (onsen) sources",
    "🏯 Kyoto has 17 UNESCO World Heritage Sites within the city",
  ],
  italy: [
    "🍝 Each Italian region has its own signature pasta shape and sauce",
    "🏛️ Rome's Colosseum could seat 50,000 spectators in ancient times",
    "🍕 Neapolitan pizza has been UNESCO Intangible Cultural Heritage since 2017",
    "🎭 Venice's Carnival has been celebrated since the 12th century",
    "🍷 Italy is the world's largest wine producer by volume",
  ],
  france: [
    "🥐 The French consume 30 million baguettes every single day",
    "🗼 The Eiffel Tower was meant to be temporary — built for the 1889 World Fair",
    "🍷 France has over 300 distinct cheese varieties",
    "🎨 The Louvre is the world's largest art museum with 380,000 objects",
    "🌊 The French Riviera gets 300+ days of sunshine per year",
  ],
  spain: [
    "💃 Flamenco originated in Andalusia and is UNESCO Intangible Heritage",
    "🍅 La Tomatina in Buñol uses over 150,000 tomatoes every August",
    "🏗️ Sagrada Família in Barcelona has been under construction since 1882",
    "🍷 Spain has the most land devoted to vineyards in the world",
    "🌙 Dinner in Spain typically starts at 9–10 PM — embrace the late schedule",
  ],
  greece: [
    "🏛️ Athens is one of the oldest cities in the world — inhabited for over 3,400 years",
    "🏝️ Greece has approximately 6,000 islands, but only 227 are inhabited",
    "🫒 Greek olive oil production dates back over 4,000 years",
    "🌅 Santorini's caldera sunset is considered one of the most beautiful in the world",
    "🧿 The blue evil eye (mati) charm is a beloved Greek tradition",
  ],
  portugal: [
    "🎶 Fado music is Portugal's soulful UNESCO-listed art form",
    "🍮 Pastéis de nata originated in Belém — the original recipe is still secret",
    "🏄 Nazaré holds the world record for the largest wave ever surfed (26.2 m)",
    "🌉 Lisbon's Ponte 25 de Abril was inspired by the Golden Gate Bridge",
    "🍷 Port wine can only be called 'Port' if produced in the Douro Valley",
  ],
  usa: [
    "🗽 The Statue of Liberty was a gift from France, dedicated in 1886",
    "🏜️ The Grand Canyon is over 6 million years old",
    "🌉 San Francisco's fog has a name — locals call it 'Karl'",
    "🎷 New Orleans is the birthplace of jazz music",
    "🌲 The US has 63 national parks spanning every climate zone",
  ],
};

const GENERIC_TIPS: string[] = [
  "💡 Download offline maps before your trip — they work without data",
  "📱 Most countries accept contactless payments — bring a travel-friendly card",
  "🧳 Roll your clothes instead of folding — it saves 30% more space",
  "💧 Carry a reusable water bottle — many airports have refill stations",
  "📸 The golden hour (just after sunrise, before sunset) gives the best photos",
  "🔌 Check plug adapters before you go — there are 15 different types worldwide",
  "🌍 Learning just 5 phrases in the local language goes a long way",
  "💰 Withdraw local currency at ATMs, not exchange bureaus — better rates",
  "🩺 Travel insurance costs ~5% of your trip but covers 100% of the unexpected",
  "✈️ Tuesday and Wednesday flights are typically 15–20% cheaper",
];

function getTipsForDestination(destination: string): string[] {
  const lower = destination.toLowerCase();
  // Try exact key match first, then check if destination contains any key
  for (const [key, tips] of Object.entries(DESTINATION_TIPS)) {
    if (lower.includes(key) || key.includes(lower)) return tips;
  }
  // Check for known aliases
  const aliases: Record<string, string> = {
    munich: "bavaria", berlin: "germany", hamburg: "germany", frankfurt: "germany",
    bangkok: "thailand", "chiang mai": "thailand", phuket: "thailand",
    tokyo: "japan", kyoto: "japan", osaka: "japan",
    rome: "italy", venice: "italy", florence: "italy", milan: "italy",
    paris: "france", nice: "france", lyon: "france", marseille: "france",
    barcelona: "spain", madrid: "spain", seville: "spain",
    athens: "greece", santorini: "greece", mykonos: "greece", crete: "greece",
    lisbon: "portugal", porto: "portugal", "new york": "usa", "las vegas": "usa",
    "los angeles": "usa", "san francisco": "usa",
  };
  for (const [alias, key] of Object.entries(aliases)) {
    if (lower.includes(alias)) return DESTINATION_TIPS[key] ?? GENERIC_TIPS;
  }
  return GENERIC_TIPS;
}

function estimateProgress(thoughts: string[]): number {
  const last = (thoughts[thoughts.length - 1] ?? "").toLowerCase();
  if (last.includes("connecting")) return 2;
  if (last.includes("checking for event")) return 8;
  if (last.includes("understanding your trip")) return 14;
  if (last.includes("trip profile ready")) return 26;
  if (last.includes("composing your")) return 32;
  if (last.includes("writing a")) return 37;
  const dayMatch = last.match(/(?:writing|generating) day[s]?\s+(\d+)[–\-]?(\d+)?\s+of\s+(\d+)/);
  if (dayMatch) {
    const current = parseInt(dayMatch[2] ?? dayMatch[1]!, 10);
    const total = parseInt(dayMatch[3]!, 10);
    return 38 + Math.round((current / total) * 50);
  }
  if (last.includes("all days generated") || last.includes("validating")) return 92;
  if (last.includes("quality")) return 95;
  if (last.includes("link check")) return 97;
  if (last.includes("reconciled")) return 96;
  if (last.includes("plan ready")) return 100;
  if (thoughts.length > 1) return Math.min(35, thoughts.length * 5);
  return 3;
}

function ThinkingScreen({ thoughts, destination, tripType }: { thoughts: string[]; destination: string; tripType: string }) {
  const [imgIdx, setImgIdx] = useState(0);
  const [prevIdx, setPrevIdx] = useState<number | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [kbKey, setKbKey] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);

  const images = TRAVEL_PHOTOS.map((id) => `https://images.unsplash.com/${id}?w=1920&q=85&fit=crop`);
  const tips = getTipsForDestination(destination);

  // Crossfade background every 6s
  useEffect(() => {
    const t = setInterval(() => {
      setTransitioning(true);
      setPrevIdx(imgIdx);
      setTimeout(() => {
        setImgIdx((i) => (i + 1) % images.length);
        setKbKey((k) => k + 1);
        setTransitioning(false);
        setPrevIdx(null);
      }, 1400);
    }, 6000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgIdx, images.length]);

  // Rotate tips every 5s
  useEffect(() => {
    const t = setInterval(() => setTipIdx((i) => (i + 1) % tips.length), 5000);
    return () => clearInterval(t);
  }, [tips.length]);

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const progress = estimateProgress(thoughts);
  const latestThought = thoughts[thoughts.length - 1] ?? "";
  const prevThoughts = thoughts.slice(-4, -1);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const elapsedStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  // Human-friendly trip type label
  const tripLabel = tripType && tripType !== "city break"
    ? tripType.charAt(0).toUpperCase() + tripType.slice(1) + " adventure"
    : "Your perfect journey is being crafted";

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#0a1628" }}>
      <style>{`
        @keyframes kenBurns {
          0%   { transform: scale(1.08) translate(0%, 0%); }
          50%  { transform: scale(1.14) translate(-1.5%, -1%); }
          100% { transform: scale(1.1)  translate(1%, 0.5%); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes planePulse {
          0%, 100% { transform: translateX(0) translateY(0) rotate(-45deg); }
          25%       { transform: translateX(3px) translateY(-2px) rotate(-45deg); }
          75%       { transform: translateX(-2px) translateY(1px) rotate(-45deg); }
        }
        @keyframes progressGlow {
          0%, 100% { box-shadow: 0 0 8px rgba(226,96,58,0.5); }
          50%       { box-shadow: 0 0 18px rgba(226,96,58,0.9); }
        }
        @keyframes tipFade {
          0%   { opacity: 0; transform: translateY(6px); }
          12%  { opacity: 1; transform: translateY(0); }
          88%  { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-6px); }
        }
        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(30px, -20px) scale(1.05); }
          66%      { transform: translate(-20px, 10px) scale(0.95); }
        }
        .thinking-step-done {
          animation: fadeInUp 0.3s ease forwards;
        }
        .thinking-step-active {
          animation: fadeInUp 0.35s ease forwards;
        }
      `}</style>

      {/* === Background image layer === */}
      {prevIdx !== null && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 0,
          backgroundImage: `url(${images[prevIdx]})`,
          backgroundSize: "cover", backgroundPosition: "center",
          opacity: transitioning ? 0 : 1,
          transition: "opacity 1.4s ease",
        }} />
      )}
      <div
        key={kbKey}
        style={{
          position: "absolute", inset: 0, zIndex: 1,
          backgroundImage: `url(${images[imgIdx]})`,
          backgroundSize: "cover", backgroundPosition: "center",
          opacity: transitioning ? 0 : 1,
          transition: "opacity 1.4s ease",
          animation: "kenBurns 12s ease-in-out infinite alternate",
        }}
      />

      <div style={{
        position: "absolute", inset: 0, zIndex: 2,
        background: "linear-gradient(to bottom, rgba(8,18,40,0.6) 0%, rgba(8,18,40,0.25) 30%, rgba(8,18,40,0.45) 60%, rgba(8,18,40,0.95) 100%)",
      }} />

      {/* === Content === */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 3,
        display: "flex", flexDirection: "column",
        maxHeight: "100vh",
      }}>

        <div style={{
          padding: "20px 28px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexShrink: 0,
        }}>
          <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase" }}>
            ✈ TravelMate
          </div>
          <div style={{
            background: "rgba(255,255,255,0.1)", backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.15)", borderRadius: 999,
            padding: "5px 14px", color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: 600,
          }}>
            ⏱ {elapsedStr}
          </div>
        </div>

        {/* Center hero */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "0 24px", textAlign: "center",
          minHeight: 0, /* allow shrinking */
        }}>
          {/* Plane icon */}
          <div style={{
            fontSize: 32, marginBottom: 16,
            animation: "planePulse 3s ease-in-out infinite",
            filter: "drop-shadow(0 4px 20px rgba(226,96,58,0.5))",
          }}>
            ✈
          </div>

          <h1 style={{
            fontFamily: "var(--font-display-stack)",
            fontSize: "clamp(36px, 7vw, 72px)",
            fontWeight: 900, color: "#fff", lineHeight: 1.05,
            marginBottom: 10, letterSpacing: -1,
            textShadow: "0 4px 32px rgba(0,0,0,0.5)",
          }}>
            {destination}
          </h1>
          <p style={{
            color: "rgba(255,255,255,0.55)", fontSize: 14, fontWeight: 500,
            letterSpacing: 1.5, textTransform: "uppercase",
          }}>
            {tripLabel}
          </p>
        </div>

        {/* Bottom panel — progress + status card */}
        <div style={{
          padding: "0 24px 24px",
          maxWidth: 560, width: "100%", margin: "0 auto",
          flexShrink: 0,
        }}>

          {/* Progress bar */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "baseline" }}>
              <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, letterSpacing: 1.8, textTransform: "uppercase", fontWeight: 600 }}>
                Building your itinerary
              </span>
              <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: 700 }}>
                {progress}%
              </span>
            </div>
            <div style={{
              height: 3, borderRadius: 999,
              background: "rgba(255,255,255,0.1)",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%", borderRadius: 999,
                background: "linear-gradient(90deg, var(--accent), #f0a86a)",
                width: `${progress}%`,
                transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                animation: progress > 0 && progress < 100 ? "progressGlow 2s ease infinite" : "none",
              }} />
            </div>
          </div>

          {/* Glass status card */}
          <div style={{
            background: "rgba(255,255,255,0.07)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.12)",
            padding: "14px 16px",
            maxHeight: 160, overflowY: "auto",
          }}>
            {/* Previous steps */}
            {prevThoughts.map((t, i) => (
              <div key={i} className="thinking-step-done" style={{
                display: "flex", gap: 10, alignItems: "center",
                marginBottom: 5, opacity: 0.5,
              }}>
                <span style={{ fontSize: 10, color: "#4ade80", fontWeight: 700, flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>{t}</span>
              </div>
            ))}

            {/* Active step */}
            {latestThought && (
              <div key={latestThought} className="thinking-step-active" style={{
                display: "flex", gap: 10, alignItems: "center",
                background: "rgba(226,96,58,0.12)",
                border: "1px solid rgba(226,96,58,0.2)",
                borderRadius: 8, padding: "8px 12px",
                marginTop: prevThoughts.length > 0 ? 3 : 0,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "var(--accent)", flexShrink: 0,
                  animation: "pulseDot 1.5s ease-in-out infinite",
                }} />
                <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.9)", fontWeight: 600, lineHeight: 1.4 }}>
                  {latestThought}
                </span>
              </div>
            )}
          </div>

          {/* Rotating travel tip (moved below status card) */}
          <div style={{
            marginTop: 16, minHeight: 32,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div
              key={tipIdx}
              style={{
                animation: "tipFade 5s ease-in-out forwards",
                textAlign: "center",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12.5, lineHeight: 1.5, fontWeight: 500, letterSpacing: 0.3 }}>
                {tips[tipIdx % tips.length]}
              </span>
            </div>
          </div>

          {/* Credit */}
          <div style={{ textAlign: "center", marginTop: 8, color: "rgba(255,255,255,0.2)", fontSize: 9, letterSpacing: 1 }}>
            PHOTOS VIA UNSPLASH
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper components for Google Maps and Booking.com logos/links
function GoogleMapsLogo({ opt }: { opt: TravelOption }) {
  const query = encodeURIComponent(`${opt.title} ${opt.location.address || ""}`);
  // If opt.link is already a Google Maps link, use it. Otherwise construct search URL.
  const isMapsLink = opt.link && (opt.link.includes("google.com/maps") || opt.link.includes("maps.google.com") || opt.link.includes("maps.app.goo.gl"));
  const mapsUrl = isMapsLink ? opt.link : `https://www.google.com/maps/search/?api=1&query=${query}`;

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "3px",
        borderRadius: "4px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        cursor: "pointer",
        transition: "transform 0.2s, box-shadow 0.2s",
        boxShadow: "var(--shadow-sm)",
        flexShrink: 0,
      }}
      title="View on Google Maps"
      onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.15)"; e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
    >
      <svg viewBox="0 0 24 24" width="13" height="13" style={{ display: "block" }}>
        <path d="M12 2C7.58 2 4 5.58 4 10c0 5.25 8 12 8 12s8-6.75 8-12c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" fill="#4285F4" />
        <path d="M12 2C7.58 2 4 5.58 4 10c0 1 .19 1.95.53 2.82L12 4.12V2z" fill="#EA4335" />
        <path d="M12 22s8-6.75 8-12c0-1-.19-1.95-.53-2.82L12 19.88V22z" fill="#34A853" />
        <path d="M12 13c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" fill="#FBBC05" />
      </svg>
    </a>
  );
}

function BookingLogo({ opt }: { opt: TravelOption }) {
  const query = encodeURIComponent(opt.title);
  const bookingUrl = opt.bookingUrl || `https://www.booking.com/searchresults.html?ss=${query}`;

  return (
    <a
      href={bookingUrl}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "3px",
        borderRadius: "4px",
        background: "#003580",
        border: "1px solid #00224f",
        cursor: "pointer",
        transition: "transform 0.2s, box-shadow 0.2s",
        boxShadow: "var(--shadow-sm)",
        flexShrink: 0,
      }}
      title="Book on Booking.com"
      onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.15)"; e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
    >
      <svg viewBox="0 0 24 24" width="13" height="13" style={{ display: "block" }}>
        <rect width="24" height="24" rx="4" fill="#003580" />
        <text x="5" y="18" fill="#ffffff" fontSize="16" fontWeight="bold" fontFamily="system-ui, sans-serif">B</text>
      </svg>
    </a>
  );
}

function LocationLogos({ opt, category }: { opt: TravelOption; category: string }) {
  const hasMap = category !== "TRANSPORT" && category !== "LOGISTICS";
  const isHotel = category === "STAYS";

  if (!hasMap) return null;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginLeft: 6, verticalAlign: "middle", flexShrink: 0 }}>
      <GoogleMapsLogo opt={opt} />
      {isHotel && <BookingLogo opt={opt} />}
    </div>
  );
}

// ── Option card ───────────────────────────────────────────────────────────────

function OptionCard({ opt, category, selected, onSelect }: { opt: TravelOption; category: string; selected: boolean; onSelect: () => void }) {
  const [open, setOpen] = useState(false);
  const tier = TIER_META[opt.tier] ?? { label: opt.tier, color: "var(--ink-soft)", soft: "var(--bg-soft)" };

  return (
    <div
      style={{
        border: `1.5px solid ${selected ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 11, overflow: "hidden",
        background: selected ? "var(--accent-soft)" : "var(--surface)",
        marginTop: 8,
      }}
    >
      <div
        className={selected ? undefined : "option-row"}
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(!open); } }}
        style={{
          width: "100%", padding: "11px 14px",
          display: "flex", justifyContent: "space-between",
          alignItems: "center", gap: 10, textAlign: "left",
          cursor: "pointer", userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: 11, fontWeight: 700, padding: "3px 10px",
              borderRadius: 999, color: tier.color, background: tier.soft,
              flexShrink: 0, whiteSpace: "nowrap", letterSpacing: 0.2,
            }}
          >
            {tier.label}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0, overflow: "hidden" }}>
            <a
              href={opt.link ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(opt.title + " " + opt.location.address)}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                fontWeight: selected ? 650 : 500, fontSize: 14, color: "var(--ink)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {opt.title} <span style={{ color: "var(--teal)", fontSize: 12 }}>↗</span>
            </a>
            <LocationLogos opt={opt} category={category} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ color: "var(--ink-soft)", fontSize: 13.5, fontWeight: 600 }}>
            {fmtMoney(opt.price)}
          </span>
          {!selected && (
            <button className="select-btn" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
              Select
            </button>
          )}
          {selected && (
            <span style={{
              fontSize: 12, color: "#fff", fontWeight: 700, background: "var(--accent)",
              padding: "4px 12px", borderRadius: 999, whiteSpace: "nowrap",
            }}>
              ✓ Chosen
            </span>
          )}
          <span style={{ color: "var(--muted)", fontSize: 10 }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <div style={{ padding: "2px 14px 14px", display: "flex", flexDirection: "column", gap: 7, borderTop: "1px dashed var(--border)" }}>
          <p style={{ fontSize: 13.5, color: "var(--ink-soft)", paddingTop: 10 }}>{opt.description}</p>
          {opt.reasoning && (
            <p style={{
              fontSize: 13, color: "var(--teal)", background: "var(--teal-soft)",
              padding: "8px 12px", borderRadius: 8, lineHeight: 1.5,
            }}>
              💡 {opt.reasoning}
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "var(--muted)" }}>
            {opt.location.address && <span>📍 {opt.location.address}</span>}
            {opt.openingHours && <span>🕐 {opt.openingHours}</span>}
            {opt.phoneNumber && <span>📞 {opt.phoneNumber}</span>}
          </div>

          {(opt.accessNotes || category === "ACTIVITIES" || category === "LOGISTICS") && (
            <div style={{
              display: "flex", gap: 8, alignItems: "flex-start",
              fontSize: 12.5, color: "var(--ink)",
              background: "var(--cat-transport-soft)",
              border: "1px solid var(--cat-transport-soft)",
              borderRadius: 8, padding: "8px 12px",
            }}>
              <span style={{ flexShrink: 0 }}>🚶</span>
              <span style={{ minWidth: 0 }}>
                <strong style={{ color: "var(--cat-transport)" }}>Getting there:&nbsp;</strong>
                {opt.accessNotes || "Walk-in — accessible on foot from your previous stop."}
              </span>
            </div>
          )}

          {(["DINING", "ACTIVITIES", "STAYS", "LOGISTICS"].includes(category) ||
            opt.bookingRequired || opt.bookingUrl || opt.priceDetail || opt.bookingAdvice) && (
            <div style={{
              border: "1px solid var(--border)", borderRadius: 8,
              padding: "10px 12px", background: "var(--bg-soft)",
              display: "flex", flexDirection: "column", gap: 6,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "var(--ink-soft)" }}>
                  🎟 Booking & tickets
                </span>
                {opt.bookingUrl && (
                  <a
                    href={opt.bookingUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: 12.5, fontWeight: 700, color: "#fff",
                      background: "var(--teal)", padding: "5px 14px",
                      borderRadius: 999, whiteSpace: "nowrap", textDecoration: "none",
                    }}
                  >
                    {bookingActionLabel(category)} →
                  </a>
                )}
              </div>

              {!opt.bookingUrl && (opt.bookingRequired || opt.price.amount > 0) && opt.phoneNumber && (
                <span style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 600 }}>
                  📞 Booking required — call{" "}
                  <a href={`tel:${opt.phoneNumber.replace(/[\s/-]+/g, "")}`} style={{ fontWeight: 700 }}>
                    {opt.phoneNumber}
                  </a>
                </span>
              )}
              {!opt.bookingUrl && (opt.bookingRequired || opt.price.amount > 0) && !opt.phoneNumber && (
                <span style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 600 }}>
                  🎟 Ticket required — buy on site or via the link above
                </span>
              )}
              {isFreeWalkIn(opt) && (
                <span style={{ fontSize: 12.5, color: "var(--cat-activities)", fontWeight: 600 }}>
                  ✓ Free — no booking or tickets needed, just walk in
                </span>
              )}

              {opt.priceDetail && (
                <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>💶 {opt.priceDetail}</span>
              )}
              {opt.bookingAdvice && (
                <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>ℹ️ {opt.bookingAdvice}</span>
              )}
            </div>
          )}

          {opt.link && (
            <div style={{ marginTop: 2 }}>
              <a href={opt.link} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600 }}>
                {linkActionLabel(opt)} →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Timeline block ────────────────────────────────────────────────────────────

function TimelineBlock({ block, isLast, onSwap, flash = false }: {
  block: Block;
  isLast: boolean;
  onSwap: (blockId: string, optionId: string) => void;
  flash?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const selected = block.options.find((o) => o.id === block.selectedOptionId) ?? block.options[0];
  const cat = catMeta(block.category);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "52px 44px 1fr", alignItems: "stretch" }}>
      {/* Time */}
      <div style={{ paddingTop: 16, textAlign: "right", paddingRight: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-soft)", fontVariantNumeric: "tabular-nums" }}>
          {block.scheduledTime}
        </span>
      </div>

      {/* Node + connector */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%", background: cat.soft,
          border: `2px solid ${cat.color}`, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 15, flexShrink: 0, marginTop: 8,
          boxShadow: "var(--shadow-sm)", zIndex: 1,
        }}>
          {cat.icon}
        </div>
        {!isLast && <div style={{ width: 2, flex: 1, background: "var(--border)", marginTop: 4, marginBottom: -8 }} />}
      </div>

      {/* Card */}
      <div className={`card${flash ? " flash-updated" : ""}`} style={{ marginBottom: 14, overflow: "hidden" }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            width: "100%", padding: "13px 16px", background: "transparent", border: "none",
            display: "flex", alignItems: "center", gap: 12, textAlign: "left",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <span style={{
                fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                color: cat.color,
              }}>
                {cat.label}
              </span>
            </div>
            <div style={{ fontWeight: 650, fontSize: 15, color: "var(--ink)", lineHeight: 1.35, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span>{block.label ?? selected?.title ?? block.category}</span>
              {!block.label && selected && (
                <LocationLogos opt={selected} category={block.category} />
              )}
            </div>
            {selected && block.label && (
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.title}</span>
                <LocationLogos opt={selected} category={block.category} />
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            {selected && selected.price.amount > 0 && (
              <span style={{
                fontSize: 13, fontWeight: 700, color: "var(--ink-soft)",
                background: "var(--bg-soft)", padding: "4px 11px", borderRadius: 999,
              }}>
                {fmtMoney(selected.price)}
              </span>
            )}
            <span style={{
              fontSize: 11, color: "var(--muted)", transform: expanded ? "rotate(180deg)" : "none",
              transition: "transform 0.18s ease",
            }}>
              ▼
            </span>
          </div>
        </button>

        {expanded && (
          <div style={{ padding: "0 16px 14px" }}>
            <p style={{ fontSize: 11.5, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, margin: "4px 0 2px" }}>
              {block.options.length} swappable options
            </p>
            {block.options.map((opt) => (
              <OptionCard key={opt.id} opt={opt} category={block.category} selected={opt.id === block.selectedOptionId} onSelect={() => onSwap(block.blockId, opt.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Day view ──────────────────────────────────────────────────────────────────

function DayView({ day, onSwap, flashIds }: {
  day: DayPlan;
  onSwap: (blockId: string, optionId: string) => void;
  flashIds?: ReadonlySet<string>;
}) {
  const dayTotal = day.blocks.reduce((sum, b) => {
    const sel = b.options.find((o) => o.id === b.selectedOptionId) ?? b.options[0];
    return sum + (sel?.price.amount ?? 0);
  }, 0);
  const currency = day.blocks[0]?.options[0]?.price.currency ?? "EUR";

  return (
    <div style={{ animation: "fadeUp 0.35s ease" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h3 style={{ fontSize: 26, fontWeight: 700, color: "var(--navy)" }}>
            {day.title}
          </h3>
          <span style={{
            fontSize: 13, fontWeight: 700, color: "var(--ink-soft)",
            background: "var(--surface)", border: "1px solid var(--border)",
            padding: "5px 14px", borderRadius: 999, whiteSpace: "nowrap",
          }}>
            Day total ≈ {currency} {Math.round(dayTotal).toLocaleString()}
          </span>
        </div>
        <p style={{ color: "var(--ink-soft)", fontSize: 14.5, marginTop: 4 }}>
          {fmtDate(day.date, { weekday: "long", day: "numeric", month: "long" })}
          {day.theme ? ` · ${day.theme}` : ""}
        </p>
        {day.dailyTips.length > 0 && (
          <div style={{
            marginTop: 14, padding: "12px 16px",
            background: "#fbf6e9", border: "1px solid #efe3bd",
            borderRadius: 10, fontSize: 13.5, color: "#7a6420", lineHeight: 1.6,
          }}>
            <strong style={{ letterSpacing: 0.5 }}>✦ Tips for today:</strong> {day.dailyTips.join(" · ")}
          </div>
        )}
      </div>

      <div>
        {day.blocks.map((b, i) => (
          <TimelineBlock key={b.blockId} block={b} isLast={i === day.blocks.length - 1} onSwap={onSwap} flash={flashIds?.has(b.blockId) ?? false} />
        ))}
      </div>
    </div>
  );
}

// ── Itinerary screen (PR#10 hero + progressive rendering) ────────────────────

const HERO_PHOTOS: Record<string, string> = {
  forest:    "photo-1448375240586-882707db888b",
  nature:    "photo-1476514525535-07fb3b4ae5f1",
  mountain:  "photo-1464822759023-fed622ff2c3b",
  spa:       "photo-1571019613454-1cb2f99b2d8b",
  beach:     "photo-1506929562872-bb421503ef21",
  city:      "photo-1477959858617-67f85cf4f1df",
  paris:     "photo-1499856871958-5b9627545d1a",
  rome:      "photo-1552832230-c0197dd311b5",
  japan:     "photo-1543158181-e6f9f6712055",
  venice:    "photo-1523906834658-6e24ef2386f9",
  greece:    "photo-1513581166391-887a96ddeafd",
  food:      "photo-1414235077428-338989a2e8c0",
  dining:    "photo-1414235077428-338989a2e8c0",
  desert:    "photo-1509316785289-025f5b846b35",
  road:      "photo-1469854523086-cc02fe5d8800",
  adventure: "photo-1530789253388-582c481c54b0",
  culture:   "photo-1558618666-fcd25c85cd64",
  museum:    "photo-1558618666-fcd25c85cd64",
  default0:  "photo-1469854523086-cc02fe5d8800",
  default1:  "photo-1488646953014-85cb44e25828",
  default2:  "photo-1476514525535-07fb3b4ae5f1",
  default3:  "photo-1530789253388-582c481c54b0",
  default4:  "photo-1513581166391-887a96ddeafd",
};

function dayPhotoUrl(day: DayPlan, planTitle: string, dayIndex: number): string {
  // Extract keywords from the plan title to get the destination (e.g. "Achensee Trip" -> "achensee,trip")
  const keywords = planTitle.replace(/[^a-zA-Z0-9]+/g, ",").toLowerCase();

  // Use loremflickr to dynamically fetch an image matching the destination keywords.
  // We include 'landscape' to ensure the photo is scenic.
  return `https://loremflickr.com/1920/1080/landscape,${keywords}/all?lock=${dayIndex}`;
}

function ItineraryScreen({ plan, generating, reflowing, flashIds, onSwap, onReset }: {
  plan: TripPlan;
  generating: boolean;
  reflowing: boolean;
  flashIds: ReadonlySet<string>;
  onSwap: (blockId: string, optionId: string) => void;
  onReset: () => void;
}) {
  const [activeDay, setActiveDay] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [heroBg, setHeroBg] = useState<{ cur: string; prev: string | null; fading: boolean }>({
    cur: dayPhotoUrl(plan.days[0]!, plan.title, 0),
    prev: null, fading: false,
  });

  const totalDays = totalDaysOf(plan);
  const pendingDays = generating ? Math.max(0, totalDays - plan.days.length) : 0;

  function switchDay(i: number) {
    if (i === activeDay) return;
    const newUrl = dayPhotoUrl(plan.days[i]!, plan.title, i);
    setHeroBg((b) => ({ cur: b.cur, prev: b.cur, fading: true }));
    setTimeout(() => {
      setHeroBg({ cur: newUrl, prev: null, fading: false });
    }, 500);
    setActiveDay(i);
  }

  async function handleExportPdf() {
    if (exporting) return;
    setExporting(true);
    try { await downloadItineraryPdf(plan); }
    catch (err) { console.error("PDF export failed:", err); alert("Could not generate the PDF."); }
    finally { setExporting(false); }
  }

  const firstDate = plan.days[0]?.date;
  const lastDate = plan.days[plan.days.length - 1]?.date;
  const currentDay = plan.days[activeDay]!;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <style>{`
        @keyframes heroFadeIn { from { opacity:0; } to { opacity:1; } }
        .day-pill { transition: all 0.2s ease; cursor: pointer; border: none; font-family: inherit; }
        .day-pill:hover { transform: translateY(-2px); }
        .hero-chip { backdrop-filter: blur(8px); transition: background 0.2s; }
        .hero-chip:hover { background: rgba(255,255,255,0.22) !important; }
      `}</style>

      {/* ── HERO ── */}
      <div style={{ position: "relative", height: "62vh", minHeight: 420, overflow: "hidden" }}>
        {heroBg.prev && (
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `url(${heroBg.prev})`,
            backgroundSize: "cover", backgroundPosition: "center",
            opacity: heroBg.fading ? 0 : 1,
            transition: "opacity 0.5s ease",
          }} />
        )}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${heroBg.cur})`,
          backgroundSize: "cover", backgroundPosition: "center",
          opacity: heroBg.fading ? 0 : 1,
          transition: "opacity 0.5s ease",
          animation: "heroFadeIn 0.8s ease",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(8,20,48,0.52) 0%, rgba(8,20,48,0.15) 40%, rgba(8,20,48,0.72) 100%)",
        }} />

        <div style={{ position: "relative", zIndex: 2, height: "100%", display: "flex", flexDirection: "column", maxWidth: 900, margin: "0 auto", padding: "0 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 24 }}>
            <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>
              ✈ TravelMate
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleExportPdf} disabled={exporting || generating} className="hero-chip" style={{
                padding: "8px 18px",
                background: exporting || generating ? "rgba(255,255,255,0.18)" : "var(--accent)",
                border: "none", borderRadius: 999, color: "#fff", fontSize: 12.5, fontWeight: 700,
                boxShadow: generating ? "none" : "0 4px 20px rgba(0,0,0,0.3)",
                cursor: exporting ? "wait" : generating ? "default" : "pointer",
              }}>
                {exporting ? "Preparing…" : "⬇ Export PDF"}
              </button>
              <button onClick={onReset} className="hero-chip" style={{
                padding: "8px 18px", background: "rgba(255,255,255,0.13)",
                border: "1px solid rgba(255,255,255,0.3)", borderRadius: 999,
                color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              }}>
                + New trip
              </button>
            </div>
          </div>

          <div style={{ flex: 1 }} />

          <div key={activeDay} style={{ animation: "heroFadeIn 0.4s ease", marginBottom: 12 }}>
            <span style={{
              display: "inline-block",
              background: "var(--accent)", color: "#fff",
              fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase",
              padding: "5px 14px", borderRadius: 999,
              boxShadow: "0 4px 16px rgba(226,96,58,0.5)",
            }}>
              Day {currentDay.dayNumber} of {totalDays}
            </span>
          </div>

          <h1 key={`title-${activeDay}`} style={{
            fontFamily: "var(--font-display-stack)",
            fontSize: "clamp(28px, 4vw, 52px)",
            fontWeight: 900, color: "#fff", lineHeight: 1.1,
            marginBottom: 10, letterSpacing: -0.5, maxWidth: 700,
            textShadow: "0 2px 20px rgba(0,0,0,0.4)",
            animation: "heroFadeIn 0.5s ease",
          }}>
            {currentDay.title.replace(/^Day \d+:\s*/, "")}
          </h1>

          {currentDay.theme && (
            <p key={`theme-${activeDay}`} style={{
              color: "rgba(255,255,255,0.75)", fontSize: 15, lineHeight: 1.6,
              maxWidth: 580, marginBottom: 20,
              animation: "heroFadeIn 0.6s ease",
            }}>
              {currentDay.theme}
            </p>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingBottom: 28 }}>
            {[
              `📅 ${firstDate ? fmtDate(firstDate, { day: "numeric", month: "short" }) : ""} – ${lastDate ? fmtDate(lastDate, { day: "numeric", month: "short", year: "numeric" }) : ""}`,
              `⏱ ${plan.duration}`,
              `💰 ${fmtMoney(plan.totalEstimatedCost)} total`,
            ].map((chip) => (
              <span key={chip} className="hero-chip" style={{
                background: "rgba(255,255,255,0.13)", border: "1px solid rgba(255,255,255,0.22)",
                padding: "6px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, color: "#fff",
              }}>
                {chip}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── DAY TABS — float over hero bottom edge ── */}
      <div style={{ maxWidth: 900, margin: "-28px auto 0", padding: "0 28px", position: "relative", zIndex: 10 }}>
        <div style={{
          display: "flex", gap: 6, padding: "8px", overflowX: "auto",
          background: "rgba(255,255,255,0.96)", backdropFilter: "blur(16px)",
          borderRadius: 18, boxShadow: "0 16px 48px rgba(8,20,48,0.18), 0 1px 0 rgba(255,255,255,0.9)",
          border: "1px solid rgba(255,255,255,0.8)",
        }}>
          {plan.days.map((day, i) => {
            const active = activeDay === i;
            return (
              <button key={i} onClick={() => switchDay(i)} className="day-pill" style={{
                flex: 1, minWidth: 80, padding: "10px 14px", textAlign: "center",
                borderRadius: 12,
                background: active ? "var(--navy)" : "transparent",
                color: active ? "#fff" : "var(--ink-soft)",
                boxShadow: active ? "0 4px 14px rgba(8,20,48,0.25)" : "none",
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" }}>Day {day.dayNumber}</div>
                <div style={{ fontSize: 10.5, opacity: active ? 0.75 : 0.6, whiteSpace: "nowrap", marginTop: 1 }}>
                  {fmtDate(day.date, { weekday: "short", day: "numeric", month: "short" })}
                </div>
              </button>
            );
          })}
          {/* Ghost tabs for days still being written */}
          {Array.from({ length: pendingDays }, (_, i) => (
            <div
              key={`pending-${i}`}
              className="day-pill"
              style={{ flex: 1, minWidth: 80, padding: "10px 14px", textAlign: "center", borderRadius: 12, opacity: 0.45, cursor: "default", background: "transparent", color: "var(--ink-soft)" }}
              title="Still being written…"
            >
              <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" }}>Day {plan.days.length + i + 1}</div>
              <div style={{ fontSize: 10.5, opacity: 0.6, whiteSpace: "nowrap", marginTop: 1 }}>writing…</div>
            </div>
          ))}
        </div>
        {generating && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginTop: 10,
            fontSize: 13, color: "var(--ink-soft)", paddingLeft: 4,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%", background: "var(--accent)",
              animation: "pulseDot 1.3s ease infinite", flexShrink: 0,
            }} />
            {pendingDays > 0
              ? `Writing day ${plan.days.length + 1} of ${totalDays} — you can already review and swap the days above.`
              : "Finishing touches — validating the full itinerary…"}
          </div>
        )}
        {!generating && reflowing && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginTop: 10,
            fontSize: 13, color: "var(--ink-soft)", paddingLeft: 4,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%", background: "var(--teal)",
              animation: "pulseDot 1.3s ease infinite", flexShrink: 0,
            }} />
            Re-flowing dependent cards — transport routes and references are being updated…
          </div>
        )}
      </div>

      {/* ── DAY CONTENT ── */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 28px 60px" }}>
        <div key={`header-${activeDay}`} style={{ animation: "fadeUp 0.35s ease", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 6 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "var(--navy)", fontFamily: "var(--font-display-stack)" }}>
              {currentDay.title}
            </h2>
            <span style={{
              fontSize: 13, fontWeight: 700, color: "var(--ink-soft)",
              background: "var(--surface)", border: "1px solid var(--border)",
              padding: "6px 16px", borderRadius: 999,
            }}>
              Day total ≈ {currentDay.blocks[0]?.options[0]?.price.currency ?? "EUR"}{" "}
              {Math.round(currentDay.blocks.reduce((s, b) => {
                const sel = b.options.find((o) => o.id === b.selectedOptionId) ?? b.options[0];
                return s + (sel?.price.amount ?? 0);
              }, 0)).toLocaleString()}
            </span>
          </div>
          <p style={{ color: "var(--ink-soft)", fontSize: 14.5 }}>
            {fmtDate(currentDay.date, { weekday: "long", day: "numeric", month: "long" })}
          </p>
          {currentDay.dailyTips.length > 0 && (
            <div style={{
              marginTop: 14, padding: "13px 18px",
              background: "#fbf6e9", border: "1px solid #efe3bd", borderRadius: 12,
              fontSize: 13.5, color: "#7a6420", lineHeight: 1.6,
            }}>
              <strong>✦ Tips for today:</strong> {currentDay.dailyTips.join(" · ")}
            </div>
          )}
        </div>

        <div key={`timeline-${activeDay}`} style={{ animation: "fadeUp 0.4s ease" }}>
          {currentDay.blocks.map((b, i) => (
            <TimelineBlock key={b.blockId} block={b} isLast={i === currentDay.blocks.length - 1} onSwap={onSwap} flash={flashIds.has(b.blockId)} />
          ))}
        </div>

        {/* Export CTA */}
        <div style={{
          marginTop: 48, padding: "22px 26px",
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap",
          boxShadow: "var(--shadow-md)",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--navy)" }}>Happy with your choices?</div>
            <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: 2 }}>
              Export a PDF with your selected options — take it offline, print it, share it.
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={handleExportPdf}
            disabled={exporting || generating}
            title={generating ? "Available when all days are ready" : undefined}
            style={{ padding: "12px 26px", fontSize: 14.5, flexShrink: 0 }}
          >
            {exporting ? "Preparing…" : generating ? `Writing day ${plan.days.length + 1}…` : "⬇ Download PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Error screen ──────────────────────────────────────────────────────────────

function ErrorScreen({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <div style={{ maxWidth: 560, margin: "90px auto", padding: "0 24px", textAlign: "center" }}>
      <p style={{ fontSize: 52, marginBottom: 18 }}>🧳</p>
      <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 10, color: "var(--navy)" }}>We hit some turbulence</h2>
      <p style={{
        color: "var(--ink-soft)", fontSize: 13, marginBottom: 28, fontFamily: "monospace",
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
        padding: "12px 16px", textAlign: "left", overflowWrap: "break-word",
      }}>
        {message}
      </p>
      <button className="btn-primary" onClick={onReset} style={{ padding: "12px 32px", fontSize: 15 }}>
        Try again
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Screen =
  | { kind: "input" }
  | { kind: "thinking"; thoughts: string[]; destination: string; tripType: string }
  | { kind: "itinerary"; plan: TripPlan; generating: boolean }
  | { kind: "error"; message: string };

export default function Home() {
  const [screen, setScreen] = useState<Screen>({ kind: "input" });
  const [reflowing, setReflowing] = useState(false);
  const [flashIds, setFlashIds] = useState<ReadonlySet<string>>(new Set());
  const esRef = useRef<EventSource | null>(null);
  const swappedDaysRef = useRef<Set<number>>(new Set());
  const pendingEditsRef = useRef<Array<{ blockId: string; optionId: string }>>([]);
  const editChainRef = useRef<Promise<void>>(Promise.resolve());
  const inFlightEditsRef = useRef(0);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function reset() {
    esRef.current?.close();
    esRef.current = null;
    swappedDaysRef.current = new Set();
    pendingEditsRef.current = [];
    inFlightEditsRef.current = 0;
    setReflowing(false);
    setFlashIds(new Set());
    setScreen({ kind: "input" });
  }

  function flashChanged(ids: string[]) {
    setFlashIds(new Set(ids));
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashIds(new Set()), 3000);
  }

  function postEdit(planId: string, blockId: string, optionId: string) {
    inFlightEditsRef.current++;
    setReflowing(true);
    editChainRef.current = editChainRef.current.then(async () => {
      try {
        const res = await fetch(`${API}/modify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId, blockId, newOptionId: optionId }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { plan, changedBlockIds } = await res.json() as { plan: TripPlan; changedBlockIds: string[] };
        inFlightEditsRef.current--;
        if (inFlightEditsRef.current === 0) {
          setScreen((s) => (s.kind === "itinerary" ? { ...s, plan } : s));
          flashChanged(changedBlockIds.filter((id) => id !== blockId));
          setReflowing(false);
        }
      } catch (err) {
        inFlightEditsRef.current--;
        if (inFlightEditsRef.current === 0) setReflowing(false);
        console.warn("Re-flow failed — keeping the local swap only:", err);
      }
    });
  }

  function handleSwap(blockId: string, optionId: string) {
    setScreen((s) => {
      if (s.kind !== "itinerary") return s;
      const day = s.plan.days.find((d) => d.blocks.some((b) => b.blockId === blockId));
      if (day) swappedDaysRef.current.add(day.dayNumber);
      if (s.generating) {
        pendingEditsRef.current.push({ blockId, optionId });
      } else {
        postEdit(s.plan.planId, blockId, optionId);
      }
      return { ...s, plan: swapOption(s.plan, blockId, optionId) };
    });
  }

  async function handleSubmit(brief: string) {
    const destination = extractDestination(brief);
    const tripType = extractTripType(brief);
    swappedDaysRef.current = new Set();
    setScreen({ kind: "thinking", thoughts: ["Connecting…"], destination, tripType });

    let planId: string;
    try {
      const res = await fetch(`${API}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: extractDestination(brief),
          travelerDescription: brief,
          tripType: extractTripType(brief),
          budgetTier: extractBudget(brief),
          freeformText: brief,
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        throw new Error(err.message ?? `HTTP ${res.status}`);
      }
      ({ planId } = await res.json() as { planId: string });
    } catch (err) {
      setScreen({ kind: "error", message: String(err) });
      return;
    }

    const es = new EventSource(`${API}/plan/${planId}/stream`);
    esRef.current = es;

    es.addEventListener("thought", (e) => {
      const { text } = JSON.parse((e as MessageEvent).data) as { text: string };
      setScreen((s) => s.kind === "thinking" ? { kind: "thinking", thoughts: [...s.thoughts, text], destination: s.destination, tripType: s.tripType } : s);
    });

    es.addEventListener("partial", (e) => {
      const incoming = JSON.parse((e as MessageEvent).data) as TripPlan;
      setScreen((s) => ({
        kind: "itinerary",
        plan: mergePlans(s.kind === "itinerary" ? s.plan : null, incoming, swappedDaysRef.current),
        generating: true,
      }));
    });

    es.addEventListener("ready", (e) => {
      const incoming = JSON.parse((e as MessageEvent).data) as TripPlan;
      es.close();
      setScreen((s) => ({
        kind: "itinerary",
        plan: mergePlans(s.kind === "itinerary" ? s.plan : null, incoming, swappedDaysRef.current),
        generating: false,
      }));
      const pending = pendingEditsRef.current;
      pendingEditsRef.current = [];
      for (const edit of pending) {
        postEdit(incoming.planId, edit.blockId, edit.optionId);
      }
    });

    es.addEventListener("error", (e) => {
      const raw = (e as MessageEvent).data;
      if (!raw) return;
      const { message } = JSON.parse(raw) as { message?: string };
      es.close();
      setScreen({ kind: "error", message: message ?? "Server error" });
    });

    es.onerror = () => {
      es.close();
      setScreen((s) =>
        s.kind === "thinking"
          ? { kind: "error", message: "Could not reach the API server. Make sure it is running on port 8080." }
          : s
      );
    };
  }

  return (
    <>
      {screen.kind === "input" && <InputScreen onSubmit={handleSubmit} />}
      {screen.kind === "thinking" && <ThinkingScreen thoughts={screen.thoughts} destination={screen.destination} tripType={screen.tripType} />}
      {screen.kind === "itinerary" && (
        <ItineraryScreen
          plan={screen.plan}
          generating={screen.generating}
          reflowing={reflowing}
          flashIds={flashIds}
          onSwap={handleSwap}
          onReset={reset}
        />
      )}
      {screen.kind === "error" && <ErrorScreen message={screen.message} onReset={reset} />}
    </>
  );
}

// ── Lightweight local extractors for the initial POST ─────────────────────────

function extractDestination(text: string): string {
  let t = text.trim();

  // 0. Strip filler phrases that wrap around the real destination
  //    e.g. "the area of Bavarian Alps" → "Bavarian Alps"
  t = t.replace(/\b(?:the\s+)?(?:area|region|city|town|island|coast|countryside|part)\s+of\s+/gi, "");
  t = t.replace(/\b(?:somewhere|someplace)\s+(?:in|near|around)\s+/gi, "");

  // 1. After preposition: "in Paris", "to Bangkok", "visiting the Bavarian Alps"
  //    Now also strips leading articles ("the") from the match
  const prepMatch = t.match(/(?:in|to|visit(?:ing)?|through|around|explore|exploring)\s+(?:the\s+)?([A-Z][a-zA-ZÀ-ÿ\s-]{1,32}?)(?:\s+(?:in|for|on|this|next|last|during|from|with|and|we|I)|[,.]|$)/i);
  if (prepMatch?.[1]) {
    const cleaned = prepMatch[1].replace(/\s+$/, "");
    if (cleaned.length > 1) return toTitleCase(cleaned);
  }

  // 2. Explicit "trip to X" / "holiday in X"
  const tripMatch = t.match(/(?:trip|travel|holiday|vacation|weekend|getaway)\s+(?:to|in)\s+(?:the\s+)?([A-Za-zÀ-ÿ\s-]{2,32}?)(?:[,.]|\s+(?:for|in|this|with)|$)/i);
  if (tripMatch?.[1]) return toTitleCase(tripMatch[1].trim());

  // 3. Compound proper nouns: "Black Forest", "Costa Rica", "New Zealand"
  const caps = t.match(/\b([A-Z][a-zA-ZÀ-ÿ]+(?:[\s-][A-Z][a-zA-ZÀ-ÿ]+){0,3})\b/);
  if (caps?.[1]) {
    const skip = new Set(["I", "We", "My", "Our", "The", "A", "An", "And", "But", "Or", "For", "So", "If"]);
    if (!skip.has(caps[1])) return caps[1].trim();
  }

  // 4. Last resort — use a longer phrase if available
  const words = t.split(/\s+/).filter((w) => w.length > 2);
  if (words.length >= 2) return toTitleCase(words.slice(0, 3).join(" "));
  if (words.length === 1) return toTitleCase(words[0]!);
  return "Your Destination";
}

function toTitleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractTripType(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("culinary") || lower.includes("food") || lower.includes("dining")) return "culinary";
  if (lower.includes("motorhome") || lower.includes("road trip") || lower.includes("camper")) return "road trip";
  if (lower.includes("backpack") || lower.includes("budget")) return "backpacking";
  if (lower.includes("casino") || lower.includes("nightlife") || lower.includes("club")) return "nightlife";
  if (lower.includes("beach") || lower.includes("surf")) return "beach";
  if (lower.includes("hik") || lower.includes("trek") || lower.includes("outdoor")) return "adventure";
  if (lower.includes("business")) return "business";
  if (lower.includes("honeymoon") || lower.includes("romantic")) return "romantic";
  if (lower.includes("family")) return "family";
  return "city break";
}

function extractBudget(text: string): "ECONOMY" | "SMART" | "LUXURY" {
  const lower = text.toLowerCase();
  if (/\b(luxury|5[- ]star|first.class|michelin|high.end|premium)\b/.test(lower)) return "LUXURY";
  if (/\b(budget|cheap|hostel|backpack|economical|€\d{1,2}\/day|\$\d{1,2}\/day)\b/.test(lower)) return "ECONOMY";
  return "SMART";
}
