"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../../src/hooks/use-auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

interface TripSummary {
  id: string;
  title: string;
  brief: string;
  createdAt: string;
}

export default function TripsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetch(`${API}/auth/trips`, { credentials: "include" })
      .then(r => r.ok ? r.json() as Promise<TripSummary[]> : [])
      .then(setTrips)
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user]);

  if (loading || !user) return null;

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--font-body)",
      padding: "2rem 1rem",
    }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "2rem" }}>
          <Link href="/" style={{ color: "var(--teal)", fontSize: "0.9rem", textDecoration: "none" }}>
            ← Back
          </Link>
        </div>

        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 700,
          color: "var(--navy)", marginBottom: "0.5rem",
        }}>
          My Trips
        </h1>
        <p style={{ color: "var(--ink-soft)", fontSize: "0.95rem", marginBottom: "2rem" }}>
          Your previously generated itineraries.
        </p>

        {fetching && (
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Loading trips...</p>
        )}

        {!fetching && trips.length === 0 && (
          <div style={{
            padding: "3rem 2rem", textAlign: "center",
            background: "var(--surface)", borderRadius: 14,
            border: "1px solid var(--border)",
          }}>
            <p style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🗺</p>
            <p style={{ fontWeight: 600, color: "var(--navy)", fontSize: "1.1rem", marginBottom: "0.5rem" }}>
              No trips yet
            </p>
            <p style={{ color: "var(--ink-soft)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
              Plan your first adventure and it will show up here.
            </p>
            <Link href="/" style={{
              padding: "0.65rem 1.5rem", borderRadius: 10, fontSize: "0.9rem",
              fontWeight: 600, background: "var(--accent)", color: "#fff",
              textDecoration: "none",
            }}>
              Plan a trip
            </Link>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {trips.map(trip => (
            <Link key={trip.id} href={`/trip/${trip.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{
                padding: "1.25rem 1.5rem",
                background: "var(--surface)", borderRadius: 14,
                border: "1px solid var(--border)",
                transition: "box-shadow 0.15s ease, border-color 0.15s ease",
                cursor: "pointer",
              }}
                onMouseOver={e => {
                  e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
                  e.currentTarget.style.borderColor = "var(--teal)";
                }}
                onMouseOut={e => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>
                      {trip.title}
                    </h3>
                    <p style={{
                      fontSize: "0.85rem", color: "var(--ink-soft)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 400,
                    }}>
                      {trip.brief}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {new Date(trip.createdAt).toLocaleDateString(undefined, {
                        year: "numeric", month: "short", day: "numeric",
                      })}
                    </span>
                    <span style={{ color: "var(--teal)", fontSize: "0.9rem" }}>→</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
