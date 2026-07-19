/**
 * Stage 4 — Re-flow (Highlight H4). Given ONE edited block, recompute ONLY its
 * dependents so the itinerary stays coherent — without re-running Synthesis.
 *
 * The dependency graph is DERIVED deterministically (the LLM's free-text
 * `dependencyLogic` is informational only — code decides):
 *
 *   1. POSITIONAL  — TRANSPORT blocks adjacent to the swapped block carry its
 *                    venue as an endpoint → route must be re-resolved
 *                    (same day).
 *   2. REFERENTIAL — any selected option that mentions the old venue by name
 *                    (titles, descriptions, links) → name/link patch
 *                    (same day AND other days: "walk back to Hotel X").
 *   3. CONTINUITY  — swapping a STAYS selection propagates the new hotel to
 *                    every other day that slept in the old one (cross-day).
 *
 * Dependents are repaired in the cheapest way that works (§3.3):
 *   - name + link patches: pure code, no LLM
 *   - affected TRANSPORT routes: ONE scoped fast-tier LLM call ("refetch") to
 *     re-estimate mode/duration/cost between the NEW endpoints, with a
 *     deterministic fallback (patched names + rebuilt directions link)
 *   - every touched link is re-verified before the plan is saved
 */
import type { TripPlan, DayPlan, ItineraryBlock, TravelOption, PlanEdit, StreamCallbacks } from "@travelmate/contracts";
import { ItineraryBlockSchema } from "@travelmate/contracts";
import type { Database } from "@travelmate/database";
import type { LLMClient } from "@travelmate/llm";
import { verifyDayLinks, mapsSearchUrl } from "./verify-links.js";
import { enforceConsistency, departureEpoch } from "./consistency.js";

export interface ReflowResult {
  plan: TripPlan;
  /** Every block the re-flow touched (including the swapped one) — for UI highlights. */
  changedBlockIds: string[];
}

const selected = (b: ItineraryBlock): TravelOption =>
  b.options.find((o) => o.id === b.selectedOptionId) ?? b.options[0]!;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replace every occurrence of `from` (plain, +-encoded, %-encoded) with `to`. */
function patchNames(text: string, from: string, to: string): string {
  let out = text;
  for (const [f, t] of [
    [from, to],
    [from.replace(/ /g, "+"), to.replace(/ /g, "+")],
    [encodeURIComponent(from), encodeURIComponent(to)],
  ] as const) {
    out = out.replace(new RegExp(escapeRegExp(f), "gi"), t);
  }
  return out;
}

function mentionsVenue(opt: TravelOption, name: string): boolean {
  const re = new RegExp(escapeRegExp(name), "i");
  return re.test(opt.title) || re.test(opt.description) ||
    (!!opt.link && re.test(decodeURIComponent(opt.link).replace(/\+/g, " ")));
}

/** Rebuild a Google Maps directions link, keeping the old travel mode and stamping departure_time. */
function rebuildDirectionsLink(oldLink: string | undefined, from: string, to: string, dayDate?: string, scheduledTime?: string): string {
  const mode = oldLink?.match(/travelmode=(walking|transit|driving|bicycling)/i)?.[1] ?? "transit";
  const u = new URL(`https://www.google.com/maps/dir/?api=1`);
  u.searchParams.set("origin", from);
  u.searchParams.set("destination", to);
  u.searchParams.set("travelmode", mode);
  if (dayDate && scheduledTime) {
    u.searchParams.set("departure_time", String(departureEpoch(dayDate, scheduledTime)));
  }
  return u.toString();
}

/* ── Dependency derivation ─────────────────────────────────────────────────── */

interface Dependents {
  /** TRANSPORT blocks needing route re-resolution: block + its new endpoints. */
  transports: Array<{ day: DayPlan; block: ItineraryBlock; from: string; to: string }>;
  /** Options needing a deterministic old-name → new-name patch. */
  references: Array<{ day: DayPlan; block: ItineraryBlock; opt: TravelOption }>;
  /** STAYS blocks on other days that slept in the old hotel. */
  staysToFollow: Array<{ day: DayPlan; block: ItineraryBlock }>;
}

/** The non-transport venue the traveler is at before/after a given block index. */
function neighborVenue(day: DayPlan, index: number, direction: -1 | 1): { block: ItineraryBlock; venue: TravelOption } | undefined {
  for (let i = index + direction; i >= 0 && i < day.blocks.length; i += direction) {
    const b = day.blocks[i]!;
    if (b.category !== "TRANSPORT") return { block: b, venue: selected(b) };
  }
  return undefined;
}

