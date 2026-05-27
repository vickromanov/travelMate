/**
 * Stage 1 — Intent. Free-form user text → validated TripBrief.
 * Decomposed (atomic facts → free-form traveler profile → inference loop). No
 * archetypes (P3). Every assumption logged to onThought BEFORE any fetch (P1).
 * Default LLM tier: fast (projectStructure.md §7.2).
 */
import { NotImplemented } from "@travelmate/contracts";
import type { CrucialInfo, TripBrief, StreamCallbacks } from "@travelmate/contracts";
import type { LLMClient } from "@travelmate/llm";

export async function extractIntent(
  _input: CrucialInfo,
  _llm: LLMClient,
  _cb: StreamCallbacks,
): Promise<TripBrief> {
  throw new NotImplemented("orchestrator.extractIntent");
}
