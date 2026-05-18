"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";

export default function BackstageCreatePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [hasSpotlight, setHasSpotlight] = useState(false);
  const [hasBackstage, setHasBackstage] = useState(false);
  const [spotlightHandle, setSpotlightHandle] = useState("");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data } = await supabase
        .from("creator_profiles")
        .select("handle, kind, creator_type, display_name")
        .eq("user_id", user.id);
      const spot = (data ?? []).find((r) => r.kind === "spotlight");
      const back = (data ?? []).find((r) => r.kind === "backstage");
      setHasSpotlight(!!spot);
      setHasBackstage(!!back);
      setSpotlightHandle(spot?.handle ?? "");
      setDisplayName(spot?.display_name ?? "");
      setLoading(false);
    })();
  }, [router, supabase]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);

    const re = /^[a-z0-9][a-z0-9_-]{2,29}$/;
    if (!re.test(handle)) {
      setErr("Handle must be 3–30 chars: lowercase letters, numbers, dashes, underscores.");
      return;
    }
    if (handle === spotlightHandle) {
      setErr("Use a different handle than your Spotlight to keep identities separate.");
      return;
    }

    setSubmitting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { error } = await (supabase as any).from("creator_profiles").insert({
      user_id: user.id,
      kind: "backstage",
      handle,
      display_name: displayName || null,
      creator_type: "backstage",
      linked: false,
    });

    if (error) {
      setErr(error.message);
      setSubmitting(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="bs-loading">
        <p className="kicker">Loading...</p>
      </main>
    );
  }

  if (!hasSpotlight) {
    return (
      <main className="bs-shell">
        <div className="bs-card">
          <p className="kicker">No Spotlight profile</p>
          <h1 className="bs-title">You need a Spotlight first.</h1>
          <p className="bs-text">
            Backstage extends your Spotlight presence. Set up a Spotlight profile, then you can open a Backstage from the dashboard.
          </p>
          <Link href="/signup" className="btn btn--primary">
            Create Spotlight account
          </Link>
        </div>
      </main>
    );
  }


  if (hasBackstage) {
    return (
      <main className="bs-shell">
        <div className="bs-card">
          <p className="kicker">Already set up</p>
          <h1 className="bs-title">You already have a Backstage.</h1>
          <p className="bs-text">Switch to it from the dashboard sidebar to manage it.</p>
          <Link href="/dashboard" className="btn btn--secondary">
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="bs-shell">
      <div className="bs-card">
        <p className="kicker">Open a Backstage</p>
        <h1 className="bs-title">
          A separate <em>public identity.</em>
        </h1>
        <p className="bs-text">
          Backstage is your adult-content tier. By default it&apos;s completely unlinked from your Spotlight — your employer, family, and mainstream followers will never see the connection. You can link them later from your dashboard.
        </p>
        <p className="bs-text bs-muted">
          Age verification (Veriff) and 2257 records will be required before you can publish on Backstage. You&apos;ll set those up after creating the profile.
        </p>

        <form onSubmit={onSubmit} className="bs-form">
          <label className="bs-field">
            <span className="label">
              Backstage handle
              <em className="bs-hint">spotlightly.app/c/your-backstage-handle</em>
            </span>
            <input
              type="text"
              className="input"
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase())}
              placeholder="alter-ego"
              required
              autoFocus
            />
          </label>

          <label className="bs-field">
            <span className="label">Display name (optional)</span>
            <input
              type="text"
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="If different from your Spotlight name"
            />
          </label>

          {err && <div className="bs-err">⚠ {err}</div>}

          <div className="bs-actions">
            <Link href="/dashboard" className="btn btn--ghost">
              Cancel
            </Link>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? "Creating..." : "Open Backstage →"}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .bs-loading, .bs-shell {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--s-6);
        }
        .bs-card {
          max-width: 560px;
          width: 100%;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-3);
          padding: var(--s-10);
        }
        .bs-title {
          font-family: var(--font-serif);
          font-size: 36px;
          font-weight: 300;
          line-height: 1.1;
          color: #fff;
          margin: var(--s-3) 0 var(--s-4);
        }
        .bs-title em { font-style: italic; color: var(--accent-back); }
        .bs-text {
          font-size: 15px;
          line-height: 1.7;
          color: var(--text-soft);
          margin: 0 0 var(--s-4);
        }
        .bs-text.bs-muted { color: var(--muted); font-size: 13px; }
        .bs-form { display: flex; flex-direction: column; gap: var(--s-4); margin-top: var(--s-6); }
        .bs-field { display: flex; flex-direction: column; }
        .bs-hint {
          font-style: normal;
          text-transform: none;
          letter-spacing: 0;
          font-size: 11px;
          font-weight: 300;
          color: var(--muted);
          font-family: var(--font-sans);
          margin-left: 8px;
        }
        .bs-err {
          background: var(--red-soft);
          border: 1px solid var(--red-border);
          color: var(--red);
          padding: var(--s-3) var(--s-4);
          border-radius: var(--r-2);
          font-size: 13px;
        }
        .bs-actions {
          display: flex;
          justify-content: flex-end;
          gap: var(--s-2);
          margin-top: var(--s-4);
        }
      `}</style>
    </main>
  );
}
