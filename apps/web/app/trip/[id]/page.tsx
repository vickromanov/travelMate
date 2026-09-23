"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../../../src/hooks/use-auth";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import type { TripPlan, DayPlan, Block, Money } from "../../../src/lib/plan-types";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

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

const CAT_META: Record<string, { icon: string; label: string; color: string }> = {
  STAYS:      { icon: "🏨", label: "Stay", color: "var(--cat-stays)" },
  DINING:     { icon: "🍽️", label: "Dining", color: "var(--cat-dining)" },
  TRANSPORT:  { icon: "🚆", label: "Transport", color: "var(--cat-transport)" },
  ACTIVITIES: { icon: "🎯", label: "Activity", color: "var(--cat-activities)" },
  LOGISTICS:  { icon: "📋", label: "Logistics", color: "var(--cat-logistics)" },
};

function BlockCard({ block }: { block: Block }) {
  const selected = block.options.find(o => o.id === block.selectedOptionId) ?? block.options[0];
  if (!selected) return null;
  const cat = CAT_META[block.category] ?? CAT_META.LOGISTICS!;

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "48px 1fr", gap: 12,
      padding: "12px 0",
    }}>
      <div style={{ textAlign: "center", paddingTop: 2 }}>
        <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {block.scheduledTime}
        </span>
        <div style={{ fontSize: "1.1rem", marginTop: 4 }}>{cat.icon}</div>
      </div>
      <div style={{
        padding: "12px 16px", borderRadius: 10,
        background: "var(--surface)", border: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{
            fontSize: "0.7rem", fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
            color: cat.color,
          }}>
            {cat.label}
          </span>
          {selected.price.amount > 0 && (
            <span style={{
              fontSize: "0.75rem", fontWeight: 600, color: "var(--ink-soft)",
              background: "var(--bg-soft)", padding: "2px 8px", borderRadius: 999,
              marginLeft: "auto",
            }}>
              {fmtMoney(selected.price)}
            </span>
          )}
        </div>
        <div style={{ fontWeight: 650, fontSize: "0.95rem", color: "var(--ink)" }}>
          {block.label ?? selected.title}
        </div>
        {block.label && (
          <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: 2 }}>
            {selected.title}
          </div>
        )}
        <p style={{ fontSize: "0.83rem", color: "var(--ink-soft)", marginTop: 6, lineHeight: 1.5 }}>
          {selected.description}
        </p>
        {selected.location.address && (
          <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: 4 }}>
            📍 {selected.location.address}
          </div>
        )}
      </div>
    </div>
  );
}

function DaySection({ day }: { day: DayPlan }) {
  const dayTotal = day.blocks.reduce((sum, b) => {
    const sel = b.options.find(o => o.id === b.selectedOptionId) ?? b.options[0];
    return sum + (sel?.price.amount ?? 0);
  }, 0);
  const currency = day.blocks[0]?.options[0]?.price.currency ?? "EUR";

  return (
    <div style={{ marginBottom: "2rem" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        flexWrap: "wrap", gap: 8, marginBottom: 8,
      }}>
        <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--navy)" }}>
          {day.title}
        </h3>
        <span style={{
          fontSize: "0.8rem", fontWeight: 600, color: "var(--ink-soft)",
          background: "var(--bg-soft)", padding: "4px 12px", borderRadius: 999,
        }}>
          ≈ {currency} {Math.round(dayTotal).toLocaleString()}
        </span>
      </div>
      <p style={{ color: "var(--ink-soft)", fontSize: "0.88rem", marginBottom: 12 }}>
        {fmtDate(day.date, { weekday: "long", day: "numeric", month: "long" })}
        {day.theme ? ` · ${day.theme}` : ""}
      </p>
      {day.dailyTips.length > 0 && (
        <div style={{
          padding: "10px 14px", marginBottom: 12,
          background: "#fbf6e9", border: "1px solid #efe3bd", borderRadius: 8,
          fontSize: "0.83rem", color: "#7a6420", lineHeight: 1.6,
        }}>
          <strong>✦ Tips:</strong> {day.dailyTips.join(" · ")}
        </div>
      )}
      {day.blocks.map(b => <BlockCard key={b.blockId} block={b} />)}
    </div>
  );
}

export default function TripDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;

  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [tripTitle, setTripTitle] = useState("");
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !tripId) return;
    fetch(`${API}/auth/trips/${tripId}`, { credentials: "include" })
      .then(async r => {
        if (!r.ok) throw new Error("Trip not found");
        return r.json() as Promise<{ id: string; title: string; data: TripPlan }>;
      })
      .then(trip => {
        setTripTitle(trip.title);
        setPlan(trip.data);
      })
      .catch(err => setError(String(err)))
      .finally(() => setFetching(false));
  }, [user, tripId]);

  if (loading || !user) return null;

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--font-body)",
      padding: "2rem 1rem",
    }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "2rem" }}>
          <Link href="/trips" style={{ color: "var(--teal)", fontSize: "0.9rem", textDecoration: "none" }}>
            ← My Trips
          </Link>
        </div>

        {fetching && (
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Loading trip...</p>
        )}

        {error && (
          <div style={{
            padding: "2rem", textAlign: "center",
            background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)",
          }}>
            <p style={{ color: "#e25c3e", fontWeight: 600 }}>{error}</p>
            <Link href="/trips" style={{
              display: "inline-block", marginTop: "1rem",
              padding: "0.5rem 1.5rem", borderRadius: 8,
              background: "var(--accent)", color: "#fff",
              textDecoration: "none", fontWeight: 600, fontSize: "0.9rem",
            }}>
              Back to trips
            </Link>
          </div>
        )}

        {plan && (
          <>
            <div style={{ marginBottom: "2rem" }}>
              <h1 style={{
                fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: 700,
                color: "var(--navy)", marginBottom: "0.5rem",
              }}>
                {plan.title ?? tripTitle}
              </h1>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: "1rem" }}>
                {plan.duration && (
                  <span style={{
                    fontSize: "0.8rem", fontWeight: 600, padding: "4px 12px",
                    borderRadius: 999, background: "var(--surface)", border: "1px solid var(--border)",
                    color: "var(--ink-soft)",
                  }}>
                    ⏱ {plan.duration}
                  </span>
                )}
                {plan.totalEstimatedCost && (
                  <span style={{
                    fontSize: "0.8rem", fontWeight: 600, padding: "4px 12px",
                    borderRadius: 999, background: "var(--surface)", border: "1px solid var(--border)",
                    color: "var(--ink-soft)",
                  }}>
                    💰 {fmtMoney(plan.totalEstimatedCost)} total
                  </span>
                )}
              </div>
            </div>

            {plan.days.map(day => <DaySection key={day.dayNumber} day={day} />)}
          </>
        )}
      </div>
    </div>
  );
}
