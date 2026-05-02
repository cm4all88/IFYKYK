"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: "40px", width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <div style={{ width: 28, height: 28, background: "var(--amber)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#fff" }}>S</div>
          <span style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>Spotlightly</span>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>Sign in</h1>
        <p style={{ color: "var(--text-sec)", fontSize: 14, marginBottom: 28 }}>Welcome back.</p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", color: "var(--text-sec)", fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 14px", fontSize: 14, color: "var(--text)", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: "block", color: "var(--text-sec)", fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 14px", fontSize: 14, color: "var(--text)", outline: "none", boxSizing: "border-box" }} />
          </div>

          {error && <div style={{ color: "#c83030", fontSize: 13, marginBottom: 14, background: "rgba(200,48,48,0.07)", borderRadius: 8, padding: "8px 12px" }}>{error}</div>}

          <button type="submit" disabled={loading}
            style={{ width: "100%", background: "var(--amber)", border: "none", borderRadius: 10, padding: "13px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "wait" : "pointer" }}>
            {loading ? "Signing in..." : "Sign in →"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, color: "var(--text-sec)", fontSize: 14 }}>
          Don&apos;t have an account?{" "}
          <a href="/signup" style={{ color: "var(--amber)", fontWeight: 600, textDecoration: "none" }}>Sign up</a>
        </p>
      </div>
    </div>
  );
}
