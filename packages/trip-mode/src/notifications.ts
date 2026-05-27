/**
 * Dispatches a TripModeEvent as a push/local notification. Transport (web push,
 * Expo notifications) wired in the implementation phase. Skeleton.
 */
import { NotImplemented } from "@travelmate/contracts";
import type { TripModeEvent } from "@travelmate/contracts";

export interface NotificationDispatcher {
  dispatch(event: TripModeEvent): Promise<void>;
}

export const consoleDispatcher: NotificationDispatcher = {
  async dispatch(_event: TripModeEvent): Promise<void> {
    throw new NotImplemented("trip-mode.consoleDispatcher.dispatch");
  },
};
