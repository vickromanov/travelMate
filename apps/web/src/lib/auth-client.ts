const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

const opts: RequestInit = { credentials: "include", headers: { "Content-Type": "application/json" } };

export async function signup(email: string, password: string, name?: string): Promise<AuthUser> {
  const res = await fetch(`${BASE}/auth/signup`, {
    ...opts, method: "POST", body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Signup failed");
  }
  return res.json() as Promise<AuthUser>;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${BASE}/auth/login`, {
    ...opts, method: "POST", body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Login failed");
  }
  return res.json() as Promise<AuthUser>;
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/auth/logout`, { ...opts, method: "POST" });
}

export async function getMe(): Promise<AuthUser | null> {
  const res = await fetch(`${BASE}/auth/me`, { credentials: "include" });
  if (!res.ok) return null;
  return res.json() as Promise<AuthUser>;
}

export function getGoogleAuthUrl(): string {
  return `${BASE}/auth/google`;
}

export interface UserPreferences {
  dietaryRestrictions: string[];
  accessibilityNeeds: string;
  travelPace: "relaxed" | "moderate" | "packed";
  interests: string[];
  accommodationStyle: "hotel" | "boutique" | "hostel" | "apartment" | "resort" | "no-preference";
  travelStyle: string[];
  homeCity: string;
  defaultBudgetTier: "ECONOMY" | "SMART" | "LUXURY" | null;
  preferredCurrency: string;
}

export async function getPreferences(): Promise<UserPreferences> {
  const res = await fetch(`${BASE}/auth/preferences`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load preferences");
  return res.json() as Promise<UserPreferences>;
}

export async function updatePreferences(prefs: UserPreferences): Promise<UserPreferences> {
  const res = await fetch(`${BASE}/auth/preferences`, {
    ...opts, method: "PUT", body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error("Failed to save preferences");
  return res.json() as Promise<UserPreferences>;
}

export interface MemoryEntry {
  id: string;
  category: string;
  fact: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export async function getMemories(): Promise<MemoryEntry[]> {
  const res = await fetch(`${BASE}/auth/memories`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load memories");
  return res.json() as Promise<MemoryEntry[]>;
}

export async function addMemory(category: string, fact: string): Promise<MemoryEntry> {
  const res = await fetch(`${BASE}/auth/memories`, {
    ...opts, method: "POST", body: JSON.stringify({ category, fact }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Failed to add memory");
  }
  return res.json() as Promise<MemoryEntry>;
}

export async function deleteMemory(id: string): Promise<void> {
  const res = await fetch(`${BASE}/auth/memories/${id}`, {
    credentials: "include", method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete memory");
}

export async function updateMemories(memories: MemoryEntry[]): Promise<MemoryEntry[]> {
  const res = await fetch(`${BASE}/auth/memories`, {
    ...opts, method: "PUT", body: JSON.stringify({ memories }),
  });
  if (!res.ok) throw new Error("Failed to update memories");
  return res.json() as Promise<MemoryEntry[]>;
}
