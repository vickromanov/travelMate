"use client";
import { useState, useRef, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

// ── Types (mirror contracts without importing the package on the client) ──────

interface Money { amount: number; currency: string; }
interface GeoLocation { lat: number; lng: number; address: string; }
interface TravelOption {
  id: string; tier: string; title: string; description: string;
  reasoning: string; price: Money; location: GeoLocation;
  openingHours?: string; phoneNumber?: string;
  bookingUrl?: string; scheduledTime?: string; durationMinutes?: number;
}
interface Block {
  blockId: string; category: string; scheduledTime: string;
  label?: string; selectedOptionId: string;
  options: TravelOption[];
}
interface DayPlan {
  dayNumber: number; date: string; title: string; theme: string;
  dailyTips: string[]; blocks: Block[];
}
interface TripPlan {
  planId: string; title: string; description: string;
  totalEstimatedCost: Money; duration: string; days: DayPlan[];
}

// ── Category metadata ─────────────────────────────────────────────────────────

const CAT_ICON: Record<string, string> = {
  DINING: "🍽️", STAYS: "🏨", TRANSPORT: "🚆", ACTIVITIES: "🎯", LOGISTICS: "📋",
};
const TIER_COLOR: Record<string, string> = {
  ANCHOR: "#6c63ff",
  "SMART-VALUE": "#4ade80",
  PREMIUM: "#f59e0b",
  INDEPENDENT: "#60a5fa",
};

const TIER_LABEL: Record<string, string> = {
  ANCHOR: "⚓ Anchor",
  "SMART-VALUE": "💡 Smart Value",
  PREMIUM: "👑 Premium",
  INDEPENDENT: "🧭 Independent",
};

// ── Input form ────────────────────────────────────────────────────────────────

const EXAMPLES = [
  "Two of us, romantic culinary week in Thailand in November, love street food but want one fancy dinner",
  "Family of 4 — motorhome road trip through the Black Forest in August, kids 8 and 11",
  "Solo backpacker, 5 days Lisbon, budget €50/day, want to see fado and surf",
  "Friends trip, 4 guys, Las Vegas long weekend, shows, clubs, some hiking on Sunday",
];

function InputScreen({ onSubmit }: { onSubmit: (brief: string) => void }) {
  const [text, setText] = useState("");

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "64px 24px" }}>
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.1, marginBottom: 12 }}>
          TravelMate
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 17 }}>
          Describe your trip. Get a complete, zero-thinking itinerary.
        </p>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Who's going, where, when, what kind of trip — describe it in your own words…"
        style={{
          width: "100%", minHeight: 120, padding: 16,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", color: "var(--text)",
          resize: "vertical", outline: "none", lineHeight: 1.6, fontSize: 15,
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) {
            onSubmit(text.trim());
          }
        }}
      />

      <button
        onClick={() => text.trim() && onSubmit(text.trim())}
        disabled={!text.trim()}
        style={{
          marginTop: 12, padding: "12px 28px",
          background: text.trim() ? "var(--accent)" : "var(--surface2)",
          color: text.trim() ? "#fff" : "var(--text-muted)",
          border: "none", borderRadius: "var(--radius)",
          fontWeight: 600, fontSize: 15, transition: "all 0.15s",
        }}
      >
        Plan my trip →
      </button>

      <div style={{ marginTop: 32 }}>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>Try an example:</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setText(ex)}
              style={{
                textAlign: "left", padding: "10px 14px",
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 8, color: "var(--text-muted)", fontSize: 13,
                cursor: "pointer", transition: "border-color 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Thinking screen ───────────────────────────────────────────────────────────

function ThinkingScreen({ thoughts }: { thoughts: string[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [thoughts]);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "64px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "pulse 1.4s infinite" }} />
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>Planning your trip…</h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {thoughts.map((t, i) => (
          <div
            key={i}
            style={{
              padding: "10px 14px", background: "var(--surface)",
              border: "1px solid var(--border)", borderRadius: 8,
              fontSize: 14, color: i === thoughts.length - 1 ? "var(--text)" : "var(--text-muted)",
              animation: "fadeIn 0.3s ease",
            }}
          >
            {t}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }
      `}</style>
    </div>
  );
}

// ── Itinerary view ────────────────────────────────────────────────────────────

function OptionCard({ opt, selected }: { opt: TravelOption; selected: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 8, overflow: "hidden",
        background: selected ? "rgba(108,99,255,0.05)" : "var(--surface2)",
        marginTop: 6,
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", padding: "10px 12px", background: "transparent",
          border: "none", display: "flex", justifyContent: "space-between",
          alignItems: "center", gap: 8, textAlign: "left", color: "var(--text)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: 11, fontWeight: 700, padding: "2px 8px",
              borderRadius: 4, color: "#fff",
              background: TIER_COLOR[opt.tier] ?? "var(--accent)",
              flexShrink: 0, whiteSpace: "nowrap",
            }}
          >
            {TIER_LABEL[opt.tier] ?? opt.tier}
          </span>
          <span style={{ fontWeight: selected ? 600 : 400, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {opt.title}
          </span>
        </div>
        <span style={{ color: "var(--text-muted)", flexShrink: 0, fontSize: 13 }}>
          {opt.price.amount > 0 ? `${opt.price.currency} ${opt.price.amount}` : "Free"} {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{opt.description}</p>
          <p style={{ fontSize: 13, color: "var(--accent2)", fontStyle: "italic" }}>
            💡 {opt.reasoning}
          </p>
          {opt.location.address && (
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>📍 {opt.location.address}</p>
          )}
          {opt.openingHours && (
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>🕐 {opt.openingHours}</p>
          )}
          {opt.phoneNumber && (
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>📞 {opt.phoneNumber}</p>
          )}
          {opt.bookingUrl && (
            <a href={opt.bookingUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
              Book →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function BlockCard({ block }: { block: Block }) {
  const [expanded, setExpanded] = useState(false);
  const selected = block.options.find((o) => o.id === block.selectedOptionId) ?? block.options[0];

  return (
    <div
      style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", overflow: "hidden",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%", padding: "12px 16px", background: "transparent", border: "none",
          display: "flex", alignItems: "center", gap: 12, textAlign: "left", color: "var(--text)",
        }}
      >
        <span style={{ fontSize: 20, flexShrink: 0 }}>{CAT_ICON[block.category] ?? "📌"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              {block.scheduledTime} — {block.label ?? selected?.title ?? block.category}
            </span>
          </div>
          {selected && !expanded && (
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
              {selected.title}
              {selected.price.amount > 0 && ` · ${selected.price.currency} ${selected.price.amount}`}
            </div>
          )}
        </div>
        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div style={{ padding: "0 16px 16px" }}>
          {block.options.map((opt) => (
            <OptionCard key={opt.id} opt={opt} selected={opt.id === block.selectedOptionId} />
          ))}
        </div>
      )}
    </div>
  );
}

function DayView({ day }: { day: DayPlan }) {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700 }}>
          Day {day.dayNumber} — {day.title}
        </h3>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{day.theme} · {day.date}</p>
        {day.dailyTips.length > 0 && (
          <div style={{ marginTop: 10, padding: "10px 14px", background: "var(--surface2)", borderRadius: 8, fontSize: 13, color: "var(--text-muted)" }}>
            💡 {day.dailyTips.join(" · ")}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {day.blocks.map((b) => (
          <BlockCard key={b.blockId} block={b} />
        ))}
      </div>
    </div>
  );
}

function ItineraryScreen({ plan, onReset }: { plan: TripPlan; onReset: () => void }) {
  const [activeDay, setActiveDay] = useState(0);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>{plan.title}</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 15, maxWidth: 580 }}>{plan.description}</p>
          <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 14 }}>
            <span>📅 {plan.duration}</span>
            <span>💰 {plan.totalEstimatedCost.currency} {plan.totalEstimatedCost.amount.toLocaleString()}</span>
            <span>📍 {plan.days.length > 0 ? plan.days[0]?.date : ""} – {plan.days[plan.days.length - 1]?.date ?? ""}</span>
          </div>
        </div>
        <button
          onClick={onReset}
          style={{
            padding: "8px 16px", background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 8, color: "var(--text-muted)", fontSize: 13, flexShrink: 0,
          }}
        >
          New trip
        </button>
      </div>

      {/* Day tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
        {plan.days.map((day, i) => (
          <button
            key={i}
            onClick={() => setActiveDay(i)}
            style={{
              padding: "8px 16px", flexShrink: 0,
              background: activeDay === i ? "var(--accent)" : "var(--surface)",
              color: activeDay === i ? "#fff" : "var(--text-muted)",
              border: `1px solid ${activeDay === i ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 8, fontWeight: activeDay === i ? 600 : 400, fontSize: 13,
            }}
          >
            Day {day.dayNumber}
          </button>
        ))}
      </div>

      {/* Active day */}
      {plan.days[activeDay] && <DayView day={plan.days[activeDay]!} />}
    </div>
  );
}

