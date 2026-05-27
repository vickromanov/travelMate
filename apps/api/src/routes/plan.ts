/**
 * POST /plan — validate CrucialInfo (zod), then run the Orchestrator plan
 * pipeline. Streams onThought; the client learns the result by subscribing to
 * the plan via the Database Observer (no onComplete). Skeleton.
 */
import { NotImplemented, CrucialInfoSchema } from "@travelmate/contracts";

export async function handlePlan(_body: unknown): Promise<never> {
  CrucialInfoSchema.parse(_body); // boundary validation belongs here
  throw new NotImplemented("api.handlePlan");
}
