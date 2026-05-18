"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";

// ──────────────────────────────────────────────────────────────────
// Types — defensive, mirror what's actually in the DB
// ──────────────────────────────────────────────────────────────────

type Profile = {
  id?: string;
  user_id: string;
  kind: "spotlight" | "backstage";
  handle: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  linked: boolean;
  creator_type: "spotlight" | "backstage";
};

type Tab = "spotlight" | "backstage";
type Pane = "overview" | "profile" | "posts" | "settings";

// ──────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [spotlight, setSpotlight] = useState<Profile | null>(null);
  const [backstage, setBackstage] = useState<Profile | null>(null);
  const [tab, setTab] = useState<Tab>("spotlight");
  const [pane, setPane] = useState<Pane>("overview");

  // Read ?pane= from URL on mount — avoids useSearchParams Suspense requirement
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("pane") as Pane;
    if (p && ["overview", "profile", "posts", "settings"].includes(p)) {
      setPane(p);
    }
  }, []);

  const [linkedToggle, setLinkedToggle] = useState(false);
  const [savingLink, setSavingLink] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // ────────────────────────────────────────────────────────────────
  // Initial load
  // ────────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setLoading(true);
    setErrMsg(null);

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      router.push("/login");
      return;
    }

    setUserEmail(user.email ?? null);

    const { data: rows, error } = await supabase
      .from("creator_profiles")
      .select("*")
      .eq("user_id", user.id);

    if (error) {
      setErrMsg(error.message);
      setLoading(false);
      return;
    }

    const spot = (rows ?? []).find((r: any) => r.kind === "spotlight") as Profile | undefined;
    const back = (rows ?? []).find((r: any) => r.kind === "backstage") as Profile | undefined;

    setSpotlight(spot ?? null);
    setBackstage(back ?? null);
    setLinkedToggle(!!(spot?.linked && back?.linked));
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // If they only have backstage somehow, show it by default
  useEffect(() => {
    if (!spotlight && backstage) setTab("backstage");
  }, [spotlight, backstage]);

  // ────────────────────────────────────────────────────────────────
  // Identity link toggle — must update BOTH rows for the badge to show
  // ────────────────────────────────────────────────────────────────

  async function toggleLinked(next: boolean) {
    if (!spotlight || !backstage) return;
    setSavingLink(true);
    setErrMsg(null);

    const { error } = await supabase
      .from("creator_profiles")
      .update({ linked: next })
      .eq("user_id", spotlight.user_id);

    if (error) {
      setErrMsg(error.message);
    } else {
      setLinkedToggle(next);
      setSpotlight((p) => (p ? { ...p, linked: next } : p));
      setBackstage((p) => (p ? { ...p, linked: next } : p));
    }
    setSavingLink(false);
  }

  // ────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="db-loading">
        <p className="kicker">Loading your dashboard...</p>
      </div>
    );
  }

  const active = tab === "spotlight" ? spotlight : backstage;

  return (
    <main className="db">
      {/* TOP BAR */}
      <header className="db-top">
        <div className="db-top-inner">
          <Link href="/" className="db-brand">
            Spot<span>light</span>ly
          </Link>

          <div className="db-top-right">
            {spotlight && (
              <Link
                href={`/c/${spotlight.handle}`}
                className="db-view-link"
                target="_blank"
                rel="noopener"
              >
                View public page →
              </Link>
            )}
            <span className="db-email">{userEmail}</span>
            <form action="/api/auth/signout" method="post">
              <button type="submit" className="btn btn--ghost btn--small">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* SHELL */}
      <div className="db-shell">
        {/* SIDEBAR */}
        <aside className="db-sidebar">
          {/* Identity tabs — only show if both exist */}
          {spotlight && backstage && (
            <div className="db-identity-tabs">
              <button
                onClick={() => setTab("spotlight")}
                className={`db-it ${tab === "spotlight" ? "db-it--active" : ""}`}
              >
                <span className="db-it-tag">Spotlight</span>
                <span className="db-it-handle">@{spotlight.handle}</span>
              </button>
              <button
                onClick={() => setTab("backstage")}
                className={`db-it db-it--back ${tab === "backstage" ? "db-it--active" : ""}`}
              >
                <span className="db-it-tag">Backstage</span>
                <span className="db-it-handle">@{backstage.handle}</span>
              </button>
            </div>
          )}

          {/* Solo identity badge */}
          {spotlight && !backstage && (
            <div className="db-solo">
              <span className="db-solo-tag">
                Spotlight
              </span>
              <span className="db-solo-handle">@{spotlight.handle}</span>
            </div>
          )}

          {/* Pane nav */}
          <nav className="db-nav">
            <PaneButton current={pane} target="overview" onClick={setPane}>
              Overview
            </PaneButton>
            <PaneButton current={pane} target="profile" onClick={setPane}>
              Profile
            </PaneButton>
            <PaneButton current={pane} target="posts" onClick={setPane}>
              Posts
            </PaneButton>
            <PaneButton current={pane} target="settings" onClick={setPane}>
              Settings
            </PaneButton>
          </nav>

          {/* Backstage upsell — only if they don't have one yet and they're 18+ */}
          {spotlight && !backstage && (
            <div className="db-upsell">
              <p className="db-upsell-tag">Adult content · 18+</p>
              <h4 className="db-upsell-title">Open a Backstage</h4>
              <p className="db-upsell-text">
                A separate public profile for adult content. Linked or unlinked
                from your Spotlight — your call.
              </p>
              <Link href="/dashboard/backstage/create" className="btn btn--secondary btn--small db-upsell-btn">
                Set it up →
              </Link>
            </div>
          )}
        </aside>

        {/* MAIN PANE */}
        <section className="db-main">
          {errMsg && (
            <div className="db-err">
              <span>⚠ {errMsg}</span>
              <button onClick={() => setErrMsg(null)} className="db-err-x">×</button>
            </div>
          )}

          {pane === "overview" && active && (
            <OverviewPane
              profile={active}
              other={tab === "spotlight" ? backstage : spotlight}
              linkedToggle={linkedToggle}
              onToggleLink={toggleLinked}
              savingLink={savingLink}
            />
          )}

          {pane === "profile" && active && (
            <ProfilePane
              profile={active}
              onSaved={refresh}
              setErr={setErrMsg}
            />
          )}

          {pane === "posts" && active && (
            <PostsPane profile={active} setErr={setErrMsg} />
          )}

          {pane === "settings" && active && (
            <SettingsPane profile={active} userEmail={userEmail} />
          )}
        </section>
      </div>

      <DashboardStyles />
    </main>
  );
}

