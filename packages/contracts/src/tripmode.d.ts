/**
 * Trip-Mode → UX boundary (Highlight H5). The live in-trip feed.
 * projectStructure.md §3.4.
 */
import { z } from "zod";
export declare const TripModeEventSchema: z.ZodObject<{
    planId: z.ZodString;
    blockId: z.ZodString;
    kind: z.ZodEnum<["next", "leaveNow", "directions", "showTicket", "arrived", "done"]>;
    message: z.ZodString;
    /** When the UX should surface this (ISO). */
    triggerAt: z.ZodString;
    payload: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    message: string;
    blockId: string;
    planId: string;
    kind: "next" | "leaveNow" | "directions" | "showTicket" | "arrived" | "done";
    triggerAt: string;
    payload?: Record<string, unknown> | undefined;
}, {
    message: string;
    blockId: string;
    planId: string;
    kind: "next" | "leaveNow" | "directions" | "showTicket" | "arrived" | "done";
    triggerAt: string;
    payload?: Record<string, unknown> | undefined;
}>;
export type TripModeEvent = z.infer<typeof TripModeEventSchema>;
//# sourceMappingURL=tripmode.d.ts.map