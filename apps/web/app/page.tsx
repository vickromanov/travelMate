"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { UserMenu } from "../src/components/user-menu";
import { useAuth } from "../src/hooks/use-auth";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

// ── Input form ──────────────────────────────────────────────────────────────

const EXAMPLES = [
  "Two of us, romantic culinary week in Thailand in November, love street food but want one fancy dinner",
  "Family of 4 — motorhome road trip through the Black Forest in August, kids 8 and 11",
  "Solo backpacker, 5 days Lisbon, budget €50/day, want to see fado and surf",
  "Friends trip, 4 guys, Las Vegas long weekend, shows, clubs, some hiking on Sunday",
];

function InputScreen({ onSubmit, submitting }: { onSubmit: (brief: string) => void; submitting: boolean }) {
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
          disabled={submitting}
          style={{
            width: "100%", minHeight: 120, padding: "16px 18px",
            background: "transparent", border: "none",
            resize: "vertical", outline: "none", lineHeight: 1.6, fontSize: 15.5,
            opacity: submitting ? 0.6 : 1,
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim() && !submitting) {
              onSubmit(text.trim());
            }
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 8px 8px" }}>
          <button
            className="btn-primary"
            onClick={() => text.trim() && !submitting && onSubmit(text.trim())}
            disabled={!text.trim() || submitting}
            style={{ padding: "12px 30px", fontSize: 15 }}
          >
            {submitting ? "Preparing…" : "Plan my trip →"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 36, animation: "fadeUp 0.5s ease 0.16s backwards" }}>
        <p style={{ color: "var(--muted)", fontSize: 12.5, marginBottom: 12, textAlign: "center", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>
          Or try one of these
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {EXAMPLES.map((ex) => (
            <button key={ex} className="example-chip" onClick={() => useTemplate(ex)} disabled={submitting} style={{ padding: "11px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <span>{ex}</span>
              <span style={{ color: "var(--teal)", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0, fontSize: 12.5 }}>Use ↑</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Lightweight local extractors for the initial POST ───────────────────────

function extractDestination(text: string): string {
  let t = text.trim();
  t = t.replace(/\b(?:the\s+)?(?:area|region|city|town|island|coast|countryside|part)\s+of\s+/gi, "");
  t = t.replace(/\b(?:somewhere|someplace)\s+(?:in|near|around)\s+/gi, "");

  const prepMatch = t.match(/(?:in|to|visit(?:ing)?|through|around|explore|exploring)\s+(?:the\s+)?([A-Z][a-zA-ZÀ-ÿ\s-]{1,32}?)(?:\s+(?:in|for|on|this|next|last|during|from|with|and|we|I)|[,.]|$)/i);
  if (prepMatch?.[1]) {
    const cleaned = prepMatch[1].replace(/\s+$/, "");
    if (cleaned.length > 1) return toTitleCase(cleaned);
  }

  const tripMatch = t.match(/(?:trip|travel|holiday|vacation|weekend|getaway)\s+(?:to|in)\s+(?:the\s+)?([A-Za-zÀ-ÿ\s-]{2,32}?)(?:[,.]|\s+(?:for|in|this|with)|$)/i);
  if (tripMatch?.[1]) return toTitleCase(tripMatch[1].trim());

  const caps = t.match(/\b([A-Z][a-zA-ZÀ-ÿ]+(?:[\s-][A-Z][a-zA-ZÀ-ÿ]+){0,3})\b/);
  if (caps?.[1]) {
    const skip = new Set(["I", "We", "My", "Our", "The", "A", "An", "And", "But", "Or", "For", "So", "If"]);
    if (!skip.has(caps[1])) return caps[1].trim();
  }

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

// ── Main page ───────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const { preferences } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(brief: string) {
    setSubmitting(true);
    setError(null);

    const destination = extractDestination(brief);
    const tripType = extractTripType(brief);

    try {
      const res = await fetch(`${API}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          destination,
          travelerDescription: brief,
          tripType,
          budgetTier: preferences?.defaultBudgetTier ?? extractBudget(brief),
          freeformText: brief,
          ...(preferences ? { userPreferences: preferences } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        throw new Error(err.message ?? `HTTP ${res.status}`);
      }
      const { planId } = await res.json() as { planId: string };

      try {
        sessionStorage.setItem(`tm:meta:${planId}`, JSON.stringify({ destination, tripType }));
      } catch {}

      router.push(`/plan/${planId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <>
      <div style={{ position: "fixed", top: 16, right: 20, zIndex: 200 }}>
        <UserMenu />
      </div>
      <InputScreen onSubmit={handleSubmit} submitting={submitting} />
      {error && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          maxWidth: 480, padding: "14px 20px", background: "#fff0ee",
          border: "1px solid #f5c6be", borderRadius: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          fontSize: 13.5, color: "#b33a2a", zIndex: 100, animation: "fadeUp 0.3s ease",
        }}>
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} style={{
            marginLeft: 12, background: "none", border: "none", color: "#b33a2a",
            fontSize: 16, cursor: "pointer", fontWeight: 700,
          }}>×</button>
        </div>
      )}
    </>
  );
}
