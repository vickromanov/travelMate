/**
 * The trip vocabulary: from what the UX collects → to the zero-thinking itinerary.
 * See about_travelMate.md (H2/H3/H4) and projectStructure.md §4.
 */
import { z } from "zod";
export declare const CrucialInfoSchema: z.ZodObject<{
    destination: z.ZodString;
    /** Free-form — NO archetype enum. Principle P3. */
    travelerDescription: z.ZodString;
    tripType: z.ZodString;
    budgetTier: z.ZodEnum<["ECONOMY", "SMART", "LUXURY"]>;
    origin: z.ZodOptional<z.ZodString>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    partyAdults: z.ZodOptional<z.ZodNumber>;
    partyChildren: z.ZodOptional<z.ZodNumber>;
    freeformText: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    destination: string;
    travelerDescription: string;
    tripType: string;
    budgetTier: "ECONOMY" | "SMART" | "LUXURY";
    origin?: string | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    partyAdults?: number | undefined;
    partyChildren?: number | undefined;
    freeformText?: string | undefined;
}, {
    destination: string;
    travelerDescription: string;
    tripType: string;
    budgetTier: "ECONOMY" | "SMART" | "LUXURY";
    origin?: string | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    partyAdults?: number | undefined;
    partyChildren?: number | undefined;
    freeformText?: string | undefined;
}>;
export type CrucialInfo = z.infer<typeof CrucialInfoSchema>;
export declare const InferenceEntrySchema: z.ZodObject<{
    field: z.ZodString;
    assumed: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    field: string;
    assumed: string;
    reason: string;
}, {
    field: string;
    assumed: string;
    reason: string;
}>;
export type InferenceEntry = z.infer<typeof InferenceEntrySchema>;
export declare const TripBriefSchema: z.ZodObject<{
    facts: z.ZodObject<{
        destination: z.ZodString;
        /** Free-form — NO archetype enum. Principle P3. */
        travelerDescription: z.ZodString;
        tripType: z.ZodString;
        budgetTier: z.ZodEnum<["ECONOMY", "SMART", "LUXURY"]>;
        origin: z.ZodOptional<z.ZodString>;
        startDate: z.ZodOptional<z.ZodString>;
        endDate: z.ZodOptional<z.ZodString>;
        partyAdults: z.ZodOptional<z.ZodNumber>;
        partyChildren: z.ZodOptional<z.ZodNumber>;
        freeformText: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        destination: string;
        travelerDescription: string;
        tripType: string;
        budgetTier: "ECONOMY" | "SMART" | "LUXURY";
        origin?: string | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        partyAdults?: number | undefined;
        partyChildren?: number | undefined;
        freeformText?: string | undefined;
    }, {
        destination: string;
        travelerDescription: string;
        tripType: string;
        budgetTier: "ECONOMY" | "SMART" | "LUXURY";
        origin?: string | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        partyAdults?: number | undefined;
        partyChildren?: number | undefined;
        freeformText?: string | undefined;
    }>;
    /** Free-form natural-language profile of THIS traveler. Never an archetype. */
    travelerProfile: z.ZodString;
    /** Every assumption made to fill a null fact — streamed to onThought (P1). */
    inferenceChain: z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        assumed: z.ZodString;
        reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        field: string;
        assumed: string;
        reason: string;
    }, {
        field: string;
        assumed: string;
        reason: string;
    }>, "many">;
    /** Which categories this trip needs fetched. */
    neededCategories: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    facts: {
        destination: string;
        travelerDescription: string;
        tripType: string;
        budgetTier: "ECONOMY" | "SMART" | "LUXURY";
        origin?: string | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        partyAdults?: number | undefined;
        partyChildren?: number | undefined;
        freeformText?: string | undefined;
    };
    travelerProfile: string;
    inferenceChain: {
        field: string;
        assumed: string;
        reason: string;
    }[];
    neededCategories: string[];
}, {
    facts: {
        destination: string;
        travelerDescription: string;
        tripType: string;
        budgetTier: "ECONOMY" | "SMART" | "LUXURY";
        origin?: string | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        partyAdults?: number | undefined;
        partyChildren?: number | undefined;
        freeformText?: string | undefined;
    };
    travelerProfile: string;
    inferenceChain: {
        field: string;
        assumed: string;
        reason: string;
    }[];
    neededCategories: string[];
}>;
export type TripBrief = z.infer<typeof TripBriefSchema>;
export declare const TravelOptionSchema: z.ZodObject<{
    id: z.ZodString;
    tier: z.ZodEnum<["ANCHOR", "SMART-VALUE", "PREMIUM", "INDEPENDENT"]>;
    title: z.ZodString;
    description: z.ZodString;
    reasoning: z.ZodString;
    price: z.ZodObject<{
        amount: z.ZodNumber;
        currency: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        amount: number;
        currency: string;
    }, {
        amount: number;
        currency: string;
    }>;
    location: z.ZodObject<{
        lat: z.ZodNumber;
        lng: z.ZodNumber;
        address: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        lat: number;
        lng: number;
        address: string;
    }, {
        lat: number;
        lng: number;
        address: string;
    }>;
    scheduledTime: z.ZodOptional<z.ZodString>;
    durationMinutes: z.ZodOptional<z.ZodNumber>;
    bookingRequired: z.ZodOptional<z.ZodBoolean>;
    bookingUrl: z.ZodOptional<z.ZodString>;
    openingHours: z.ZodOptional<z.ZodString>;
    phoneNumber: z.ZodOptional<z.ZodString>;
    /** Source/affiliate provenance — present on every option. */
    affiliationRef: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    tier: "ANCHOR" | "SMART-VALUE" | "PREMIUM" | "INDEPENDENT";
    title: string;
    description: string;
    reasoning: string;
    price: {
        amount: number;
        currency: string;
    };
    location: {
        lat: number;
        lng: number;
        address: string;
    };
    scheduledTime?: string | undefined;
    durationMinutes?: number | undefined;
    bookingRequired?: boolean | undefined;
    bookingUrl?: string | undefined;
    openingHours?: string | undefined;
    phoneNumber?: string | undefined;
    affiliationRef?: string | undefined;
}, {
    id: string;
    tier: "ANCHOR" | "SMART-VALUE" | "PREMIUM" | "INDEPENDENT";
    title: string;
    description: string;
    reasoning: string;
    price: {
        amount: number;
        currency: string;
    };
    location: {
        lat: number;
        lng: number;
        address: string;
    };
    scheduledTime?: string | undefined;
    durationMinutes?: number | undefined;
    bookingRequired?: boolean | undefined;
    bookingUrl?: string | undefined;
    openingHours?: string | undefined;
    phoneNumber?: string | undefined;
    affiliationRef?: string | undefined;
}>;
export type TravelOption = z.infer<typeof TravelOptionSchema>;
export declare const ItineraryBlockSchema: z.ZodObject<{
    blockId: z.ZodString;
    category: z.ZodEnum<["STAYS", "TRANSPORT", "DINING", "ACTIVITIES", "LOGISTICS"]>;
    timeSlot: z.ZodOptional<z.ZodEnum<["MORNING", "AFTERNOON", "EVENING", "OVERNIGHT", "ALL_DAY"]>>;
    scheduledTime: z.ZodString;
    label: z.ZodOptional<z.ZodString>;
    isOptional: z.ZodOptional<z.ZodBoolean>;
    selectedOptionId: z.ZodString;
    /**
     * Drives the Re-flow Engine (H4). "none" = independent. Otherwise an expression
     * naming the blocks/locations this block depends on (e.g. depends on STAYS
     * location → re-flow when the hotel changes). projectStructure.md §2 Refinement 1.
     */
    dependencyLogic: z.ZodString;
    options: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        tier: z.ZodEnum<["ANCHOR", "SMART-VALUE", "PREMIUM", "INDEPENDENT"]>;
        title: z.ZodString;
        description: z.ZodString;
        reasoning: z.ZodString;
        price: z.ZodObject<{
            amount: z.ZodNumber;
            currency: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            amount: number;
            currency: string;
        }, {
            amount: number;
            currency: string;
        }>;
        location: z.ZodObject<{
            lat: z.ZodNumber;
            lng: z.ZodNumber;
            address: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            lat: number;
            lng: number;
            address: string;
        }, {
            lat: number;
            lng: number;
            address: string;
        }>;
        scheduledTime: z.ZodOptional<z.ZodString>;
        durationMinutes: z.ZodOptional<z.ZodNumber>;
        bookingRequired: z.ZodOptional<z.ZodBoolean>;
        bookingUrl: z.ZodOptional<z.ZodString>;
        openingHours: z.ZodOptional<z.ZodString>;
        phoneNumber: z.ZodOptional<z.ZodString>;
        /** Source/affiliate provenance — present on every option. */
        affiliationRef: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        tier: "ANCHOR" | "SMART-VALUE" | "PREMIUM" | "INDEPENDENT";
        title: string;
        description: string;
        reasoning: string;
        price: {
            amount: number;
            currency: string;
        };
        location: {
            lat: number;
            lng: number;
            address: string;
        };
        scheduledTime?: string | undefined;
        durationMinutes?: number | undefined;
        bookingRequired?: boolean | undefined;
        bookingUrl?: string | undefined;
        openingHours?: string | undefined;
        phoneNumber?: string | undefined;
        affiliationRef?: string | undefined;
    }, {
        id: string;
        tier: "ANCHOR" | "SMART-VALUE" | "PREMIUM" | "INDEPENDENT";
        title: string;
        description: string;
        reasoning: string;
        price: {
            amount: number;
            currency: string;
        };
        location: {
            lat: number;
            lng: number;
            address: string;
        };
        scheduledTime?: string | undefined;
        durationMinutes?: number | undefined;
        bookingRequired?: boolean | undefined;
        bookingUrl?: string | undefined;
        openingHours?: string | undefined;
        phoneNumber?: string | undefined;
        affiliationRef?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    options: {
        id: string;
        tier: "ANCHOR" | "SMART-VALUE" | "PREMIUM" | "INDEPENDENT";
        title: string;
        description: string;
        reasoning: string;
        price: {
            amount: number;
            currency: string;
        };
        location: {
            lat: number;
            lng: number;
            address: string;
        };
        scheduledTime?: string | undefined;
        durationMinutes?: number | undefined;
        bookingRequired?: boolean | undefined;
        bookingUrl?: string | undefined;
        openingHours?: string | undefined;
        phoneNumber?: string | undefined;
        affiliationRef?: string | undefined;
    }[];
    scheduledTime: string;
    blockId: string;
    category: "STAYS" | "TRANSPORT" | "DINING" | "ACTIVITIES" | "LOGISTICS";
    selectedOptionId: string;
    dependencyLogic: string;
    timeSlot?: "MORNING" | "AFTERNOON" | "EVENING" | "OVERNIGHT" | "ALL_DAY" | undefined;
    label?: string | undefined;
    isOptional?: boolean | undefined;
}, {
    options: {
        id: string;
        tier: "ANCHOR" | "SMART-VALUE" | "PREMIUM" | "INDEPENDENT";
        title: string;
        description: string;
        reasoning: string;
        price: {
            amount: number;
            currency: string;
        };
        location: {
            lat: number;
            lng: number;
            address: string;
        };
        scheduledTime?: string | undefined;
        durationMinutes?: number | undefined;
        bookingRequired?: boolean | undefined;
        bookingUrl?: string | undefined;
        openingHours?: string | undefined;
        phoneNumber?: string | undefined;
        affiliationRef?: string | undefined;
    }[];
    scheduledTime: string;
    blockId: string;
    category: "STAYS" | "TRANSPORT" | "DINING" | "ACTIVITIES" | "LOGISTICS";
    selectedOptionId: string;
    dependencyLogic: string;
    timeSlot?: "MORNING" | "AFTERNOON" | "EVENING" | "OVERNIGHT" | "ALL_DAY" | undefined;
    label?: string | undefined;
    isOptional?: boolean | undefined;
}>;
export type ItineraryBlock = z.infer<typeof ItineraryBlockSchema>;
export declare const DayPlanSchema: z.ZodObject<{
    dayNumber: z.ZodNumber;
    date: z.ZodString;
    title: z.ZodString;
    theme: z.ZodString;
    dailyTips: z.ZodArray<z.ZodString, "many">;
    startLocation: z.ZodOptional<z.ZodString>;
    blocks: z.ZodArray<z.ZodObject<{
        blockId: z.ZodString;
        category: z.ZodEnum<["STAYS", "TRANSPORT", "DINING", "ACTIVITIES", "LOGISTICS"]>;
        timeSlot: z.ZodOptional<z.ZodEnum<["MORNING", "AFTERNOON", "EVENING", "OVERNIGHT", "ALL_DAY"]>>;
        scheduledTime: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
        isOptional: z.ZodOptional<z.ZodBoolean>;
        selectedOptionId: z.ZodString;
        /**
         * Drives the Re-flow Engine (H4). "none" = independent. Otherwise an expression
         * naming the blocks/locations this block depends on (e.g. depends on STAYS
         * location → re-flow when the hotel changes). projectStructure.md §2 Refinement 1.
         */
        dependencyLogic: z.ZodString;
        options: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            tier: z.ZodEnum<["ANCHOR", "SMART-VALUE", "PREMIUM", "INDEPENDENT"]>;
            title: z.ZodString;
            description: z.ZodString;
            reasoning: z.ZodString;
            price: z.ZodObject<{
                amount: z.ZodNumber;
                currency: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                amount: number;
                currency: string;
            }, {
                amount: number;
                currency: string;
            }>;
            location: z.ZodObject<{
                lat: z.ZodNumber;
                lng: z.ZodNumber;
                address: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                lat: number;
                lng: number;
                address: string;
            }, {
                lat: number;
                lng: number;
                address: string;
            }>;
            scheduledTime: z.ZodOptional<z.ZodString>;
            durationMinutes: z.ZodOptional<z.ZodNumber>;
            bookingRequired: z.ZodOptional<z.ZodBoolean>;
            bookingUrl: z.ZodOptional<z.ZodString>;
            openingHours: z.ZodOptional<z.ZodString>;
            phoneNumber: z.ZodOptional<z.ZodString>;
            /** Source/affiliate provenance — present on every option. */
            affiliationRef: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            tier: "ANCHOR" | "SMART-VALUE" | "PREMIUM" | "INDEPENDENT";
            title: string;
            description: string;
            reasoning: string;
            price: {
                amount: number;
                currency: string;
            };
            location: {
                lat: number;
                lng: number;
                address: string;
            };
            scheduledTime?: string | undefined;
            durationMinutes?: number | undefined;
            bookingRequired?: boolean | undefined;
            bookingUrl?: string | undefined;
            openingHours?: string | undefined;
            phoneNumber?: string | undefined;
            affiliationRef?: string | undefined;
        }, {
            id: string;
            tier: "ANCHOR" | "SMART-VALUE" | "PREMIUM" | "INDEPENDENT";
            title: string;
            description: string;
            reasoning: string;
            price: {
                amount: number;
                currency: string;
            };
            location: {
                lat: number;
                lng: number;
                address: string;
            };
            scheduledTime?: string | undefined;
            durationMinutes?: number | undefined;
            bookingRequired?: boolean | undefined;
            bookingUrl?: string | undefined;
            openingHours?: string | undefined;
            phoneNumber?: string | undefined;
            affiliationRef?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        options: {
            id: string;
            tier: "ANCHOR" | "SMART-VALUE" | "PREMIUM" | "INDEPENDENT";
            title: string;
            description: string;
            reasoning: string;
            price: {
                amount: number;
                currency: string;
            };
            location: {
                lat: number;
                lng: number;
                address: string;
            };
            scheduledTime?: string | undefined;
            durationMinutes?: number | undefined;
            bookingRequired?: boolean | undefined;
            bookingUrl?: string | undefined;
            openingHours?: string | undefined;
            phoneNumber?: string | undefined;
            affiliationRef?: string | undefined;
        }[];
        scheduledTime: string;
        blockId: string;
        category: "STAYS" | "TRANSPORT" | "DINING" | "ACTIVITIES" | "LOGISTICS";
        selectedOptionId: string;
        dependencyLogic: string;
        timeSlot?: "MORNING" | "AFTERNOON" | "EVENING" | "OVERNIGHT" | "ALL_DAY" | undefined;
        label?: string | undefined;
        isOptional?: boolean | undefined;
    }, {
        options: {
            id: string;
            tier: "ANCHOR" | "SMART-VALUE" | "PREMIUM" | "INDEPENDENT";
            title: string;
            description: string;
            reasoning: string;
            price: {
                amount: number;
                currency: string;
            };
            location: {
                lat: number;
                lng: number;
                address: string;
            };
            scheduledTime?: string | undefined;
            durationMinutes?: number | undefined;
            bookingRequired?: boolean | undefined;
            bookingUrl?: string | undefined;
            openingHours?: string | undefined;
            phoneNumber?: string | undefined;
            affiliationRef?: string | undefined;
        }[];
        scheduledTime: string;
        blockId: string;
        category: "STAYS" | "TRANSPORT" | "DINING" | "ACTIVITIES" | "LOGISTICS";
        selectedOptionId: string;
        dependencyLogic: string;
        timeSlot?: "MORNING" | "AFTERNOON" | "EVENING" | "OVERNIGHT" | "ALL_DAY" | undefined;
        label?: string | undefined;
        isOptional?: boolean | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    date: string;
    title: string;
    dayNumber: number;
    theme: string;
    dailyTips: string[];
    blocks: {
        options: {
            id: string;
            tier: "ANCHOR" | "SMART-VALUE" | "PREMIUM" | "INDEPENDENT";
            title: string;
            description: string;
            reasoning: string;
            price: {
                amount: number;
                currency: string;
            };
            location: {
                lat: number;
                lng: number;
                address: string;
            };
            scheduledTime?: string | undefined;
            durationMinutes?: number | undefined;
            bookingRequired?: boolean | undefined;
            bookingUrl?: string | undefined;
            openingHours?: string | undefined;
            phoneNumber?: string | undefined;
            affiliationRef?: string | undefined;
        }[];
        scheduledTime: string;
        blockId: string;
        category: "STAYS" | "TRANSPORT" | "DINING" | "ACTIVITIES" | "LOGISTICS";
        selectedOptionId: string;
        dependencyLogic: string;
        timeSlot?: "MORNING" | "AFTERNOON" | "EVENING" | "OVERNIGHT" | "ALL_DAY" | undefined;
        label?: string | undefined;
        isOptional?: boolean | undefined;
    }[];
    startLocation?: string | undefined;
}, {
    date: string;
    title: string;
    dayNumber: number;
    theme: string;
    dailyTips: string[];
    blocks: {
        options: {
            id: string;
            tier: "ANCHOR" | "SMART-VALUE" | "PREMIUM" | "INDEPENDENT";
            title: string;
            description: string;
            reasoning: string;
            price: {
                amount: number;
                currency: string;
            };
            location: {
                lat: number;
                lng: number;
                address: string;
            };
            scheduledTime?: string | undefined;
            durationMinutes?: number | undefined;
            bookingRequired?: boolean | undefined;
            bookingUrl?: string | undefined;
            openingHours?: string | undefined;
            phoneNumber?: string | undefined;
            affiliationRef?: string | undefined;
        }[];
        scheduledTime: string;
        blockId: string;
        category: "STAYS" | "TRANSPORT" | "DINING" | "ACTIVITIES" | "LOGISTICS";
        selectedOptionId: string;
        dependencyLogic: string;
        timeSlot?: "MORNING" | "AFTERNOON" | "EVENING" | "OVERNIGHT" | "ALL_DAY" | undefined;
        label?: string | undefined;
        isOptional?: boolean | undefined;
    }[];
    startLocation?: string | undefined;
}>;
export type DayPlan = z.infer<typeof DayPlanSchema>;
export declare const TripPlanSchema: z.ZodObject<{
    planId: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    totalEstimatedCost: z.ZodObject<{
        amount: z.ZodNumber;
        currency: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        amount: number;
        currency: string;
    }, {
        amount: number;
        currency: string;
    }>;
    duration: z.ZodString;
    days: z.ZodArray<z.ZodObject<{
        dayNumber: z.ZodNumber;
        date: z.ZodString;
        title: z.ZodString;
        theme: z.ZodString;
        dailyTips: z.ZodArray<z.ZodString, "many">;
        startLocation: z.ZodOptional<z.ZodString>;
        blocks: z.ZodArray<z.ZodObject<{
            blockId: z.ZodString;
            category: z.ZodEnum<["STAYS", "TRANSPORT", "DINING", "ACTIVITIES", "LOGISTICS"]>;
            timeSlot: z.ZodOptional<z.ZodEnum<["MORNING", "AFTERNOON", "EVENING", "OVERNIGHT", "ALL_DAY"]>>;
            scheduledTime: z.ZodString;
            label: z.ZodOptional<z.ZodString>;
            isOptional: z.ZodOptional<z.ZodBoolean>;
            selectedOptionId: z.ZodString;
            /**
             * Drives the Re-flow Engine (H4). "none" = independent. Otherwise an expression
             * naming the blocks/locations this block depends on (e.g. depends on STAYS
             * location → re-flow when the hotel changes). projectStructure.md §2 Refinement 1.
             */
            dependencyLogic: z.ZodString;
            options: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                tier: z.ZodEnum<["ANCHOR", "SMART-VALUE", "PREMIUM", "INDEPENDENT"]>;
                title: z.ZodString;
                description: z.ZodString;
                reasoning: z.ZodString;
                price: z.ZodObject<{
                    amount: z.ZodNumber;
                    currency: z.ZodString;
                }, "strip", z.ZodTypeAny, {
                    amount: number;
                    currency: string;
                }, {
                    amount: number;
                    currency: string;
                }>;
                location: z.ZodObject<{
                    lat: z.ZodNumber;
                    lng: z.ZodNumber;
                    address: z.ZodString;
                }, "strip", z.ZodTypeAny, {
                    lat: number;
                    lng: number;
                    address: string;
                }, {
                    lat: number;
                    lng: number;
                    address: string;
                }>;
                scheduledTime: z.ZodOptional<z.ZodString>;
                durationMinutes: z.ZodOptional<z.ZodNumber>;
                bookingRequired: z.ZodOptional<z.ZodBoolean>;
                bookingUrl: z.ZodOptional<z.ZodString>;
                openingHours: z.ZodOptional<z.ZodString>;
                phoneNumber: z.ZodOptional<z.ZodString>;
                /** Source/affiliate provenance — present on every option. */
                affiliationRef: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                id: string;
                tier: "ANCHOR" | "SMART-VALUE" | "PREMIUM" | "INDEPENDENT";
                title: string;
                description: string;
                reasoning: string;
                price: {
                    amount: number;
                    currency: string;
                };
                location: {
                    lat: number;
                    lng: number;
                    address: string;
                };
                scheduledTime?: string | undefined;
                durationMinutes?: number | undefined;
                bookingRequired?: boolean | undefined;
                bookingUrl?: string | undefined;
                openingHours?: string | undefined;
                phoneNumber?: string | undefined;
                affiliationRef?: string | undefined;
            }, {
                id: string;
                tier: "ANCHOR" | "SMART-VALUE" | "PREMIUM" | "INDEPENDENT";
                title: string;
                description: string;
                reasoning: string;
                price: {
                    amount: number;
                    currency: string;
                };
                location: {
                    lat: number;
                    lng: number;
                    address: string;
                };
                scheduledTime?: string | undefined;
                durationMinutes?: number | undefined;
                bookingRequired?: boolean | undefined;
                bookingUrl?: string | undefined;
                openingHours?: string | undefined;
                phoneNumber?: string | undefined;
                affiliationRef?: string | undefined;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            options: {
                id: string;
                tier: "ANCHOR" | "SMART-VALUE" | "PREMIUM" | "INDEPENDENT";
                title: string;
                description: string;
                reasoning: string;
                price: {
                    amount: number;
                    currency: string;
                };
                location: {
                    lat: number;
                    lng: number;
                    address: string;
                };
                scheduledTime?: string | undefined;
                durationMinutes?: number | undefined;
                bookingRequired?: boolean | undefined;
                bookingUrl?: string | undefined;
                openingHours?: string | undefined;
                phoneNumber?: string | undefined;
                affiliationRef?: string | undefined;
            }[];
            scheduledTime: string;
            blockId: string;
            category: "STAYS" | "TRANSPORT" | "DINING" | "ACTIVITIES" | "LOGISTICS";
            selectedOptionId: string;
            dependencyLogic: string;
            timeSlot?: "MORNING" | "AFTERNOON" | "EVENING" | "OVERNIGHT" | "ALL_DAY" | undefined;
            label?: string | undefined;
            isOptional?: boolean | undefined;
        }, {
            options: {
                id: string;
                tier: "ANCHOR" | "SMART-VALUE" | "PREMIUM" | "INDEPENDENT";
                title: string;
                description: string;
                reasoning: string;
                price: {
                    amount: number;
                    currency: string;
                };
                location: {
                    lat: number;
                    lng: number;
                    address: string;
                };
                scheduledTime?: string | undefined;
                durationMinutes?: number | undefined;
                bookingRequired?: boolean | undefined;
                bookingUrl?: string | undefined;
                openingHours?: string | undefined;
                phoneNumber?: string | undefined;
                affiliationRef?: string | undefined;
            }[];
            scheduledTime: string;
            blockId: string;
            category: "STAYS" | "TRANSPORT" | "DINING" | "ACTIVITIES" | "LOGISTICS";
            selectedOptionId: string;
            dependencyLogic: string;
            timeSlot?: "MORNING" | "AFTERNOON" | "EVENING" | "OVERNIGHT" | "ALL_DAY" | undefined;
            label?: string | undefined;
            isOptional?: boolean | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        date: string;
        title: string;
        dayNumber: number;
        theme: string;
        dailyTips: string[];
        blocks: {
            options: {
                id: string;
                tier: "ANCHOR" | "SMART-VALUE" | "PREMIUM" | "INDEPENDENT";
                title: string;
                description: string;
                reasoning: string;
                price: {
                    amount: number;
                    currency: string;
                };
                location: {
                    lat: number;
                    lng: number;
                    address: string;
                };
                scheduledTime?: string | undefined;
                durationMinutes?: number | undefined;
                bookingRequired?: boolean | undefined;
                bookingUrl?: string | undefined;
                openingHours?: string | undefined;
                phoneNumber?: string | undefined;
                affiliationRef?: string | undefined;
            }[];
            scheduledTime: string;
            blockId: string;
            category: "STAYS" | "TRANSPORT" | "DINING" | "ACTIVITIES" | "LOGISTICS";
            selectedOptionId: string;
            dependencyLogic: string;
            timeSlot?: "MORNING" | "AFTERNOON" | "EVENING" | "OVERNIGHT" | "ALL_DAY" | undefined;
            label?: string | undefined;
            isOptional?: boolean | undefined;
        }[];
        startLocation?: string | undefined;
    }, {
        date: string;
        title: string;
        dayNumber: number;
        theme: string;
        dailyTips: string[];
        blocks: {
            options: {
                id: string;
                tier: "ANCHOR" | "SMART-VALUE" | "PREMIUM" | "INDEPENDENT";
                title: string;
                description: string;
                reasoning: string;
                price: {
                    amount: number;
                    currency: string;
                };
                location: {
                    lat: number;
                    lng: number;
                    address: string;
                };
                scheduledTime?: string | undefined;
                durationMinutes?: number | undefined;
                bookingRequired?: boolean | undefined;
                bookingUrl?: string | undefined;
                openingHours?: string | undefined;
                phoneNumber?: string | undefined;
                affiliationRef?: string | undefined;
            }[];
            scheduledTime: string;
            blockId: string;
            category: "STAYS" | "TRANSPORT" | "DINING" | "ACTIVITIES" | "LOGISTICS";
            selectedOptionId: string;
            dependencyLogic: string;
            timeSlot?: "MORNING" | "AFTERNOON" | "EVENING" | "OVERNIGHT" | "ALL_DAY" | undefined;
            label?: string | undefined;
            isOptional?: boolean | undefined;
        }[];
        startLocation?: string | undefined;
    }>, "many">;
    /** Echoed so the UX can show the assumptions that shaped the plan (P1). */
    inferenceChain: z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        assumed: z.ZodString;
        reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        field: string;
        assumed: string;
        reason: string;
    }, {
        field: string;
        assumed: string;
        reason: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    inferenceChain: {
        field: string;
        assumed: string;
        reason: string;
    }[];
    title: string;
    description: string;
    planId: string;
    totalEstimatedCost: {
        amount: number;
        currency: string;
    };
    duration: string;
    days: {
        date: string;
        title: string;
        dayNumber: number;
        theme: string;
        dailyTips: string[];
        blocks: {
            options: {
                id: string;
                tier: "ANCHOR" | "SMART-VALUE" | "PREMIUM" | "INDEPENDENT";
                title: string;
                description: string;
                reasoning: string;
                price: {
                    amount: number;
                    currency: string;
                };
                location: {
                    lat: number;
                    lng: number;
                    address: string;
                };
                scheduledTime?: string | undefined;
                durationMinutes?: number | undefined;
                bookingRequired?: boolean | undefined;
                bookingUrl?: string | undefined;
                openingHours?: string | undefined;
                phoneNumber?: string | undefined;
                affiliationRef?: string | undefined;
            }[];
            scheduledTime: string;
            blockId: string;
            category: "STAYS" | "TRANSPORT" | "DINING" | "ACTIVITIES" | "LOGISTICS";
            selectedOptionId: string;
            dependencyLogic: string;
            timeSlot?: "MORNING" | "AFTERNOON" | "EVENING" | "OVERNIGHT" | "ALL_DAY" | undefined;
            label?: string | undefined;
            isOptional?: boolean | undefined;
        }[];
        startLocation?: string | undefined;
    }[];
}, {
    inferenceChain: {
        field: string;
        assumed: string;
        reason: string;
    }[];
    title: string;
    description: string;
    planId: string;
    totalEstimatedCost: {
        amount: number;
        currency: string;
    };
    duration: string;
    days: {
        date: string;
        title: string;
        dayNumber: number;
        theme: string;
        dailyTips: string[];
        blocks: {
            options: {
                id: string;
                tier: "ANCHOR" | "SMART-VALUE" | "PREMIUM" | "INDEPENDENT";
                title: string;
                description: string;
                reasoning: string;
                price: {
                    amount: number;
                    currency: string;
                };
                location: {
                    lat: number;
                    lng: number;
                    address: string;
                };
                scheduledTime?: string | undefined;
                durationMinutes?: number | undefined;
                bookingRequired?: boolean | undefined;
                bookingUrl?: string | undefined;
                openingHours?: string | undefined;
                phoneNumber?: string | undefined;
                affiliationRef?: string | undefined;
            }[];
            scheduledTime: string;
            blockId: string;
            category: "STAYS" | "TRANSPORT" | "DINING" | "ACTIVITIES" | "LOGISTICS";
            selectedOptionId: string;
            dependencyLogic: string;
            timeSlot?: "MORNING" | "AFTERNOON" | "EVENING" | "OVERNIGHT" | "ALL_DAY" | undefined;
            label?: string | undefined;
            isOptional?: boolean | undefined;
        }[];
        startLocation?: string | undefined;
    }[];
}>;
export type TripPlan = z.infer<typeof TripPlanSchema>;
/** UX → Orchestrator: a single-step edit that triggers a scoped re-flow (H4). */
export declare const PlanEditSchema: z.ZodObject<{
    planId: z.ZodString;
    blockId: z.ZodString;
    newOptionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    blockId: string;
    planId: string;
    newOptionId: string;
}, {
    blockId: string;
    planId: string;
    newOptionId: string;
}>;
export type PlanEdit = z.infer<typeof PlanEditSchema>;
//# sourceMappingURL=trip.d.ts.map