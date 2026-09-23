import { z } from "zod";
import { BudgetTierSchema } from "./common.js";

export const SignupRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).optional(),
});
export type SignupRequest = z.infer<typeof SignupRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const UserPreferencesSchema = z.object({
  dietaryRestrictions: z.array(z.string()).default([]),
  accessibilityNeeds: z.string().default(""),
  travelPace: z.enum(["relaxed", "moderate", "packed"]).default("moderate"),
  interests: z.array(z.string()).default([]),
  accommodationStyle: z
    .enum(["hotel", "boutique", "hostel", "apartment", "resort", "no-preference"])
    .default("no-preference"),
  travelStyle: z.array(z.string()).default([]),
  homeCity: z.string().default(""),
  defaultBudgetTier: BudgetTierSchema.nullable().default(null),
  preferredCurrency: z.string().default(""),
});
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
