/**
 * Trip Mode endpoints (Highlight H5): start/stop live guidance and feed
 * position/time ticks. Subscribers receive TripModeEvents. Skeleton.
 */
import { NotImplemented } from "@travelmate/contracts";

export async function handleTripModeStart(_planId: string): Promise<never> {
  throw new NotImplemented("api.handleTripModeStart");
}

export async function handleTripModeTick(
  _planId: string,
  _at: string,
): Promise<never> {
  throw new NotImplemented("api.handleTripModeTick");
}
