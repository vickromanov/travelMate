/**
 * Itinerary refinement — existing plan + natural language instruction → modified plan.
 *
 * Two-step process:
 *   1. Analyze: classify the modification (quick LLM call, "qa" tier)
 *   2. Execute: apply changes using the appropriate strategy:
 *      - addDays      → per-day LLM generation (reuses synthesis schema)
 *      - removeDays   → deterministic removal + renumber
 *      - modifyDays   → per-day LLM rewrite
 *      - budgetShift  → deterministic option re-selection
 *      - dateShift    → deterministic date arithmetic
 */
import type {
  TripPlan,
  DayPlan,
  StreamCallbacks,
} from "@travelmate/contracts";
import { TripPlanSchema, DayPlanSchema } from "@travelmate/contracts";
import type { LLMClient } from "@travelmate/llm";
import { SCHEMA_BLOCK, extractJSON } from "./synthesis.js";
import { enforceConsistency } from "./consistency.js";
import { verifyDayLinks } from "./verify-links.js";

export interface RefineResult {
  plan: TripPlan;
  summary: string;
}

/* ── Analysis types ────────────────────────────────────────────────────────── */

interface RefineAction {
  summary: string;
  addDays?: { count: number; position: "end" | "start" };
  removeDays?: number[];
  modifyDays?: { dayNumber: number; instruction: string }[];
  budgetShift?: "cheaper" | "more_expensive";
  dateShift?: number;
}

/* ── Step 1: Analyze ───────────────────────────────────────────────────────── */

const ANALYZE_SYSTEM = `You are TravelMate's itinerary refinement analyzer.
Given a current itinerary summary and a user request, determine what modifications are needed.
Output ONLY valid JSON — no markdown, no code fences, no explanation.`;

const ANALYZE_SCHEMA = `OUTPUT SCHEMA (output exactly this JSON structure):
{
  "summary": "One sentence describing what you'll change",
  "addDays": null | { "count": number, "position": "end" | "start" },
  "removeDays": null | [dayNumbers],
  "modifyDays": null | [{ "dayNumber": number, "instruction": "specific change for this day" }],
  "budgetShift": null | "cheaper" | "more_expensive",
  "dateShift": null | number
}

CLASSIFICATION RULES:
- "add N more days" / "extend by N days" → addDays { count: N, position: "end" }
- "remove the last day" / "shorten by N days" → removeDays [dayNumbers]
- "make it cheaper" / "find budget options" / "too expensive" → budgetShift "cheaper"
- "upgrade" / "more luxurious" / "splurge" → budgetShift "more_expensive"
- "leave N days later" / "shift by N days" → dateShift N (positive = later)
- "arrive N days earlier" → dateShift -N
- "more food on day 3" / "change day 2 activities" → modifyDays with specific instruction
- General improvement requests ("make it better", "more local") → modifyDays on ALL days
- A request can combine multiple actions (e.g. "add 2 days and leave later" → addDays + dateShift)
- NEVER invent actions the user didn't ask for
- removeDays must contain valid day numbers from the current plan
- dateShift is in DAYS (integer)`;

