"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import * as authClient from "../lib/auth-client";
import type { UserPreferences, MemoryEntry } from "../lib/auth-client";

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
  memories: MemoryEntry[];
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  loadPreferences: () => Promise<UserPreferences>;
  savePreferences: (prefs: UserPreferences) => Promise<void>;
  loadMemories: () => Promise<MemoryEntry[]>;
  addMemory: (category: string, fact: string) => Promise<MemoryEntry>;
  deleteMemory: (id: string) => Promise<void>;
  updateMemories: (memories: MemoryEntry[]) => Promise<void>;
  googleAuthUrl: string;
}

export type { UserPreferences, MemoryEntry };

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);

  useEffect(() => {
    authClient.getMe().then((u) => {
      setUser(u);
      if (u) {
        authClient.getPreferences().then(setPreferences).catch(() => {});
        authClient.getMemories().then(setMemories).catch(() => {});
      }
    }).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await authClient.login(email, password);
    setUser(u);
    authClient.getPreferences().then(setPreferences).catch(() => {});
    authClient.getMemories().then(setMemories).catch(() => {});
  }, []);

  const signup = useCallback(async (email: string, password: string, name?: string) => {
    const u = await authClient.signup(email, password, name);
    setUser(u);
    authClient.getPreferences().then(setPreferences).catch(() => {});
    authClient.getMemories().then(setMemories).catch(() => {});
  }, []);

  const logout = useCallback(async () => {
    await authClient.logout();
    setUser(null);
    setPreferences(null);
    setMemories([]);
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

  const loadMemories = useCallback(async () => {
    const m = await authClient.getMemories();
    setMemories(m);
    return m;
  }, []);

  const addMemoryFn = useCallback(async (category: string, fact: string) => {
    const entry = await authClient.addMemory(category, fact);
    setMemories((prev) => [...prev, entry]);
    return entry;
  }, []);

  const deleteMemoryFn = useCallback(async (id: string) => {
    await authClient.deleteMemory(id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const updateMemoriesFn = useCallback(async (mems: MemoryEntry[]) => {
    const updated = await authClient.updateMemories(mems);
    setMemories(updated);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user, loading, preferences, memories,
        login, signup, logout,
        loadPreferences, savePreferences,
        loadMemories,
        addMemory: addMemoryFn,
        deleteMemory: deleteMemoryFn,
        updateMemories: updateMemoriesFn,
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
