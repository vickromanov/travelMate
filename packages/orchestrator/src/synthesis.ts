/**
 * Stage 3 — Synthesis. Fetched + cached data → the zero-thinking TripPlan (H3).
 * The one expensive LLM call: tier `mid`, escalate to `frontier` only after 2
 * validation failures. Token discipline (projectStructure.md §7.3):
 *   - schema/system sent as a CACHED prompt block
 *   - LLM sees compact summaries + returns option IDs; code hydrates full
 *     records from the Cache afterwards (IDs in, IDs out).
 */
import { NotImplemented } from "@travelmate/contracts";
import type {
  TripBrief,
  NormalizedResult,
  TripPlan,
  StreamCallbacks,
} from "@travelmate/contracts";
import type { LLMClient } from "@travelmate/llm";

export async function synthesizePlan(
  _brief: TripBrief,
  _data: NormalizedResult[],
  _llm: LLMClient,
  _cb: StreamCallbacks,
): Promise<TripPlan> {
  throw new NotImplemented("orchestrator.synthesizePlan");
}
