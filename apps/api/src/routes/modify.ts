/**
 * POST /modify — one edit → scoped re-flow (Highlight H4). Never re-synthesises.
 * Skeleton.
 */
import { NotImplemented, PlanEditSchema } from "@travelmate/contracts";

export async function handleModify(_body: unknown): Promise<never> {
  PlanEditSchema.parse(_body);
  throw new NotImplemented("api.handleModify");
}
