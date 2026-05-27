/**
 * Trip-Mode → UX boundary (Highlight H5). The live in-trip feed.
 * projectStructure.md §3.4.
 */
import { z } from "zod";

export const TripModeEventSchema = z.object({
  planId: z.string().min(1),
  blockId: z.string().min(1),
  kind: z.enum([
    "next", // here is your next step
    "leaveNow", // time to leave to make it
    "directions", // how to get there from current position
    "showTicket", // QR / confirmation for the upcoming activity
    "arrived", // you have reached the location
    "done", // step complete, advancing
  ]),
  message: z.string(),
  /** When the UX should surface this (ISO). */
  triggerAt: z.string().datetime(),
  payload: z.record(z.unknown()).optional(),
});
export type TripModeEvent = z.infer<typeof TripModeEventSchema>;