// ── Error screen ──────────────────────────────────────────────────────────────

function ErrorScreen({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <div style={{ maxWidth: 560, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
      <p style={{ fontSize: 48, marginBottom: 16 }}>⚠️</p>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h2>
      <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24, fontFamily: "monospace" }}>{message}</p>
      <button
        onClick={onReset}
        style={{
          padding: "10px 24px", background: "var(--accent)", color: "#fff",
          border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Screen = { kind: "input" } | { kind: "thinking"; thoughts: string[] } | { kind: "itinerary"; plan: TripPlan } | { kind: "error"; message: string };

export default function Home() {
  const [screen, setScreen] = useState<Screen>({ kind: "input" });
  const esRef = useRef<EventSource | null>(null);

  function reset() {
    esRef.current?.close();
    esRef.current = null;
    setScreen({ kind: "input" });
  }

  async function handleSubmit(brief: string) {
    setScreen({ kind: "thinking", thoughts: ["Connecting…"] });

    // POST /plan
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

    // SSE
    const es = new EventSource(`${API}/plan/${planId}/stream`);
    esRef.current = es;

    es.addEventListener("thought", (e) => {
      const { text } = JSON.parse((e as MessageEvent).data) as { text: string };
      setScreen((s) => s.kind === "thinking" ? { kind: "thinking", thoughts: [...s.thoughts, text] } : s);
    });

    es.addEventListener("ready", (e) => {
      const plan = JSON.parse((e as MessageEvent).data) as TripPlan;
      es.close();
      setScreen({ kind: "itinerary", plan });
    });

    es.addEventListener("error", (e) => {
      // Only handle server-sent `event: error` messages (have .data).
      // Native connection errors have no .data — let onerror handle those.
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
      {screen.kind === "thinking" && <ThinkingScreen thoughts={screen.thoughts} />}
      {screen.kind === "itinerary" && <ItineraryScreen plan={screen.plan} onReset={reset} />}
      {screen.kind === "error" && <ErrorScreen message={screen.message} onReset={reset} />}
    </>
  );
}

// ── Lightweight local extractors for the initial POST ─────────────────────────
// These give the intent LLM something to start with.
// The intent stage refines everything from the free-form text anyway.

function extractDestination(text: string): string {
  // Very rough: last multi-word proper-noun-ish phrase after "in", "to", "visiting"
  const match = text.match(/(?:in|to|visit(?:ing)?|through|around)\s+([A-Z][a-zA-Z\s]{2,24}?)(?:\s+in|\s+for|\s+on|\s*[,.]|$)/);
  if (match?.[1]) return match[1].trim();
  // fallback: first capitalized word sequence
  const caps = text.match(/\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\b/);
  return caps?.[1] ?? "Unknown";
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
