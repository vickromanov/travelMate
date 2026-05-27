/**
 * Collects the free-form trip/traveler description + validates Crucial Info
 * before it is sent to the Orchestrator (about_travelMate.md §8). No archetype
 * pickers — free text only (P3). Skeleton.
 */
import type { CrucialInfo } from "@travelmate/contracts";

export interface TripDescribeProps {
  onSubmit: (info: CrucialInfo) => void;
}

export function TripDescribe(_props: TripDescribeProps): null {
  // TODO(ui): multi-turn collector; zod-validate CrucialInfo before onSubmit.
  return null;
}
