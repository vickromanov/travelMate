/**
 * The trip vocabulary: from what the UX collects → to the zero-thinking itinerary.
 * See about_travelMate.md (H2/H3/H4) and projectStructure.md §4.
 */
import { z } from "zod";
import { BudgetTierSchema, GeoLocationSchema, MoneySchema } from "./common.js";
/* ── UX → Orchestrator: the minimum validated input (about_travelMate.md §8) ── */
export const CrucialInfoSchema = z.object({
    destination: z.string().min(1),
    /** Free-form — NO archetype enum. Principle P3. */
    travelerDescription: z.string().min(1),
    tripType: z.string().min(1),
    budgetTier: BudgetTierSchema,
    origin: z.string().optional(),
    startDate: z.string().date().optional(),
    endDate: z.string().date().optional(),
    partyAdults: z.number().int().positive().optional(),
    partyChildren: z.number().int().nonnegative().optional(),
    freeformText: z.string().optional(),
});
/* ── Orchestrator-internal: structured intent (intent.ts output) ── */
export const InferenceEntrySchema = z.object({
    field: z.string(),
    assumed: z.string(),
    reason: z.string(),
});
export const TripBriefSchema = z.object({
    facts: CrucialInfoSchema,
    /** Free-form natural-language profile of THIS traveler. Never an archetype. */
    travelerProfile: z.string().min(1),
    /** Every assumption made to fill a null fact — streamed to onThought (P1). */
    inferenceChain: z.array(InferenceEntrySchema),
    /** Which categories this trip needs fetched. */
    neededCategories: z.array(z.string()),
});
/* ── Orchestrator → Database → UX: the itinerary ── */
export const TravelOptionSchema = z.object({
    id: z.string().min(1),
    tier: z.enum(["ANCHOR", "SMART-VALUE", "PREMIUM", "INDEPENDENT"]),
    title: z.string(),
    description: z.string(),
    reasoning: z.string(),
    price: MoneySchema,
    location: GeoLocationSchema,
    scheduledTime: z.string().optional(),
    durationMinutes: z.number().int().positive().optional(),
    bookingRequired: z.boolean().optional(),
    bookingUrl: z.string().url().optional(),
    openingHours: z.string().optional(),
    phoneNumber: z.string().optional(),
    /** Source/affiliate provenance — present on every option. */
    affiliationRef: z.string().optional(),
});
export const ItineraryBlockSchema = z.object({
    blockId: z.string().min(1), // "d1_b1"
    category: z.enum(["STAYS", "TRANSPORT", "DINING", "ACTIVITIES", "LOGISTICS"]),
    timeSlot: z
        .enum(["MORNING", "AFTERNOON", "EVENING", "OVERNIGHT", "ALL_DAY"])
        .optional(),
    scheduledTime: z.string(), // required — the day must progress realistically
    label: z.string().optional(),
    isOptional: z.boolean().optional(),
    selectedOptionId: z.string().min(1),
    /**
     * Drives the Re-flow Engine (H4). "none" = independent. Otherwise an expression
     * naming the blocks/locations this block depends on (e.g. depends on STAYS
     * location → re-flow when the hotel changes). projectStructure.md §2 Refinement 1.
     */
    dependencyLogic: z.string(),
    options: z.array(TravelOptionSchema).min(2).max(4),
});
export const DayPlanSchema = z.object({
    dayNumber: z.number().int().positive(),
    date: z.string().date(),
    title: z.string(),
    theme: z.string(),
    dailyTips: z.array(z.string()),
    startLocation: z.string().optional(),
    blocks: z.array(ItineraryBlockSchema),
});
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
/** UX → Orchestrator: a single-step edit that triggers a scoped re-flow (H4). */
export const PlanEditSchema = z.object({
    planId: z.string().min(1),
    blockId: z.string().min(1),
    newOptionId: z.string().min(1),
});
//# sourceMappingURL=trip.js.map