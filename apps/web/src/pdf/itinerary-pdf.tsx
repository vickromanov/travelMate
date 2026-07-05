/**
 * The itinerary as a print-quality PDF — only the CHOSEN option of every block.
 * Built with @react-pdf/renderer: real vector text (selectable, searchable),
 * clickable links, proper pagination. Rendered lazily on the client when the
 * traveler clicks "Download PDF" (and in Node by the smoke test).
 */
import * as React from "react";
import { Document, Page, Text, View, Link, StyleSheet } from "@react-pdf/renderer";
import type { TripPlan, DayPlan, Block, Money } from "../lib/plan-types";
import { selectedOption } from "../lib/plan-types";

/* ── Brand palette (mirrors globals.css tokens — PDFs can't read CSS vars) ── */

const INK = "#1c2433";
const INK_SOFT = "#465063";
const MUTED = "#8a92a3";
const NAVY = "#21375f";
const TEAL = "#0e7c7b";
const CORAL = "#e2603a";
const PAPER = "#faf8f4";
const BORDER = "#e3ddd0";
const TIP_BG = "#fbf6e9";
const TIP_INK = "#7a6420";

const CAT: Record<string, { label: string; color: string; soft: string }> = {
  STAYS:      { label: "STAY", color: "#6d5bd0", soft: "#efecfb" },
  DINING:     { label: "DINE", color: "#d97706", soft: "#fdf3e3" },
  TRANSPORT:  { label: "MOVE", color: "#0284c7", soft: "#e5f3fb" },
  ACTIVITIES: { label: "DO",   color: "#0e9f6e", soft: "#e5f7f0" },
  LOGISTICS:  { label: "INFO", color: "#64748b", soft: "#eef1f5" },
};
const cat = (c: string) => CAT[c] ?? CAT.LOGISTICS!;

function fmtMoney(m: Money): string {
  return m.amount > 0 ? `${m.currency} ${m.amount.toLocaleString("en-GB")}` : "Free";
}

function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", opts);
  } catch {
    return iso;
  }
}

const s = StyleSheet.create({
  page: {
    backgroundColor: PAPER,
    paddingTop: 42,
    paddingBottom: 56,
    paddingHorizontal: 46,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: INK,
  },

  /* cover header */
  brand: { fontSize: 8, letterSpacing: 2, color: TEAL, marginBottom: 10, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 26, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 8, lineHeight: 1.15 },
  description: { fontSize: 10.5, color: INK_SOFT, lineHeight: 1.5, marginBottom: 14, maxWidth: 420 },
  chipsRow: { flexDirection: "row", gap: 6, marginBottom: 6 },
  chip: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 10, backgroundColor: "#ffffff",
    paddingVertical: 4, paddingHorizontal: 10, fontSize: 8.5, color: INK_SOFT,
    fontFamily: "Helvetica-Bold",
  },
  coverRule: { height: 3, backgroundColor: CORAL, width: 64, marginBottom: 18, borderRadius: 2 },

  /* day section */
  daySection: { marginTop: 22 },
  dayHeader: {
    backgroundColor: NAVY, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4,
  },
  dayTitle: { color: "#ffffff", fontSize: 12.5, fontFamily: "Helvetica-Bold" },
  dayMeta: { color: "#c6d2e8", fontSize: 8.5, marginTop: 2 },
  dayTotal: { color: "#ffffff", fontSize: 9.5, fontFamily: "Helvetica-Bold" },

  tips: {
    backgroundColor: TIP_BG, borderRadius: 6, padding: 8, marginBottom: 6,
    fontSize: 8.5, color: TIP_INK, lineHeight: 1.45,
  },

  /* block row */
  row: {
    flexDirection: "row", alignItems: "flex-start",
    borderBottomWidth: 1, borderBottomColor: BORDER,
    paddingVertical: 7, gap: 8,
  },
  time: { width: 34, fontSize: 9.5, fontFamily: "Helvetica-Bold", color: INK_SOFT, paddingTop: 1 },
  catChip: {
    width: 34, borderRadius: 4, paddingVertical: 2.5, alignItems: "center",
    fontSize: 6.5, fontFamily: "Helvetica-Bold", marginTop: 1,
  },
  main: { flex: 1 },
  blockLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: INK, lineHeight: 1.3 },
  venue: { fontSize: 9.5, color: TEAL, marginTop: 1.5, textDecoration: "none" },
  detail: { fontSize: 8, color: MUTED, marginTop: 1.5, lineHeight: 1.4 },
  price: { width: 62, textAlign: "right", fontSize: 9.5, fontFamily: "Helvetica-Bold", color: INK_SOFT, paddingTop: 1 },

  /* footer */
  footer: {
    position: "absolute", bottom: 24, left: 46, right: 46,
    flexDirection: "row", justifyContent: "space-between",
    fontSize: 7.5, color: MUTED,
    borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 6,
  },
});

