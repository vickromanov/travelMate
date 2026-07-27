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
