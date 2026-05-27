/**
 * Shared primitives used by every other contract module.
 * Skeleton: schemas express the intended shape; refine as tiers are implemented.
 */
import { z } from "zod";
/** The data categories a fetcher can serve. One module per category in @travelmate/fetchers. */
export declare const CategorySchema: z.ZodEnum<["flights", "hotels", "dining", "activities", "events", "weather", "places"]>;
export type Category = z.infer<typeof CategorySchema>;
export declare const MoneySchema: z.ZodObject<{
    amount: z.ZodNumber;
    currency: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amount: number;
    currency: string;
}, {
    amount: number;
    currency: string;
}>;
export type Money = z.infer<typeof MoneySchema>;
export declare const GeoLocationSchema: z.ZodObject<{
    lat: z.ZodNumber;
    lng: z.ZodNumber;
    address: z.ZodString;
}, "strip", z.ZodTypeAny, {
    lat: number;
    lng: number;
    address: string;
}, {
    lat: number;
    lng: number;
    address: string;
}>;
export type GeoLocation = z.infer<typeof GeoLocationSchema>;
export declare const BudgetTierSchema: z.ZodEnum<["ECONOMY", "SMART", "LUXURY"]>;
export type BudgetTier = z.infer<typeof BudgetTierSchema>;
/**
 * Canonical error every tier throws across a boundary. Carrying a stable `code`
 * keeps the Orchestrator's cascade/escalation logic decoupled from messages.
 */
export declare class ContractError extends Error {
    readonly code: string;
    constructor(code: string, message: string, cause?: unknown);
}
/** Thrown by skeleton stubs so an unimplemented path fails loudly, never silently. */
export declare class NotImplemented extends ContractError {
    constructor(what: string);
}
//# sourceMappingURL=common.d.ts.map