// ──────────────────────────────────────────────────────────────────
// PANE: Overview — split panel earnings + identity link toggle
// ──────────────────────────────────────────────────────────────────

function OverviewPane({
  profile,
  other,
  linkedToggle,
  onToggleLink,
  savingLink,
}: {
  profile: Profile;
  other: Profile | null;
  linkedToggle: boolean;
  onToggleLink: (next: boolean) => void;
  savingLink: boolean;
}) {
  return (
    <div className="pane">
      <div className="pane-head">
        <p className="kicker">Overview · {profile.kind === "spotlight" ? "Spotlight" : "Backstage"}</p>
        <h1 className="pane-title">
          Welcome back, <em>{profile.display_name ?? profile.handle}</em>.
        </h1>
      </div>

      {/* Stats grid */}
      <div className="stats">
        <div className="stat">
          <p className="stat-label">Subscribers</p>
          <p className="stat-num">0</p>
          <p className="stat-meta">Build your audience</p>
        </div>
        <div className="stat">
          <p className="stat-label">This month</p>
          <p className="stat-num">$0</p>
          <p className="stat-meta">Tips + subs combined</p>
        </div>
        <div className="stat">
          <p className="stat-label">Lifetime</p>
          <p className="stat-num">$0</p>
          <p className="stat-meta">Across all channels</p>
        </div>
        <div className="stat">
          <p className="stat-label">Posts</p>
          <p className="stat-num">0</p>
          <p className="stat-meta">Get something out there</p>
        </div>
      </div>

      {/* Identity link toggle — only if both profiles exist */}
      {other && (
        <div className="link-card">
          <div className="link-card-text">
            <p className="kicker">Public Identity</p>
            <h3 className="link-card-title">
              {linkedToggle ? "Profiles are linked" : "Profiles are private"}
            </h3>
            <p className="link-card-desc">
              {linkedToggle
                ? `A Backstage badge appears on your Spotlight profile. Fans can navigate from one to the other.`
                : `Your Spotlight and Backstage are publicly invisible to each other. Nothing connects them on either profile.`}
            </p>
          </div>
          <button
            className={`link-toggle ${linkedToggle ? "link-toggle--on" : ""}`}
            onClick={() => onToggleLink(!linkedToggle)}
            disabled={savingLink}
            type="button"
            aria-pressed={linkedToggle}
          >
            <span className="link-toggle-dot" />
          </button>
        </div>
      )}

      {/* Quick actions */}
      <div className="quick">
        <Link href="#profile" className="quick-card">
          <h4>Edit your profile</h4>
          <p>Bio, avatar, cover. Make it yours.</p>
        </Link>
        <Link href="#posts" className="quick-card">
          <h4>Write your first post</h4>
          <p>Get something out there. Even a hello.</p>
        </Link>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// PANE: Profile — edit display name, bio, avatar URL, cover URL
// ──────────────────────────────────────────────────────────────────

function ProfilePane({
  profile,
  onSaved,
  setErr,
}: {
  profile: Profile;
  onSaved: () => void;
  setErr: (msg: string | null) => void;
}) {
  const supabase = createClient();
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [coverUrl, setCoverUrl] = useState(profile.cover_url ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);

    const { error } = await supabase
      .from("creator_profiles")
      .update({
        display_name: displayName.trim() || undefined,
        bio: bio.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
        cover_url: coverUrl.trim() || undefined,
      })
      .eq("user_id", profile.user_id)
      .eq("kind", profile.kind);

    if (error) setErr(error.message);
    else {
      setSavedAt(Date.now());
      onSaved();
    }
    setSaving(false);
  }

  return (
    <div className="pane">
      <div className="pane-head">
        <p className="kicker">Profile · {profile.kind === "spotlight" ? "Spotlight" : "Backstage"}</p>
        <h1 className="pane-title">
          Make it <em>yours.</em>
        </h1>
        <p className="pane-lede">
          What fans see when they land on your page. Changes are live the moment you save.
        </p>
      </div>

      <form className="form" onSubmit={save}>
        <div className="form-row">
          <div className="form-field">
            <label className="label">Handle</label>
            <input className="input" type="text" value={profile.handle} disabled />
            <p className="hint">spotlightly.app/c/{profile.handle}</p>
          </div>
          <div className="form-field">
            <label className="label">Display name</label>
            <input
              className="input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="The name your fans will see"
              maxLength={60}
            />
          </div>
        </div>

        <div className="form-field">
          <label className="label">Bio</label>
          <textarea
            className="textarea"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A line or two about what you do."
            maxLength={500}
            rows={4}
          />
          <p className="hint">{bio.length}/500</p>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label className="label">Avatar URL</label>
            <input
              className="input"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="form-field">
            <label className="label">Cover URL</label>
            <input
              className="input"
              type="url"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>
        <p className="hint">
          For now, paste an image URL from anywhere on the web. File uploads land in the next push.
        </p>

        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </button>
          {savedAt && <span className="form-saved">Saved · {new Date(savedAt).toLocaleTimeString()}</span>}
        </div>
      </form>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// PANE: Posts — list + composer
// ──────────────────────────────────────────────────────────────────

function PostsPane({ profile, setErr }: { profile: Profile; setErr: (m: string | null) => void }) {
  const supabase = createClient();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("creator_profile_id", profile.id ?? "")
      .order("created_at", { ascending: false });

    if (error) {
      // Posts table may not have rows yet, or column names may differ — show as empty
      setPosts([]);
    } else {
      setPosts(data ?? []);
    }
    setLoading(false);
  }, [profile.id, supabase]);

  useEffect(() => {
    if (profile.id) void load();
    else setLoading(false);
  }, [load, profile.id]);

  async function publish(e: FormEvent) {
    e.preventDefault();
    if (!profile.id) {
      setErr("Profile is missing an id. Refresh and try again.");
      return;
    }
    if (!body.trim()) return;

    setPosting(true);
    setErr(null);

    const { error } = await (supabase as any).from("posts").insert({
      creator_profile_id: profile.id,
      caption: body.trim(),
      tier: "free",
      content_rating: profile.creator_type === "backstage" ? "R" : "M",
      status: "live",
    });

    if (error) {
      setErr(error.message);
      setPosting(false);
      return;
    }

    setBody("");
    setComposing(false);
    setPosting(false);
    void load();
  }

  return (
    <div className="pane">
      <div className="pane-head pane-head--row">
        <div>
          <p className="kicker">Posts · {profile.kind === "spotlight" ? "Spotlight" : "Backstage"}</p>
          <h1 className="pane-title">Your work.</h1>
        </div>
        <button
          className="btn btn--primary"
          onClick={() => setComposing((c) => !c)}
          type="button"
        >
          {composing ? "Cancel" : "+ New post"}
        </button>
      </div>

      {composing && (
        <form className="composer" onSubmit={publish}>

          <textarea
            className="composer-body"
            placeholder="What's on your mind?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            autoFocus
          />
          <div className="composer-actions">
            <p className="hint">{body.length} chars</p>
            <button type="submit" className="btn btn--primary" disabled={posting || !body.trim()}>
              {posting ? "Publishing..." : "Publish"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="kicker">Loading posts...</p>
      ) : posts.length === 0 ? (
        <div className="empty">
          <p className="empty-mark">◌</p>
          <h3 className="empty-title">No posts yet.</h3>
          <p className="empty-text">Hit "+ New post" up there to publish your first one.</p>
        </div>
      ) : (
        <ul className="post-list">
          {posts.map((p) => (
            <li key={p.id} className="post-item">
              <p className="post-body">{p.caption}</p>
              <p className="post-meta">
                {p.created_at ? new Date(p.created_at).toLocaleString() : "-"}
                {p.status && p.status !== "published" ? ` � ${p.status}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// PANE: Settings — account-level (email, dangerous actions later)
// ──────────────────────────────────────────────────────────────────

function SettingsPane({ profile, userEmail }: { profile: Profile; userEmail: string | null }) {
  return (
    <div className="pane">
      <div className="pane-head">
        <p className="kicker">Settings</p>
        <h1 className="pane-title">Account.</h1>
      </div>

      <div className="settings-block">
        <p className="label">Email</p>
        <p className="settings-val">{userEmail ?? "—"}</p>
      </div>

      <div className="settings-block">
        <p className="label">Tier</p>
        <p className="settings-val">
          {false
            ? ""
            : profile.creator_type === "backstage"
            ? "Backstage (adult content)"
            : "Spotlight"}
        </p>
      </div>

      <div className="settings-block">
        <p className="label">Public URL</p>
        <p className="settings-val">
          <Link href={`/c/${profile.handle}`} className="settings-link" target="_blank">
            spotlightly.app/c/{profile.handle} →
          </Link>
        </p>
      </div>

      <p className="hint" style={{ marginTop: "-" }}>
        Account deletion, payout settings, and notification preferences land in a future push.
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function PaneButton({
  current,
  target,
  onClick,
  children,
}: {
  current: Pane;
  target: Pane;
  onClick: (p: Pane) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => onClick(target)}
      className={`db-pane-btn ${current === target ? "db-pane-btn--active" : ""}`}
      type="button"
    >
      {children}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────────

function DashboardStyles() {
  return (
    <style jsx global>{`
      .db { min-height: 100vh; }

      .db-loading {
        min-height: 60vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .db-top {
        border-bottom: 1px solid var(--border);
        background: var(--bg);
        position: sticky;
        top: 0;
        z-index: 40;
      }
      .db-top-inner {
        max-width: var(--container-wide);
        margin: 0 auto;
        padding: var(--s-3) var(--s-6);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-4);
      }
      .db-brand {
        font-family: var(--font-serif);
        font-size: 24px;
        color: #fff;
        letter-spacing: -0.01em;
      }
      .db-brand span { color: var(--accent); }

      .db-top-right {
        display: flex;
        align-items: center;
        gap: var(--s-4);
      }
      .db-view-link {
        font-family: var(--font-mono);
        font-size: 11px;
        letter-spacing: 0.1em;
        color: var(--accent);
      }
      .db-email {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--muted);
      }

      .db-shell {
        max-width: var(--container-wide);
        margin: 0 auto;
        display: grid;
        grid-template-columns: 280px 1fr;
        gap: var(--s-8);
        padding: var(--s-8) var(--s-6);
      }

      /* SIDEBAR */
      .db-sidebar {
        position: sticky;
        top: 80px;
        align-self: start;
      }
      .db-identity-tabs {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin-bottom: var(--s-6);
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--r-3);
        overflow: hidden;
      }
      .db-it {
        background: transparent;
        border: none;
        padding: var(--s-4) var(--s-5);
        text-align: left;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 4px;
        border-left: 2px solid transparent;
        transition: background var(--t-fast);
      }
      .db-it:hover { background: var(--surface-2); }
      .db-it--active {
        background: var(--surface-2);
        border-left-color: var(--accent);
      }
      .db-it--back.db-it--active {
        border-left-color: var(--accent-back);
      }
      .db-it-tag {
        font-family: var(--font-mono);
        font-size: 9px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .db-it--active .db-it-tag { color: var(--accent); }
      .db-it--back.db-it--active .db-it-tag { color: var(--accent-back); }
      .db-it-handle {
        font-family: var(--font-mono);
        font-size: 13px;
        color: var(--text);
      }

      .db-solo {
        background: var(--surface);
        border: 1px solid var(--border);
        border-left: 3px solid var(--accent);
        border-radius: var(--r-3);
        padding: var(--s-4) var(--s-5);
        margin-bottom: var(--s-6);
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .db-solo-tag {
        font-family: var(--font-mono);
        font-size: 9px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--accent);
      }
      .db-solo-handle {
        color: var(--text);
        font-family: var(--font-mono);
        font-size: 13px;
        color: var(--text);
      }

      .db-nav {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .db-pane-btn {
        background: transparent;
        border: none;
        padding: var(--s-3) var(--s-5);
        font-family: var(--font-mono);
        font-size: 12px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--muted);
        text-align: left;
        cursor: pointer;
        border-radius: var(--r-2);
        transition: all var(--t-fast);
      }
      .db-pane-btn:hover { color: var(--text); background: var(--surface); }
      .db-pane-btn--active {
        color: var(--accent);
        background: var(--surface);
      }

      .db-upsell {
        margin-top: var(--s-8);
        padding: var(--s-5);
        background: var(--surface);
        border: 1px solid rgba(192, 132, 252, 0.2);
        border-radius: var(--r-3);
      }
      .db-upsell-tag {
        font-family: var(--font-mono);
        font-size: 9px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--accent-back);
        margin: 0 0 var(--s-3);
      }
      .db-upsell-title {
        font-family: var(--font-serif);
        font-size: 22px;
        font-weight: 400;
        color: #fff;
        margin: 0 0 var(--s-2);
      }
      .db-upsell-text {
        font-size: 13px;
        line-height: 1.6;
        color: var(--text-soft);
        margin: 0 0 var(--s-4);
      }

      /* MAIN PANE */
      .db-main { min-width: 0; }

      .db-err {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--red-soft);
        border: 1px solid var(--red-border);
        color: var(--red);
        padding: var(--s-3) var(--s-4);
        border-radius: var(--r-2);
        margin-bottom: var(--s-5);
        font-size: 13px;
      }
      .db-err-x {
        background: none;
        border: none;
        color: var(--red);
        font-size: 18px;
        cursor: pointer;
      }

      .pane {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--r-3);
        padding: var(--s-10) var(--s-10);
      }
      .pane-head { margin-bottom: var(--s-10); }
      .pane-head--row {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        flex-wrap: wrap;
        gap: var(--s-4);
      }
      .pane-title {
        font-family: var(--font-serif);
        font-size: clamp(28px, 4vw, 40px);
        font-weight: 300;
        line-height: 1.1;
        color: #fff;
        margin: var(--s-2) 0 var(--s-3);
      }
      .pane-title em { font-style: italic; color: var(--accent); }
      .pane-lede {
        font-size: 15px;
        color: var(--text-soft);
        line-height: 1.7;
        margin: 0;
        max-width: 540px;
      }

      /* STATS */
      .stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 2px;
        margin-bottom: var(--s-8);
      }
      .stat {
        background: var(--surface-2);
        border: 1px solid var(--border);
        padding: var(--s-5) var(--s-6);
      }
      .stat-label {
        font-family: var(--font-mono);
        font-size: 9px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--muted);
        margin: 0 0 var(--s-3);
      }
      .stat-num {
        font-family: var(--font-serif);
        font-size: 36px;
        font-weight: 400;
        color: #fff;
        margin: 0 0 var(--s-2);
        line-height: 1;
      }
      .stat-meta {
        font-size: 11px;
        color: var(--muted);
        margin: 0;
      }

      /* IDENTITY LINK CARD */
      .link-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-6);
        background: var(--surface-2);
        border: 1px solid rgba(192, 132, 252, 0.15);
        border-radius: var(--r-3);
        padding: var(--s-6);
        margin-bottom: var(--s-8);
      }
      .link-card-text { flex: 1; min-width: 0; }
      .link-card-title {
        font-family: var(--font-serif);
        font-size: 22px;
        font-weight: 400;
        color: #fff;
        margin: var(--s-2) 0 var(--s-2);
      }
      .link-card-desc {
        font-size: 13px;
        color: var(--text-soft);
        line-height: 1.6;
        margin: 0;
        max-width: 480px;
      }

      .link-toggle {
        flex-shrink: 0;
        width: 56px;
        height: 32px;
        background: var(--surface-3);
        border: 1px solid var(--border);
        border-radius: 999px;
        position: relative;
        cursor: pointer;
        transition: background var(--t-base) var(--ease);
      }
      .link-toggle:disabled { opacity: 0.5; cursor: wait; }
      .link-toggle-dot {
        position: absolute;
        top: 3px; left: 3px;
        width: 24px; height: 24px;
        background: var(--text);
        border-radius: 50%;
        transition: transform var(--t-base) var(--ease);
      }
      .link-toggle--on { background: var(--accent-back); }
      .link-toggle--on .link-toggle-dot { transform: translateX(24px); }

      /* QUICK ACTIONS */
      .quick {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2px;
      }
      .quick-card {
        background: var(--surface-2);
        border: 1px solid var(--border);
        padding: var(--s-5) var(--s-6);
        text-decoration: none;
        color: inherit;
        transition: border-color var(--t-fast);
      }
      .quick-card:hover { border-color: var(--border-strong); }
      .quick-card h4 {
        font-family: var(--font-serif);
        font-size: 20px;
        font-weight: 400;
        color: #fff;
        margin: 0 0 var(--s-2);
      }
      .quick-card p {
        font-size: 13px;
        color: var(--muted);
        margin: 0;
      }

      /* FORM */
      .form { display: flex; flex-direction: column; gap: var(--s-5); }
      .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--s-4);
      }
      .form-field { display: flex; flex-direction: column; }
      .hint {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--muted);
        margin: var(--s-2) 0 0;
      }
      .form-actions {
        display: flex;
        align-items: center;
        gap: var(--s-4);
        margin-top: var(--s-3);
      }
      .form-saved {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--accent-open);
      }

      /* COMPOSER */
      .composer {
        background: var(--surface-2);
        border: 1px solid var(--border);
        border-radius: var(--r-3);
        padding: var(--s-5);
        margin-bottom: var(--s-8);
        display: flex;
        flex-direction: column;
        gap: var(--s-3);
      }
      .composer-title, .composer-body {
        background: transparent;
        border: none;
        outline: none;
        color: var(--text);
        font-family: inherit;
        width: 100%;
        padding: 0;
      }
      .composer-title {
        font-family: var(--font-serif);
        font-size: 24px;
        font-weight: 400;
      }
      .composer-title::placeholder { color: var(--muted-faint); }
      .composer-body {
        font-size: 15px;
        line-height: 1.7;
        resize: vertical;
        min-height: 120px;
      }
      .composer-body::placeholder { color: var(--muted); }
      .composer-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: var(--s-3);
        border-top: 1px solid var(--border);
      }

      /* POSTS */
      .post-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .post-item {
        background: var(--surface-2);
        border: 1px solid var(--border);
        padding: var(--s-5) var(--s-6);
      }
      .post-title {
        font-family: var(--font-serif);
        font-size: 22px;
        font-weight: 400;
        color: #fff;
        margin: 0 0 var(--s-2);
      }
      .post-body {
        font-size: 14px;
        line-height: 1.7;
        color: var(--text-soft);
        margin: 0 0 var(--s-3);
        white-space: pre-wrap;
      }
      .post-meta {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--muted);
        margin: 0;
      }

      /* EMPTY */
      .empty {
        text-align: center;
        padding: var(--s-16) var(--s-5);
      }
      .empty-mark {
        font-family: var(--font-serif);
        font-size: 48px;
        color: var(--muted);
        opacity: 0.4;
        margin: 0 0 var(--s-5);
      }
      .empty-title {
        font-family: var(--font-serif);
        font-size: 24px;
        font-style: italic;
        font-weight: 300;
        color: #fff;
        margin: 0 0 var(--s-2);
      }
      .empty-text {
        font-size: 13px;
        color: var(--muted);
        margin: 0;
      }

      /* SETTINGS */
      .settings-block {
        padding: var(--s-5) 0;
        border-bottom: 1px solid var(--border);
      }
      .settings-val {
        font-size: 15px;
        color: var(--text);
        margin: var(--s-2) 0 0;
      }
      .settings-link {
        color: var(--accent);
        font-family: var(--font-mono);
        font-size: 13px;
      }

      /* MOBILE */
      @media (max-width: 900px) {
        .db-shell { grid-template-columns: 1fr; gap: var(--s-5); }
        .db-sidebar { position: static; }
        .db-nav { flex-direction: row; overflow-x: auto; }
        .db-pane-btn { white-space: nowrap; }
        .pane { padding: var(--s-6) var(--s-5); }
        .stats { grid-template-columns: repeat(2, 1fr); }
        .quick { grid-template-columns: 1fr; }
        .form-row { grid-template-columns: 1fr; }
        .link-card { flex-direction: column; align-items: flex-start; }
      }
    `}</style>
  );
}
