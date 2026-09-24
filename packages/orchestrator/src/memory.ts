/**
 * Memory extraction — extracts personal facts from trip descriptions.
 * Runs in parallel with the plan pipeline (non-blocking).
 * Uses the lightweight "qa" tier for speed.
 */
import type { LLMClient } from "@travelmate/llm";

export interface ExtractedMemory {
  category: "travel_party" | "dietary" | "interests" | "constraints" | "home_base" | "general";
  fact: string;
}

interface ExistingMemory {
  category: string;
  fact: string;
}

const SYSTEM = `You extract personal facts about a traveler from their trip description.
Only extract DURABLE facts that apply beyond this single trip — things about the person,
not about the trip itself.

EXTRACT:
- Travel party composition (kids and their ages, partner, elderly parents)
- Dietary needs specific to family members ("son is allergic to nuts")
- Strong interests or dislikes ("we hate museums", "loves street food")
- Home base / origin city
- Practical constraints (mobility issues, nap schedules, early risers)
- Pet peeves or strong preferences ("always need a pool")

DO NOT EXTRACT:
- The destination (trip-specific)
- Dates (trip-specific)
- Budget tier (already in preferences)
- Generic interests already covered by preference toggles (history, nightlife, etc.)
- One-time trip details ("visiting grandma")

Output ONLY a JSON array of objects: [{"category": "...", "fact": "..."}]
If nothing worth remembering, output: []
Each fact should be a clear, concise statement about the person.
Deduplicate against the existing memories provided — do not extract facts already known.`;

export async function extractMemories(
  tripText: string,
  existingMemories: ExistingMemory[],
  llm: LLMClient,
): Promise<ExtractedMemory[]> {
  const existingBlock = existingMemories.length > 0
    ? `\nEXISTING MEMORIES (do NOT re-extract these):\n${existingMemories.map((m) => `- [${m.category}] ${m.fact}`).join("\n")}`
    : "";

  try {
    const res = await llm.run(
      {
        stage: "intent",
        system: SYSTEM,
        cacheableContext: "",
        user: `Trip description: "${tripText}"${existingBlock}\n\nExtract new personal facts.`,
      },
      (text) => {
        try {
          const arr = JSON.parse(text);
          return Array.isArray(arr);
        } catch {
          return false;
        }
      },
    );

    const raw = JSON.parse(res.text) as unknown[];
    const results: ExtractedMemory[] = [];
    const validCategories = new Set(["travel_party", "dietary", "interests", "constraints", "home_base", "general"]);

    for (const item of raw) {
      if (
        typeof item === "object" && item !== null &&
        "category" in item && "fact" in item &&
        typeof (item as { category: unknown }).category === "string" &&
        typeof (item as { fact: unknown }).fact === "string"
      ) {
        const cat = (item as { category: string }).category;
        const fact = (item as { fact: string }).fact.slice(0, 500);
        if (validCategories.has(cat) && fact.length > 0) {
          results.push({ category: cat as ExtractedMemory["category"], fact });
        }
      }
    }
    return results;
  } catch {
    return [];
  }
}