function compressPlan(plan: TripPlan): string {
  const lines: string[] = [];
  lines.push(
    `CURRENT ITINERARY: "${plan.title}" (${plan.duration}, ` +
    `${plan.totalEstimatedCost.currency} ${plan.totalEstimatedCost.amount} total)`,
  );

  for (const day of plan.days) {
    const dayTotal = day.blocks.reduce((sum, b) => {
      const sel = b.options.find((o) => o.id === b.selectedOptionId) ?? b.options[0];
      return sum + (sel?.price.amount ?? 0);
    }, 0);
    const cur = day.blocks[0]?.options[0]?.price.currency ?? "EUR";
    const wd = (() => {
      try { return new Date(day.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" }); }
      catch { return ""; }
    })();

    lines.push(`\nDay ${day.dayNumber} (${day.date}, ${wd}) — "${day.title}"`);

    const cats = new Map<string, string[]>();
    for (const block of day.blocks) {
      const sel = block.options.find((o) => o.id === block.selectedOptionId) ?? block.options[0];
      if (!sel) continue;
      if (!cats.has(block.category)) cats.set(block.category, []);
      const price = sel.price.amount > 0 ? ` (${sel.price.currency} ${sel.price.amount})` : "";
      cats.get(block.category)!.push(`${sel.title}${price}`);
    }

    for (const [cat, items] of cats) {
      lines.push(`  ${cat}: ${items.join(", ")}`);
    }
    lines.push(`  Day total: ~${cur} ${Math.round(dayTotal)}`);
  }

  return lines.join("\n");
}

async function analyzeRefine(
  plan: TripPlan,
  message: string,
  llm: LLMClient,
): Promise<RefineAction> {
  const summary = compressPlan(plan);
  const res = await llm.run(
    {
      stage: "qa",
      system: ANALYZE_SYSTEM,
      cacheableContext: ANALYZE_SCHEMA,
      user: `${summary}\n\nUSER REQUEST: "${message}"\n\nAnalyze what needs to change and output the JSON.`,
    },
    (text) => {
      try {
        const raw = JSON.parse(extractJSON(text)) as Record<string, unknown>;
        return typeof raw.summary === "string";
      } catch {
        return false;
      }
    },
  );

  const raw = JSON.parse(extractJSON(res.text)) as Record<string, unknown>;
  return {
    summary: (raw.summary as string) ?? "Modifying your itinerary",
    addDays: raw.addDays as RefineAction["addDays"] ?? undefined,
    removeDays: raw.removeDays as number[] ?? undefined,
    modifyDays: raw.modifyDays as RefineAction["modifyDays"] ?? undefined,
    budgetShift: raw.budgetShift as RefineAction["budgetShift"] ?? undefined,
    dateShift: raw.dateShift as number ?? undefined,
  };
}

/* ── Step 2: Execute ───────────────────────────────────────────────────────── */

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  const ms = Date.UTC(y, m - 1, d) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function applyDateShift(plan: TripPlan, shift: number): TripPlan {
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      date: shiftDate(day.date, shift),
    })),
  };
}

function applyRemoveDays(plan: TripPlan, dayNumbers: number[]): TripPlan {
  const toRemove = new Set(dayNumbers);
  const kept = plan.days.filter((d) => !toRemove.has(d.dayNumber));
  kept.forEach((d, i) => {
    const oldNum = d.dayNumber;
    const newNum = i + 1;
    if (oldNum !== newNum) {
      const prefix = `d${oldNum}_`;
      const newPrefix = `d${newNum}_`;
      for (const block of d.blocks) {
        if (block.blockId.startsWith(prefix)) {
          block.blockId = newPrefix + block.blockId.slice(prefix.length);
        }
        if (block.selectedOptionId?.startsWith(prefix)) {
          block.selectedOptionId = newPrefix + block.selectedOptionId.slice(prefix.length);
        }
        for (const opt of block.options) {
          if (opt.id.startsWith(prefix)) {
            opt.id = newPrefix + opt.id.slice(prefix.length);
          }
        }
      }
    }
    d.dayNumber = newNum;
  });

  const totalCost = kept.reduce((sum, d) =>
    sum + d.blocks.reduce((s, b) => {
      const sel = b.options.find((o) => o.id === b.selectedOptionId) ?? b.options[0];
      return s + (sel?.price.amount ?? 0);
    }, 0), 0);
  const cur = kept[0]?.blocks[0]?.options[0]?.price.currency ?? "EUR";

  return {
    ...plan,
    days: kept,
    duration: `${kept.length} Days`,
    totalEstimatedCost: { amount: Math.round(totalCost), currency: cur },
  };
}

function applyBudgetShift(plan: TripPlan, direction: "cheaper" | "more_expensive"): TripPlan {
  const updated = structuredClone(plan);

  for (const day of updated.days) {
    for (const block of day.blocks) {
      if (block.options.length === 0) continue;
      const sorted = [...block.options].sort((a, b) => a.price.amount - b.price.amount);
      const pick = direction === "cheaper" ? sorted[0]! : sorted[sorted.length - 1]!;
      block.selectedOptionId = pick.id;
    }
  }

  const totalCost = updated.days.reduce((sum, d) =>
    sum + d.blocks.reduce((s, b) => {
      const sel = b.options.find((o) => o.id === b.selectedOptionId) ?? b.options[0];
      return s + (sel?.price.amount ?? 0);
    }, 0), 0);
  const cur = updated.days[0]?.blocks[0]?.options[0]?.price.currency ?? "EUR";
  updated.totalEstimatedCost = { amount: Math.round(totalCost), currency: cur };

  return updated;
}