function BlockRow({ block }: { block: Block }) {
  const sel = selectedOption(block);
  const c = cat(block.category);
  if (!sel) return null;

  const details = [
    // For stays the description carries the room configuration and its math
    // ("2 rooms × EUR 250 = EUR 500/night") — essential info, always shown.
    block.category === "STAYS" ? sel.description : undefined,
    sel.location.address,
    sel.openingHours ? `Open ${sel.openingHours}` : undefined,
    sel.phoneNumber,
  ].filter(Boolean).join("  ·  ");

  return (
    <View style={s.row} wrap={false}>
      <Text style={s.time}>{block.scheduledTime}</Text>
      <View style={[s.catChip, { backgroundColor: c.soft }]}>
        <Text style={{ color: c.color }}>{c.label}</Text>
      </View>
      <View style={s.main}>
        <Text style={s.blockLabel}>{block.label ?? sel.title}</Text>
        {/* Venue line only when it adds information beyond the label */}
        {sel.title !== (block.label ?? sel.title) ? (
          sel.link
            ? <Link src={sel.link} style={s.venue}>{sel.title}</Link>
            : <Text style={s.venue}>{sel.title}</Text>
        ) : sel.link ? (
          <Link src={sel.link} style={s.venue}>Open in Maps / website</Link>
        ) : null}
        {details ? <Text style={s.detail}>{details}</Text> : null}
      </View>
      <Text style={s.price}>{fmtMoney(sel.price)}</Text>
    </View>
  );
}

function DaySection({ day, breakBefore }: { day: DayPlan; breakBefore: boolean }) {
  const total = day.blocks.reduce((sum, b) => sum + (selectedOption(b)?.price.amount ?? 0), 0);
  const currency = day.blocks[0]?.options[0]?.price.currency ?? "EUR";

  return (
    <View style={s.daySection} break={breakBefore}>
      <View style={s.dayHeader} wrap={false}>
        <View>
          <Text style={s.dayTitle}>Day {day.dayNumber} — {day.title}</Text>
          <Text style={s.dayMeta}>
            {fmtDate(day.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {day.theme ? `  ·  ${day.theme}` : ""}
          </Text>
        </View>
        <Text style={s.dayTotal}>~ {currency} {Math.round(total).toLocaleString("en-GB")}</Text>
      </View>

      {day.dailyTips.length > 0 && (
        <View style={s.tips} wrap={false}>
          <Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Tips for today:  </Text>
            {day.dailyTips.join("  ·  ")}
          </Text>
        </View>
      )}

      {day.blocks.map((b) => <BlockRow key={b.blockId} block={b} />)}
    </View>
  );
}

export function ItineraryPdfDocument({ plan }: { plan: TripPlan }) {
  const firstDate = plan.days[0]?.date;
  const lastDate = plan.days[plan.days.length - 1]?.date;

  return (
    <Document
      title={plan.title}
      author="TravelMate"
      subject="Travel itinerary"
      creator="TravelMate — zero-thinking itineraries"
    >
      <Page size="A4" style={s.page}>
        {/* Cover header */}
        <Text style={s.brand}>TRAVELMATE ITINERARY</Text>
        <Text style={s.title}>{plan.title}</Text>
        <View style={s.coverRule} />
        <Text style={s.description}>{plan.description}</Text>
        <View style={s.chipsRow}>
          <Text style={s.chip}>
            {firstDate ? fmtDate(firstDate, { day: "numeric", month: "short" }) : ""}
            {" – "}
            {lastDate ? fmtDate(lastDate, { day: "numeric", month: "short", year: "numeric" }) : ""}
          </Text>
          <Text style={s.chip}>{plan.duration}</Text>
          <Text style={s.chip}>Total ~ {fmtMoney(plan.totalEstimatedCost)}</Text>
        </View>

        {/* Days — flow after the cover; each row is unbreakable */}
        {plan.days.map((day, i) => (
          <DaySection key={day.dayNumber} day={day} breakBefore={i > 0} />
        ))}

        {/* Footer on every page */}
        <View style={s.footer} fixed>
          <Text>{plan.title} — generated by TravelMate</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
