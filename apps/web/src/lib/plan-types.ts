/**
 * Client-side mirrors of the @travelmate/contracts trip types.
 * The UX deliberately does NOT import the contracts package (P5 — tiers
 * talk over HTTP, the API validates); these shapes match the JSON it serves.
 */

export interface Money { amount: number; currency: string; }
export interface GeoLocation { lat: number; lng: number; address: string; }

export interface TravelOption {
  id: string; tier: string; title: string; description: string;
  reasoning: string; price: Money; location: GeoLocation;
  openingHours?: string; phoneNumber?: string;
  bookingUrl?: string; scheduledTime?: string; durationMinutes?: number;
  link?: string;
}

export interface Block {
  blockId: string; category: string; scheduledTime: string;
  label?: string; selectedOptionId: string; dependencyLogic: string;
  options: TravelOption[];
}

export interface DayPlan {
  dayNumber: number; date: string; title: string; theme: string;
  dailyTips: string[]; blocks: Block[];
}

export interface TripPlan {
  planId: string; title: string; description: string;
  totalEstimatedCost: Money; duration: string; days: DayPlan[];
}

/** The option the traveler actually chose for a block. */
export function selectedOption(block: Block): TravelOption | undefined {
  return block.options.find((o) => o.id === block.selectedOptionId) ?? block.options[0];
}