/* ── Day generation / modification via LLM ─────────────────────────────────── */

const MODIFY_SYSTEM = `You are TravelMate's itinerary editor. Modify an existing day according to the instruction.
Keep everything that doesn't need to change. Maintain ALL fields and the 4-option structure.
Output ONLY valid JSON — no markdown, no code fences, no explanation.`;

const GENERATE_SYSTEM = `You are TravelMate's synthesis engine. Generate a complete day for an existing itinerary.
Output ONLY valid JSON — no markdown, no code fences, no explanation.
The JSON must be parseable by JSON.parse().`;

function extractPlanContext(plan: TripPlan): {
  destination: string;
  hotelName: string | undefined;
  currency: string;
  budgetPerDay: number;
} {
  const firstStays = plan.days[0]?.blocks.find((b) => b.category === "STAYS");
  const anchor = firstStays?.options.find((o) => o.tier === "ANCHOR");

  const totalCost = plan.days.reduce((sum, d) =>
    sum + d.blocks.reduce((s, b) => {
      const sel = b.options.find((o) => o.id === b.selectedOptionId) ?? b.options[0];
      return s + (sel?.price.amount ?? 0);
    }, 0), 0);
  const currency = plan.days[0]?.blocks[0]?.options[0]?.price.currency ?? "EUR";

  const dest = plan.title.replace(/\bitinerary\b/gi, "").replace(/\d+[-–]\s*day/gi, "").trim() || "the destination";

  return {
    destination: dest,
    hotelName: anchor?.title,
    currency,
    budgetPerDay: Math.round(totalCost / Math.max(plan.days.length, 1)),
  };
}

async function generateNewDay(
  plan: TripPlan,
  dayNumber: number,
  date: string,
  totalDays: number,
  llm: LLMClient,
  prevDay: DayPlan | undefined,
): Promise<DayPlan> {
  const ctx = extractPlanContext(plan);
  const isArrival = dayNumber === 1;
  const isDeparture = dayNumber === totalDays;
  const minBlocks = isArrival || isDeparture ? 2 : 3;

  const prevEnd = prevDay
    ? (prevDay.blocks[prevDay.blocks.length - 1]?.options.find(
        (o) => o.id === prevDay.blocks[prevDay.blocks.length - 1]!.selectedOptionId,
      )?.title ?? "")
    : "";

  const prompt = `TRIP CONTEXT:
- Destination: ${ctx.destination}
- Hotel: ${ctx.hotelName ?? "pick a suitable hotel"}
- Budget: ~${ctx.currency} ${ctx.budgetPerDay} per day
- Total trip: ${totalDays} days
${isArrival ? "- This is the ARRIVAL day: no breakfast/lunch/morning at the destination." : ""}
${isDeparture ? "- This is the DEPARTURE day: checkout ~11:00, no evening program." : ""}
${prevEnd ? `- Previous day ended at: ${prevEnd}` : ""}

Generate day ${dayNumber} (date: ${date}) — a ${isArrival ? "partial arrival" : isDeparture ? "partial departure" : "full"} day.
${!isArrival && !isDeparture ? "Include at least 8 blocks: 1 STAYS + 3 DINING + 2 ACTIVITIES + 2 TRANSPORT." : ""}
Every block must have EXACTLY 4 options: ANCHOR, SMART-VALUE, PREMIUM, INDEPENDENT.

Output JSON: {"day": { "dayNumber": ${dayNumber}, "date": "${date}", "title": "...", "theme": "...", "dailyTips": [...], "blocks": [...] }}`;

  const res = await llm.run(
    {
      stage: "synthesis",
      system: GENERATE_SYSTEM,
      cacheableContext: SCHEMA_BLOCK,
      user: prompt,
    },
    (text) => {
      try {
        const raw = JSON.parse(extractJSON(text)) as Record<string, unknown>;
        const days = raw.days as unknown[] | undefined;
        const day = (raw.day ?? days?.[0] ?? raw) as { blocks?: unknown[] };
        return Array.isArray(day.blocks) && day.blocks.length >= minBlocks;
      } catch {
        return false;
      }
    },
  );

  const raw = JSON.parse(extractJSON(res.text)) as Record<string, unknown>;
  const days = raw.days as unknown[] | undefined;
  const dayObj = (raw.day ?? days?.[0] ?? raw) as unknown;
  const parsed = DayPlanSchema.parse(dayObj);
  parsed.dayNumber = dayNumber;
  parsed.date = date;

  parsed.blocks.sort((a, b) => {
    const ta = a.scheduledTime.replace(":", "").padStart(4, "0");
    const tb = b.scheduledTime.replace(":", "").padStart(4, "0");
    return ta.localeCompare(tb);
  });

  return parsed;
}

