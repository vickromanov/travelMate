/**
 * apps/api — thin HTTP host. Wires routes to the Orchestrator + Trip Mode and
 * does boundary validation. NO business logic here (it lives in the packages).
 * HTTP framework (e.g. Fastify) chosen + added in the implementation phase.
 */
import { NotImplemented } from "@travelmate/contracts";
import { handlePlan } from "./routes/plan.js";
import { handleModify } from "./routes/modify.js";
import {
  handleTripModeStart,
  handleTripModeTick,
} from "./routes/trip-mode.js";

export const routes = {
  "POST /plan": handlePlan,
  "POST /modify": handleModify,
  "POST /trip-mode/start": handleTripModeStart,
  "POST /trip-mode/tick": handleTripModeTick,
};

export async function startServer(_port = Number(process.env.API_PORT ?? 8080)) {
  throw new NotImplemented("api.startServer");
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
  void startServer();
}
