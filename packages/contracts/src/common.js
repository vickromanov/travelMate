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
export const MoneySchema = z.object({
    amount: z.number().nonnegative(),
    currency: z.string().length(3), // ISO 4217
});
export const GeoLocationSchema = z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    address: z.string().min(1),
});
export const BudgetTierSchema = z.enum(["ECONOMY", "SMART", "LUXURY"]);
/**
 * Canonical error every tier throws across a boundary. Carrying a stable `code`
 * keeps the Orchestrator's cascade/escalation logic decoupled from messages.
 */
export class ContractError extends Error {
    code;
    constructor(code, message, cause) {
        // Use the native Error `cause` option (ES2022) rather than a parameter
        // property, which would collide with the inherited Error.cause member.
        super(message, cause !== undefined ? { cause } : undefined);
        this.code = code;
        this.name = "ContractError";
    }
}
/** Thrown by skeleton stubs so an unimplemented path fails loudly, never silently. */
export class NotImplemented extends ContractError {
    constructor(what) {
        super("NOT_IMPLEMENTED", `Not implemented: ${what}`);
        this.name = "NotImplemented";
    }
}
//# sourceMappingURL=common.js.map