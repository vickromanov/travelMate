/**
 * The trip vocabulary: from what the UX collects → to the zero-thinking itinerary.
 * See about_travelMate.md (H2/H3/H4) and projectStructure.md §4.
 */
import { z } from "zod";
import { BudgetTierSchema, GeoLocationSchema, MoneySchema } from "./common.js";

// LLMs return null for missing optional fields — coerce null → undefined everywhere.
const optStr = () => z.string().nullish().transform((v) => v ?? undefined);
const optDate = () =>
  z
    .string()
    .nullish()
    .transform((v) => v ?? undefined)
    .pipe(z.string().date().optional());
const optNum = (schema: z.ZodNumber) =>
  schema.nullish().transform((v) => v ?? undefined);

/* ── UX → Orchestrator: the minimum validated input (about_travelMate.md §8) ── */

export const CrucialInfoSchema = z.object({
  destination: z.string().min(1),
  /** Free-form — NO archetype enum. Principle P3. */
  travelerDescription: z.string().min(1),
  tripType: z.string().min(1),
  budgetTier: BudgetTierSchema,
  /**
   * Explicit numeric budget stated by the traveler, normalised to PER DAY per
   * person (e.g. "€50/day" → 50; "total €800 for a week solo" → ~114). A hard
   * constraint on the selected (ANCHOR) options, enforced by the quality validator.
   */
  budgetDailyCap: MoneySchema.nullish().transform((v) => v ?? undefined),
  origin: optStr(),
  startDate: optDate(),
  endDate: optDate(),
  partyAdults: optNum(z.number().int().positive()),
  partyChildren: optNum(z.number().int().nonnegative()),
  freeformText: optStr(),
});
export type CrucialInfo = z.infer<typeof CrucialInfoSchema>;

/* ── Orchestrator-internal: structured intent (intent.ts output) ── */

export const InferenceEntrySchema = z.object({
  field: z.string(),
  assumed: z.preprocess((v) => String(v), z.string()),
  reason: z.string(),
});
export type InferenceEntry = z.infer<typeof InferenceEntrySchema>;

export const TripBriefSchema = z.object({
  facts: CrucialInfoSchema,
  /** Free-form natural-language profile of THIS traveler. Never an archetype. */
  travelerProfile: z.string().min(1),
  /** Every assumption made to fill a null fact — streamed to onThought (P1). */
  inferenceChain: z.array(InferenceEntrySchema),
  /** Which categories this trip needs fetched. */
  neededCategories: z.array(z.string()),
});
export type TripBrief = z.infer<typeof TripBriefSchema>;

/* ── Orchestrator → Database → UX: the itinerary ── */

export const TravelOptionSchema = z.object({
  id: z.string().min(1),
  tier: z.enum(["ANCHOR", "SMART-VALUE", "PREMIUM", "INDEPENDENT"]),
  title: z.string(),
  // Narrative fields: an LLM occasionally omits one on a single option — that
  // must degrade to an empty string (quality validator warns), never kill the plan.
  description: z.string().nullish().transform((v) => v ?? ""),
  reasoning: z.string().nullish().transform((v) => v ?? ""),
  price: MoneySchema,
  location: GeoLocationSchema,
  scheduledTime: optStr(),
  durationMinutes: optNum(z.number().int().positive()),
  bookingRequired: z.boolean().nullish().transform((v) => v ?? undefined),
  bookingUrl: optStr(),
  openingHours: optStr(),
  phoneNumber: optStr(),
  affiliationRef: optStr(),
  /** Primary clickable link for the card header. Official site, Google Maps, or directions. */
  link: optStr(),
});
export type TravelOption = z.infer<typeof TravelOptionSchema>;

export const ItineraryBlockSchema = z.object({
  blockId: z.string().min(1), // "d1_b1"
  category: z.preprocess(
    // LLMs sometimes output the singular "ACTIVITY" — normalise before enum check
    (v) => (v === "ACTIVITY" ? "ACTIVITIES" : v),
    z.enum(["STAYS", "TRANSPORT", "DINING", "ACTIVITIES", "LOGISTICS"]),
  ),
  timeSlot: z
    .enum(["MORNING", "AFTERNOON", "EVENING", "OVERNIGHT", "ALL_DAY"])
    .nullish()
    .transform((v) => v ?? undefined),
  scheduledTime: z.string(),
  label: optStr(),
  isOptional: z.boolean().nullish().transform((v) => v ?? undefined),
  selectedOptionId: z.string().min(1),
  /**
   * Drives the Re-flow Engine (H4). "none" = independent. Otherwise an expression
   * naming the blocks/locations this block depends on (e.g. depends on STAYS
   * location → re-flow when the hotel changes). projectStructure.md §2 Refinement 1.
   */
  dependencyLogic: z.string(),
  options: z.array(TravelOptionSchema).min(4).max(4),
});
export type ItineraryBlock = z.infer<typeof ItineraryBlockSchema>;

export const DayPlanSchema = z.object({
  dayNumber: z.number().int().positive(),
  date: z.string().date(),
  title: z.string(),
  theme: z.string().nullish().transform((v) => v ?? ""),
  dailyTips: z.array(z.string()).nullish().transform((v) => v ?? []),
  startLocation: optStr(),
  blocks: z.array(ItineraryBlockSchema),
});
export type DayPlan = z.infer<typeof DayPlanSchema>;

export const TripPlanSchema = z.object({
  planId: z.string().min(1),
  title: z.string(),
  description: z.string(),
  totalEstimatedCost: MoneySchema,
  duration: z.string(), // "3 Days"
  days: z.array(DayPlanSchema),
  /** Echoed so the UX can show the assumptions that shaped the plan (P1). */
  inferenceChain: z.array(InferenceEntrySchema),
});
export type TripPlan = z.infer<typeof TripPlanSchema>;

/** UX → Orchestrator: a single-step edit that triggers a scoped re-flow (H4). */
export const PlanEditSchema = z.object({
  planId: z.string().min(1),
  blockId: z.string().min(1),
  newOptionId: z.string().min(1),
});
export type PlanEdit = z.infer<typeof PlanEditSchema>;
