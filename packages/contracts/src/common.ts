/**
 * Shared primitives used by every other contract module.
 * Skeleton: schemas express the intended shape; refine as tiers are implemented.
 */
import { z } from "zod";

/** The data categories a fetcher can serve. One module per category in @travelmate/fetchers. */
export const CategorySchema = z.enum([
  "flights",
  "hotels",
  "dining",
  "activities",
  "events",
  "weather",
  "places",
]);
export type Category = z.infer<typeof CategorySchema>;

export const MoneySchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().length(3), // ISO 4217
});
export type Money = z.infer<typeof MoneySchema>;

export const GeoLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  // LLMs routinely drop the address on secondary options — degrade to ""
  // (the orchestrator quality validator warns) rather than failing the plan.
  address: z.string().nullish().transform((v) => v ?? ""),
});
export type GeoLocation = z.infer<typeof GeoLocationSchema>;

export const BudgetTierSchema = z.enum(["ECONOMY", "SMART", "LUXURY"]);
export type BudgetTier = z.infer<typeof BudgetTierSchema>;

/**
 * Canonical error every tier throws across a boundary. Carrying a stable `code`
 * keeps the Orchestrator's cascade/escalation logic decoupled from messages.
 */
export class ContractError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    cause?: unknown,
  ) {
    // Use the native Error `cause` option (ES2022) rather than a parameter
    // property, which would collide with the inherited Error.cause member.
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = "ContractError";
  }
}

/** Thrown by skeleton stubs so an unimplemented path fails loudly, never silently. */
export class NotImplemented extends ContractError {
  constructor(what: string) {
    super("NOT_IMPLEMENTED", `Not implemented: ${what}`);
    this.name = "NotImplemented";
  }
}