export function deriveDependents(plan: TripPlan, swappedBlockId: string, oldName: string): Dependents {
  const result: Dependents = { transports: [], references: [], staysToFollow: [] };

  let swappedDay: DayPlan | undefined;
  let swappedIndex = -1;
  let swappedBlock: ItineraryBlock | undefined;
  for (const day of plan.days) {
    const i = day.blocks.findIndex((b) => b.blockId === swappedBlockId);
    if (i !== -1) { swappedDay = day; swappedIndex = i; swappedBlock = day.blocks[i]; break; }
  }
  if (!swappedDay || !swappedBlock) return result;
  const newVenue = selected(swappedBlock);

  // 1. POSITIONAL — the transport legs physically attached to this block.
  //    Previous transport arrives AT the swapped venue; next departs FROM it.
  for (let i = swappedIndex - 1; i >= 0; i--) {
    const b = swappedDay.blocks[i]!;
    if (b.category === "TRANSPORT") {
      const from = neighborVenue(swappedDay, i, -1)?.venue.title ?? "";
      result.transports.push({ day: swappedDay, block: b, from, to: newVenue.title });
      break;
    }
    break; // a non-transport block sits between — no attached leg
  }
  for (let i = swappedIndex + 1; i < swappedDay.blocks.length; i++) {
    const b = swappedDay.blocks[i]!;
    if (b.category === "TRANSPORT") {
      const to = neighborVenue(swappedDay, i, 1)?.venue.title ?? "";
      result.transports.push({ day: swappedDay, block: b, from: newVenue.title, to });
      break;
    }
    break;
  }

  // 2 + 3. REFERENTIAL and CONTINUITY across the whole plan
  const transportIds = new Set(result.transports.map((t) => t.block.blockId));
  for (const day of plan.days) {
    for (const block of day.blocks) {
      if (block.blockId === swappedBlockId || transportIds.has(block.blockId)) continue;

      if (
        swappedBlock.category === "STAYS" &&
        block.category === "STAYS" &&
        selected(block).title.toLowerCase() === oldName.toLowerCase()
      ) {
        result.staysToFollow.push({ day, block });
        continue;
      }

      for (const opt of block.options) {
        if (mentionsVenue(opt, oldName)) {
          result.references.push({ day, block, opt });
        }
      }
    }
  }

  return result;
}

/* ── Scoped LLM re-resolution of transport routes ("refetch") ─────────────── */

const REFLOW_SYSTEM = `You are TravelMate's re-flow engine. ONE itinerary block changed; you re-resolve
ONLY the transport legs attached to it. Output ONLY valid JSON — no markdown, no explanation.`;

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
}

async function reresolveTransports(
  jobs: Dependents["transports"],
  llm: LLMClient,
): Promise<Map<string, ItineraryBlock>> {
  const resolved = new Map<string, ItineraryBlock>();
  if (jobs.length === 0) return resolved;

  const prompt = `These TRANSPORT blocks must be re-resolved because a venue they connect to changed.
For each: keep blockId, scheduledTime, dependencyLogic and the 4-option structure, but recompute
the route between the NEW endpoints — realistic mode, duration, total party cost, and a Google Maps
directions link "https://www.google.com/maps/dir/?api=1&origin=FROM&destination=TO&travelmode=MODE&departure_time=EPOCH" (EPOCH = Unix seconds for the day+time).

${jobs.map((j) => `- blockId "${j.block.blockId}": now FROM "${j.from}" TO "${j.to}" at ${j.block.scheduledTime}
  current JSON: ${JSON.stringify(j.block)}`).join("\n")}

Output: {"blocks": [ ...the re-resolved TRANSPORT blocks, same schema... ]}`;

  try {
    const res = await llm.run(
      { stage: "reflow", system: REFLOW_SYSTEM, user: prompt },
      (text) => {
        try {
          const raw = JSON.parse(extractJSON(text)) as { blocks?: unknown[] };
          return Array.isArray(raw.blocks) && raw.blocks.length === jobs.length;
        } catch {
          return false;
        }
      },
    );
    const raw = JSON.parse(extractJSON(res.text)) as { blocks: unknown[] };
    for (const rawBlock of raw.blocks) {
      const parsed = ItineraryBlockSchema.safeParse(rawBlock);
      if (parsed.success && jobs.some((j) => j.block.blockId === parsed.data.blockId)) {
        resolved.set(parsed.data.blockId, parsed.data);
      }
    }
  } catch (err) {
    console.warn(`[reflow] transport re-resolution failed (${err instanceof Error ? err.message.slice(0, 80) : err}) — using deterministic fallback`);
  }
  return resolved;
}

