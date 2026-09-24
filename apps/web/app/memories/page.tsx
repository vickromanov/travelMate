"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../../src/hooks/use-auth";
import type { MemoryEntry } from "../../src/hooks/use-auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CATEGORIES: Array<{ value: string; label: string; icon: string }> = [
  { value: "travel_party", label: "Travel Party", icon: "👨‍👩‍👧‍👦" },
  { value: "dietary", label: "Dietary", icon: "🍽️" },
  { value: "interests", label: "Interests & Dislikes", icon: "⭐" },
  { value: "constraints", label: "Practical Constraints", icon: "⏰" },
  { value: "home_base", label: "Home Base", icon: "🏠" },
  { value: "general", label: "General", icon: "💡" },
];

const categoryMeta = (cat: string) =>
  CATEGORIES.find((c) => c.value === cat) ?? { value: cat, label: cat, icon: "💡" };

export default function MemoriesPage() {
  const { user, loading, memories, loadMemories, addMemory, deleteMemory, updateMemories } = useAuth();
  const router = useRouter();
  const [newFact, setNewFact] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFact, setEditFact] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) loadMemories().catch(() => {});
  }, [user, loadMemories]);

  async function handleAdd() {
    if (!newFact.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await addMemory(newCategory, newFact.trim());
      setNewFact("");
      setNewCategory("general");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteMemory(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  function startEdit(mem: MemoryEntry) {
    setEditingId(mem.id);
    setEditFact(mem.fact);
    setEditCategory(mem.category);
  }

  async function handleSaveEdit() {
    if (!editingId || !editFact.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = memories.map((m) =>
        m.id === editingId
          ? { ...m, fact: editFact.trim(), category: editCategory, updatedAt: new Date().toISOString() }
          : m,
      );
      await updateMemories(updated);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) return null;

  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    items: memories.filter((m) => m.category === cat.value),
  })).filter((g) => g.items.length > 0);

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--font-body)",
      padding: "2rem 1rem",
    }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "2rem" }}>
          <Link href="/" style={{ color: "var(--teal)", fontSize: "0.9rem", textDecoration: "none" }}>
            ← Back
          </Link>
        </div>

        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 700,
          color: "var(--navy)", marginBottom: "0.5rem",
        }}>
          Memory
        </h1>
        <p style={{ color: "var(--ink-soft)", fontSize: "0.95rem", marginBottom: "2rem" }}>
          Things I remember about you. These help me plan better trips tailored to your needs.
          Memories are automatically learned from your trip descriptions.
        </p>

        {error && (
          <div style={{
            padding: "0.75rem 1rem", marginBottom: "1rem",
            background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10,
            color: "#991b1b", fontSize: "0.85rem",
          }}>
            {error}
          </div>
        )}

        {/* Add new memory */}
        <div style={{
          marginBottom: "2rem", padding: "1.25rem 1.5rem",
          background: "var(--surface)", borderRadius: 14,
          border: "1px solid var(--border)",
        }}>
          <h3 style={{
            fontSize: "1rem", fontWeight: 700, color: "var(--navy)",
            marginBottom: "0.75rem", letterSpacing: 0.3,
          }}>
            Add a memory
          </h3>
          <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              style={{
                padding: "0.6rem 0.85rem", borderRadius: 8,
                border: "1px solid var(--border-strong)", fontSize: "0.9rem",
                fontFamily: "inherit", background: "var(--bg)", cursor: "pointer",
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={newFact}
              onChange={(e) => setNewFact(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newFact.trim()) handleAdd(); }}
              placeholder="e.g., I have two kids, ages 7 and 5"
              style={{
                flex: 1, padding: "0.7rem 0.85rem", borderRadius: 8,
                border: "1px solid var(--border-strong)", fontSize: "0.95rem",
                outline: "none", fontFamily: "inherit", background: "var(--bg)",
              }}
            />
            <button
              onClick={handleAdd}
              disabled={adding || !newFact.trim()}
              style={{
                padding: "0.7rem 1.5rem", borderRadius: 8, fontSize: "0.9rem",
                fontWeight: 700, border: "none", cursor: adding ? "wait" : "pointer",
                background: !newFact.trim() ? "var(--border)" : "var(--accent)", color: "#fff",
                fontFamily: "inherit", flexShrink: 0,
              }}
            >
              {adding ? "Adding..." : "Add"}
            </button>
          </div>
        </div>

        {/* Memory list grouped by category */}
        {grouped.length === 0 && (
          <div style={{
            textAlign: "center", padding: "3rem 1rem",
            color: "var(--muted)", fontSize: "0.95rem",
          }}>
            <p style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🧠</p>
            <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>No memories yet</p>
            <p>Plan a trip and I&apos;ll automatically learn things about you, or add them manually above.</p>
          </div>
        )}

        {grouped.map((group) => (
          <div key={group.value} style={{
            marginBottom: "1.5rem", padding: "1.25rem 1.5rem",
            background: "var(--surface)", borderRadius: 14,
            border: "1px solid var(--border)",
          }}>
            <h3 style={{
              fontSize: "0.95rem", fontWeight: 700, color: "var(--navy)",
              marginBottom: "0.75rem", letterSpacing: 0.3,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span>{group.icon}</span> {group.label}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {group.items.map((mem) => (
                <div key={mem.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "0.65rem 0.85rem", borderRadius: 10,
                  background: "var(--bg)", border: "1px solid var(--border)",
                }}>
                  {editingId === mem.id ? (
                    <>
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        style={{
                          padding: "0.4rem 0.6rem", borderRadius: 6,
                          border: "1px solid var(--border-strong)", fontSize: "0.8rem",
                          fontFamily: "inherit", background: "var(--bg)",
                        }}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={editFact}
                        onChange={(e) => setEditFact(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setEditingId(null); }}
                        style={{
                          flex: 1, padding: "0.4rem 0.6rem", borderRadius: 6,
                          border: "1px solid var(--border-strong)", fontSize: "0.9rem",
                          fontFamily: "inherit", background: "var(--bg)", outline: "none",
                        }}
                        autoFocus
                      />
                      <button
                        onClick={handleSaveEdit}
                        disabled={saving}
                        style={{
                          padding: "0.35rem 0.8rem", borderRadius: 6, fontSize: "0.8rem",
                          fontWeight: 600, border: "none", background: "var(--teal)", color: "#fff",
                          cursor: "pointer", fontFamily: "inherit",
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{
                          padding: "0.35rem 0.6rem", borderRadius: 6, fontSize: "0.8rem",
                          border: "1px solid var(--border)", background: "var(--bg)",
                          cursor: "pointer", fontFamily: "inherit", color: "var(--ink-soft)",
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: "0.9rem", color: "var(--ink)", lineHeight: 1.4 }}>
                        {mem.fact}
                      </span>
                      {mem.source && (
                        <span style={{
                          fontSize: "0.75rem", color: "var(--muted)", flexShrink: 0,
                          padding: "2px 8px", borderRadius: 999,
                          background: "var(--bg-soft)", whiteSpace: "nowrap",
                        }}>
                          {mem.source === "auto" ? "auto-learned" : mem.source}
                        </span>
                      )}
                      <button
                        onClick={() => startEdit(mem)}
                        style={{
                          padding: "0.3rem 0.5rem", borderRadius: 6, fontSize: "0.75rem",
                          border: "1px solid var(--border)", background: "transparent",
                          cursor: "pointer", color: "var(--ink-soft)", fontFamily: "inherit",
                        }}
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(mem.id)}
                        style={{
                          padding: "0.3rem 0.5rem", borderRadius: 6, fontSize: "0.75rem",
                          border: "1px solid var(--border)", background: "transparent",
                          cursor: "pointer", color: "#e25c3e", fontFamily: "inherit",
                        }}
                        title="Delete"
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