async function modifyExistingDay(
  day: DayPlan,
  instruction: string,
  plan: TripPlan,
  llm: LLMClient,
): Promise<DayPlan> {
  const ctx = extractPlanContext(plan);
  const minBlocks = 2;

  const prompt = `TRIP CONTEXT:
- Destination: ${ctx.destination}
- Hotel: ${ctx.hotelName ?? "current hotel"}
- Budget: ~${ctx.currency} ${ctx.budgetPerDay} per day

CURRENT DAY ${day.dayNumber} (${day.date}):
${JSON.stringify(day)}

MODIFICATION REQUESTED: "${instruction}"

Modify ONLY what the instruction asks for. Keep all other blocks, options, and data unchanged.
Every block must keep EXACTLY 4 options: ANCHOR, SMART-VALUE, PREMIUM, INDEPENDENT.
Output the modified day as JSON: {"day": { ...same schema as input... }}`;

  const res = await llm.run(
    {
      stage: "synthesis",
      system: MODIFY_SYSTEM,
      cacheableContext: SCHEMA_BLOCK,
      user: prompt,
    },
    (text) => {
      try {
        const raw = JSON.parse(extractJSON(text)) as Record<string, unknown>;
        const days = raw.days as unknown[] | undefined;
        const d = (raw.day ?? days?.[0] ?? raw) as { blocks?: unknown[] };
        return Array.isArray(d.blocks) && d.blocks.length >= minBlocks;
      } catch {
        return false;
      }
    },
  );

  const raw = JSON.parse(extractJSON(res.text)) as Record<string, unknown>;
  const days = raw.days as unknown[] | undefined;
  const dayObj = (raw.day ?? days?.[0] ?? raw) as unknown;
  const parsed = DayPlanSchema.parse(dayObj);
  parsed.dayNumber = day.dayNumber;
  parsed.date = day.date;

  parsed.blocks.sort((a, b) => {
    const ta = a.scheduledTime.replace(":", "").padStart(4, "0");
    const tb = b.scheduledTime.replace(":", "").padStart(4, "0");
    return ta.localeCompare(tb);
  });

  return parsed;
}

async function applyAddDays(
  plan: TripPlan,
  add: NonNullable<RefineAction["addDays"]>,
  llm: LLMClient,
  cb: StreamCallbacks,
): Promise<TripPlan> {
  const updated = structuredClone(plan);
  const existingCount = updated.days.length;
  const newTotal = existingCount + add.count;
  const newDays: DayPlan[] = [];

  if (add.position === "start") {
    const firstDate = updated.days[0]?.date ?? new Date().toISOString().slice(0, 10);
    for (let i = 0; i < add.count; i++) {
      const dayNumber = i + 1;
      const date = shiftDate(firstDate, -(add.count - i));
      cb.onThought(`Generating day ${dayNumber} of ${newTotal}…`);

      const prevDay = newDays[newDays.length - 1];
      const day = await generateNewDay(updated, dayNumber, date, newTotal, llm, prevDay);

      enforceConsistency({ ...updated, days: [day] });
      const links = await verifyDayLinks([day]);
      if (links.replaced > 0) {
        cb.onThought(`Day ${dayNumber}: replaced ${links.replaced} dead link(s).`);
      }
      newDays.push(day);
    }
    // Renumber existing days
    for (let i = 0; i < updated.days.length; i++) {
      updated.days[i]!.dayNumber = add.count + i + 1;
    }
    updated.days.unshift(...newDays);
  } else {
    const lastDate = updated.days[existingCount - 1]?.date ?? new Date().toISOString().slice(0, 10);
    for (let i = 0; i < add.count; i++) {
      const dayNumber = existingCount + i + 1;
      const date = shiftDate(lastDate, i + 1);
      cb.onThought(`Generating day ${dayNumber} of ${newTotal}…`);

      const prevDay = updated.days[updated.days.length - 1];
      const day = await generateNewDay(updated, dayNumber, date, newTotal, llm, prevDay);

      enforceConsistency({ ...updated, days: [day] });
      const links = await verifyDayLinks([day]);
      if (links.replaced > 0) {
        cb.onThought(`Day ${dayNumber}: replaced ${links.replaced} dead link(s).`);
      }
      updated.days.push(day);
    }
  }

  const totalCost = updated.days.reduce((sum, d) =>
    sum + d.blocks.reduce((s, b) => {
      const sel = b.options.find((o) => o.id === b.selectedOptionId) ?? b.options[0];
      return s + (sel?.price.amount ?? 0);
    }, 0), 0);
  const cur = updated.days[0]?.blocks[0]?.options[0]?.price.currency ?? "EUR";

  updated.duration = `${newTotal} Days`;
  updated.totalEstimatedCost = { amount: Math.round(totalCost), currency: cur };

  return updated;
}

