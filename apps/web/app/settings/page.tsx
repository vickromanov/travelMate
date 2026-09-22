"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../../src/hooks/use-auth";
import type { UserPreferences } from "../../src/hooks/use-auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

const DIETARY_OPTIONS = [
  "Vegetarian", "Vegan", "Halal", "Kosher",
  "Gluten-free", "Nut allergy", "Lactose intolerant",
];

const INTEREST_OPTIONS = [
  "History", "Food & dining", "Art & museums", "Nature & outdoors",
  "Nightlife", "Shopping", "Architecture", "Sports & adventure",
  "Wellness & spa", "Photography", "Local culture", "Music & festivals",
];

const STYLE_OPTIONS = [
  "Cultural", "Adventure", "Luxury", "Relaxation",
  "Budget", "Romantic", "Family-friendly",
];

const ACCOMMODATION_OPTIONS: Array<{ value: UserPreferences["accommodationStyle"]; label: string }> = [
  { value: "no-preference", label: "No preference" },
  { value: "hotel", label: "Hotel" },
  { value: "boutique", label: "Boutique hotel" },
  { value: "hostel", label: "Hostel" },
  { value: "apartment", label: "Apartment / Airbnb" },
  { value: "resort", label: "Resort" },
];

const PACE_OPTIONS: Array<{ value: UserPreferences["travelPace"]; label: string; desc: string }> = [
  { value: "relaxed", label: "Relaxed", desc: "Fewer activities, more free time" },
  { value: "moderate", label: "Moderate", desc: "Balanced schedule" },
  { value: "packed", label: "Packed", desc: "See as much as possible" },
];

const CURRENCY_OPTIONS = [
  "", "EUR", "USD", "GBP", "JPY", "AUD", "CAD", "CHF", "SEK", "NOK", "DKK",
  "NZD", "SGD", "HKD", "KRW", "THB", "MXN", "BRL", "ZAR", "ILS", "TRY",
];

const DEFAULTS: UserPreferences = {
  dietaryRestrictions: [],
  accessibilityNeeds: "",
  travelPace: "moderate",
  interests: [],
  accommodationStyle: "no-preference",
  travelStyle: [],
  homeCity: "",
  defaultBudgetTier: null,
  preferredCurrency: "",
};

