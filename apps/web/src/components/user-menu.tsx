"use client";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../hooks/use-auth";
import Link from "next/link";

const menuItemStyle: React.CSSProperties = {
  width: "100%", padding: "0.65rem 1rem", background: "none", border: "none",
  textAlign: "left", fontSize: "0.85rem", color: "var(--ink)", cursor: "pointer",
  fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10,
  textDecoration: "none",
};

function MenuItem({ href, icon, label, onClick }: {
  href?: string; icon: string; label: string; onClick?: () => void;
}) {
  const inner = (
    <>
      <span style={{ fontSize: "1rem", width: 20, textAlign: "center" }}>{icon}</span>
      {label}
    </>
  );

  if (href) {
    return (
      <Link href={href} style={menuItemStyle}
        onMouseOver={e => (e.currentTarget.style.background = "var(--bg-soft)")}
        onMouseOut={e => (e.currentTarget.style.background = "none")}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button onClick={onClick} style={menuItemStyle}
      onMouseOver={e => (e.currentTarget.style.background = "var(--bg-soft)")}
      onMouseOut={e => (e.currentTarget.style.background = "none")}
    >
      {inner}
    </button>
  );
}

export function UserMenu() {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (loading) return null;

  if (!user) {
    return (
      <Link href="/login" style={{
        padding: "0.5rem 1.1rem", borderRadius: 8, fontSize: "0.85rem",
        fontWeight: 600, background: "var(--accent)", color: "#fff",
        textDecoration: "none", whiteSpace: "nowrap",
      }}>
        Sign in
      </Link>
    );
  }

  const initials = (user.name ?? user.email)
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase())
    .join("");

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: 36, height: 36, borderRadius: "50%", border: "2px solid var(--border-strong)",
          background: user.avatarUrl ? `url(${user.avatarUrl}) center/cover` : "var(--navy)",
          color: "#fff", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {!user.avatarUrl && initials}
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)", minWidth: 220,
          background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)", padding: "0.5rem 0", zIndex: 100,
        }}
          onClick={() => setOpen(false)}
        >
          <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--ink)" }}>
              {user.name ?? "Traveler"}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>
              {user.email}
            </div>
          </div>

          <div style={{ padding: "0.25rem 0" }}>
            <MenuItem href="/trips" icon="🗺" label="My Trips" />
            <MenuItem href="/settings" icon="⚙" label="Preferences" />
          </div>

          <div style={{ borderTop: "1px solid var(--border)", padding: "0.25rem 0" }}>
            <MenuItem icon="↩" label="Sign out" onClick={async () => { await logout(); }} />
          </div>
        </div>
      )}
    </div>
  );
}