async function applyModifyDays(
  plan: TripPlan,
  mods: NonNullable<RefineAction["modifyDays"]>,
  llm: LLMClient,
  cb: StreamCallbacks,
): Promise<TripPlan> {
  const updated = structuredClone(plan);

  for (const mod of mods) {
    const dayIdx = updated.days.findIndex((d) => d.dayNumber === mod.dayNumber);
    if (dayIdx === -1) continue;

    cb.onThought(`Modifying day ${mod.dayNumber}…`);
    try {
      const modified = await modifyExistingDay(updated.days[dayIdx]!, mod.instruction, updated, llm);
      enforceConsistency({ ...updated, days: [modified] });
      const links = await verifyDayLinks([modified]);
      if (links.replaced > 0) {
        cb.onThought(`Day ${mod.dayNumber}: replaced ${links.replaced} dead link(s).`);
      }
      updated.days[dayIdx] = modified;
    } catch (err) {
      cb.onThought(`Could not modify day ${mod.dayNumber} — keeping the original.`);
      console.warn(`[refine] day ${mod.dayNumber} modification failed:`, err);
    }
  }

  const totalCost = updated.days.reduce((sum, d) =>
    sum + d.blocks.reduce((s, b) => {
      const sel = b.options.find((o) => o.id === b.selectedOptionId) ?? b.options[0];
      return s + (sel?.price.amount ?? 0);
    }, 0), 0);
  const cur = updated.days[0]?.blocks[0]?.options[0]?.price.currency ?? "EUR";
  updated.totalEstimatedCost = { amount: Math.round(totalCost), currency: cur };

  return updated;
}

/* ── Public entry point ────────────────────────────────────────────────────── */

export async function refinePlan(
  plan: TripPlan,
  message: string,
  llm: LLMClient,
  cb: StreamCallbacks,
): Promise<RefineResult> {
  cb.onThought("Analyzing your request…");

  const action = await analyzeRefine(plan, message, llm);
  cb.onThought(action.summary);

  let result = structuredClone(plan);

  if (action.dateShift) {
    result = applyDateShift(result, action.dateShift);
    cb.onThought(`Shifted all dates by ${action.dateShift > 0 ? "+" : ""}${action.dateShift} day(s).`);
  }

  // Modify before remove so the classifier's day numbers still match the plan
  if (action.modifyDays?.length) {
    result = await applyModifyDays(result, action.modifyDays, llm, cb);
  }

  if (action.removeDays?.length) {
    result = applyRemoveDays(result, action.removeDays);
    cb.onThought(`Removed day(s) ${action.removeDays.join(", ")}.`);
  }

  if (action.budgetShift) {
    result = applyBudgetShift(result, action.budgetShift);
    const label = action.budgetShift === "cheaper" ? "more affordable" : "premium";
    cb.onThought(`Switched to ${label} options across the itinerary.`);
  }

  if (action.addDays) {
    result = await applyAddDays(result, action.addDays, llm, cb);
  }

  enforceConsistency(result);
  const validated = TripPlanSchema.parse(result);
  cb.onThought(`Refinement complete — ${validated.days.length} days, ${validated.days.reduce((s, d) => s + d.blocks.length, 0)} blocks.`);

  return { plan: validated, summary: action.summary };
}
