"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setErr("Passwords don't match."); return; }
    if (password.length < 8) { setErr("Password must be at least 8 characters."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setErr(error.message); setLoading(false); return; }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="lg">
      <div className="lg-shell">
        <Link href="/" className="brand-logo" style={{ fontSize: 28 }}>Spot<span>light</span>ly</Link>
        <div className="lg-card">
          <p className="kicker">Account recovery</p>
          <h1 className="lg-title">New <em>password.</em></h1>
          <form className="lg-form" onSubmit={handleSubmit}>
            {err && <div className="lg-err">{err}</div>}
            <div className="lg-field">
              <label className="label">New password</label>
              <input className="input" type="password" required minLength={8}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters" />
            </div>
            <div className="lg-field">
              <label className="label">Confirm password</label>
              <input className="input" type="password" required
                value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Same password again" />
            </div>
            <button type="submit" className="btn btn--primary lg-submit" disabled={loading}>
              {loading ? "Updating…" : "Set new password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