/* ── The engine ────────────────────────────────────────────────────────────── */

export async function reflow(
  edit: PlanEdit,
  db: Database,
  llm: LLMClient,
  cb?: Pick<StreamCallbacks, "onThought">,
): Promise<ReflowResult> {
  const plan = await db.plans.getPlan(edit.planId);
  if (!plan) throw new Error(`Plan ${edit.planId} not found`);

  // Locate the block and apply the swap itself
  let swappedBlock: ItineraryBlock | undefined;
  for (const day of plan.days) {
    swappedBlock = day.blocks.find((b) => b.blockId === edit.blockId);
    if (swappedBlock) break;
  }
  if (!swappedBlock) throw new Error(`Block ${edit.blockId} not found in plan ${edit.planId}`);
  const newOption = swappedBlock.options.find((o) => o.id === edit.newOptionId);
  if (!newOption) throw new Error(`Option ${edit.newOptionId} not found in block ${edit.blockId}`);

  const oldOption = selected(swappedBlock);
  swappedBlock.selectedOptionId = edit.newOptionId;
  const changed = new Set<string>([edit.blockId]);

  if (oldOption.title === newOption.title) {
    // Same venue (e.g. different room class) — nothing depends on the name
    await db.plans.savePlan(plan);
    db.observer.notify(plan);
    return { plan, changedBlockIds: [...changed] };
  }

  cb?.onThought?.(`Re-flowing dependents of "${oldOption.title}" → "${newOption.title}"…`);
  const deps = deriveDependents(plan, edit.blockId, oldOption.title);

  // 3. CONTINUITY — other nights follow the new hotel (deterministic)
  for (const { block } of deps.staysToFollow) {
    const sameTitle = block.options.find((o) => o.title === newOption.title);
    if (sameTitle) {
      block.selectedOptionId = sameTitle.id;
    } else {
      // Options are capped at 4 — replace the currently selected one in place,
      // keeping its id so nothing else breaks.
      const idx = block.options.findIndex((o) => o.id === block.selectedOptionId);
      const keepId = block.options[idx]!.id;
      block.options[idx] = { ...newOption, id: keepId };
      block.selectedOptionId = keepId;
    }
    changed.add(block.blockId);
  }

  // 2. REFERENTIAL — deterministic name + link patches
  for (const { block, opt } of deps.references) {
    opt.title = patchNames(opt.title, oldOption.title, newOption.title);
    opt.description = patchNames(opt.description, oldOption.title, newOption.title);
    if (opt.link) opt.link = patchNames(opt.link, oldOption.title, newOption.title);
    changed.add(block.blockId);
  }

  // 1. POSITIONAL — re-resolve attached transport routes (the "refetch")
  if (deps.transports.length > 0) {
    cb?.onThought?.(`Recomputing ${deps.transports.length} transport leg(s) for the new route…`);
    const resolved = await reresolveTransports(deps.transports, llm);
    for (const job of deps.transports) {
      const fresh = resolved.get(job.block.blockId);
      if (fresh) {
        Object.assign(job.block, fresh);
      } else {
        // Deterministic fallback: patch endpoint names + rebuild the directions
        // link on every option; route metadata stays approximate.
        for (const opt of job.block.options) {
          opt.title = patchNames(opt.title, oldOption.title, newOption.title);
          opt.description = patchNames(opt.description, oldOption.title, newOption.title);
          opt.link = rebuildDirectionsLink(opt.link, job.from, job.to, job.day.date, job.block.scheduledTime);
          opt.linkType = "DIRECTIONS";
        }
        if (job.block.label) job.block.label = patchNames(job.block.label, oldOption.title, newOption.title);
      }
      changed.add(job.block.blockId);
    }
  }

  // Re-reconcile booking/access/mode on touched days, then re-verify links
  const touchedDays = plan.days.filter((d) => d.blocks.some((b) => changed.has(b.blockId)));
  enforceConsistency({ ...plan, days: touchedDays });
  await verifyDayLinks(touchedDays);

  // Guard: the swapped option's own link must exist for dependents to point at
  for (const day of touchedDays) {
    for (const block of day.blocks) {
      for (const opt of block.options) {
        if (!opt.link) {
          opt.link = mapsSearchUrl(opt);
          opt.linkType = "MAPS";
        }
      }
    }
  }

  await db.plans.savePlan(plan);
  db.observer.notify(plan);

  cb?.onThought?.(`Re-flow complete — ${changed.size - 1} dependent block(s) updated.`);
  return { plan, changedBlockIds: [...changed] };
}
