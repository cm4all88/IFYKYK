"use client";
import React from "react";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";
import ThemeToggle from "@/components/ThemeToggle";
import VideoUpload from "@/components/VideoUpload";
import SocialPostsManager from "@/components/dashboard/SocialPostsManager";
import { CREATOR_CATEGORIES } from "@/lib/categories";
import ImageUpload from "@/components/ImageUpload";

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
type Pane = "overview" | "profile" | "posts" | "channels" | "fans" | "campaigns" | "wishlist" | "advisor" | "analytics" | "payments" | "moderation" | "blocks" | "messages" | "live" | "billing" | "digital" | "tiers" | "store" | "refer" | "social" | "settings";

// ──────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const ADMIN_ID = "9b5ac2dc-ea4f-4bac-b2ef-70608562568a";
  const [spotlight, setSpotlight] = useState<Profile | null>(null);
  const [backstage, setBackstage] = useState<Profile | null>(null);
  const [tab, setTab] = useState<Tab>("spotlight");
  const [pane, setPane] = useState<Pane>("overview");

  // Read ?pane= from URL on mount — avoids useSearchParams Suspense requirement
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("pane") as Pane;
    if (p && ["overview", "profile", "posts", "channels", "fans", "campaigns", "wishlist", "advisor", "analytics", "payments", "moderation", "blocks", "messages", "live", "billing", "digital", "tiers", "store", "refer", "social", "settings"].includes(p)) {
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
    setIsAdmin(user.id === ADMIN_ID);

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
    <main className="db" style={{ position: "relative" }}>
      {/* Stage background — creator's cover or hero-bg, muted */}
      <div style={{
        position: "fixed", inset: 0,
        backgroundImage: `url('${(active as any)?.cover_url || "/hero-bg.jpg"}')`,
        backgroundSize: "cover",
        backgroundPosition: "center top",
        opacity: 0.05,
        pointerEvents: "none",
        zIndex: 0,
      }} />
      {/* TOP BAR */}
      <header className="db-top">
        <div className="db-top-inner">
          <Link href="/" className="db-brand">
            Spot<span>light</span>ly
          </Link>

          <div className="db-top-right">
              <ThemeToggle />
            {spotlight && (
              <Link
                href={`/${spotlight.handle}`}
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

          {/* Pane nav — grouped sections */}
          <nav className="db-nav">

            <div className="db-nav-section">
              <PaneButton current={pane} target="overview" onClick={setPane}>Overview</PaneButton>
              <PaneButton current={pane} target="profile" onClick={setPane}>Profile</PaneButton>
              <PaneButton current={pane} target="posts" onClick={setPane}>Posts</PaneButton>
              <PaneButton current={pane} target="channels" onClick={setPane}>Channels</PaneButton>
            </div>

            <div className="db-nav-label">Audience</div>
            <div className="db-nav-section">
              <PaneButton current={pane} target="fans" onClick={setPane}>Fans</PaneButton>
              <Link href="/messages" className="db-nav-link">Messages</Link>
              <PaneButton current={pane} target="campaigns" onClick={setPane}>Campaigns</PaneButton>
              <PaneButton current={pane} target="wishlist" onClick={setPane}>Wishlist</PaneButton>
            </div>

            <div className="db-nav-label">Earn</div>
            <div className="db-nav-section">
              <PaneButton current={pane} target="advisor" onClick={setPane}>✦ Advisor</PaneButton>
              <PaneButton current={pane} target="analytics" onClick={setPane}>Analytics</PaneButton>
              <PaneButton current={pane} target="tiers" onClick={setPane}>Subscription Tiers</PaneButton>
              <PaneButton current={pane} target="refer" onClick={setPane}>Refer & Earn</PaneButton>
            </div>

            <div className="db-nav-label">Publish</div>
            <div className="db-nav-section">
              <PaneButton current={pane} target="store" onClick={setPane}>Digital Store</PaneButton>
              <PaneButton current={pane} target="social" onClick={setPane}>Social Posts</PaneButton>
              <Link href="/merch" className="db-nav-link">Merch</Link>
              <Link href="/live" className="db-nav-link">Go Live</Link>
              <Link href="/archive" className="db-nav-link">Archive</Link>
            </div>

            <div className="db-nav-label">Account</div>
            <div className="db-nav-section">
              <PaneButton current={pane} target="payments" onClick={setPane}>Payments</PaneButton>
              <PaneButton current={pane} target="billing" onClick={setPane}>Billing</PaneButton>
              <PaneButton current={pane} target="settings" onClick={setPane}>Settings</PaneButton>
              <PaneButton current={pane} target="moderation" onClick={setPane}>Moderation</PaneButton>
              <PaneButton current={pane} target="blocks" onClick={setPane}>Block List</PaneButton>
              <Link href="/help" className="db-nav-link">Help</Link>
              {isAdmin && (
                <a href="/admin" className="db-nav-link">Admin</a>
              )}
            </div>

            {!backstage && (
              <a href="/backstage-setup" style={{ display:"block", margin:"var(--s-4) var(--s-3) 0", padding:"10px var(--s-4)", fontSize:13, color:"var(--accent-back)", borderRadius:"var(--r-2)", textDecoration:"none", border:"1px solid rgba(192,132,252,0.2)", background:"rgba(192,132,252,0.05)", textAlign:"center" }}>+ Add Backstage</a>
            )}
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

          {pane === "store" && active && (
            <DigitalStorePane profile={active} setErr={setErrMsg} />
          )}
          {pane === "refer" && active && (
            <ReferPane profile={active} />
          )}
          {pane === "billing" && (
            <BillingPane />
          )}
          {pane === "settings" && active && (
            <SettingsPane profile={active} userEmail={userEmail} />
          )}
          {pane === "channels" && active && (
            <ChannelsPane profile={active} />
          )}
          {pane === "fans" && active && (
            <FansPane profile={active} />
          )}
          {pane === "campaigns" && active && (
            <CampaignsPane profile={active} />
          )}
          {pane === "wishlist" && active && (
            <WishlistPane profile={active} />
          )}
          {pane === "analytics" && active && (
            <AnalyticsPane profile={active} />
          )}
          {pane === "advisor" && active && (
            <AdvisorPane profile={active} />
          )}
          {pane === "payments" && spotlight && (
            <PaymentsPane profile={spotlight} />
          )}
          {pane === "moderation" && spotlight && (
            <ModerationPane profile={spotlight} />
          )}
          {pane === "blocks" && active && (
            <BlockPane profile={active} />
          )}
          {pane === "messages" && active && (
            <MessagesPane profile={active} />
          )}
          {pane === "live" && active && (
            <LivePane profile={active} />
          )}
          {pane === "social" && active && (
            <div className="pane">
              <SocialPostsManager />
            </div>
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
          <p className="stat-label">Audience</p>
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

      {/* Quick actions — priority hierarchy */}

      {/* Next action — single most important thing */}
      <div style={{ marginBottom: "var(--s-8)" }}>
        <Link href="/dashboard?pane=posts" style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderLeft: "3px solid var(--accent)",
          padding: "20px 28px", textDecoration: "none", color: "inherit",
          borderRadius: "var(--r-2)", transition: "background var(--t-fast)",
          gap: 16,
        }}>
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 6 }}>
              Your next move
            </p>
            <p style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 400, color: "#fff", margin: 0 }}>
              Create your first post
            </p>
          </div>
          <span style={{ color: "var(--accent)", fontSize: 20, flexShrink: 0 }}>→</span>
        </Link>
      </div>

      {/* Tools — calm list, not a grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {[
          { href: "/dashboard?pane=payments", label: "Connect Stripe", desc: "Required before your audience can pay you.", accent: true },
          { href: "/dashboard?pane=profile", label: "Edit profile", desc: "Avatar, bio, cover. Your first impression." },
          { href: "/messages", label: "Messages", desc: "Inbox and Front Row messages." },
          { href: "/dashboard?pane=channels", label: "Channels", desc: "Subscription tiers your audience can join." },
          { href: "/dashboard?pane=social", label: "Social posts", desc: "Paste your Instagram, TikTok, or YouTube links." },
          { href: "/live", label: "Go Live", desc: "Stream directly to your audience." },
          { href: "/merch", label: "Merch", desc: "Design and sell branded products. No upfront cost." },
          { href: "/dashboard?pane=digital", label: "Digital store", desc: "Sell guides, presets, courses. 0% cut." },
          { href: "/dashboard?pane=analytics", label: "Analytics", desc: "Audience growth and earnings." },
          { href: "/dashboard?pane=advisor", label: "✦ Advisor", desc: "AI-powered monetization strategy." },
        ].map(item => (
          <Link key={item.href} href={item.href} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 20px", textDecoration: "none", color: "inherit",
            borderBottom: "1px solid var(--border)", gap: 16,
            transition: "background var(--t-fast)",
          }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--surface)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <div>
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 500,
                color: (item as any).accent ? "var(--accent-open)" : "var(--text)",
                margin: "0 0 3px",
              }}>
                {item.label}
              </p>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>{item.desc}</p>
            </div>
            <span style={{ color: "var(--muted)", fontSize: 16, flexShrink: 0, opacity: 0.4 }}>›</span>
          </Link>
        ))}
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
  const [socialLinks, setSocialLinks] = useState<Record<string,string>>((profile as any).social_links ?? {});
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [coverUrl, setCoverUrl] = useState(profile.cover_url ?? "");
  const [tags, setTags] = useState<string[]>((profile as any).tags ?? []);
  const [locationCity, setLocationCity] = useState((profile as any).location_city ?? "");
  const [locationCountry, setLocationCountry] = useState((profile as any).location_country ?? "");
  const [bookingUrl, setBookingUrl] = useState((profile as any).booking_url ?? "");
  const [bookingLabel, setBookingLabel] = useState((profile as any).booking_label ?? "");
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
      } as any)
      .eq("user_id", profile.user_id)
      .eq("kind", profile.kind);

    // Save tags and location separately (new columns may not be in generated types)
    await (supabase as any).from("creator_profiles").update({
      tags,
      location_city: locationCity.trim() || null,
      location_country: locationCountry.trim() || null,
      booking_url: bookingUrl.trim() || null,
      booking_label: bookingLabel.trim() || null,
      offers_services: !!bookingUrl.trim(),
    }).eq("user_id", profile.user_id).eq("kind", profile.kind);

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

        {/* Tags */}
        <div className="form-field">
          <label className="label">Categories <span style={{ color:"var(--muted)", fontWeight:300 }}>(pick up to 5 — helps fans find you)</span></label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:"var(--s-2)" }}>
            {(CREATOR_CATEGORIES as readonly { id: string; label: string; emoji: string }[])
              .filter(c => profile.kind === "backstage" || c.id !== "adult")
              .map(cat => {
              const active = tags.includes(cat.id);
              return (
                <button key={cat.id} type="button" onClick={() => {
                  if (active) setTags(prev => prev.filter((t: string) => t !== cat.id));
                  else if (tags.length < 5) setTags(prev => [...prev, cat.id]);
                }} style={{
                  display:"flex", alignItems:"center", gap:6,
                  padding:"6px 12px", borderRadius:"var(--r-pill)", border:"1px solid", cursor:"pointer", fontSize:12,
                  background: active ? "rgba(240,180,41,0.1)" : "var(--surface-2)",
                  color: active ? "var(--accent)" : "var(--muted)",
                  borderColor: active ? "rgba(240,180,41,0.25)" : "var(--border)",
                }}>
                  {cat.emoji} {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Location */}
        <div className="form-row">
          <div className="form-field">
            <label className="label">City <span style={{ color:"var(--muted)", fontWeight:300 }}>(optional)</span></label>
            <input className="input" type="text" placeholder="Seattle" value={locationCity} onChange={e => setLocationCity(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="label">Country <span style={{ color:"var(--muted)", fontWeight:300 }}>(optional)</span></label>
            <input className="input" type="text" placeholder="USA" value={locationCountry} onChange={e => setLocationCountry(e.target.value)} />
          </div>
        </div>

        {/* Booking */}
        <div style={{ borderTop:"1px solid var(--border)", paddingTop:"var(--s-6)", marginTop:"var(--s-2)" }}>
          <p className="kicker" style={{ marginBottom:"var(--s-2)" }}>📅 Appointments & Bookings</p>
          <p style={{ fontSize:13, color:"var(--muted)", lineHeight:1.6, marginBottom:"var(--s-5)" }}>
            Hairdressers, trainers, coaches, photographers — add your booking link and fans can book directly from your page.
            Works with Calendly, Acuity, Square, Booksy, Vagaro, and any other booking platform.
          </p>
          <div className="form-field" style={{ marginBottom:"var(--s-4)" }}>
            <label className="label">Booking URL</label>
            <input className="input" type="url" placeholder="https://calendly.com/you or https://booksy.com/en-us/..." value={bookingUrl} onChange={e => setBookingUrl(e.target.value)} />
            <p className="hint">Paste your booking link from any platform. Calendly links will embed directly on your page.</p>
          </div>
          <div className="form-field">
            <label className="label">Button label <span style={{ color:"var(--muted)", fontWeight:300 }}>(optional)</span></label>
            <input className="input" type="text" placeholder='e.g. "Book a haircut" · "Schedule a session" · "Book now"' value={bookingLabel} onChange={e => setBookingLabel(e.target.value)} />
            <p className="hint">Defaults to "Book an appointment" if left blank.</p>
          </div>
        </div>

        <div style={{ borderTop:"1px solid var(--border)", paddingTop:"var(--s-6)" }}>
          <p className="kicker" style={{ marginBottom:"var(--s-2)" }}>Social links & link-in-bio</p>
          <p style={{ fontSize:13, color:"var(--muted)", lineHeight:1.6, marginBottom:"var(--s-5)" }}>
            These appear on your public page. Put <strong style={{color:"var(--text)"}}>spotlightly.app/{profile.handle}</strong> in your bios instead of Linktree.
          </p>
          {([
            { key:"social_tiktok",    label:"TikTok",     ph:"https://tiktok.com/@you" },
            { key:"social_instagram", label:"Instagram",   ph:"https://instagram.com/you" },
            { key:"social_youtube",   label:"YouTube",     ph:"https://youtube.com/@you" },
            { key:"social_twitter",   label:"X / Twitter", ph:"https://x.com/you" },
            { key:"social_twitch",    label:"Twitch",      ph:"https://twitch.tv/you" },
            { key:"social_discord",   label:"Discord",     ph:"https://discord.gg/server" },
            { key:"social_substack",  label:"Substack",    ph:"https://you.substack.com" },
            { key:"social_website",   label:"Website",     ph:"https://yoursite.com" },
          ] as const).map(s => (
            <div key={s.key} style={{ display:"grid", gridTemplateColumns:"100px 1fr", gap:"var(--s-3)", alignItems:"center", marginBottom:"var(--s-3)" }}>
              <label className="label" style={{ margin:0 }}>{s.label}</label>
              <input className="input" type="url" placeholder={s.ph}
                value={(socialLinks as any)[s.key] ?? ""}
                onChange={e => setSocialLinks((prev:any) => ({ ...prev, [s.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        <div className="form-field" style={{ marginBottom:"var(--s-5)" }}>
          <label className="label" style={{ marginBottom:"var(--s-3)" }}>Profile photo</label>
          <ImageUpload value={avatarUrl} onChange={setAvatarUrl} shape="circle" label="Upload photo" hint="JPG, PNG or WebP · Square images work best" />
        </div>

        <div className="form-field" style={{ marginBottom:"var(--s-5)" }}>
          <label className="label" style={{ marginBottom:"var(--s-3)" }}>Cover image</label>
          <ImageUpload value={coverUrl} onChange={setCoverUrl} shape="rect" label="Upload cover" hint="JPG, PNG or WebP · 1500×500px recommended" previewWidth={180} previewHeight={60} />
          <p style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)", marginTop:"var(--s-2)", letterSpacing:"0.06em" }}>
            ✦ Your cover image also appears as a muted background behind your dashboard.
          </p>
        </div>

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
// PANE: Fans — subscriber list, block, region control
// ──────────────────────────────────────────────────────────────────
function FansPane({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const [subs, setSubs] = React.useState<any[]>([]);
  const [blocked, setBlocked] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState<"subscribers"|"blocked"|"regions">("subscribers");
  const [blockEmail, setBlockEmail] = React.useState("");
  const [blockReason, setBlockReason] = React.useState("");
  const [regionInput, setRegionInput] = React.useState("");
  const [blockedRegions, setBlockedRegions] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    async function load() {
      const { data: s } = await (supabase as any)
        .from("subscriptions").select("*, fan:fan_user_id(email, raw_user_meta_data)")
        .eq("creator_profile_id", profile.id).eq("status", "active")
        .order("created_at", { ascending: false });
      setSubs(s ?? []);

      const { data: b } = await (supabase as any)
        .from("fan_blocks").select("*").eq("creator_profile_id", profile.id)
        .order("created_at", { ascending: false });
      setBlocked(b ?? []);

      const { data: r } = await (supabase as any)
        .from("creator_profiles").select("blocked_regions").eq("id", profile.id).maybeSingle();
      setBlockedRegions(r?.blocked_regions ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function blockFan() {
    if (!blockEmail.trim()) return;
    setSaving(true);
    await (supabase as any).from("fan_blocks").insert({
      creator_profile_id: profile.id,
      fan_email: blockEmail.trim(),
      reason: blockReason.trim() || null,
    });
    const { data: b } = await (supabase as any)
      .from("fan_blocks").select("*").eq("creator_profile_id", profile.id).order("created_at", { ascending: false });
    setBlocked(b ?? []);
    setBlockEmail(""); setBlockReason(""); setSaving(false);
  }

  async function unblock(id: string) {
    await (supabase as any).from("fan_blocks").delete().eq("id", id);
    setBlocked(prev => prev.filter(b => b.id !== id));
  }

  async function addRegion() {
    if (!regionInput.trim()) return;
    const next = regionInput.trim().toUpperCase();
    const updated = blockedRegions.includes(next) ? blockedRegions : [...blockedRegions, next];
    await (supabase as any).from("creator_profiles").update({ blocked_regions: updated }).eq("id", profile.id);
    setBlockedRegions(updated); setRegionInput("");
  }

  async function removeRegion(r: string) {
    const updated = blockedRegions.filter(x => x !== r);
    await (supabase as any).from("creator_profiles").update({ blocked_regions: updated }).eq("id", profile.id);
    setBlockedRegions(updated);
  }

  const tabStyle = (t: string) => ({
    fontFamily:"var(--font-display)", fontSize:12, fontWeight:700,
    padding:"8px 16px", border:"none", cursor:"pointer",
    borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
    color: tab === t ? "var(--text)" : "var(--muted)",
    background:"transparent",
  } as const);

  return (
    <div className="pane">
      <div className="pane-head">
        <p className="kicker">Fans</p>
        <h1 className="pane-title">Your <em>audience.</em></h1>
        <p className="pane-lede">Every subscriber verified their email and phone number. You know who's in your community — and you control who stays.</p>
      </div>

      <div style={{ display:"flex", gap:0, borderBottom:"1px solid var(--border)", marginBottom:"var(--s-6)" }}>
        <button style={tabStyle("subscribers")} onClick={() => setTab("subscribers")}>
          Subscribers ({subs.length})
        </button>
        <button style={tabStyle("blocked")} onClick={() => setTab("blocked")}>
          Blocked ({blocked.length})
        </button>
        <button style={tabStyle("regions")} onClick={() => setTab("regions")}>
          Region blocks ({blockedRegions.length})
        </button>
      </div>

      {loading && <p style={{ color:"var(--muted)", fontSize:14 }}>Loading…</p>}

      {/* Subscribers tab */}
      {!loading && tab === "subscribers" && (
        <div>
          {subs.length === 0 ? (
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"var(--s-10)", textAlign:"center" }}>
              <p style={{ fontFamily:"var(--font-serif)", fontSize:20, fontStyle:"italic", color:"#fff", marginBottom:"var(--s-2)" }}>No subscribers yet.</p>
              <p style={{ fontSize:13, color:"var(--muted)" }}>Connect Stripe and post your first content to start building your audience.</p>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              {subs.map((s: any) => (
                <div key={s.id} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"var(--s-4) var(--s-5)", display:"grid", gridTemplateColumns:"1fr auto", gap:"var(--s-4)", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:13, color:"var(--text)", fontWeight:600, marginBottom:3 }}>
                      {s.fan?.email ?? "—"}
                    </div>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)", letterSpacing:".08em" }}>
                      Phone: {s.fan?.raw_user_meta_data?.phone ?? "not provided"} · Subscribed {new Date(s.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button onClick={() => { setBlockEmail(s.fan?.email ?? ""); setTab("blocked"); }}
                    style={{ fontFamily:"var(--font-display)", fontSize:11, fontWeight:700, padding:"6px 14px", background:"var(--red-soft)", color:"var(--red)", border:"1px solid var(--red-border)", borderRadius:"var(--r-1)", cursor:"pointer" }}>
                    Block
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Blocked tab */}
      {!loading && tab === "blocked" && (
        <div>
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"var(--s-5)", marginBottom:"var(--s-4)" }}>
            <p className="label" style={{ marginBottom:"var(--s-3)" }}>Block a fan by email</p>
            <div style={{ display:"flex", gap:"var(--s-3)", flexWrap:"wrap" }}>
              <input className="input" type="email" placeholder="fan@example.com" style={{ maxWidth:280 }}
                value={blockEmail} onChange={e => setBlockEmail(e.target.value)} />
              <input className="input" placeholder="Reason (optional)" style={{ maxWidth:200 }}
                value={blockReason} onChange={e => setBlockReason(e.target.value)} />
              <button className="btn btn--primary btn--small" onClick={blockFan} disabled={saving || !blockEmail.trim()}>
                {saving ? "Blocking…" : "Block"}
              </button>
            </div>
          </div>
          {blocked.length === 0 ? (
            <p style={{ color:"var(--muted)", fontSize:13 }}>No blocked fans.</p>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              {blocked.map((b: any) => (
                <div key={b.id} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderLeft:"3px solid var(--red)", borderRadius:"var(--r-2)", padding:"var(--s-3) var(--s-5)", display:"grid", gridTemplateColumns:"1fr auto", alignItems:"center", gap:"var(--s-4)" }}>
                  <div>
                    <div style={{ fontSize:13, color:"var(--text)", fontWeight:600 }}>{b.fan_email}</div>
                    {b.reason && <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>{b.reason}</div>}
                  </div>
                  <button onClick={() => unblock(b.id)} style={{ fontSize:11, background:"none", border:"1px solid var(--border)", color:"var(--muted)", padding:"5px 12px", borderRadius:"var(--r-1)", cursor:"pointer" }}>
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Regions tab */}
      {!loading && tab === "regions" && (
        <div>
          <p style={{ fontSize:13, color:"var(--text-soft)", lineHeight:1.7, marginBottom:"var(--s-5)" }}>
            Block fans from specific countries from accessing your content. Use 2-letter country codes (US, GB, DE, etc.) or region names.
          </p>
          <div style={{ display:"flex", gap:"var(--s-3)", marginBottom:"var(--s-5)" }}>
            <input className="input" placeholder="Country code e.g. US, GB, AU" style={{ maxWidth:220 }}
              value={regionInput} onChange={e => setRegionInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addRegion()} />
            <button className="btn btn--secondary btn--small" onClick={addRegion} disabled={!regionInput.trim()}>
              Block region
            </button>
          </div>
          {blockedRegions.length === 0 ? (
            <p style={{ color:"var(--muted)", fontSize:13 }}>No regions blocked. Your content is accessible globally.</p>
          ) : (
            <div style={{ display:"flex", gap:"var(--s-2)", flexWrap:"wrap" }}>
              {blockedRegions.map(r => (
                <div key={r} style={{ display:"flex", alignItems:"center", gap:"var(--s-2)", background:"var(--surface)", border:"1px solid var(--red-border)", borderRadius:"var(--r-pill)", padding:"6px 14px" }}>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--red)", letterSpacing:".1em" }}>{r}</span>
                  <button onClick={() => removeRegion(r)} style={{ background:"none", border:"none", color:"var(--muted-faint)", cursor:"pointer", fontSize:14, lineHeight:1 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ──────────────────────────────────────────────────────────────────
// PANE: Campaigns — fundraising with exclusive access as reward
// ──────────────────────────────────────────────────────────────────
function CampaignsPane({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const [campaigns, setCampaigns] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    title: "", description: "", goal_amount: "",
    deadline: "", reward_description: "",
  });

  React.useEffect(() => {
    async function load() {
      const { data } = await (supabase as any)
        .from("campaigns")
        .select("*, donations:campaign_donations(amount)")
        .eq("creator_profile_id", profile.id)
        .order("created_at", { ascending: false });
      setCampaigns((data ?? []).map((c: any) => ({
        ...c,
        raised: (c.donations ?? []).reduce((sum: number, d: any) => sum + Number(d.amount), 0),
      })));
      setLoading(false);
    }
    load();
  }, []);

  async function createCampaign() {
    if (!form.title.trim() || !form.goal_amount) return;
    setSaving(true);
    const { data, error } = await (supabase as any).from("campaigns").insert({
      creator_profile_id: profile.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      goal_amount: parseFloat(form.goal_amount),
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      reward_description: form.reward_description.trim() || null,
      status: "active",
    }).select().single();
    if (error) { setSaving(false); return; }
    setCampaigns(prev => [{ ...data, raised: 0 }, ...prev]);
    setForm({ title:"", description:"", goal_amount:"", deadline:"", reward_description:"" });
    setCreating(false);
    setSaving(false);
  }

  async function closeCampaign(id: string) {
    await (supabase as any).from("campaigns").update({ status:"closed" }).eq("id", id);
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status:"closed" } : c));
  }

  const pct = (raised: number, goal: number) => Math.min(100, Math.round((raised / goal) * 100));

  return (
    <div className="pane">
      <div className="pane-head">
        <p className="kicker">Campaigns</p>
        <h1 className="pane-title">Fund your <em>next chapter.</em></h1>
        <p className="pane-lede">
          Run a campaign for anything — a trip, training, equipment, a creative project.
          Donors get exclusive access to content others won&apos;t see.
          Not charity. An experience they&apos;re part of.
        </p>
      </div>

      {loading ? <p style={{ color:"var(--muted)", fontSize:14 }}>Loading…</p> : null}

      <div style={{ display:"flex", flexDirection:"column", gap:2, marginBottom:"var(--s-6)" }}>
        {campaigns.map((c: any) => (
          <div key={c.id} style={{ background:"var(--surface)", border:`1px solid ${c.status === "active" ? "var(--accent-border)" : "var(--border)"}`, borderRadius:"var(--r-3)", padding:"var(--s-6) var(--s-7)", opacity: c.status !== "active" ? 0.6 : 1 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start", marginBottom:"var(--s-4)" }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:"var(--s-3)", marginBottom:4 }}>
                  <span style={{ fontFamily:"var(--font-display)", fontSize:18, fontWeight:800, color:"#fff" }}>{c.title}</span>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:".14em", textTransform:"uppercase", padding:"2px 8px", border:"1px solid", borderRadius:2,
                    color: c.status === "active" ? "var(--accent)" : c.status === "funded" ? "var(--accent-open)" : "var(--muted)",
                    borderColor: c.status === "active" ? "var(--accent-border)" : c.status === "funded" ? "rgba(52,211,153,.25)" : "var(--border)",
                    background: c.status === "active" ? "var(--accent-soft)" : c.status === "funded" ? "rgba(52,211,153,.08)" : "rgba(255,255,255,.03)",
                  }}>{c.status}</span>
                </div>
                {c.description && <p style={{ fontSize:13, color:"var(--muted)", margin:0 }}>{c.description}</p>}
              </div>
              {c.status === "active" && (
                <button onClick={() => closeCampaign(c.id)}
                  style={{ fontSize:11, background:"none", border:"1px solid var(--border)", color:"var(--muted)", padding:"5px 12px", borderRadius:"var(--r-1)", cursor:"pointer", flexShrink:0 }}>
                  Close
                </button>
              )}
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom:"var(--s-3)" }}>
              <div style={{ height:6, background:"var(--surface-3)", borderRadius:99, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${pct(c.raised, c.goal_amount)}%`, background:"linear-gradient(90deg, var(--accent), var(--accent-bright))", borderRadius:99, transition:"width 1s var(--ease)" }} />
              </div>
            </div>
            <div style={{ display:"flex", gap:"var(--s-6)", fontFamily:"var(--font-mono)", fontSize:11, letterSpacing:".08em" }}>
              <span style={{ color:"var(--accent-bright)", fontWeight:600 }}>${c.raised.toFixed(0)} raised</span>
              <span style={{ color:"var(--muted)" }}>of ${Number(c.goal_amount).toFixed(0)} goal</span>
              <span style={{ color:"var(--muted)" }}>{pct(c.raised, c.goal_amount)}%</span>
              {c.deadline && <span style={{ color:"var(--muted)" }}>ends {new Date(c.deadline).toLocaleDateString()}</span>}
            </div>
            {c.reward_description && (
              <div style={{ marginTop:"var(--s-4)", padding:"var(--s-3) var(--s-4)", background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"var(--r-1)", fontSize:12, color:"var(--text-soft)" }}>
                <span style={{ color:"var(--accent)", fontWeight:700, fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:".15em", textTransform:"uppercase", marginRight:8 }}>Donors get</span>
                {c.reward_description}
              </div>
            )}
          </div>
        ))}
      </div>

      {!creating ? (
        <button className="btn btn--secondary" onClick={() => setCreating(true)}>+ New campaign</button>
      ) : (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", padding:"var(--s-6)" }}>
          <p style={{ fontFamily:"var(--font-display)", fontSize:16, fontWeight:700, color:"#fff", marginBottom:"var(--s-5)" }}>New campaign</p>
          <div style={{ display:"flex", flexDirection:"column", gap:"var(--s-4)" }}>
            <div>
              <label className="label">Campaign title</label>
              <input className="input" placeholder="e.g. Training trip to Spain · New studio equipment · Album fund"
                value={form.title} onChange={e => setForm(f => ({...f, title:e.target.value}))} />
            </div>
            <div>
              <label className="label">What is this for?</label>
              <textarea className="input" rows={3}
                placeholder="Tell your audience what you're raising money for and why it matters to your work and career..."
                value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} />
            </div>
            <div>
              <label className="label">What donors get (exclusive access)</label>
              <input className="input"
                placeholder="e.g. Behind-the-scenes posts from Spain, daily live streams from training, private Q&A during the trip"
                value={form.reward_description} onChange={e => setForm(f => ({...f, reward_description:e.target.value}))} />
              <p style={{ fontSize:11, color:"var(--muted)", marginTop:4 }}>
                This is the exclusive content donors get that your regular followers won&apos;t see.
              </p>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"var(--s-4)" }}>
              <div>
                <label className="label">Goal (USD)</label>
                <div style={{ display:"flex", gap:"var(--s-2)", alignItems:"center" }}>
                  <span style={{ color:"var(--muted)" }}>$</span>
                  <input className="input" type="number" min="10" placeholder="2500"
                    value={form.goal_amount} onChange={e => setForm(f => ({...f, goal_amount:e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="label">Deadline (optional)</label>
                <input className="input" type="date"
                  value={form.deadline} onChange={e => setForm(f => ({...f, deadline:e.target.value}))} />
              </div>
            </div>
            <div style={{ display:"flex", gap:"var(--s-3)" }}>
              <button className="btn btn--primary" onClick={createCampaign}
                disabled={saving || !form.title.trim() || !form.goal_amount}>
                {saving ? "Creating…" : "Launch campaign"}
              </button>
              <button className="btn btn--ghost" onClick={() => setCreating(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ──────────────────────────────────────────────────────────────────
// PANE: Advisor — AI monetization strategist
// ──────────────────────────────────────────────────────────────────
function AdvisorPane({ profile }: { profile: Profile }) {
  const [messages, setMessages] = React.useState<{ role:"user"|"assistant"; content:string }[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [initialized, setInitialized] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const STARTERS = [
    "How should I price my subscription?",
    "What content should I put behind a paywall vs keep free?",
    "How do I convert followers into paying subscribers?",
    "When is the best time to ask fans to subscribe?",
    "Help me think through my launch strategy.",
  ];

  // Auto-load personalized greeting on first open
  React.useEffect(() => {
    if (initialized) return;
    setInitialized(true);
    setLoading(true);
    fetch("/api/advisor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [],
        profile: {
          display_name: profile.display_name,
          bio: (profile as any).bio,
          tags: (profile as any).tags,
          location_city: (profile as any).location_city,
          location_country: (profile as any).location_country,
          handle: profile.handle,
        },
      }),
    })
      .then(r => r.json())
      .then(data => {
        setMessages([{ role: "assistant", content: data.response }]);
        setLoading(false);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      })
      .catch(() => {
        setMessages([{ role: "assistant", content: "Hi! Ask me anything about monetizing on Spotlightly." }]);
        setLoading(false);
      });
  }, [initialized, profile]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    const newMessages = [...messages, { role: "user" as const, content: msg }];
    setMessages(newMessages);
    setLoading(true);

    const res = await fetch("/api/advisor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: newMessages,
        profile: {
          display_name: profile.display_name,
          bio: (profile as any).bio,
          tags: (profile as any).tags,
          handle: profile.handle,
        },
      }),
    });

    const data = await res.json();
    setMessages(prev => [...prev, { role: "assistant", content: data.response ?? "Try again." }]);
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  return (
    <div className="pane" style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 120px)", padding:0 }}>
      {/* Header */}
      <div style={{ padding:"var(--s-6) var(--s-8)", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
        <p className="kicker" style={{ marginBottom:"var(--s-2)" }}>AI Advisor</p>
        <h1 className="pane-title" style={{ fontSize:32 }}>Your Spotlightly <em>strategist.</em></h1>
        <p className="pane-lede" style={{ marginTop:"var(--s-3)" }}>
          Personalized to your profile. Specific advice for your situation — not generic tips.
        </p>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", padding:"var(--s-6) var(--s-8)", display:"flex", flexDirection:"column", gap:"var(--s-4)" }}>
        {loading && messages.length === 0 ? (
          <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
            <div style={{ width:28, height:28, borderRadius:"50%", background:"rgba(240,180,41,0.15)", border:"1px solid rgba(240,180,41,0.3)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:14 }}>✦</div>
            <div style={{ fontSize:13, color:"var(--muted)", paddingTop:4 }}>Reading your profile…</div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                {m.role === "assistant" && (
                  <div style={{ width:28, height:28, borderRadius:"50%", background:"rgba(240,180,41,0.15)", border:"1px solid rgba(240,180,41,0.3)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:14 }}>✦</div>
                )}
                <div style={{
                  fontSize:14, lineHeight:1.75,
                  color: m.role === "user" ? "rgba(255,255,255,0.85)" : "var(--text)",
                  background: m.role === "user" ? "rgba(255,255,255,0.05)" : "rgba(240,180,41,0.05)",
                  border: `1px solid ${m.role === "user" ? "rgba(255,255,255,0.08)" : "rgba(240,180,41,0.12)"}`,
                  borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                  padding:"12px 16px", maxWidth:"85%", whiteSpace:"pre-line",
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && messages.length > 0 && (
              <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:"rgba(240,180,41,0.15)", border:"1px solid rgba(240,180,41,0.3)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:14 }}>✦</div>
                <div style={{ fontSize:13, color:"var(--muted)", paddingTop:4 }}>…</div>
              </div>
            )}
            {messages.length === 1 && !loading && (
              <div>
                <p style={{ fontSize:12, color:"var(--muted)", marginBottom:"var(--s-3)" }}>Or try one of these:</p>
                <div style={{ display:"flex", flexDirection:"column", gap:"var(--s-2)" }}>
                  {STARTERS.map((s, i) => (
                    <button key={i} onClick={() => send(s)}
                      style={{ textAlign:"left", background:"rgba(255,255,255,0.03)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"10px 14px", fontSize:13, color:"var(--text-soft)", cursor:"pointer", fontFamily:"inherit" }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding:"var(--s-4) var(--s-8)", borderTop:"1px solid var(--border)", flexShrink:0, display:"flex", gap:"var(--s-3)" }}>
        <input
          className="input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") send(); }}
          placeholder="Ask anything about monetizing on Spotlightly…"
          disabled={loading}
          style={{ flex:1, borderRadius:"var(--r-pill)" }}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()} className="btn btn--primary" style={{ borderRadius:"var(--r-pill)", padding:"0 var(--s-5)" }}>
          {loading ? "…" : "→"}
        </button>
      </div>
    </div>
  );
}



// ──────────────────────────────────────────────────────────────────
// PANE: Pricing — Creator subscription tiers
// ──────────────────────────────────────────────────────────────────
function PricingPane({ profile, setErr }: { profile: Profile; setErr: (m: string | null) => void }) {
  const supabase = createClient();
  const [tiers, setTiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", price_monthly: "", price_yearly: "", perks: "", color: "#F0B429",
  });
  const [offerYearly, setOfferYearly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("subscription_tiers").select("*")
      .eq("creator_profile_id", profile.id)
      .order("sort_order", { ascending: true });
    setTiers(data ?? []);
    setLoading(false);
  }, [profile.id, supabase]);

  useEffect(() => { if (profile.id) void load(); else setLoading(false); }, [load, profile.id]);

  function calcYearly(monthly: string) {
    const m = parseFloat(monthly);
    if (!m) return "";
    return (m * 10).toFixed(2); // 2 months free
  }

  async function saveTier(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.price_monthly) return;
    setSaving(true);
    setErr(null);
    const perks = form.perks.split("\n").map(p => p.trim()).filter(Boolean);
    const yearly = offerYearly
      ? (form.price_yearly ? parseFloat(form.price_yearly) : parseFloat(calcYearly(form.price_monthly)))
      : null;
    await (supabase as any).from("subscription_tiers").insert({
      creator_profile_id: profile.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price_monthly: parseFloat(form.price_monthly),
      price_yearly: yearly,
      perks,
      color: form.color || null,
      sort_order: tiers.length,
    });
    setForm({ name:"", description:"", price_monthly:"", price_yearly:"", perks:"", color:"#F0B429" });
    setOfferYearly(false); setCreating(false); setSaving(false);
    void load();
  }

  async function deleteTier(id: string) {
    if (!confirm("Delete this tier? Existing subscribers will keep access until their billing cycle ends.")) return;
    await (supabase as any).from("subscription_tiers").update({ is_active: false }).eq("id", id);
    void load();
  }

  async function moveTier(id: string, dir: "up" | "down") {
    const idx = tiers.findIndex(t => t.id === id);
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === tiers.length - 1) return;
    const other = tiers[dir === "up" ? idx - 1 : idx + 1];
    await Promise.all([
      (supabase as any).from("subscription_tiers").update({ sort_order: other.sort_order }).eq("id", id),
      (supabase as any).from("subscription_tiers").update({ sort_order: tiers[idx].sort_order }).eq("id", other.id),
    ]);
    void load();
  }

  return (
    <div className="pane">
      <div className="pane-head pane-head--row">
        <div>
          <p className="kicker">Subscription Tiers</p>
          <h1 className="pane-title">Your <em>pricing.</em></h1>
        </div>
        <button className="btn btn--primary" type="button" onClick={() => setCreating(c => !c)}>
          {creating ? "Cancel" : "+ Add tier"}
        </button>
      </div>

      <div style={{ background:"rgba(240,180,41,0.05)", border:"1px solid rgba(240,180,41,0.15)", borderRadius:"var(--r-3)", padding:"var(--s-4) var(--s-5)", marginBottom:"var(--s-6)", fontSize:13, color:"var(--text-soft)", lineHeight:1.7 }}>
        Create as many tiers as you want. Fans see them all on your page and pick what fits. Yearly pricing gives fans a discount (typically 2 months free) and locks in longer-term subscribers.
      </div>

      {creating && (
        <form onSubmit={saveTier} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", padding:"var(--s-6)", marginBottom:"var(--s-6)", display:"flex", flexDirection:"column", gap:"var(--s-4)" }}>
          <div className="form-row">
            <div className="form-field">
              <label className="label">Tier name</label>
              <input className="input" type="text" placeholder='e.g. "Fan" · "Superfan" · "VIP"' value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} required />
            </div>
            <div className="form-field">
              <label className="label">Accent color</label>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <input type="color" value={form.color} onChange={e => setForm(f => ({...f, color:e.target.value}))} style={{ width:40, height:40, border:"1px solid var(--border)", borderRadius:"var(--r-1)", background:"none", cursor:"pointer" }} />
                <input className="input" type="text" value={form.color} onChange={e => setForm(f => ({...f, color:e.target.value}))} style={{ flex:1 }} />
              </div>
            </div>
          </div>

          <div className="form-field">
            <label className="label">Description <span style={{ color:"var(--muted)", fontWeight:300 }}>(optional)</span></label>
            <input className="input" type="text" placeholder='"For fans who want exclusive access"' value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="label">Monthly price</label>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ color:"var(--muted)" }}>$</span>
                <input className="input" type="number" min="0.99" step="0.01" placeholder="9.99" value={form.price_monthly}
                  onChange={e => { setForm(f => ({...f, price_monthly:e.target.value, price_yearly: offerYearly ? calcYearly(e.target.value) : f.price_yearly})); }} required />
                <span style={{ color:"var(--muted)", fontSize:13 }}>/mo</span>
              </div>
            </div>
            <div className="form-field">
              <label className="label" style={{ display:"flex", alignItems:"center", gap:10 }}>
                Yearly price
                <label style={{ display:"flex", alignItems:"center", gap:6, fontWeight:400, cursor:"pointer" }}>
                  <input type="checkbox" checked={offerYearly} onChange={e => {
                    setOfferYearly(e.target.checked);
                    if (e.target.checked) setForm(f => ({...f, price_yearly: calcYearly(f.price_monthly)}));
                  }} />
                  <span style={{ fontSize:11, color:"var(--muted)" }}>Offer yearly</span>
                </label>
              </label>
              {offerYearly && (
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ color:"var(--muted)" }}>$</span>
                  <input className="input" type="number" min="0.99" step="0.01" value={form.price_yearly}
                    onChange={e => setForm(f => ({...f, price_yearly:e.target.value}))} />
                  <span style={{ color:"var(--muted)", fontSize:13 }}>/yr</span>
                </div>
              )}
              {offerYearly && form.price_monthly && (
                <p className="hint" style={{ color:"var(--accent-open)" }}>
                  = {Math.round((1 - parseFloat(form.price_yearly || "0") / (parseFloat(form.price_monthly) * 12)) * 100)}% off vs monthly
                </p>
              )}
              {!offerYearly && <p className="hint">Toggle to offer a yearly discount.</p>}
            </div>
          </div>

          <div className="form-field">
            <label className="label">Perks <span style={{ color:"var(--muted)", fontWeight:300 }}>(one per line)</span></label>
            <textarea className="textarea" rows={4}
              placeholder={"All posts and videos\nExclusive Discord channel\nMonthly live Q&A\nBehind-the-scenes content"}
              value={form.perks} onChange={e => setForm(f => ({...f, perks:e.target.value}))} />
          </div>

          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? "Saving…" : "Add tier"}
          </button>
        </form>
      )}

      {loading ? (
        <p style={{ fontSize:13, color:"var(--muted)" }}>Loading…</p>
      ) : tiers.length === 0 ? (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", padding:"var(--s-12)", textAlign:"center" }}>
          <p style={{ fontSize:32, marginBottom:"var(--s-4)" }}>💰</p>
          <p style={{ fontFamily:"var(--font-serif)", fontSize:22, fontWeight:300, color:"#fff", marginBottom:"var(--s-3)" }}>No tiers yet.</p>
          <p style={{ fontSize:14, color:"var(--muted)", maxWidth:420, margin:"0 auto var(--s-5)" }}>
            Create subscription tiers so fans can choose how to support you. Start with one tier and add more as you grow.
          </p>
          <button className="btn btn--primary" onClick={() => setCreating(true)}>Create your first tier →</button>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"var(--s-2)" }}>
          {tiers.map((tier, idx) => (
            <div key={tier.id} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", padding:"var(--s-5) var(--s-6)", display:"flex", gap:"var(--s-5)", alignItems:"flex-start" }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:tier.color ?? "var(--accent)", flexShrink:0, marginTop:6 }} />
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"baseline", gap:"var(--s-3)", flexWrap:"wrap", marginBottom:4 }}>
                  <p style={{ fontSize:16, fontWeight:700, color:"var(--text)" }}>{tier.name}</p>
                  <p style={{ fontFamily:"var(--font-mono)", fontSize:14, color:tier.color ?? "var(--accent)", fontWeight:700 }}>
                    ${Number(tier.price_monthly).toFixed(2)}/mo
                    {tier.price_yearly && (
                      <span style={{ color:"var(--muted)", fontWeight:400, fontSize:12, marginLeft:8 }}>
                        or ${Number(tier.price_yearly).toFixed(2)}/yr
                        {" "}({Math.round((1 - tier.price_yearly / (tier.price_monthly * 12)) * 100)}% off)
                      </span>
                    )}
                  </p>
                </div>
                {tier.description && <p style={{ fontSize:13, color:"var(--muted)", marginBottom:"var(--s-3)" }}>{tier.description}</p>}
                {tier.perks?.length > 0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {tier.perks.map((perk: string, i: number) => (
                      <span key={i} style={{ fontSize:11, color:"var(--text-soft)", background:"var(--surface-2)", border:"1px solid var(--border)", padding:"2px 10px", borderRadius:"var(--r-pill)" }}>
                        ✓ {perk}
                      </span>
                    ))}
                  </div>
                )}
                <p style={{ fontSize:11, color:"var(--muted)", marginTop:"var(--s-3)", fontFamily:"var(--font-mono)" }}>
                  {tier.subscriber_count} subscriber{tier.subscriber_count !== 1 ? "s" : ""}
                </p>
              </div>
              <div style={{ display:"flex", gap:"var(--s-2)", flexShrink:0 }}>
                <button onClick={() => moveTier(tier.id, "up")} className="btn btn--secondary" style={{ fontSize:12 }} disabled={idx === 0}>↑</button>
                <button onClick={() => moveTier(tier.id, "down")} className="btn btn--secondary" style={{ fontSize:12 }} disabled={idx === tiers.length - 1}>↓</button>
                <button onClick={() => deleteTier(tier.id)} className="btn btn--secondary" style={{ fontSize:12, color:"var(--red)" }}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ──────────────────────────────────────────────────────────────────
// PANE: Digital Store
// ──────────────────────────────────────────────────────────────────
const DIGITAL_CATEGORIES = [
  { id: "ebook",    label: "eBook / Guide",   emoji: "📚" },
  { id: "preset",   label: "Preset / Filter", emoji: "🎨" },
  { id: "template", label: "Template",         emoji: "📊" },
  { id: "audio",    label: "Audio / Music",    emoji: "🎵" },
  { id: "course",   label: "Course / Program", emoji: "🎓" },
  { id: "video",    label: "Video",            emoji: "🎬" },
  { id: "other",    label: "Other",            emoji: "📦" },
];

// ──────────────────────────────────────────────────────────────────
// PANE: Tiers & Pricing




function DigitalStorePane({ profile, setErr }: { profile: Profile; setErr: (m: string | null) => void }) {
  const supabase = createClient();
  const [products, setProducts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [category, setCategory] = React.useState("other");
  const [fileUrl, setFileUrl] = React.useState("");
  const [fileName, setFileName] = React.useState("");
  const [fileSizeBytes, setFileSizeBytes] = React.useState(0);
  const [fileType, setFileType] = React.useState("other");
  const [previewImageUrl, setPreviewImageUrl] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);
  const imageRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("digital_products").select("*")
      .eq("creator_profile_id", profile.id ?? "")
      .neq("status", "deleted")
      .order("created_at", { ascending: false });
    setProducts(data ?? []);
    setLoading(false);
  }, [profile.id, supabase]);

  React.useEffect(() => { if (profile.id) void load(); else setLoading(false); }, [load, profile.id]);

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/digital/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); setUploading(false); return; }
    setFileUrl(data.url); setFileName(file.name); setFileSizeBytes(file.size); setFileType(data.fileType);
    setUploading(false); e.target.value = "";
  }

  async function uploadPreview(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) setPreviewImageUrl(data.url);
    setUploading(false); e.target.value = "";
  }

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !fileUrl || !price) { setErr("Title, file, and price are required"); return; }
    setSaving(true);
    await (supabase as any).from("digital_products").insert({
      creator_profile_id: profile.id,
      title: title.trim(), description: description.trim() || null,
      price: parseFloat(price), file_url: fileUrl, file_name: fileName,
      file_size_bytes: fileSizeBytes, file_type: fileType, category,
      preview_image_url: previewImageUrl || null,
    });
    setCreating(false); setTitle(""); setDescription(""); setPrice("");
    setFileUrl(""); setFileName(""); setCategory("other"); setPreviewImageUrl("");
    setSaving(false); void load();
  }

  async function toggleStatus(id: string, current: string) {
    const next = current === "active" ? "paused" : "active";
    await (supabase as any).from("digital_products").update({ status: next }).eq("id", id);
    setProducts(prev => prev.map(p => p.id === id ? { ...p, status: next } : p));
  }

  async function deleteProduct(id: string) {
    if (!confirm("Remove this product? Existing buyers keep their downloads.")) return;
    await (supabase as any).from("digital_products").update({ status: "deleted" }).eq("id", id);
    setProducts(prev => prev.filter(p => p.id !== id));
  }

  const formatBytes = (b: number) => b > 1e6 ? `${(b/1e6).toFixed(1)} MB` : `${(b/1e3).toFixed(0)} KB`;

  return (
    <div className="pane">
      <div className="pane-head pane-head--row">
        <div>
          <p className="kicker">Digital Store</p>
          <h1 className="pane-title">Sell your <em>work.</em></h1>
          <p style={{ fontSize:13, color:"var(--muted)", marginTop:"var(--s-2)", maxWidth:480 }}>
            PDFs, preset packs, beat packs, templates, courses — anything digital. 10% platform fee, you keep 90%. Fans get an instant download link after purchase.
          </p>
        </div>
        <button className="btn btn--primary" type="button" onClick={() => setCreating(c => !c)}>
          {creating ? "Cancel" : "+ New product"}
        </button>
      </div>

      {creating && (
        <form onSubmit={createProduct} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", padding:"var(--s-6) var(--s-7)", marginBottom:"var(--s-4)" }}>
          <p className="kicker" style={{ marginBottom:"var(--s-5)" }}>New digital product</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"var(--s-4)", marginBottom:"var(--s-4)" }}>
            <div className="form-field">
              <label className="label">Title</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="12-Week Fitness Program" required />
            </div>
            <div className="form-field">
              <label className="label">Price ($)</label>
              <input className="input" type="number" min="1" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="29.00" required />
            </div>
          </div>
          <div className="form-field" style={{ marginBottom:"var(--s-4)" }}>
            <label className="label">Description</label>
            <textarea className="textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="What\'s included? Who is it for?" rows={3} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"var(--s-4)", marginBottom:"var(--s-4)" }}>
            <div className="form-field">
              <label className="label">Category</label>
              <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
                {DIGITAL_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label className="label">Digital file</label>
              <input ref={fileRef} type="file" style={{ display:"none" }} onChange={uploadFile} accept=".pdf,.zip,.mp3,.mp4,.epub,.psd" />
              {fileUrl ? (
                <div style={{ display:"flex", alignItems:"center", gap:"var(--s-2)", padding:"var(--s-3) var(--s-4)", background:"rgba(52,211,153,0.06)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:"var(--r-2)" }}>
                  <span style={{ color:"#34D399" }}>✓</span>
                  <span style={{ fontSize:12, color:"var(--text-soft)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{fileName}</span>
                  <span style={{ fontSize:11, color:"var(--muted)", flexShrink:0 }}>{formatBytes(fileSizeBytes)}</span>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn btn--secondary" style={{ width:"100%", borderRadius:"var(--r-1)" }}>
                  {uploading ? "Uploading…" : "Upload file (PDF, ZIP, MP3…)"}
                </button>
              )}
            </div>
          </div>
          <div className="form-field" style={{ marginBottom:"var(--s-5)" }}>
            <label className="label">Cover image <span style={{ color:"var(--muted)", fontWeight:300 }}>(optional)</span></label>
            <input ref={imageRef} type="file" accept="image/*" style={{ display:"none" }} onChange={uploadPreview} />
            <div style={{ display:"flex", alignItems:"center", gap:"var(--s-4)" }}>
              <div style={{ width:80, height:60, background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", overflow:"hidden", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {previewImageUrl ? <img src={previewImageUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <span style={{ fontSize:22, color:"var(--muted)" }}>🖼️</span>}
              </div>
              <button type="button" onClick={() => imageRef.current?.click()} className="btn btn--secondary" style={{ borderRadius:"var(--r-pill)", fontSize:12 }}>Upload cover</button>
            </div>
          </div>
          {price && (
            <div style={{ background:"rgba(240,180,41,0.06)", border:"1px solid rgba(240,180,41,0.15)", borderRadius:"var(--r-2)", padding:"var(--s-3) var(--s-4)", marginBottom:"var(--s-5)", fontSize:13 }}>
              At ${parseFloat(price||"0").toFixed(2)}: <strong style={{ color:"var(--text)" }}>You earn ${(parseFloat(price||"0") * 0.90).toFixed(2)}</strong>
              <span style={{ color:"var(--muted)" }}> · Platform fee ${(parseFloat(price||"0") * 0.10).toFixed(2)}</span>
            </div>
          )}
          <button type="submit" className="btn btn--primary" disabled={saving || !fileUrl || !title || !price}>
            {saving ? "Publishing…" : "Publish product"}
          </button>
        </form>
      )}

      {loading ? (
        <p style={{ color:"var(--muted)", fontSize:13 }}>Loading…</p>
      ) : products.length === 0 && !creating ? (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", padding:"48px 40px", textAlign:"center" }}>
          <div style={{ fontSize:40, marginBottom:16 }}>📦</div>
          <h3 style={{ fontFamily:"var(--font-serif)", fontSize:24, fontWeight:300, color:"#fff", marginBottom:8 }}>Nothing for sale yet.</h3>
          <p style={{ fontSize:13, color:"var(--muted)", marginBottom:24 }}>Upload a PDF guide, preset pack, course, or anything else your fans would pay for.</p>
          <button className="btn btn--primary" onClick={() => setCreating(true)}>Create your first product →</button>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
          {products.map((p: any) => {
            const cat = DIGITAL_CATEGORIES.find(c => c.id === p.category);
            return (
              <div key={p.id} style={{ display:"flex", alignItems:"center", gap:"var(--s-4)", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", padding:"var(--s-4) var(--s-5)", opacity: p.status === "paused" ? 0.6 : 1 }}>
                <div style={{ width:52, height:40, background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"var(--r-1)", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
                  {p.preview_image_url ? <img src={p.preview_image_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <span style={{ fontSize:20 }}>{cat?.emoji ?? "📦"}</span>}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:14, fontWeight:700, color:"var(--text)", marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</p>
                  <div style={{ display:"flex", alignItems:"center", gap:"var(--s-3)" }}>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--accent)", fontWeight:700 }}>${Number(p.price).toFixed(2)}</span>
                    <span style={{ fontSize:11, color:"var(--muted)" }}>{cat?.label}</span>
                    <span style={{ fontSize:11, color:"var(--muted)" }}>{p.sales_count} sold</span>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:10, letterSpacing:".1em", textTransform:"uppercase", color: p.status === "active" ? "#34D399" : "var(--muted)", background: p.status === "active" ? "rgba(52,211,153,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${p.status === "active" ? "rgba(52,211,153,0.2)" : "var(--border)"}`, padding:"1px 7px", borderRadius:99 }}>{p.status}</span>
                  </div>
                </div>
                <div style={{ display:"flex", gap:"var(--s-2)", flexShrink:0 }}>
                  <button className="btn btn--secondary" style={{ fontSize:11, padding:"5px 12px", borderRadius:"var(--r-pill)" }} onClick={() => toggleStatus(p.id, p.status)}>
                    {p.status === "active" ? "Pause" : "Activate"}
                  </button>
                  <button onClick={() => deleteProduct(p.id)} style={{ background:"none", border:"none", color:"rgba(248,113,113,0.5)", cursor:"pointer", fontSize:11, padding:"5px 8px" }}>Remove</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ──────────────────────────────────────────────────────────────────
// PANE: Refer & Earn
// ──────────────────────────────────────────────────────────────────
function ReferPane({ profile }: { profile: Profile }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/referrals/stats")
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const creatorLink = `https://spotlightly.app/signup?ref=${profile.handle}`;
  const subLink = `https://spotlightly.app/${profile.handle}?ref=${profile.handle}`;

  return (
    <div className="pane">
      <div className="pane-head">
        <p className="kicker">Refer &amp; Earn</p>
        <h1 className="pane-title">Grow together. <em>Earn together.</em></h1>
        <p className="pane-lede">Two ways to earn free months — refer creators to Spotlightly, or refer fans to your page.</p>
      </div>

      {loading ? (
        <p style={{ color:"var(--muted)", fontSize:13 }}>Loading…</p>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"var(--s-3)" }}>

          {/* Creator referral */}
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderTop:"2px solid var(--accent)", borderRadius:"var(--r-3)", padding:"var(--s-6) var(--s-6)" }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"var(--s-4)", marginBottom:"var(--s-5)", flexWrap:"wrap" }}>
              <div>
                <p style={{ fontFamily:"var(--font-display)", fontSize:18, fontWeight:700, color:"#fff", marginBottom:4 }}>🤝 Refer a creator</p>
                <p style={{ fontSize:13, color:"var(--muted)", lineHeight:1.65, maxWidth:480 }}>
                  Share your link with creators who should be on Spotlightly. Every 5 who sign up earns you 1 free month — no limit on how many you can earn.
                </p>
              </div>
              {stats?.credits?.pendingUsd > 0 && (
                <div style={{ background:"rgba(240,180,41,0.1)", border:"1px solid rgba(240,180,41,0.2)", borderRadius:"var(--r-2)", padding:"var(--s-3) var(--s-4)", flexShrink:0, textAlign:"center" }}>
                  <p style={{ fontFamily:"var(--font-display)", fontSize:22, fontWeight:800, color:"var(--accent)", lineHeight:1 }}>${stats.credits.pendingUsd}</p>
                  <p style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:".15em", textTransform:"uppercase", color:"var(--accent)", opacity:.7, marginTop:4 }}>credit earned</p>
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom:"var(--s-5)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"var(--s-2)" }}>
                <p style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--muted)" }}>
                  {stats?.creatorReferrals?.progressToNextCredit ?? 0} / 5 toward next free month
                </p>
                <p style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--muted)" }}>
                  {stats?.creatorReferrals?.total ?? 0} total referrals
                </p>
              </div>
              <div style={{ height:8, background:"var(--surface-2)", borderRadius:"var(--r-pill)", overflow:"hidden" }}>
                <div style={{ height:"100%", background:"var(--accent)", borderRadius:"var(--r-pill)", width:`${stats?.creatorReferrals?.percentage ?? 0}%`, transition:"width 0.6s ease" }} />
              </div>
            </div>

            {/* Link */}
            <div style={{ display:"flex", gap:"var(--s-2)", alignItems:"center" }}>
              <div style={{ flex:1, background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"10px 14px", fontFamily:"var(--font-mono)", fontSize:12, color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {creatorLink}
              </div>
              <button onClick={() => copy(creatorLink, "creator")} className="btn btn--secondary" style={{ fontSize:12, flexShrink:0 }}>
                {copied === "creator" ? "✓ Copied" : "Copy link"}
              </button>
            </div>
          </div>

          {/* Subscriber referral */}
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderTop:"2px solid var(--accent-open)", borderRadius:"var(--r-3)", padding:"var(--s-6)" }}>
            <div style={{ marginBottom:"var(--s-5)" }}>
              <p style={{ fontFamily:"var(--font-display)", fontSize:18, fontWeight:700, color:"#fff", marginBottom:4 }}>📣 Refer a subscriber</p>
              <p style={{ fontSize:13, color:"var(--muted)", lineHeight:1.65, maxWidth:480 }}>
                Share your referral link on social media. When someone clicks it and subscribes to your page, it&apos;s tracked. See exactly how many subscribers came from your own promotion.
              </p>
            </div>

            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"var(--s-2)", marginBottom:"var(--s-5)" }}>
              {[
                { label:"Total clicks", value: stats?.subscriberReferrals?.total ?? 0 },
                { label:"Subscribed", value: stats?.subscriberReferrals?.converted ?? 0 },
                { label:"Conversion", value: `${stats?.subscriberReferrals?.conversionRate ?? 0}%` },
              ].map((s, i) => (
                <div key={i} style={{ background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"var(--s-4)", textAlign:"center" }}>
                  <p style={{ fontFamily:"var(--font-display)", fontSize:22, fontWeight:800, color:"#fff", lineHeight:1 }}>{s.value}</p>
                  <p style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:".15em", textTransform:"uppercase", color:"var(--muted)", marginTop:"var(--s-2)" }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Link */}
            <div style={{ display:"flex", gap:"var(--s-2)", alignItems:"center" }}>
              <div style={{ flex:1, background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"10px 14px", fontFamily:"var(--font-mono)", fontSize:12, color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {subLink}
              </div>
              <button onClick={() => copy(subLink, "sub")} className="btn btn--secondary" style={{ fontSize:12, flexShrink:0 }}>
                {copied === "sub" ? "✓ Copied" : "Copy link"}
              </button>
            </div>
          </div>

          {/* How it works */}
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", padding:"var(--s-5) var(--s-6)" }}>
            <p style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:".2em", textTransform:"uppercase", color:"var(--muted)", marginBottom:"var(--s-4)" }}>How creator referrals work</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"var(--s-2)" }}>
              {[
                { step:"1", text:"Share your creator link with friends who create content" },
                { step:"2", text:"They sign up using your link and start their free trial" },
                { step:"3", text:"5 signups = 1 free month automatically added to your account" },
                { step:"4", text:"No limit — refer 50 creators, get 10 free months" },
              ].map(s => (
                <div key={s.step} style={{ textAlign:"center", padding:"var(--s-4)" }}>
                  <div style={{ width:32, height:32, borderRadius:"50%", background:"rgba(240,180,41,0.1)", border:"1px solid rgba(240,180,41,0.2)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto var(--s-3)", fontFamily:"var(--font-display)", fontSize:13, fontWeight:800, color:"var(--accent)" }}>{s.step}</div>
                  <p style={{ fontSize:12, color:"var(--muted)", lineHeight:1.6 }}>{s.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Applied credits */}
          {(stats?.credits?.applied > 0 || stats?.credits?.pending > 0) && (
            <div style={{ background:"rgba(52,211,153,0.05)", border:"1px solid rgba(52,211,153,0.15)", borderRadius:"var(--r-3)", padding:"var(--s-4) var(--s-6)", display:"flex", alignItems:"center", gap:"var(--s-4)" }}>
              <span style={{ fontSize:24 }}>🎉</span>
              <div>
                <p style={{ fontSize:14, fontWeight:700, color:"var(--text)" }}>
                  {stats.credits.pendingUsd > 0
                    ? `$${stats.credits.pendingUsd} credit ready — applied against your next bill`
                    : `$${stats.credits.appliedUsd} earned through referrals so far`}
                </p>
                <p style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>
                  ${stats.credits.totalUsd} total earned · ${stats.credits.appliedUsd} applied · ${stats.credits.pendingUsd} pending
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function BillingPane() {
  const [data, setData] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [openingPortal, setOpeningPortal] = React.useState(false);

  React.useEffect(() => {
    async function loadBilling() {
      const res = await fetch("/api/billing");
      const d = await res.json();
      // Auto-create billing record if none exists
      if (!d.billing) {
        const createRes = await fetch("/api/billing", { method: "POST" });
        const created = await createRes.json();
        const refetch = await fetch("/api/billing");
        const fresh = await refetch.json();
        setData(fresh);
      } else {
        setData(d);
      }
      setLoading(false);
    }
    loadBilling();
  }, []);

  async function openPortal() {
    setOpeningPortal(true);
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const d = await res.json();
    if (d.url) window.location.href = d.url;
    else { alert(d.error ?? "Could not open billing portal"); setOpeningPortal(false); }
  }

  const TIER_ORDER = ["starter", "growth", "pro", "scale", "legend"];
  const TIER_INFO: Record<string, { name: string; maxSubs: number; priceUsd: number; label: string }> = {
    starter: { name: "Starter",  maxSubs: 100,      priceUsd: 29,    label: "Up to 100 subscribers" },
    growth:  { name: "Growth",   maxSubs: 500,      priceUsd: 79,    label: "Up to 500 subscribers" },
    pro:     { name: "Pro",      maxSubs: 2500,     priceUsd: 249,   label: "Up to 2,500 subscribers" },
    scale:   { name: "Scale",    maxSubs: 10000,    priceUsd: 749,   label: "Up to 10,000 subscribers" },
    legend:  { name: "Legend",   maxSubs: Infinity, priceUsd: 3499,  label: "Unlimited subscribers" },
  };

  return (
    <div className="pane">
      <div className="pane-head">
        <p className="kicker">Platform subscription</p>
        <h1 className="pane-title">Your <em>plan.</em></h1>
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: "var(--muted)" }}>Loading…</p>
      ) : !data?.billing ? (
        <p style={{ fontSize: 13, color: "var(--muted)" }}>Setting up your account…</p>
      ) : (
        <div style={{ maxWidth: 560 }}>

          {/* Status card */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-3)", padding: "var(--s-6) var(--s-7)", marginBottom: 2 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--s-5)" }}>
              <div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>Current plan</p>
                <p style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 400, color: "#fff", lineHeight: 1 }}>
                  {TIER_INFO[data.billing.tier]?.name}
                </p>
                <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{TIER_INFO[data.billing.tier]?.label}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, color: "var(--accent)", letterSpacing: "-.03em" }}>
                  ${TIER_INFO[data.billing.tier]?.priceUsd}<span style={{ fontSize: 13, fontWeight: 400, color: "var(--muted)" }}>/mo</span>
                </p>
                <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: "var(--r-pill)", fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: ".1em", textTransform: "uppercase",
                  background: data.billing.status === "trial" ? "rgba(240,180,41,0.1)" : data.billing.status === "active" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                  color: data.billing.status === "trial" ? "var(--accent-spot)" : data.billing.status === "active" ? "var(--accent-open)" : "var(--red)",
                  border: `1px solid ${data.billing.status === "trial" ? "rgba(240,180,41,0.2)" : data.billing.status === "active" ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`,
                }}>
                  {data.billing.status === "trial" ? `Trial · ${data.trialDaysLeft}d left` : data.billing.status}
                </div>
              </div>
            </div>

            {/* Trial warning */}
            {data.billing.status === "trial" && data.trialDaysLeft <= 7 && (
              <div style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: "var(--r-2)", padding: "var(--s-4) var(--s-5)", marginBottom: "var(--s-5)", fontSize: 13, color: "rgba(248,113,113,0.9)", lineHeight: 1.6 }}>
                Your trial ends in <strong>{data.trialDaysLeft} days</strong>. Add a payment method now to keep your account active.
              </div>
            )}

            {/* Subscriber count + tier progress */}
            <div style={{ marginBottom: "var(--s-5)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "var(--text-soft)" }}>
                  <strong style={{ color: "#fff" }}>{data.subscriberCount}</strong> active subscribers
                </span>
                {data.needsUpgrade && (
                  <span style={{ fontSize: 11, color: "var(--accent-spot)", fontFamily: "var(--font-mono)", letterSpacing: ".1em", textTransform: "uppercase" }}>
                    → {TIER_INFO[data.correctTier]?.name} on next cycle
                  </span>
                )}
              </div>
              {/* Tier progress bar */}
              {data.billing.tier !== "legend" && (() => {
                const tier = TIER_INFO[data.billing.tier];
                const prevMax = TIER_ORDER.indexOf(data.billing.tier) > 0
                  ? TIER_INFO[TIER_ORDER[TIER_ORDER.indexOf(data.billing.tier) - 1]].maxSubs
                  : 0;
                const pct = Math.min(100, ((data.subscriberCount - prevMax) / (tier.maxSubs - prevMax)) * 100);
                return (
                  <div>
                    <div style={{ height: 4, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", borderRadius: 99, transition: "width 0.3s" }} />
                    </div>
                    <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                      {data.subscriberCount} of {tier.maxSubs} subscribers — next tier: {TIER_INFO[TIER_ORDER[TIER_ORDER.indexOf(data.billing.tier) + 1]]?.name} at ${TIER_INFO[TIER_ORDER[TIER_ORDER.indexOf(data.billing.tier) + 1]]?.priceUsd}/mo
                    </p>
                  </div>
                );
              })()}
            </div>

            <button onClick={openPortal} disabled={openingPortal} className="btn btn--secondary" style={{ borderRadius: "var(--r-pill)" }}>
              {openingPortal ? "Opening…" : data.billing.status === "trial" ? "Add payment method" : "Manage billing"}
            </button>
          </div>

          {/* All tiers table */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-3)", overflow: "hidden" }}>
            <div style={{ padding: "var(--s-5) var(--s-6)", borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--muted)" }}>All tiers</p>
            </div>
            {TIER_ORDER.map(key => {
              const tier = TIER_INFO[key];
              const isCurrent = key === data.billing.tier;
              const isNext = key === data.correctTier && data.needsUpgrade;
              return (
                <div key={key} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "var(--s-4) var(--s-6)",
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                  background: isCurrent ? "rgba(240,180,41,0.04)" : "transparent",
                }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: isCurrent ? 700 : 400, color: isCurrent ? "var(--accent)" : "var(--text-soft)" }}>
                      {tier.name}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>{tier.label}</span>
                    {isNext && <span style={{ marginLeft: 8, fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent-spot)", letterSpacing: ".1em", textTransform: "uppercase" }}>next cycle</span>}
                  </div>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: isCurrent ? "var(--accent)" : "var(--muted)" }}>
                    ${tier.priceUsd}/mo
                  </span>
                </div>
              );
            })}
          </div>

          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: "var(--s-4)", lineHeight: 1.7 }}>
            Your tier auto-adjusts at each billing cycle based on your subscriber count. You&apos;re never charged more than your current tier rate until the next renewal.
          </p>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// PANE: Messages — creator reads and replies to fan messages
// ──────────────────────────────────────────────────────────────────
function MessagesPane({ profile }: { profile: Profile }) {
  const [threads, setThreads] = React.useState<any[]>([]);
  const [active, setActive] = React.useState<any | null>(null);
  const [messages, setMessages] = React.useState<any[]>([]);
  const [reply, setReply] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const supabase = createClient();

  React.useEffect(() => {
    (supabase as any)
      .from("message_threads")
      .select("*, fan:fan_user_id(email)")
      .eq("creator_profile_id", profile.id)
      .order("last_message_at", { ascending: false })
      .then(({ data }: any) => { setThreads(data ?? []); setLoading(false); });
  }, []);

  async function openThread(thread: any) {
    setActive(thread);
    const { data } = await (supabase as any)
      .from("messages")
      .select("*")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true });
    setMessages(data ?? []);
    // Mark read
    await (supabase as any).from("message_threads").update({ creator_unread: 0 }).eq("id", thread.id);
    setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, creator_unread: 0 } : t));
  }

  async function sendReply() {
    if (!reply.trim() || !active) return;
    setSending(true);
    await (supabase as any).from("messages").insert({
      thread_id: active.id,
      sender_user_id: (await supabase.auth.getUser()).data.user?.id,
      creator_profile_id: profile.id,
      content: reply.trim(),
      is_front_row: false,
    });
    await (supabase as any).from("message_threads").update({ last_message_at: new Date().toISOString(), fan_unread: (active.fan_unread ?? 0) + 1 }).eq("id", active.id);
    setMessages(prev => [...prev, { content: reply.trim(), created_at: new Date().toISOString(), sender_user_id: "me" }]);
    setReply("");
    setSending(false);
  }

  return (
    <div className="pane">
      <div className="pane-head">
        <p className="kicker">Inbox</p>
        <h1 className="pane-title">Your <em>messages.</em></h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 2, minHeight: 400 }}>
        {/* Thread list */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {loading && <p style={{ padding: "var(--s-5)", fontSize: 13, color: "var(--muted)" }}>Loading…</p>}
          {!loading && threads.length === 0 && <p style={{ padding: "var(--s-5)", fontSize: 13, color: "var(--muted)" }}>No messages yet.</p>}
          {threads.map(t => (
            <div key={t.id} onClick={() => openThread(t)} style={{
              padding: "var(--s-4) var(--s-5)", cursor: "pointer",
              background: active?.id === t.id ? "rgba(255,255,255,0.04)" : "transparent",
              borderBottom: "1px solid var(--border)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{t.fan?.email?.split("@")[0] ?? "Fan"}</span>
                {t.creator_unread > 0 && (
                  <span style={{ background: "var(--accent)", color: "#09090C", fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "1px 6px" }}>{t.creator_unread}</span>
                )}
              </div>
              {t.is_front_row && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em", color: "var(--accent-spot)", textTransform: "uppercase" }}>Front Row</span>}
            </div>
          ))}
        </div>

        {/* Message thread */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
          {!active ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ fontSize: 13, color: "var(--muted)" }}>Select a conversation</p>
            </div>
          ) : (
            <>
              <div style={{ flex: 1, padding: "var(--s-5)", overflowY: "auto", display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
                {messages.map((m, i) => {
                  const isMe = m.sender_user_id !== active.fan_user_id;
                  return (
                    <div key={i} style={{ alignSelf: isMe ? "flex-end" : "flex-start", maxWidth: "75%" }}>
                      {m.is_front_row && (
                        <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent-spot)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
                          ⭐ Front Row · ${Number(m.front_row_amount).toFixed(2)}
                        </p>
                      )}
                      <div style={{
                        background: isMe ? "var(--accent)" : "var(--surface-2)",
                        color: isMe ? "#09090C" : "var(--text)",
                        padding: "10px 14px", borderRadius: "var(--r-3)",
                        fontSize: 14, lineHeight: 1.6,
                        border: m.is_front_row ? "1px solid rgba(240,180,41,0.3)" : "1px solid var(--border)",
                      }}>
                        {m.content}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: "var(--s-4) var(--s-5)", borderTop: "1px solid var(--border)", display: "flex", gap: "var(--s-3)" }}>
                <input
                  type="text" placeholder="Reply…" value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") sendReply(); }}
                  style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--r-2)", padding: "9px 14px", color: "var(--text)", fontSize: 13, outline: "none" }}
                />
                <button onClick={sendReply} disabled={sending || !reply.trim()} className="btn btn--primary btn--small" style={{ borderRadius: "var(--r-pill)" }}>
                  {sending ? "…" : "Send"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// PANE: Live — go live with BunnyCDN
// ──────────────────────────────────────────────────────────────────
function LivePane({ profile }: { profile: Profile }) {
  const [title, setTitle] = React.useState("");
  const [stream, setStream] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [ending, setEnding] = React.useState(false);
  const [currentLive, setCurrentLive] = React.useState<any | null>(null);
  const supabase = createClient();

  React.useEffect(() => {
    (supabase as any)
      .from("live_streams")
      .select("*")
      .eq("creator_profile_id", profile.id)
      .eq("status", "live")
      .maybeSingle()
      .then(({ data }: any) => setCurrentLive(data ?? null));
  }, []);

  async function goLive() {
    if (!title.trim()) return;
    setLoading(true);
    const res = await fetch("/api/live/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), creatorProfileId: profile.id }),
    });
    const data = await res.json();
    if (data.streamId) setStream(data);
    else alert(data.error ?? "Could not start stream");
    setLoading(false);
  }

  async function endStream() {
    const s = stream ?? currentLive;
    if (!s) return;
    setEnding(true);
    await fetch("/api/live/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ streamId: s.streamId ?? s.bunny_stream_id }),
    });
    setStream(null);
    setCurrentLive(null);
    setTitle("");
    setEnding(false);
  }

  const activeStream = stream ?? currentLive;

  return (
    <div className="pane">
      <div className="pane-head">
        <p className="kicker">Live Streaming</p>
        <h1 className="pane-title">Go <em>live.</em></h1>
        <p className="pane-lede">Stream to your fans in real time. Copy the RTMP URL and stream key into OBS, Streamlabs, or any streaming app.</p>
      </div>

      {activeStream ? (
        <div style={{ maxWidth: 560 }}>
          <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "var(--r-3)", padding: "var(--s-6) var(--s-7)", marginBottom: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--s-5)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", boxShadow: "0 0 6px #EF4444", display: "inline-block" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: "#EF4444" }}>Live now</span>
            </div>

            <div style={{ marginBottom: "var(--s-4)" }}>
              <p className="label">RTMP URL</p>
              <div style={{ display: "flex", gap: "var(--s-2)", alignItems: "center" }}>
                <code style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--r-2)", padding: "8px 12px", fontSize: 12, color: "var(--accent-open)", overflowX: "auto" }}>
                  {activeStream.rtmpUrl ?? activeStream.rtmp_url}
                </code>
                <button onClick={() => navigator.clipboard.writeText(activeStream.rtmpUrl ?? activeStream.rtmp_url)} className="btn btn--secondary btn--small" style={{ borderRadius: "var(--r-pill)", flexShrink: 0 }}>Copy</button>
              </div>
            </div>

            <div style={{ marginBottom: "var(--s-6)" }}>
              <p className="label">Stream Key</p>
              <div style={{ display: "flex", gap: "var(--s-2)", alignItems: "center" }}>
                <code style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--r-2)", padding: "8px 12px", fontSize: 12, color: "var(--accent-open)", overflowX: "auto" }}>
                  {activeStream.streamKey ?? activeStream.stream_key}
                </code>
                <button onClick={() => navigator.clipboard.writeText(activeStream.streamKey ?? activeStream.stream_key)} className="btn btn--secondary btn--small" style={{ borderRadius: "var(--r-pill)", flexShrink: 0 }}>Copy</button>
              </div>
            </div>

            <button onClick={endStream} disabled={ending} className="btn" style={{ background: "#EF4444", color: "#fff", borderRadius: "var(--r-pill)", border: "none" }}>
              {ending ? "Ending…" : "End Stream"}
            </button>
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: "var(--s-3)" }}>
            Your fans can see the live stream on your public page right now.
          </p>
        </div>
      ) : (
        <div style={{ maxWidth: 480 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-3)", padding: "var(--s-6) var(--s-7)" }}>
            <p className="label" style={{ marginBottom: "var(--s-2)" }}>Stream title</p>
            <input
              type="text" placeholder="e.g. Q&A session, Behind the scenes…"
              value={title} onChange={e => setTitle(e.target.value)}
              className="input" style={{ marginBottom: "var(--s-5)" }}
            />
            <button onClick={goLive} disabled={loading || !title.trim()} className="btn btn--primary" style={{ borderRadius: "var(--r-pill)" }}>
              {loading ? "Starting…" : "🔴 Go Live"}
            </button>
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: "var(--s-3)", lineHeight: 1.6 }}>
            Once you start, you&apos;ll get an RTMP URL and stream key to paste into OBS or any streaming app. Your fans will see the live stream appear on your page automatically.
          </p>
        </div>
      )}
    </div>
  );
}


function AnalyticsPane({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const [stats, setStats] = React.useState({
    totalSubs: 0, activeSubs: 0, totalTips: 0, totalPosts: 0,
    recentTips: [] as any[], subsByMonth: [] as any[], newSubsThisMonth: 0,
  });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      const [
        { count: activeSubs },
        { data: tips },
        { count: totalPosts },
        { data: allSubs },
      ] = await Promise.all([
        (supabase as any).from("subscriptions").select("id", { count:"exact", head:true })
          .eq("creator_profile_id", profile.id).eq("status", "active"),
        (supabase as any).from("tips").select("amount, created_at")
          .eq("creator_profile_id", profile.id).order("created_at", { ascending:false }).limit(50),
        (supabase as any).from("posts").select("id", { count:"exact", head:true })
          .eq("creator_profile_id", profile.id).eq("status", "live"),
        (supabase as any).from("subscriptions").select("created_at")
          .eq("creator_profile_id", profile.id),
      ]);

      const totalTips = (tips ?? []).reduce((sum: number, t: any) => sum + Number(t.amount), 0);
      const now = new Date();
      const thisMonth = allSubs?.filter((s: any) => new Date(s.created_at).getMonth() === now.getMonth() && new Date(s.created_at).getFullYear() === now.getFullYear()) ?? [];

      // Subs by month (last 6)
      const monthMap: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toLocaleString("default", { month:"short", year:"numeric" });
        monthMap[key] = 0;
      }
      (allSubs ?? []).forEach((s: any) => {
        const d = new Date(s.created_at);
        const key = d.toLocaleString("default", { month:"short", year:"numeric" });
        if (key in monthMap) monthMap[key]++;
      });

      setStats({
        activeSubs: activeSubs ?? 0,
        totalSubs: allSubs?.length ?? 0,
        totalTips,
        totalPosts: totalPosts ?? 0,
        recentTips: (tips ?? []).slice(0, 10),
        subsByMonth: Object.entries(monthMap).map(([month, count]) => ({ month, count })),
        newSubsThisMonth: thisMonth.length,
      });
      setLoading(false);
    }
    load();
  }, []);

  const maxCount = Math.max(...stats.subsByMonth.map(m => m.count), 1);

  return (
    <div className="pane">
      <div className="pane-head">
        <p className="kicker">Analytics</p>
        <h1 className="pane-title">Your <em>numbers.</em></h1>
      </div>

      {loading ? <p style={{ color:"var(--muted)", fontSize:14 }}>Loading…</p> : (
        <>
          {/* Top stats */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:2, marginBottom:"var(--s-6)" }}>
            {[
              { label:"Active subscribers", val: stats.activeSubs.toLocaleString(), accent:true },
              { label:"New this month", val: stats.newSubsThisMonth.toLocaleString() },
              { label:"Total tips earned", val: `$${stats.totalTips.toFixed(2)}` },
              { label:"Posts live", val: stats.totalPosts.toLocaleString() },
            ].map(s => (
              <div key={s.label} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"var(--s-5) var(--s-4)" }}>
                <div style={{ fontFamily:"var(--font-display)", fontSize:28, fontWeight:800, letterSpacing:"-0.03em", color: s.accent ? "var(--accent-bright)" : "#fff", lineHeight:1, marginBottom:"var(--s-2)" }}>
                  {s.val}
                </div>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:".18em", textTransform:"uppercase", color:"var(--muted)" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Subscriber growth chart */}
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", padding:"var(--s-6)", marginBottom:"var(--s-4)" }}>
            <p className="kicker" style={{ marginBottom:"var(--s-5)" }}>New subscribers — last 6 months</p>
            <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:120 }}>
              {stats.subsByMonth.map(m => (
                <div key={m.month} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:"var(--s-2)" }}>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--accent-bright)", fontWeight:600 }}>
                    {m.count > 0 ? m.count : ""}
                  </div>
                  <div style={{
                    width:"100%", borderRadius:"var(--r-1) var(--r-1) 0 0",
                    background: m.count > 0 ? "linear-gradient(to top, var(--accent), var(--accent-bright))" : "var(--surface-3)",
                    height: `${Math.max(4, Math.round((m.count / maxCount) * 80))}px`,
                    transition:"height 0.8s var(--ease)",
                  }} />
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:8, letterSpacing:".06em", color:"var(--muted)", textAlign:"center", lineHeight:1.3 }}>
                    {m.month.split(" ").map((w: string, i: number) => <div key={i}>{w}</div>)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent tips */}
          {stats.recentTips.length > 0 && (
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", padding:"var(--s-6)" }}>
              <p className="kicker" style={{ marginBottom:"var(--s-4)" }}>Recent tips</p>
              <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                {stats.recentTips.map((t: any, i: number) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"var(--s-3) var(--s-4)", background:"var(--surface-2)", borderRadius:"var(--r-1)" }}>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)", letterSpacing:".08em" }}>
                      {new Date(t.created_at).toLocaleDateString()}
                    </span>
                    <span style={{ fontFamily:"var(--font-display)", fontSize:14, fontWeight:700, color:"var(--accent-bright)" }}>
                      ${Number(t.amount).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.activeSubs === 0 && stats.totalTips === 0 && (
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", padding:"var(--s-10)", textAlign:"center" }}>
              <p style={{ fontFamily:"var(--font-serif)", fontSize:20, fontStyle:"italic", color:"#fff", marginBottom:"var(--s-3)" }}>Your stage is set.</p>
              <p style={{ fontSize:13, color:"var(--muted)", lineHeight:1.7 }}>Connect Stripe, create a channel, and share your Spotlightly link in your bios.<br />Your first subscriber changes everything.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}


// ──────────────────────────────────────────────────────────────────
// PANE: Wishlist — fund-my-purchase model
// ──────────────────────────────────────────────────────────────────

function WishlistPane({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const [items, setItems] = React.useState<any[]>([]);
  const [purchases, setPurchases] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [adding, setAdding] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [savingAddr, setSavingAddr] = React.useState(false);
  const [addrSaved, setAddrSaved] = React.useState(false);
  const [tab, setTab] = React.useState<"items"|"gifted"|"address">("items");
  const [addr, setAddr] = React.useState({
    shipping_name: (profile as any).shipping_name ?? "",
    shipping_address: (profile as any).shipping_address ?? "",
    shipping_city: (profile as any).shipping_city ?? "",
    shipping_state: (profile as any).shipping_state ?? "",
    shipping_zip: (profile as any).shipping_zip ?? "",
    shipping_country: (profile as any).shipping_country ?? "US",
  });
  const [form, setForm] = React.useState({ name:"", description:"", price:"", store_url:"", store_name:"", image_url:"" });
  const [confirming, setConfirming] = React.useState<string|null>(null);

  React.useEffect(() => {
    async function load() {
      const { data: i } = await (supabase as any)
        .from("wishlist_items").select("*")
        .eq("creator_profile_id", profile.id)
        .order("is_purchased").order("created_at", { ascending: false });
      setItems(i ?? []);

      const { data: p } = await (supabase as any)
        .from("wishlist_purchases")
        .select("*, item:wishlist_item_id(name, store_url, store_name, price, image_url), buyer:buyer_user_id(email)")
        .eq("creator_profile_id", profile.id)
        .order("created_at", { ascending: false });
      setPurchases(p ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function saveAddress() {
    setSavingAddr(true);
    await (supabase as any).from("creator_profiles").update(addr).eq("id", profile.id);
    setAddrSaved(true); setSavingAddr(false);
    setTimeout(() => setAddrSaved(false), 2000);
  }

  async function addItem() {
    if (!form.name.trim() || !form.price) return;
    setSaving(true);
    const { data, error } = await (supabase as any).from("wishlist_items").insert({
      creator_profile_id: profile.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: parseFloat(form.price),
      store_url: form.store_url.trim() || null,
      store_name: form.store_name.trim() || null,
      image_url: form.image_url.trim() || null,
    }).select().single();
    if (!error) {
      setItems(prev => [data, ...prev]);
      setForm({ name:"", description:"", price:"", store_url:"", store_name:"", image_url:"" });
      setAdding(false);
    }
    setSaving(false);
  }

  async function removeItem(id: string) {
    if (!confirm("Remove this item?")) return;
    await (supabase as any).from("wishlist_items").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  async function confirmPurchase(purchaseId: string) {
    setConfirming(purchaseId);
    const res = await fetch("/api/wishlist/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purchaseId }),
    });
    const data = await res.json();
    if (data.ok) {
      setPurchases(prev => prev.map(p =>
        p.id === purchaseId ? { ...p, status:"creator_purchased" } : p
      ));
    } else {
      alert(data.error || "Something went wrong");
    }
    setConfirming(null);
  }

  const pending = purchases.filter((p:any) => p.status === "paid_pending_purchase");
  const tabStyle = (t: string) => ({
    fontFamily:"var(--font-display)", fontSize:12, fontWeight:700,
    padding:"8px 16px", border:"none", cursor:"pointer",
    borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
    color: tab === t ? "var(--text)" : "var(--muted)", background:"transparent",
  } as const);

  return (
    <div className="pane">
      <div className="pane-head">
        <p className="kicker">Wishlist</p>
        <h1 className="pane-title">Your <em>wish list.</em></h1>
        <p className="pane-lede">
          Fans fund items from your list. When they pay, you get notified — then go buy it yourself
          from any store and we transfer the item cost directly to your Stripe account.
          Your address stays completely private.
        </p>
      </div>

      {pending.length > 0 && (
        <div style={{ background:"rgba(240,180,41,.07)", border:"1px solid var(--accent-border)", borderRadius:"var(--r-2)", padding:"var(--s-4) var(--s-5)", marginBottom:"var(--s-5)", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"var(--s-3)" }}>
          <div>
            <span style={{ fontFamily:"var(--font-display)", fontWeight:700, color:"var(--accent)", marginRight:8 }}>🎁 {pending.length} gift{pending.length > 1 ? "s" : ""} waiting</span>
            <span style={{ fontSize:13, color:"var(--text-soft)" }}>Go buy the items, then mark them done — we'll transfer the cost to you immediately.</span>
          </div>
          <button onClick={() => setTab("gifted")} className="btn btn--primary btn--small">View gifts →</button>
        </div>
      )}

      <div style={{ display:"flex", gap:0, borderBottom:"1px solid var(--border)", marginBottom:"var(--s-6)" }}>
        <button style={tabStyle("items")} onClick={() => setTab("items")}>
          Wish list ({items.filter((i:any) => !i.is_purchased).length})
        </button>
        <button style={tabStyle("gifted")} onClick={() => setTab("gifted")}>
          Gifts {pending.length > 0 && <span style={{ marginLeft:4, background:"var(--accent)", color:"#0a0a0d", borderRadius:99, fontSize:10, padding:"1px 6px", fontWeight:700 }}>{pending.length}</span>}
        </button>
        <button style={tabStyle("address")} onClick={() => setTab("address")}>
          My address
        </button>
      </div>

      {/* ITEMS TAB */}
      {tab === "items" && (
        <>
          <div style={{ display:"flex", flexDirection:"column", gap:2, marginBottom:"var(--s-5)" }}>
            {loading && <p style={{ color:"var(--muted)", fontSize:14 }}>Loading…</p>}
            {!loading && items.filter((i:any) => !i.is_purchased).length === 0 && !adding && (
              <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"var(--s-10)", textAlign:"center" }}>
                <p style={{ fontFamily:"var(--font-serif)", fontSize:18, fontStyle:"italic", color:"#fff", marginBottom:"var(--s-2)" }}>Nothing on your list yet.</p>
                <p style={{ fontSize:13, color:"var(--muted)" }}>Add things you want — gear, clothes, books, anything from any store.</p>
              </div>
            )}
            {items.filter((i:any) => !i.is_purchased).map((item: any) => (
              <div key={item.id} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"var(--s-4) var(--s-5)", display:"grid", gridTemplateColumns:"auto 1fr auto", gap:"var(--s-4)", alignItems:"center" }}>
                {item.image_url
                  ? <img src={item.image_url} alt="" style={{ width:52, height:52, objectFit:"cover", borderRadius:"var(--r-1)" }} />
                  : <div style={{ width:52, height:52, background:"var(--surface-3)", borderRadius:"var(--r-1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🎁</div>
                }
                <div>
                  <div style={{ fontFamily:"var(--font-display)", fontSize:14, fontWeight:700, color:"#fff", marginBottom:3 }}>{item.name}</div>
                  <div style={{ display:"flex", gap:"var(--s-3)", fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)", letterSpacing:".08em" }}>
                    <span style={{ color:"var(--accent-bright)", fontWeight:600 }}>${Number(item.price).toFixed(2)}</span>
                    {item.store_name && <span>{item.store_name}</span>}
                    {item.store_url && <a href={item.store_url} target="_blank" rel="noopener" style={{ color:"var(--accent)" }}>View product →</a>}
                  </div>
                  {item.description && <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>{item.description}</div>}
                </div>
                <button onClick={() => removeItem(item.id)} style={{ background:"none", border:"none", color:"var(--muted-faint)", cursor:"pointer", fontSize:18 }}>×</button>
              </div>
            ))}
            {items.filter((i:any) => i.is_purchased).length > 0 && (
              <div style={{ marginTop:"var(--s-4)" }}>
                <p className="kicker" style={{ marginBottom:"var(--s-3)" }}>Already funded</p>
                {items.filter((i:any) => i.is_purchased).map((item: any) => (
                  <div key={item.id} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"var(--s-3) var(--s-5)", opacity:0.5, display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
                    <span style={{ fontSize:13, color:"var(--muted)", textDecoration:"line-through" }}>{item.name}</span>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--accent-open)" }}>✓ Funded</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {adding ? (
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", padding:"var(--s-6)" }}>
              <p style={{ fontFamily:"var(--font-display)", fontSize:15, fontWeight:700, color:"#fff", marginBottom:"var(--s-5)" }}>Add item</p>
              <div style={{ display:"flex", flexDirection:"column", gap:"var(--s-3)" }}>
                <div><label className="label">Item name</label><input className="input" placeholder="e.g. Sony ZV-E10 Camera, Nike Air Max 270, Standing desk" value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} /></div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"var(--s-3)" }}>
                  <div>
                    <label className="label">Price ($)</label>
                    <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                      <span style={{ color:"var(--muted)" }}>$</span>
                      <input className="input" type="number" min="1" step="0.01" placeholder="249.99" value={form.price} onChange={e => setForm(f => ({...f, price:e.target.value}))} />
                    </div>
                  </div>
                  <div><label className="label">Store name</label><input className="input" placeholder="Amazon, Nike, Best Buy…" value={form.store_name} onChange={e => setForm(f => ({...f, store_name:e.target.value}))} /></div>
                </div>
                <div><label className="label">Product URL</label><input className="input" type="url" placeholder="Paste the product link from the store" value={form.store_url} onChange={e => setForm(f => ({...f, store_url:e.target.value}))} /></div>
                <div><label className="label">Product image URL (optional)</label><input className="input" type="url" placeholder="Right-click the product image → Copy image address" value={form.image_url} onChange={e => setForm(f => ({...f, image_url:e.target.value}))} /></div>
                <div><label className="label">Note (optional)</label><input className="input" placeholder="Why you want it, what it's for" value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} /></div>
                <div style={{ display:"flex", gap:"var(--s-3)" }}>
                  <button className="btn btn--primary btn--small" onClick={addItem} disabled={saving || !form.name.trim() || !form.price}>{saving ? "Adding…" : "Add to list"}</button>
                  <button className="btn btn--ghost btn--small" onClick={() => setAdding(false)}>Cancel</button>
                </div>
              </div>
            </div>
          ) : (
            <button className="btn btn--secondary" onClick={() => setAdding(true)}>+ Add item</button>
          )}
        </>
      )}

      {/* GIFTED TAB */}
      {tab === "gifted" && (
        <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
          {purchases.length === 0 && <p style={{ color:"var(--muted)", fontSize:14 }}>No gifts yet. Share your page and mention your wish list.</p>}
          {purchases.map((p: any) => (
            <div key={p.id} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderLeft:`3px solid ${p.status === "creator_purchased" ? "var(--accent-open)" : "var(--accent)"}`, borderRadius:"var(--r-2)", padding:"var(--s-5) var(--s-6)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start", gap:"var(--s-4)", flexWrap:"wrap", marginBottom:"var(--s-4)" }}>
                <div>
                  <div style={{ fontFamily:"var(--font-display)", fontSize:15, fontWeight:700, color:"#fff", marginBottom:4 }}>{p.item?.name}</div>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)", letterSpacing:".08em" }}>
                    From <span style={{ color:"var(--text-soft)" }}>{p.buyer?.email}</span>
                    {" · "}${Number(p.item_price).toFixed(2)} funded
                    {" · "}{new Date(p.created_at).toLocaleDateString()}
                  </div>
                  {p.buyer_message && (
                    <div style={{ fontFamily:"var(--font-serif)", fontSize:13, fontStyle:"italic", color:"var(--text-soft)", marginTop:"var(--s-3)", padding:"var(--s-2) var(--s-3)", background:"var(--surface-2)", borderRadius:"var(--r-1)", borderLeft:"2px solid var(--border-strong)" }}>
                      "{p.buyer_message}"
                    </div>
                  )}
                </div>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:".14em", textTransform:"uppercase", padding:"3px 8px", border:"1px solid", borderRadius:2, flexShrink:0,
                  color: p.status === "creator_purchased" ? "var(--accent-open)" : "var(--accent)",
                  borderColor: p.status === "creator_purchased" ? "rgba(52,211,153,.25)" : "var(--accent-border)",
                  background: p.status === "creator_purchased" ? "rgba(52,211,153,.08)" : "var(--accent-soft)",
                }}>
                  {p.status === "creator_purchased" ? "✓ Done" : "Waiting for you"}
                </span>
              </div>

              {p.status === "paid_pending_purchase" && (
                <div style={{ background:"rgba(240,180,41,.06)", border:"1px solid var(--accent-border)", borderRadius:"var(--r-2)", padding:"var(--s-4) var(--s-5)" }}>
                  <p style={{ fontSize:13, color:"var(--text-soft)", lineHeight:1.7, marginBottom:"var(--s-4)" }}>
                    <strong style={{ color:"var(--accent)" }}>Your move:</strong> Go buy this item from any store — doesn&apos;t have to be the exact one linked, any equivalent works.
                    Once you&apos;ve purchased it, click below and we&apos;ll immediately transfer{" "}
                    <strong style={{ color:"var(--accent-bright)" }}>${Number(p.item_price).toFixed(2)}</strong> to your Stripe account.
                  </p>
                  {p.item?.store_url && (
                    <a href={p.item.store_url} target="_blank" rel="noopener" className="btn btn--secondary btn--small" style={{ display:"inline-block", marginRight:"var(--s-3)", marginBottom:"var(--s-3)", textDecoration:"none" }}>
                      View original product →
                    </a>
                  )}
                  <button
                    onClick={() => confirmPurchase(p.id)}
                    disabled={confirming === p.id}
                    className="btn btn--primary btn--small">
                    {confirming === p.id ? "Transferring…" : `✓ I bought it — transfer me $${Number(p.item_price).toFixed(2)}`}
                  </button>
                </div>
              )}

              {p.status === "creator_purchased" && (
                <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--accent-open)", letterSpacing:".1em" }}>
                  ✓ ${Number(p.item_price).toFixed(2)} transferred to your Stripe account
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ADDRESS TAB */}
      {tab === "address" && (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", padding:"var(--s-6)" }}>
          <div style={{ background:"rgba(240,180,41,.04)", border:"1px solid var(--accent-border)", borderRadius:"var(--r-2)", padding:"var(--s-4) var(--s-5)", marginBottom:"var(--s-5)", fontSize:13, color:"var(--text-soft)", lineHeight:1.7 }}>
            🔒 <strong style={{ color:"var(--accent)" }}>Completely private.</strong> Never shown to fans, never visible on your profile, never shared with anyone. This is just for your own reference — since you buy the items yourself, you ship to wherever you want.
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"var(--s-4)" }}>
            <div><label className="label">Your name</label><input className="input" value={addr.shipping_name} onChange={e => setAddr(a => ({...a, shipping_name:e.target.value}))} placeholder="For your own reference" /></div>
            <div><label className="label">Address</label><input className="input" value={addr.shipping_address} onChange={e => setAddr(a => ({...a, shipping_address:e.target.value}))} placeholder="Your shipping address" /></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 80px 100px", gap:"var(--s-3)" }}>
              <div><label className="label">City</label><input className="input" value={addr.shipping_city} onChange={e => setAddr(a => ({...a, shipping_city:e.target.value}))} /></div>
              <div><label className="label">State</label><input className="input" value={addr.shipping_state} onChange={e => setAddr(a => ({...a, shipping_state:e.target.value}))} maxLength={2} /></div>
              <div><label className="label">ZIP</label><input className="input" value={addr.shipping_zip} onChange={e => setAddr(a => ({...a, shipping_zip:e.target.value}))} /></div>
            </div>
            <button className="btn btn--primary btn--small" onClick={saveAddress} disabled={savingAddr}>
              {savingAddr ? "Saving…" : addrSaved ? "✓ Saved" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// ──────────────────────────────────────────────────────────────────
// PANE: Channels — full CRUD
// ──────────────────────────────────────────────────────────────────

function ChannelsPane({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const [channels, setChannels] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [adding, setAdding] = React.useState(false);
  const [form, setForm] = React.useState({ name:"", description:"", subscription_price:"9.99", is_free: false });
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string|null>(null);

  React.useEffect(() => {
    async function load() {
      const { data } = await (supabase as any).from("channels").select("*").eq("creator_profile_id", profile.id).order("created_at");
      setChannels(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function createChannel() {
    if (!form.name.trim()) return;
    setSaving(true);
    const { data, error } = await (supabase as any).from("channels").insert({
      creator_profile_id: profile.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      subscription_price: form.is_free ? 0 : parseFloat(form.subscription_price) || 9.99,
      is_free: form.is_free,
      slug: form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    }).select().single();
    if (error) { setErr(error.message); setSaving(false); return; }
    setChannels(prev => [...prev, data]);
    setForm({ name:"", description:"", subscription_price:"9.99", is_free:false });
    setAdding(false);
    setSaving(false);
  }

  async function deleteChannel(id: string) {
    if (!confirm("Delete this channel? Posts in it will remain but won't be assigned to a channel.")) return;
    await (supabase as any).from("channels").delete().eq("id", id);
    setChannels(prev => prev.filter(c => c.id !== id));
  }

  return (
    <div className="pane">
      <div className="pane-head">
        <p className="kicker">Channels</p>
        <h1 className="pane-title">Your <em>channels.</em></h1>
        <p className="pane-lede">Channels are the subscription tiers fans see on your page. A free channel builds your audience. A paid channel is what they subscribe to.</p>
      </div>

      {err && <div className="db-err"><span>{err}</span><button className="db-err-x" onClick={() => setErr(null)}>×</button></div>}

      {loading ? <p style={{ color:"var(--muted)", fontSize:14 }}>Loading…</p> : (
        <div style={{ display:"flex", flexDirection:"column", gap:2, marginBottom:"var(--s-6)" }}>
          {channels.length === 0 && !adding && (
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"var(--s-10)", textAlign:"center" }}>
              <p style={{ fontFamily:"var(--font-serif)", fontSize:20, fontStyle:"italic", color:"#fff", marginBottom:"var(--s-2)" }}>No channels yet.</p>
              <p style={{ fontSize:13, color:"var(--muted)" }}>Create at least one free channel and one paid channel to get started.</p>
            </div>
          )}
          {channels.map(ch => (
            <div key={ch.id} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-2)", padding:"var(--s-5) var(--s-6)", display:"grid", gridTemplateColumns:"1fr auto", gap:"var(--s-4)", alignItems:"center" }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:"var(--s-3)", marginBottom:4 }}>
                  <span style={{ fontFamily:"var(--font-display)", fontSize:15, fontWeight:700, color:"#fff" }}>{ch.name}</span>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:".12em", textTransform:"uppercase", padding:"2px 8px", border:"1px solid", borderRadius:2, color: ch.is_free ? "var(--accent-open)" : "var(--accent)", borderColor: ch.is_free ? "rgba(52,211,153,.25)" : "var(--accent-border)", background: ch.is_free ? "rgba(52,211,153,.08)" : "var(--accent-soft)" }}>
                    {ch.is_free ? "Free" : `$${Number(ch.subscription_price).toFixed(2)}/mo`}
                  </span>
                </div>
                {ch.description && <p style={{ fontSize:12, color:"var(--muted)", margin:0 }}>{ch.description}</p>}
              </div>
              <button onClick={() => deleteChannel(ch.id)} style={{ background:"none", border:"none", color:"var(--muted-faint)", cursor:"pointer", fontSize:18, lineHeight:1 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r-3)", padding:"var(--s-6)" }}>
          <p style={{ fontFamily:"var(--font-display)", fontSize:15, fontWeight:700, color:"#fff", marginBottom:"var(--s-5)" }}>New channel</p>
          <div style={{ display:"flex", flexDirection:"column", gap:"var(--s-4)" }}>
            <div><label className="label">Channel name</label><input className="input" value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} placeholder="e.g. Free Workouts, The Program, Behind the Scenes" /></div>
            <div><label className="label">Description (optional)</label><input className="input" value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} placeholder="What fans get in this channel" /></div>
            <div style={{ display:"flex", alignItems:"center", gap:"var(--s-3)" }}>
              <input type="checkbox" id="ch-free" checked={form.is_free} onChange={e => setForm(f => ({...f, is_free:e.target.checked}))} />
              <label htmlFor="ch-free" style={{ fontSize:13, color:"var(--text-soft)", cursor:"pointer" }}>Free channel (no subscription required)</label>
            </div>
            {!form.is_free && (
              <div>
                <label className="label">Monthly price (USD)</label>
                <div style={{ display:"flex", gap:"var(--s-2)", alignItems:"center" }}>
                  <span style={{ color:"var(--muted)" }}>$</span>
                  <input className="input" type="number" min="1" max="999" step="0.01" style={{ maxWidth:120 }}
                    value={form.subscription_price} onChange={e => setForm(f => ({...f, subscription_price:e.target.value}))} />
                  <span style={{ fontSize:12, color:"var(--muted)" }}>/month</span>
                </div>
              </div>
            )}
            <div style={{ display:"flex", gap:"var(--s-3)" }}>
              <button className="btn btn--primary btn--small" onClick={createChannel} disabled={saving || !form.name.trim()}>{saving ? "Creating…" : "Create channel"}</button>
              <button className="btn btn--ghost btn--small" onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : (
        <button className="btn btn--secondary" onClick={() => setAdding(true)}>+ Add channel</button>
      )}
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
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [postTags, setPostTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [suggestingTags, setSuggestingTags] = useState(false);
  const [postType, setPostType] = useState("post");
  const [expiresAt, setExpiresAt] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [uploading, setUploading] = useState(false);
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

    const res = await fetch("/api/posts/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caption: body.trim() || null,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        tier: "free",
        creatorProfileId: profile.id,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Failed to publish");
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
            rows={6}
            autoFocus
          />
          {mediaUrl && (
            <div style={{ padding:"0 var(--s-4) var(--s-3)", position:"relative", display:"inline-block" }}>
              {mediaType === "video" ? (
                mediaUrl.includes("iframe.mediadelivery.net") ? (
                  <div style={{ position:"relative", paddingTop:"56.25%", borderRadius:"var(--r-1)", overflow:"hidden", maxWidth:320 }}>
                    <iframe src={mediaUrl} style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%", border:"none" }} allow="autoplay" />
                  </div>
                ) : (
                  <video src={mediaUrl} style={{ maxHeight:180, borderRadius:"var(--r-1)" }} controls />
                )
              ) : (
                <img src={mediaUrl} alt="" style={{ maxHeight:180, borderRadius:"var(--r-1)", display:"block" }} />
              )}
              <button type="button" onClick={() => { setMediaUrl(""); setMediaType(""); }}
                style={{ position:"absolute", top:4, right:4, background:"rgba(0,0,0,.7)", border:"none", color:"#fff", borderRadius:"50%", width:22, height:22, cursor:"pointer", fontSize:13, lineHeight:1 }}>×</button>
            </div>
          )}
          {/* Tags */}
          <div style={{ padding:"0 var(--s-4) var(--s-3)" }}>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
              {postTags.map(tag => (
                <span key={tag} style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 8px", borderRadius:3, background:"rgba(242,184,75,0.08)", border:"1px solid rgba(242,184,75,0.15)", fontFamily:"var(--font-mono)", fontSize:10, color:"rgba(242,184,75,0.8)", letterSpacing:"0.08em", textTransform:"uppercase" }}>
                  {tag}
                  <button type="button" onClick={() => setPostTags(t => t.filter(x => x !== tag))} style={{ background:"none", border:"none", color:"rgba(242,184,75,0.5)", cursor:"pointer", padding:0, fontSize:12, lineHeight:1 }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <input
                type="text" placeholder="Add tag…" value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
                    e.preventDefault();
                    const t = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
                    if (t && !postTags.includes(t) && postTags.length < 8) setPostTags(prev => [...prev, t]);
                    setTagInput("");
                  }
                }}
                style={{ flex:1, background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"var(--r-1)", padding:"6px 10px", color:"var(--text)", fontSize:12, outline:"none", fontFamily:"inherit" }}
              />
              <button type="button" disabled={suggestingTags || !body.trim()} onClick={async () => {
                setSuggestingTags(true);
                const res = await fetch("/api/posts/tags", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ caption:body, mediaType }) });
                const data = await res.json();
                if (data.tags) setPostTags(prev => Array.from(new Set([...prev, ...data.tags])).slice(0, 8));
                setSuggestingTags(false);
              }} style={{ padding:"6px 12px", background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"var(--r-1)", color:"var(--muted)", fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase", cursor:"pointer", opacity:suggestingTags||!body.trim()?0.45:1 }}>
                {suggestingTags ? "…" : "✦ AI"}
              </button>
            </div>
          </div>

          {/* Advanced options toggle */}
          <div style={{ padding:"0 var(--s-4) var(--s-3)" }}>
            <button type="button" onClick={() => setShowAdvanced(a => !a)} style={{ background:"none", border:"none", color:"var(--muted)", fontFamily:"var(--font-mono)", fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", padding:0 }}>
              {showAdvanced ? "▾" : "▸"} More options
            </button>

            {showAdvanced && (
              <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:10 }}>
                {/* Post type */}
                <div>
                  <p style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.16em", textTransform:"uppercase", color:"var(--muted)", marginBottom:6 }}>Post type</p>
                  <div style={{ display:"flex", gap:6 }}>
                    {[["post","Post"],["campaign_update","Campaign Update"],["vod","Live Replay"]].map(([val, label]) => (
                      <button key={val} type="button" onClick={() => setPostType(val)} style={{ padding:"5px 12px", borderRadius:3, border:"1px solid", borderColor:postType===val?"rgba(242,184,75,0.4)":"var(--border)", background:postType===val?"rgba(242,184,75,0.08)":"transparent", color:postType===val?"var(--accent)":"var(--muted)", fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer" }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Expiry */}
                <div>
                  <p style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.16em", textTransform:"uppercase", color:"var(--muted)", marginBottom:6 }}>Expires (leave blank = never)</p>
                  <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
                    style={{ background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"var(--r-1)", padding:"7px 10px", color:"var(--text)", fontSize:12, outline:"none", colorScheme:"dark" }} />
                </div>

                {/* Schedule */}
                <div>
                  <p style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.16em", textTransform:"uppercase", color:"var(--muted)", marginBottom:6 }}>Schedule for later (leave blank = publish now)</p>
                  <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                    style={{ background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:"var(--r-1)", padding:"7px 10px", color:"var(--text)", fontSize:12, outline:"none", colorScheme:"dark" }} />
                </div>

                {/* Pin */}
                <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}>
                  <input type="checkbox" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} style={{ accentColor:"var(--accent)", width:14, height:14 }} />
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--muted)" }}>📌 Pin to top of page</span>
                </label>
              </div>
            )}
          </div>

          <div className="composer-actions">
            <label style={{ cursor:"pointer", fontFamily:"var(--font-display)", fontSize:11, fontWeight:600, color:"var(--muted)", padding:"7px 12px", border:"1px solid var(--border)", borderRadius:"var(--r-1)" }}>
              {uploading ? "Uploading…" : "🖼️ Image"}
              <input type="file" accept="image/*" style={{ display:"none" }} disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  setUploading(true);
                  const fd = new FormData(); fd.append("file", file);
                  const res = await fetch("/api/upload", { method:"POST", body:fd });
                  const data = await res.json();
                  if (data.url) { setMediaUrl(data.url); setMediaType("image"); }
                  setUploading(false); e.target.value = "";
                }} />
            </label>
            <div style={{ display:"inline-block" }}>
              <VideoUpload
                label="🎬 Video"
                onUpload={({ cdnUrl }) => {
                  setMediaUrl(cdnUrl);
                  setMediaType("video");
                }}
              />
            </div>
            <p className="hint">{body.length} chars</p>
            <button type="submit" className="btn btn--primary" disabled={posting || (!body.trim() && !mediaUrl)}>
              {posting ? (scheduledAt ? "Scheduling..." : "Publishing...") : (scheduledAt ? `Schedule for ${new Date(scheduledAt).toLocaleDateString()}` : "Publish")}
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
                {p.status && p.status !== "live" ? `   ${p.status}` : ""}
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
  const [subPrice, setSubPrice] = React.useState(Number((profile as any).subscription_price || 9.99).toFixed(2));
  const [priceSaved, setPriceSaved] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState("");
  const supabase = createClient();

  async function savePrice() {
    const val = parseFloat(subPrice);
    if (!val || val < 1) return;
    await (supabase as any).from("creator_profiles").update({ subscription_price: val }).eq("id", profile.id);
    setPriceSaved(true);
    setTimeout(() => setPriceSaved(false), 2000);
  }

  async function deleteAccount() {
    if (deleteConfirm !== profile.handle) return;
    setDeleting(true);
    await (supabase as any).from("creator_profiles").update({ deleted_at: new Date().toISOString() }).eq("id", profile.id);
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="pane">
      <div className="pane-head">
        <p className="kicker">Settings</p>
        <h1 className="pane-title">Your <em>account.</em></h1>
      </div>

      <div className="settings-block">
        <p className="label">Email</p>
        <p className="settings-val">{userEmail ?? "—"}</p>
      </div>

      <div className="settings-block">
        <p className="label">Handle</p>
        <p className="settings-val">@{profile.handle}</p>
      </div>

      <div className="settings-block">
        <p className="label">Public page</p>
        <p className="settings-val">
          <Link href={`/${profile.handle}`} className="settings-link" target="_blank">
            spotlightly.app/{profile.handle} →
          </Link>
        </p>
      </div>

      <div className="settings-block">
        <p className="label">Subscription price</p>
        <p style={{ fontSize:12, color:"var(--muted)", marginBottom:"var(--s-2)", lineHeight:1.5 }}>
          What fans pay per month. Existing subscribers keep their rate until they renew.
        </p>
        <div style={{ display:"flex", gap:"var(--s-3)", alignItems:"center" }}>
          <span style={{ color:"var(--muted)", fontSize:16 }}>$</span>
          <input className="input" type="number" min="1" max="999" step="0.01"
            style={{ maxWidth:120 }} value={subPrice}
            onChange={e => setSubPrice(e.target.value)} />
          <button className="btn btn--secondary btn--small" onClick={savePrice}>
            {priceSaved ? "✓ Saved" : "Save"}
          </button>
        </div>
      </div>

      <div className="settings-block">
        <p className="label">Stripe Connect</p>
        {(profile as any).stripe_onboarded ? (
          <div style={{ display:"flex", alignItems:"center", gap:"var(--s-4)" }}>
            <span style={{ color:"var(--accent-open)", fontSize:13 }}>✓ Connected</span>
            <a href="https://dashboard.stripe.com" target="_blank" className="settings-link" style={{ fontSize:12 }}>Stripe Dashboard →</a>
          </div>
        ) : (
          <button className="btn btn--primary btn--small" onClick={async () => {
            const res = await fetch("/api/stripe/connect/start", { method:"POST" });
            const { url } = await res.json();
            if (url) window.location.href = url;
          }}>Connect Stripe — 3 minutes</button>
        )}
      </div>

      <div className="settings-block" style={{ borderTop:"2px solid var(--red)", marginTop:"var(--s-10)", paddingTop:"var(--s-6)" }}>
        <p className="label" style={{ color:"var(--red)" }}>Delete account</p>
        <p style={{ fontSize:12, color:"var(--muted)", lineHeight:1.6, marginBottom:"var(--s-4)" }}>
          This permanently deletes your profile and all content. Type your handle <strong style={{ color:"var(--text)" }}>@{profile.handle}</strong> to confirm.
        </p>
        <div style={{ display:"flex", gap:"var(--s-3)", flexWrap:"wrap" }}>
          <input className="input" type="text" placeholder={`Type ${profile.handle} to confirm`}
            style={{ maxWidth:280 }} value={deleteConfirm}
            onChange={e => setDeleteConfirm(e.target.value)} />
          <button
            className="btn btn--small"
            disabled={deleteConfirm !== profile.handle || deleting}
            style={{ background:"var(--red-soft)", color:"var(--red)", border:"1px solid var(--red-border)" }}
            onClick={deleteAccount}>
            {deleting ? "Deleting…" : "Delete my account"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────
// PANE: Payments — Stripe Connect + CCBill setup
// ──────────────────────────────────────────────────────────────────

function PaymentsPane({ profile }: { profile: Profile }) {
  const [connecting, setConnecting] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const stripeConnected = !!(profile as any).stripe_account_id;

  async function connectStripe() {
    setConnecting(true);
    setErr(null);
    try {
      const res = await fetch("/api/stripe/connect/start", { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      window.location.href = data.url;
    } catch (e: any) {
      setErr(e.message);
      setConnecting(false);
    }
  }

  return (
    <div className="pane">
      <div className="pane-head">
        <p className="kicker">Payments</p>
        <h1 className="pane-title">Get <em>paid.</em></h1>
        <p className="pane-lede">Connect your payment accounts so fans can subscribe and tip you. Payment buttons on your public page stay disabled until Stripe is connected.</p>
      </div>
      {err && <div style={{ background:"var(--red-soft)",border:"1px solid var(--red-border)",borderRadius:"var(--r-2)",padding:"12px 18px",marginBottom:"var(--s-6)",fontSize:13,color:"var(--red)" }}>⚠ {err}</div>}
      <div style={{ display:"flex",flexDirection:"column",gap:2,marginBottom:"var(--s-10)" }}>
        <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderTop:"2px solid var(--accent)",padding:"var(--s-8) var(--s-6)" }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"var(--s-4)" }}>
            <div>
              <p className="kicker" style={{ marginBottom:"var(--s-2)" }}>Spotlight payments</p>
              <h3 style={{ fontFamily:"var(--font-serif)",fontSize:26,fontWeight:400,color:"#fff",margin:0 }}>Stripe Connect</h3>
            </div>
            <span style={{ fontFamily:"var(--font-mono)",fontSize:9,letterSpacing:".14em",textTransform:"uppercase" as const,padding:"4px 10px",border:"1px solid",borderRadius:"var(--r-1)",color:stripeConnected?"var(--accent-open)":"var(--muted)",borderColor:stripeConnected?"rgba(110,231,183,.25)":"var(--border)",background:stripeConnected?"rgba(110,231,183,.08)":"rgba(255,255,255,.03)" }}>
              {stripeConnected ? "Connected" : "Not connected"}
            </span>
          </div>
          <p style={{ fontSize:13,color:"var(--text-soft)",lineHeight:1.75,marginBottom:"var(--s-5)" }}>
            {stripeConnected ? "Your Stripe account is connected. Fans can subscribe and tip you." : "Takes about 3 minutes — you'll need your legal name, address, SSN (last 4), and bank account."}
          </p>
          {stripeConnected ? (
            <a href="https://dashboard.stripe.com" target="_blank" rel="noopener" className="btn btn--secondary btn--small">Stripe Dashboard →</a>
          ) : (
            <button onClick={connectStripe} disabled={connecting} className="btn btn--primary">
              {connecting ? "Redirecting to Stripe..." : "Connect Stripe — 3 minutes"}
            </button>
          )}
        </div>
        <div style={{ background:"var(--surface)",border:"1px solid var(--border)",padding:"var(--s-6)" }}>
          <h3 style={{ fontFamily:"var(--font-serif)",fontSize:20,fontWeight:400,color:"#fff",marginBottom:"var(--s-3)" }}>Fee summary</h3>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"var(--s-1)" }}>
            {[
              { label:"Your monthly Spotlightly fee", val:"Flat, based on subscriber count" },
              { label:"Stripe processing", val:"2.9% + 30¢ per transaction (Stripe's fee, not ours)" },
              { label:"Tips", val:"0% — you keep 100%" },
              { label:"Subscriptions", val:"0% — you keep 100% (minus Stripe)" },
              { label:"Front Row Messages", val:"50% to you, 50% platform" },
              { label:"Super Tips", val:"85% to you, 15% platform" },
            ].map((r, i) => (
              <div key={i} style={{ background:"var(--surface-2)",border:"1px solid var(--border)",padding:"var(--s-3) var(--s-4)" }}>
                <div style={{ fontFamily:"var(--font-mono)",fontSize:9,letterSpacing:".12em",textTransform:"uppercase" as const,color:"var(--muted)",marginBottom:4 }}>{r.label}</div>
                <div style={{ fontSize:13,color:"var(--text)" }}>{r.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// PANE: Moderation — creator's flagged content
// ──────────────────────────────────────────────────────────────────

function ModerationPane({ profile }: { profile: Profile }) {
  const [events, setEvents] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const supabase = createClient();

  React.useEffect(() => {
    async function load() {
      const { data } = await (supabase as any)
        .from("moderation_events")
        .select("*")
        .eq("creator_id", (profile as any).id)
        .order("created_at", { ascending: false })
        .limit(20);
      setEvents(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="pane">
      <div className="pane-head">
        <p className="kicker">Moderation</p>
        <h1 className="pane-title">Your <em>flags.</em></h1>
        <p className="pane-lede">AI reviews every post before it goes live. Flagged content appears here.</p>
      </div>
      {loading && <p style={{ color:"var(--muted)",fontSize:14 }}>Loading...</p>}
      {!loading && events.length === 0 && (
        <div style={{ background:"var(--surface)",border:"1px solid var(--border)",padding:"var(--s-10)",textAlign:"center" as const }}>
          <p style={{ fontFamily:"var(--font-serif)",fontSize:22,fontStyle:"italic",color:"#fff",marginBottom:"var(--s-2)" }}>All clear.</p>
          <p style={{ fontSize:13,color:"var(--muted)" }}>No flagged content on your profile.</p>
        </div>
      )}
      <div style={{ display:"flex",flexDirection:"column",gap:2 }}>
        {events.map((e: any) => (
          <div key={e.id} style={{ background:"var(--surface)",border:"1px solid var(--border)",borderLeft:`3px solid ${e.severity==="critical"||e.severity==="high"?"var(--red)":"var(--accent)"}`,padding:"var(--s-5) var(--s-6)" }}>
            <div style={{ display:"flex",gap:"var(--s-3)",marginBottom:"var(--s-3)",flexWrap:"wrap" as const }}>
              <span style={{ fontFamily:"var(--font-mono)",fontSize:9,letterSpacing:".12em",textTransform:"uppercase" as const,padding:"3px 8px",borderRadius:"var(--r-1)",border:"1px solid",color:e.severity==="critical"||e.severity==="high"?"var(--red)":"var(--accent)",background:e.severity==="critical"||e.severity==="high"?"var(--red-soft)":"rgba(245,200,66,.08)",borderColor:e.severity==="critical"||e.severity==="high"?"var(--red-border)":"rgba(245,200,66,.25)" }}>{e.severity}</span>
            </div>
            <p style={{ fontSize:13,color:"var(--text-soft)",lineHeight:1.65,marginBottom:"var(--s-2)" }}>{e.flag_reason ?? "Content flagged for review"}</p>
            <p style={{ fontFamily:"var(--font-mono)",fontSize:10,color:"var(--muted)" }}>{new Date(e.created_at).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}


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


// ──────────────────────────────────────────────────────────────────
// PANE: Block List
// ──────────────────────────────────────────────────────────────────
function BlockPane({ profile }: { profile: Profile }) {
  const [blocks, setBlocks] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [contactType, setContactType] = React.useState("email");
  const [contactValue, setContactValue] = React.useState("");
  const [note, setNote] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const TYPES = [
    { id: "email",  label: "Email address",  placeholder: "fan@example.com",   hint: "Hashed for privacy — exact match only" },
    { id: "phone",  label: "Phone number",   placeholder: "+1 555 000 0000",    hint: "Hashed for privacy — digits only matched" },
    { id: "handle", label: "Handle / username", placeholder: "@username",       hint: "Their Spotlightly handle or social username" },
    { id: "name",   label: "Name",           placeholder: "Full name",          hint: "Block by display name" },
    { id: "region", label: "Region",         placeholder: "e.g. Texas, US or Germany", hint: "Block all signups from a country or state" },
  ];

  React.useEffect(() => {
    fetch(`/api/blocks?creatorProfileId=${profile.id}`)
      .then(r => r.json())
      .then(d => { setBlocks(d.blocks ?? []); setLoading(false); });
  }, [profile.id]);

  async function addBlock() {
    if (!contactValue.trim()) return;
    setAdding(true);
    setErr(null);
    const res = await fetch("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creatorProfileId: profile.id,
        contactType,
        contactValue: contactValue.trim(),
        note: note.trim() || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); setAdding(false); return; }
    setBlocks(prev => [data.block, ...prev]);
    setContactValue("");
    setNote("");
    setAdding(false);
  }

  async function removeBlock(id: string) {
    await fetch("/api/blocks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockId: id }),
    });
    setBlocks(prev => prev.filter(b => b.id !== id));
  }

  const currentType = TYPES.find(t => t.id === contactType)!;

  const typeColors: Record<string, string> = {
    email: "rgba(96,165,250,0.8)",
    phone: "rgba(52,211,153,0.8)",
    handle: "rgba(242,184,75,0.8)",
    name: "rgba(192,132,252,0.8)",
    region: "rgba(251,146,60,0.8)",
  };

  return (
    <div className="pane">
      <div className="pane-head">
        <p className="kicker">Block List</p>
        <h1 className="pane-title">Blocked <em>contacts.</em></h1>
        <p className="pane-lede">Pre-emptively block anyone from contacting or subscribing. Useful for known bad actors before they sign up.</p>
      </div>

      {/* Add block form */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderTop: "2px solid var(--accent)", padding: "28px 32px", marginBottom: 2 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 16 }}>Add to block list</p>

        {/* Type selector */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {TYPES.map(t => (
            <button key={t.id} type="button" onClick={() => { setContactType(t.id); setContactValue(""); }}
              style={{
                padding: "6px 14px", borderRadius: "var(--r-2)", border: "1px solid",
                borderColor: contactType === t.id ? "rgba(242,184,75,0.4)" : "var(--border)",
                background: contactType === t.id ? "rgba(242,184,75,0.08)" : "var(--surface-2)",
                color: contactType === t.id ? "var(--accent)" : "var(--muted)",
                fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em",
                textTransform: "uppercase", cursor: "pointer", transition: "all 0.12s",
              }}>
              {t.label}
            </button>
          ))}
        </div>

        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", marginBottom: 12, letterSpacing: "0.04em" }}>
          {currentType.hint}
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            value={contactValue}
            onChange={e => setContactValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addBlock(); }}
            placeholder={currentType.placeholder}
            style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--r-2)", padding: "10px 14px", color: "var(--text)", fontSize: 14, outline: "none", fontFamily: "inherit" }}
          />
          <button onClick={addBlock} disabled={adding || !contactValue.trim()}
            className="btn btn--primary" style={{ flexShrink: 0, opacity: adding || !contactValue.trim() ? 0.45 : 1 }}>
            {adding ? "Adding…" : "Block"}
          </button>
        </div>

        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Note (optional) — why you're blocking this contact"
          style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--r-2)", padding: "9px 14px", color: "var(--text)", fontSize: 13, outline: "none", fontFamily: "inherit" }}
        />

        {err && <p style={{ fontSize: 12, color: "var(--red)", marginTop: 10 }}>{err}</p>}
      </div>

      {/* Block list */}
      {loading && <p style={{ color: "var(--muted)", fontSize: 13, padding: "20px 0" }}>Loading…</p>}

      {!loading && blocks.length === 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "40px 32px", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontStyle: "italic", color: "#fff", marginBottom: 8 }}>No blocks yet.</p>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>Add email addresses, phone numbers, handles, names, or regions above.</p>
        </div>
      )}

      {!loading && blocks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {blocks.map(b => (
            <div key={b.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em",
                    textTransform: "uppercase", color: typeColors[b.contact_type] || "var(--muted)",
                    background: `${typeColors[b.contact_type] || "var(--muted)"}15`,
                    padding: "2px 8px", borderRadius: "var(--r-1)",
                  }}>
                    {b.contact_type}
                  </span>
                  <span style={{ fontSize: 14, color: "var(--text)", fontFamily: b.contact_type === "email" || b.contact_type === "phone" ? "var(--font-mono)" : "inherit" }}>
                    {b.display_hint}
                  </span>
                </div>
                {b.note && (
                  <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>{b.note}</p>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.06em" }}>
                  {new Date(b.created_at).toLocaleDateString()}
                </span>
                <button onClick={() => removeBlock(b.id)}
                  style={{ background: "none", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "var(--r-1)", padding: "4px 10px", color: "rgba(248,113,113,0.6)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardStyles() {
  return (
    <style jsx global>{`
      .db { min-height: 100vh; position: relative; z-index: 1; }

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
        gap: 0;
        padding-bottom: var(--s-4);
      }
      .db-nav-label {
        font-family: var(--font-mono);
        font-size: 9px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--muted);
        padding: var(--s-4) var(--s-4) var(--s-2);
        opacity: 0.6;
      }
      .db-nav-section {
        display: flex;
        flex-direction: column;
        gap: 1px;
        margin-bottom: var(--s-2);
      }
      .db-nav-link {
        display: block;
        padding: 8px var(--s-4);
        font-family: var(--font-sans);
        font-size: 14px;
        font-weight: 400;
        color: var(--muted);
        text-decoration: none;
        border-radius: var(--r-1);
        transition: all var(--t-fast);
        border-left: 2px solid transparent;
      }
      .db-nav-link:hover {
        color: var(--text);
        background: var(--surface);
        border-left-color: var(--border-strong);
      }
      .db-pane-btn {
        background: transparent;
        border: none;
        border-left: 2px solid transparent;
        padding: 8px var(--s-4);
        font-family: var(--font-sans);
        font-size: 14px;
        font-weight: 400;
        color: var(--muted);
        text-align: left;
        cursor: pointer;
        border-radius: var(--r-1);
        transition: all var(--t-fast);
        width: 100%;
      }
      .db-pane-btn:hover {
        color: var(--text);
        background: var(--surface);
        border-left-color: var(--border-strong);
      }
      .db-pane-btn--active {
        color: var(--accent);
        background: var(--surface);
        border-left-color: var(--accent);
        font-weight: 500;
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
/* quick grid removed */
      .quick-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-left: 3px solid transparent;
        padding: var(--s-5) var(--s-6);
        text-decoration: none;
        color: inherit;
        transition: border-color var(--t-fast), background var(--t-fast), transform var(--t-fast);
        cursor: pointer;
        display: block;
      }
      .quick-card:hover {
        border-color: var(--accent-border);
        border-left-color: var(--accent);
        background: var(--bg-elevated);
        transform: translateY(-1px);
      }
      .quick-card h4 {
        font-family: var(--font-serif);
        font-size: 18px;
        font-weight: 400;
        color: #fff;
        margin: 0 0 var(--s-2);
        line-height: 1.2;
      }
      .quick-card p {
        font-size: 12px;
        color: var(--muted);
        margin: 0;
        line-height: 1.5;
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
