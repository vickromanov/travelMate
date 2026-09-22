"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import * as authClient from "../lib/auth-client";
import type { UserPreferences } from "../lib/auth-client";

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  preferences: UserPreferences | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  loadPreferences: () => Promise<UserPreferences>;
  savePreferences: (prefs: UserPreferences) => Promise<void>;
  googleAuthUrl: string;
}

export type { UserPreferences };

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);

  useEffect(() => {
    authClient.getMe().then((u) => {
      setUser(u);
      if (u) authClient.getPreferences().then(setPreferences).catch(() => {});
    }).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await authClient.login(email, password);
    setUser(u);
    authClient.getPreferences().then(setPreferences).catch(() => {});
  }, []);

  const signup = useCallback(async (email: string, password: string, name?: string) => {
    const u = await authClient.signup(email, password, name);
    setUser(u);
    authClient.getPreferences().then(setPreferences).catch(() => {});
  }, []);

  const logout = useCallback(async () => {
    await authClient.logout();
    setUser(null);
    setPreferences(null);
  }, []);

  const loadPreferences = useCallback(async () => {
    const p = await authClient.getPreferences();
    setPreferences(p);
    return p;
  }, []);

  const savePreferences = useCallback(async (prefs: UserPreferences) => {
    const saved = await authClient.updatePreferences(prefs);
    setPreferences(saved);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user, loading, preferences,
        login, signup, logout,
        loadPreferences, savePreferences,
        googleAuthUrl: authClient.getGoogleAuthUrl(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
