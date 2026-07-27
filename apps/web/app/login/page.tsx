"use client";
import { useState, type FormEvent } from "react";
import { useAuth } from "../../src/hooks/use-auth";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { login, googleAuthUrl } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)", fontFamily: "var(--font-body)",
    }}>
      <div style={{
        width: "100%", maxWidth: 420, padding: "2.5rem 2rem",
        background: "var(--surface)", borderRadius: 16,
        border: "1px solid var(--border)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}>
        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 700,
          color: "var(--navy)", textAlign: "center", marginBottom: "0.25rem",
        }}>
          Welcome back
        </h1>
        <p style={{ color: "var(--ink-soft)", textAlign: "center", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
          Sign in to your TravelMate account
        </p>

        {error && (
          <div style={{
            padding: "0.75rem 1rem", marginBottom: "1rem", borderRadius: 8,
            background: "#fef2f2", color: "#b91c1c", fontSize: "0.85rem", border: "1px solid #fecaca",
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>Email</label>
          <input
            type="email" required value={email} onChange={e => setEmail(e.target.value)}
            style={inputStyle} placeholder="you@example.com"
          />

          <label style={labelStyle}>Password</label>
          <input
            type="password" required value={password} onChange={e => setPassword(e.target.value)}
            style={inputStyle} placeholder="Your password"
          />

          <button type="submit" disabled={loading} style={{
            ...btnStyle, background: "var(--accent)", color: "#fff",
            opacity: loading ? 0.7 : 1, cursor: loading ? "wait" : "pointer",
          }}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "1.25rem 0" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>or</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        <a href={googleAuthUrl} style={{
          ...btnStyle, background: "var(--surface)", color: "var(--ink)",
          border: "1px solid var(--border-strong)", textDecoration: "none", textAlign: "center",
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" style={{ marginRight: 8, verticalAlign: "middle" }}>
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </a>

        <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" style={{ color: "var(--teal)", fontWeight: 600 }}>Sign up</Link>
        </p>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", marginBottom: "0.35rem", marginTop: "0.75rem",
  fontSize: "0.85rem", fontWeight: 600, color: "var(--ink)",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.7rem 0.85rem", borderRadius: 8,
  border: "1px solid var(--border-strong)", fontSize: "0.95rem",
  outline: "none", fontFamily: "inherit", background: "var(--bg)",
};

const btnStyle: React.CSSProperties = {
  width: "100%", padding: "0.75rem", borderRadius: 8, fontSize: "0.95rem",
  fontWeight: 600, border: "none", marginTop: "1rem", display: "flex",
  alignItems: "center", justifyContent: "center",
};