export default function SettingsPage() {
  const { user, loading, preferences, loadPreferences, savePreferences } = useAuth();
  const router = useRouter();
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (preferences) setPrefs(preferences);
  }, [preferences]);

  useEffect(() => {
    if (user && !preferences) loadPreferences().catch(() => {});
  }, [user, preferences, loadPreferences]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      await savePreferences(prefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaveError("Failed to save preferences. Please try again.");
      setTimeout(() => setSaveError(null), 5000);
    } finally {
      setSaving(false);
    }
  }

  function toggleArray(arr: string[], item: string): string[] {
    return arr.includes(item) ? arr.filter(v => v !== item) : [...arr, item];
  }

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
          Travel Preferences
        </h1>
        <p style={{ color: "var(--ink-soft)", fontSize: "0.95rem", marginBottom: "2rem" }}>
          Set your preferences once — every itinerary we generate will be tailored to you.
        </p>

        {/* Travel Pace */}
        <Section title="Travel Pace">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {PACE_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setPrefs(p => ({ ...p, travelPace: opt.value }))}
                style={{
                  ...chipStyle,
                  background: prefs.travelPace === opt.value ? "var(--teal)" : "var(--bg)",
                  color: prefs.travelPace === opt.value ? "#fff" : "var(--ink)",
                  borderColor: prefs.travelPace === opt.value ? "var(--teal)" : "var(--border-strong)",
                }}
              >
                <span style={{ fontWeight: 600 }}>{opt.label}</span>
                <span style={{ fontSize: "0.78rem", opacity: 0.8 }}> — {opt.desc}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* Travel Style */}
        <Section title="Travel Style">
          <ChipGrid items={STYLE_OPTIONS} selected={prefs.travelStyle}
            onToggle={item => setPrefs(p => ({ ...p, travelStyle: toggleArray(p.travelStyle, item) }))} />
        </Section>

        {/* Interests */}
        <Section title="Interests">
          <ChipGrid items={INTEREST_OPTIONS} selected={prefs.interests}
            onToggle={item => setPrefs(p => ({ ...p, interests: toggleArray(p.interests, item) }))} />
        </Section>

        {/* Dietary Restrictions */}
        <Section title="Dietary Restrictions">
          <ChipGrid items={DIETARY_OPTIONS} selected={prefs.dietaryRestrictions}
            onToggle={item => setPrefs(p => ({ ...p, dietaryRestrictions: toggleArray(p.dietaryRestrictions, item) }))} />
        </Section>

        {/* Accessibility */}
        <Section title="Accessibility Needs">
          <input
            type="text" value={prefs.accessibilityNeeds}
            onChange={e => setPrefs(p => ({ ...p, accessibilityNeeds: e.target.value }))}
            placeholder="e.g., wheelchair access, limited mobility, stroller-friendly"
            style={inputStyle}
          />
        </Section>

        {/* Accommodation */}
        <Section title="Accommodation Preference">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {ACCOMMODATION_OPTIONS.map(opt => (
              <button key={opt.value}
                onClick={() => setPrefs(p => ({ ...p, accommodationStyle: opt.value }))}
                style={{
                  ...chipStyle,
                  background: prefs.accommodationStyle === opt.value ? "var(--teal)" : "var(--bg)",
                  color: prefs.accommodationStyle === opt.value ? "#fff" : "var(--ink)",
                  borderColor: prefs.accommodationStyle === opt.value ? "var(--teal)" : "var(--border-strong)",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Defaults */}
        <Section title="Defaults">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>Home city</label>
              <input type="text" value={prefs.homeCity}
                onChange={e => setPrefs(p => ({ ...p, homeCity: e.target.value }))}
                placeholder="e.g., London, UK"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Preferred currency</label>
              <select value={prefs.preferredCurrency}
                onChange={e => setPrefs(p => ({ ...p, preferredCurrency: e.target.value }))}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="">Auto-detect</option>
                {CURRENCY_OPTIONS.filter(Boolean).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={labelStyle}>Default budget tier</label>
            <div style={{ display: "flex", gap: 10 }}>
              {([null, "ECONOMY", "SMART", "LUXURY"] as const).map(tier => (
                <button key={tier ?? "none"}
                  onClick={() => setPrefs(p => ({ ...p, defaultBudgetTier: tier }))}
                  style={{
                    ...chipStyle,
                    background: prefs.defaultBudgetTier === tier ? "var(--teal)" : "var(--bg)",
                    color: prefs.defaultBudgetTier === tier ? "#fff" : "var(--ink)",
                    borderColor: prefs.defaultBudgetTier === tier ? "var(--teal)" : "var(--border-strong)",
                  }}
                >
                  {tier ?? "Auto"}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Save */}
        <div style={{ marginTop: "2rem", display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={handleSave} disabled={saving}
            style={{
              padding: "0.75rem 2.5rem", borderRadius: 10, fontSize: "1rem",
              fontWeight: 700, border: "none", background: "var(--accent)", color: "#fff",
              cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1,
              fontFamily: "inherit",
            }}
          >
            {saving ? "Saving..." : "Save preferences"}
          </button>
          {saved && (
            <span style={{ color: "var(--teal)", fontWeight: 600, fontSize: "0.9rem" }}>
              Saved!
            </span>
          )}
          {saveError && (
            <span style={{ color: "#e25c3e", fontWeight: 600, fontSize: "0.9rem" }}>
              {saveError}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      marginBottom: "1.75rem", padding: "1.25rem 1.5rem",
      background: "var(--surface)", borderRadius: 14,
      border: "1px solid var(--border)",
    }}>
      <h3 style={{
        fontSize: "1rem", fontWeight: 700, color: "var(--navy)",
        marginBottom: "0.75rem", letterSpacing: 0.3,
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function ChipGrid({ items, selected, onToggle }: {
  items: string[]; selected: string[]; onToggle: (item: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {items.map(item => {
        const active = selected.includes(item);
        return (
          <button key={item} onClick={() => onToggle(item)}
            style={{
              ...chipStyle,
              background: active ? "var(--teal)" : "var(--bg)",
              color: active ? "#fff" : "var(--ink)",
              borderColor: active ? "var(--teal)" : "var(--border-strong)",
            }}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}

const chipStyle: React.CSSProperties = {
  padding: "0.5rem 1rem", borderRadius: 999, fontSize: "0.85rem",
  fontWeight: 500, border: "1.5px solid", cursor: "pointer",
  fontFamily: "inherit", transition: "all 0.15s ease",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.7rem 0.85rem", borderRadius: 8,
  border: "1px solid var(--border-strong)", fontSize: "0.95rem",
  outline: "none", fontFamily: "inherit", background: "var(--bg)",
};

const labelStyle: React.CSSProperties = {
  display: "block", marginBottom: "0.35rem",
  fontSize: "0.85rem", fontWeight: 600, color: "var(--ink)",
};
