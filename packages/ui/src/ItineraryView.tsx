/**
 * Renders a TripPlan and exposes per-block "swap" (Highlight H4). Presentational
 * only — the swap handler is passed in; this component never calls the
 * Orchestrator (P5, import matrix §2). Skeleton.
 */
import type { TripPlan, PlanEdit } from "@travelmate/contracts";

export interface ItineraryViewProps {
  plan: TripPlan;
  onSwap: (edit: PlanEdit) => void;
}

export function ItineraryView(_props: ItineraryViewProps): null {
  // TODO(ui): render days → blocks → swappable options. Skeleton returns nothing.
  return null;
}
