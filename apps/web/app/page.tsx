"use client";
import { useState, useRef, useEffect } from "react";
import type { Money, TravelOption, Block, DayPlan, TripPlan } from "../src/lib/plan-types";
import { linkActionLabel } from "../src/lib/plan-types";
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
  // "~" — prices are party-total ESTIMATES until live fetchers land (P1:
  // an estimate must never masquerade as a confirmed price)
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

      <div className="card" style={{ padding: 8, boxShadow: "var(--shadow-lg)", animation: "fadeUp 0.5s ease 0.08s backwards" }}>
        <textarea
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
            <button key={ex} className="example-chip" onClick={() => setText(ex)} style={{ padding: "11px 16px" }}>
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
    <div style={{ maxWidth: 620, margin: "0 auto", padding: "72px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ display: "inline-flex", gap: 6, marginBottom: 18 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{
              width: 9, height: 9, borderRadius: "50%", background: "var(--accent)",
              animation: `pulseDot 1.3s ease ${i * 0.18}s infinite`,
            }} />
          ))}
        </div>
        <h2 style={{ fontSize: 30, fontWeight: 700, color: "var(--navy)" }}>Crafting your journey…</h2>
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>
          Real dates, real venues, real logistics — this takes a moment.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {thoughts.map((t, i) => {
          const latest = i === thoughts.length - 1;
          return (
            <div
              key={i}
              style={{
                padding: "11px 16px",
                background: latest ? "var(--surface)" : "transparent",
                border: `1px solid ${latest ? "var(--border)" : "transparent"}`,
                borderRadius: 10,
                boxShadow: latest ? "var(--shadow-sm)" : "none",
                fontSize: 14,
                color: latest ? "var(--ink)" : "var(--muted)",
                animation: "fadeUp 0.3s ease",
                display: "flex", gap: 10, alignItems: "baseline",
              }}
            >
              <span style={{ color: latest ? "var(--accent)" : "var(--border-strong)", flexShrink: 0 }}>
                {latest ? "●" : "✓"}
              </span>
              {t}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── Option card ───────────────────────────────────────────────────────────────

function OptionCard({ opt, selected, onSelect }: { opt: TravelOption; selected: boolean; onSelect: () => void }) {
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
          <div style={{ display: "flex", gap: 14, marginTop: 2 }}>
            {opt.link && (
              <a href={opt.link} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600 }}>
                {linkActionLabel(opt)} →
              </a>
            )}
            {opt.bookingUrl && opt.bookingUrl !== opt.link && (
              <a href={opt.bookingUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600 }}>
                Book now →
              </a>
            )}
          </div>
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
            <div style={{ fontWeight: 650, fontSize: 15, color: "var(--ink)", lineHeight: 1.35 }}>
              {block.label ?? selected?.title ?? block.category}
            </div>
            {selected && (
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selected.title}
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
              <OptionCard key={opt.id} opt={opt} selected={opt.id === block.selectedOptionId} onSelect={() => onSwap(block.blockId, opt.id)} />
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

// ── Itinerary screen ──────────────────────────────────────────────────────────

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

  const totalDays = totalDaysOf(plan);
  const pendingDays = generating ? Math.max(0, totalDays - plan.days.length) : 0;
  const handleSwap = onSwap;

  async function handleExportPdf() {
    if (exporting) return;
    setExporting(true);
    try {
      await downloadItineraryPdf(plan);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("Could not generate the PDF — please try again.");
    } finally {
      setExporting(false);
    }
  }

  const firstDate = plan.days[0]?.date;
  const lastDate = plan.days[plan.days.length - 1]?.date;

  return (
    <div>
      {/* Hero */}
      <div style={{
        background: "linear-gradient(130deg, var(--navy) 0%, #2c5364 55%, var(--teal) 100%)",
        padding: "52px 24px 84px",
        position: "relative",
      }}>
        <div style={{ maxWidth: 860, margin: "0 auto", color: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ fontSize: 12, letterSpacing: 2.5, textTransform: "uppercase", fontWeight: 700, opacity: 0.75 }}>
              ✈ TravelMate itinerary
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                onClick={handleExportPdf}
                disabled={exporting || generating}
                title={generating ? "Available when all days are ready" : "Export the itinerary with your chosen options as a PDF"}
                style={{
                  padding: "8px 18px",
                  background: exporting || generating ? "rgba(255,255,255,0.25)" : "var(--accent)",
                  border: "none", borderRadius: 999,
                  color: "#fff", fontSize: 13, fontWeight: 700,
                  boxShadow: generating ? "none" : "0 4px 14px rgba(0,0,0,0.25)",
                  cursor: exporting ? "wait" : generating ? "default" : "pointer",
                }}
              >
                {exporting ? "Preparing…" : "⬇ Download PDF"}
              </button>
              <button
                onClick={onReset}
                style={{
                  padding: "8px 18px", background: "rgba(255,255,255,0.14)",
                  border: "1px solid rgba(255,255,255,0.35)", borderRadius: 999,
                  color: "#fff", fontSize: 13, fontWeight: 600,
                  backdropFilter: "blur(4px)",
                }}
              >
                + New trip
              </button>
            </div>
          </div>

          <h1 style={{ fontSize: 42, fontWeight: 900, lineHeight: 1.12, margin: "18px 0 10px", maxWidth: 640 }}>
            {plan.title}
          </h1>
          <p style={{ fontSize: 15.5, opacity: 0.85, maxWidth: 600, lineHeight: 1.65 }}>
            {plan.description}
          </p>

          <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
            {[
              `📅 ${firstDate ? fmtDate(firstDate, { day: "numeric", month: "short" }) : ""} – ${lastDate ? fmtDate(lastDate, { day: "numeric", month: "short", year: "numeric" }) : ""}`,
              `⏱ ${plan.duration}`,
              `💰 ${fmtMoney(plan.totalEstimatedCost)} total`,
            ].map((chip) => (
              <span key={chip} style={{
                background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.28)",
                padding: "7px 16px", borderRadius: 999, fontSize: 13.5, fontWeight: 600,
                backdropFilter: "blur(4px)",
              }}>
                {chip}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Day tabs — pulled up over the hero edge */}
      <div style={{ maxWidth: 860, margin: "-40px auto 0", padding: "0 24px", position: "relative" }}>
        <div className="card" style={{
          display: "flex", gap: 6, padding: 8, overflowX: "auto",
          boxShadow: "var(--shadow-lg)",
        }}>
          {plan.days.map((day, i) => (
            <button
              key={i}
              className={`day-tab${activeDay === i ? " active" : ""}`}
              onClick={() => setActiveDay(i)}
              style={{ padding: "9px 18px", textAlign: "center" }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap" }}>Day {day.dayNumber}</div>
              <div style={{ fontSize: 11, opacity: 0.75, whiteSpace: "nowrap" }}>
                {fmtDate(day.date, { weekday: "short", day: "numeric", month: "short" })}
              </div>
            </button>
          ))}
          {/* Ghost tabs for days still being written */}
          {Array.from({ length: pendingDays }, (_, i) => (
            <div
              key={`pending-${i}`}
              className="day-tab"
              style={{ padding: "9px 18px", textAlign: "center", opacity: 0.45, cursor: "default" }}
              title="Still being written…"
            >
              <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap" }}>Day {plan.days.length + i + 1}</div>
              <div style={{ fontSize: 11, opacity: 0.75, whiteSpace: "nowrap" }}>writing…</div>
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

      {/* Active day timeline */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "34px 24px 40px" }}>
        {plan.days[activeDay] && <DayView day={plan.days[activeDay]!} onSwap={handleSwap} flashIds={flashIds} />}
      </div>

      {/* Export CTA — where the traveler lands after reviewing their choices */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 24px 80px" }}>
        <div className="card" style={{
          padding: "22px 26px", display: "flex", justifyContent: "space-between",
          alignItems: "center", gap: 16, flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--navy)" }}>
              Happy with your choices?
            </div>
            <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: 2 }}>
              Export the itinerary with your selected options — take it offline, print it, share it.
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
  | { kind: "thinking"; thoughts: string[] }
  | { kind: "itinerary"; plan: TripPlan; generating: boolean }
  | { kind: "error"; message: string };

export default function Home() {
  const [screen, setScreen] = useState<Screen>({ kind: "input" });
  const [reflowing, setReflowing] = useState(false);
  const [flashIds, setFlashIds] = useState<ReadonlySet<string>>(new Set());
  const esRef = useRef<EventSource | null>(null);
  // Days the traveler already swapped options on — incoming partial/final
  // updates must never overwrite these (their choices win over regeneration).
  const swappedDaysRef = useRef<Set<number>>(new Set());
  // Swaps made WHILE the plan was still generating — replayed to the server
  // once the final plan is saved, so re-flow can process their dependencies.
  const pendingEditsRef = useRef<Array<{ blockId: string; optionId: string }>>([]);
  // Serialize /modify calls: each edit re-flows against the previous result.
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

  /** Send one edit through the server re-flow engine (serialized). */
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
        // Adopt only the LAST response — intermediate ones lack queued edits
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
        // Plan not saved yet — swap locally now, replay through re-flow later
        pendingEditsRef.current.push({ blockId, optionId });
      } else {
        postEdit(s.plan.planId, blockId, optionId);
      }
      // Optimistic local swap either way — the UI answers instantly
      return { ...s, plan: swapOption(s.plan, blockId, optionId) };
    });
  }

  async function handleSubmit(brief: string) {
    swappedDaysRef.current = new Set();
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

    // Progressive delivery: each completed day arrives as a partial plan —
    // show it immediately so the traveler can review while the rest is written
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
      // Swaps made during generation now replay through the server re-flow
      // engine so their dependent cards get updated too.
      const pending = pendingEditsRef.current;
      pendingEditsRef.current = [];
      for (const edit of pending) {
        postEdit(incoming.planId, edit.blockId, edit.optionId);
      }
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
