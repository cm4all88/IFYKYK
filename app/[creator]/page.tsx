import { createClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/components/site-header";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

type AnyProfile = Record<string, any>;
type AnyChannel = Record<string, any>;
type AnyPost = Record<string, any>;

async function fetchEverything(handle: string) {
  const supabase = await createClient();

  const { data: spotlight } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("kind", "spotlight")
    .eq("handle", handle)
    .maybeSingle();

  if (!spotlight) return null;

  let backstageHandle: string | null = null;
  if (spotlight.linked) {
    const { data: backstage } = await supabase
      .from("creator_profiles")
      .select("handle, linked")
      .eq("user_id", spotlight.user_id)
      .eq("kind", "backstage")
      .maybeSingle();
    if (backstage?.linked) backstageHandle = backstage.handle as string;
  }

  const [{ data: channels }, { data: posts }] = await Promise.all([
    supabase
      .from("channels")
      .select("*")
      .eq("creator_profile_id", spotlight.id)
      .order("sort_order", { ascending: true, nullsFirst: false }),
    supabase
      .from("posts")
      .select("*")
      .eq("creator_profile_id", spotlight.id)
      .eq("status", "live")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Check if current viewer is subscribed
  const { data: { user } } = await supabase.auth.getUser();
  let isSubscribed = false;
  if (user) {
    const { data: sub } = await (supabase as any)
      .from("subscriptions")
      .select("id")
      .eq("fan_user_id", user.id)
      .eq("creator_profile_id", spotlight.id)
      .eq("status", "active")
      .maybeSingle();
    isSubscribed = !!sub;
  }

  return {
    spotlight: spotlight as AnyProfile,
    backstageHandle,
    channels: (channels ?? []) as AnyChannel[],
    posts: (posts ?? []) as AnyPost[],
    isSubscribed,
    viewerUserId: user?.id ?? null,
  };
}

export async function generateMetadata(props: {
  params: Promise<{ creator: string }>;
}): Promise<Metadata> {
  const { creator } = await props.params;
  const data = await fetchEverything(creator);
  if (!data) return { title: "Not found · Spotlightly" };
  const name = data.spotlight.display_name ?? data.spotlight.handle;
  return {
    title: `${name} · Spotlightly`,
    description: data.spotlight.bio ?? `Follow ${name} on Spotlightly`,
    openGraph: {
      title: name,
      description: data.spotlight.bio ?? "",
      images: data.spotlight.cover_url ? [data.spotlight.cover_url] : [],
    },
  };
}

export default async function CreatorPage(props: {
  params: Promise<{ creator: string }>;
}) {
  const { creator } = await props.params;
  const data = await fetchEverything(creator);
  if (!data) notFound();

  const { spotlight, backstageHandle, channels, posts, isSubscribed } = data;
  const displayName = spotlight.display_name ?? spotlight.handle;

  return (
    <>
      <SiteHeader />
      <main className="cp">
        <section className="cp-cover">
          {spotlight.cover_url ? (
            <img src={spotlight.cover_url} alt="" className="cp-cover-img" />
          ) : (
            <div className="cp-cover-fallback" aria-hidden />
          )}
          <div className="cp-cover-fade" aria-hidden />
        </section>

        <header className="cp-header">
          <div className="cp-header-inner">
            <div className="cp-avatar-wrap">
              {spotlight.avatar_url ? (
                <img src={spotlight.avatar_url} alt="" className="cp-avatar" />
              ) : (
                <div className="cp-avatar cp-avatar-fallback">
                  {String(displayName).charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="cp-identity">
              <div className="cp-name-row">
                <h1 className="cp-name">{displayName}</h1>
              </div>
              <p className="cp-handle">@{spotlight.handle}</p>
              {spotlight.bio && <p className="cp-bio">{spotlight.bio}</p>}

              {backstageHandle && (
                <Link href={`/${backstageHandle}`} className="cp-backstage">
                  <span className="cp-bs-tag">Backstage</span>
                  <span className="cp-bs-text">
                    Exclusive content at <strong>@{backstageHandle}</strong>
                  </span>
                  <span className="cp-bs-arrow">→</span>
                </Link>
              )}
            </div>

            <div className="cp-actions">
              <SubscribeButton creatorProfileId={spotlight.id} />
              <TipButton creatorProfileId={spotlight.id} />
            </div>
          </div>
        </header>

        <section className="cp-content">
          <div className="cp-content-inner">
            {channels.length > 0 && (
              <div className="cp-channels">
                <p className="kicker">Channels</p>
                <div className="cp-channel-grid">
                  {channels.map((ch) => (
                    <Link
                      key={ch.id}
                      href={`/${spotlight.handle}/${ch.slug}`}
                      className="cp-channel"
                    >
                      <h3 className="cp-channel-name">{ch.name}</h3>
                      {ch.description && (
                        <p className="cp-channel-desc">{ch.description}</p>
                      )}
                      <p className="cp-channel-meta">
                        {ch.subscription_price
                          ? `$${Number(ch.subscription_price).toFixed(2)}/mo`
                          : "Free"}{" "}
                        · {ch.content_rating}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="cp-posts">
              <p className="kicker">Latest</p>

              {posts.length === 0 ? (
                <div className="cp-empty">
                  <div className="cp-empty-mark" aria-hidden>
                    ◌
                  </div>
                  <h2 className="cp-empty-title">The stage is set.</h2>
                  <p className="cp-empty-text">
                    {displayName} hasn&apos;t posted yet. Check back soon.
                  </p>
                </div>
              ) : (
                <ul className="cp-post-list">
                  {posts.map((p) => {
                    const locked = p.tier === "premium" && !isSubscribed;
                    return (
                      <li key={p.id} className={`cp-post${locked ? " cp-post--locked" : ""}`}>
                        {locked ? (
                          <>
                            <div className="cp-post-gate">
                              <div className="cp-gate-blur" aria-hidden />
                              <div className="cp-gate-overlay">
                                <span className="cp-gate-icon">🔒</span>
                                <p className="cp-gate-label">Subscribers only</p>
                                <p className="cp-gate-desc">Subscribe to {displayName} to unlock this post.</p>
                                <form action="/api/subscribe" method="post" className="cp-gate-form">
                                  <input type="hidden" name="creator_profile_id" value={spotlight.id} />
                                  <button type="submit" className="btn btn--primary cp-gate-btn">
                                    Subscribe · {spotlight.subscription_price ? `$${Number(spotlight.subscription_price).toFixed(0)}/mo` : "Subscribe"}
                                  </button>
                                </form>
                              </div>
                            </div>
                            <div className="cp-post-meta" style={{ padding: "var(--s-4) var(--s-6)" }}>
                              <span>{new Date(p.created_at).toLocaleDateString()}</span>
                              <span className="cp-post-lock">🔒 Subscriber content</span>
                            </div>
                          </>
                        ) : (
                          <>
                            {p.media_url && p.media_type === "image" && (
                              <img src={p.media_url} alt="" className="cp-post-media" />
                            )}
                            {p.caption && <p className="cp-post-caption">{p.caption}</p>}
                            <div className="cp-post-meta">
                              <span>{new Date(p.created_at).toLocaleDateString()}</span>
                              {p.tier === "premium" && <span className="cp-post-lock" style={{ color: "var(--accent-open)" }}>✓ Subscriber content</span>}
                              {p.likes_count != null && p.likes_count > 0 && (
                                <span>{p.likes_count} likes</span>
                              )}
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>

        <style>{`
          .cp { min-height: 100vh; }
          .cp-cover {
            position: relative;
            width: 100%;
            height: clamp(220px, 32vw, 360px);
            overflow: hidden;
            background: var(--surface-2);
          }
          .cp-cover-img { width: 100%; height: 100%; object-fit: cover; }
          .cp-cover-fallback {
            width: 100%; height: 100%;
            background:
              radial-gradient(ellipse 60% 50% at 30% 40%, rgba(245, 200, 66, 0.12), transparent 70%),
              radial-gradient(ellipse 50% 40% at 70% 60%, rgba(192, 132, 252, 0.08), transparent 70%),
              var(--surface-2);
          }
          .cp-cover-fade {
            position: absolute; inset: 0;
            background: linear-gradient(to bottom, transparent 50%, rgba(10,10,15,0.6) 80%, var(--bg) 100%);
            pointer-events: none;
          }
          .cp-header {
            max-width: var(--container);
            margin: -90px auto 0;
            padding: 0 var(--s-6);
            position: relative;
            z-index: 2;
          }
          .cp-header-inner {
            display: grid;
            grid-template-columns: auto 1fr auto;
            gap: var(--s-8);
            align-items: end;
          }
          .cp-avatar {
            width: 144px; height: 144px;
            border-radius: 50%;
            border: 4px solid var(--bg);
            object-fit: cover;
            background: var(--surface-2);
          }
          .cp-avatar-fallback {
            display: flex; align-items: center; justify-content: center;
            font-family: var(--font-serif);
            font-size: 56px;
            color: var(--accent);
          }
          .cp-identity { padding-bottom: var(--s-3); min-width: 0; }
          .cp-name-row {
            display: flex; align-items: center; gap: var(--s-3); flex-wrap: wrap;
          }
          .cp-name {
            font-family: var(--font-serif);
            font-size: clamp(32px, 5vw, 44px);
            font-weight: 400;
            color: #fff;
            margin: 0;
            line-height: 1.05;
            letter-spacing: -0.01em;
          }
          .cp-handle {
            font-family: var(--font-mono);
            font-size: 13px;
            color: var(--muted);
            margin: var(--s-2) 0 0;
          }
          .cp-bio {
            font-size: 15px;
            line-height: 1.7;
            color: var(--text-soft);
            margin: var(--s-4) 0 0;
            max-width: 580px;
          }
          .cp-backstage {
            display: inline-flex;
            align-items: center;
            gap: var(--s-3);
            margin-top: var(--s-5);
            padding: 10px 16px;
            background: rgba(192,132,252,0.06);
            border: 1px solid rgba(192,132,252,0.2);
            border-radius: var(--r-2);
            transition: all var(--t-fast);
          }
          .cp-backstage:hover {
            background: rgba(192,132,252,0.1);
            border-color: rgba(192,132,252,0.35);
          }
          .cp-bs-tag {
            font-family: var(--font-mono);
            font-size: 9px;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            color: var(--accent-back);
          }
          .cp-bs-text { font-size: 13px; color: var(--text-soft); }
          .cp-bs-text strong {
            font-family: var(--font-mono);
            color: var(--accent-back);
            font-weight: 500;
          }
          .cp-bs-arrow { color: var(--accent-back); font-size: 14px; }

          .cp-actions { display: flex; gap: var(--s-2); padding-bottom: var(--s-3); }

          .cp-content {
            max-width: var(--container);
            margin: var(--s-16) auto 0;
            padding: 0 var(--s-6) var(--s-20);
          }

          .cp-channels { margin-bottom: var(--s-12); }
          .cp-channel-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
            gap: 2px;
            margin-top: var(--s-4);
          }
          .cp-channel {
            background: var(--surface);
            border: 1px solid var(--border);
            padding: var(--s-5);
            transition: border-color var(--t-fast);
          }
          .cp-channel:hover { border-color: var(--border-strong); }
          .cp-channel-name {
            font-family: var(--font-serif);
            font-size: 22px;
            font-weight: 400;
            color: #fff;
            margin: 0 0 var(--s-2);
          }
          .cp-channel-desc {
            font-size: 13px;
            color: var(--text-soft);
            line-height: 1.6;
            margin: 0 0 var(--s-3);
          }
          .cp-channel-meta {
            font-family: var(--font-mono);
            font-size: 10px;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: var(--accent);
            margin: 0;
          }

          .cp-posts { }
          .cp-post-list {
            list-style: none;
            padding: 0;
            margin: var(--s-4) 0 0;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .cp-post {
            background: var(--surface);
            border: 1px solid var(--border);
            padding: var(--s-6);
          }
          .cp-post-media {
            width: 100%;
            max-height: 600px;
            object-fit: cover;
            border-radius: var(--r-2);
            margin-bottom: var(--s-4);
          }
          .cp-post-caption {
            font-size: 15px;
            line-height: 1.7;
            color: var(--text);
            margin: 0 0 var(--s-3);
            white-space: pre-wrap;
          }
          .cp-post-meta {
            display: flex;
            gap: var(--s-4);
            font-family: var(--font-mono);
            font-size: 10px;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: var(--muted);
          }
          .cp-post-lock { color: var(--accent); }

          .cp-post--locked { border-color: rgba(245,200,66,0.12); }
          .cp-post-gate {
            position: relative;
            min-height: 260px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            background: var(--surface-2);
          }
          .cp-gate-blur {
            position: absolute;
            inset: 0;
            background: linear-gradient(135deg, var(--surface-2), var(--surface-3));
            filter: blur(0);
          }
          .cp-gate-overlay {
            position: relative;
            z-index: 2;
            text-align: center;
            padding: var(--s-8) var(--s-6);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: var(--s-3);
          }
          .cp-gate-icon { font-size: 32px; }
          .cp-gate-label {
            font-family: var(--font-mono);
            font-size: 10px;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            color: var(--accent);
          }
          .cp-gate-desc {
            font-size: 14px;
            color: var(--text-soft);
            max-width: 360px;
            line-height: 1.65;
            margin: 0;
          }
          .cp-gate-form { margin-top: var(--s-2); }
          .cp-gate-btn { padding: 12px 24px; }

          .cp-empty {
            text-align: center;
            padding: var(--s-16) var(--s-5);
            background: var(--surface);
            border: 1px solid var(--border);
            margin-top: var(--s-4);
          }
          .cp-empty-mark {
            font-size: 48px;
            color: var(--muted);
            opacity: 0.4;
            margin-bottom: var(--s-5);
            font-family: var(--font-serif);
          }
          .cp-empty-title {
            font-family: var(--font-serif);
            font-size: 24px;
            font-style: italic;
            font-weight: 300;
            color: #fff;
            margin: 0 0 var(--s-2);
          }
          .cp-empty-text { font-size: 13px; color: var(--muted); margin: 0; }

          @media (max-width: 720px) {
            .cp-header { margin-top: -64px; padding: 0 var(--s-5); }
            .cp-header-inner { grid-template-columns: 1fr; gap: var(--s-5); }
            .cp-avatar { width: 104px; height: 104px; }
            .cp-avatar-fallback { font-size: 40px; }
            .cp-actions { padding-bottom: 0; }
            .btn { flex: 1; }
            .cp-content { margin-top: var(--s-12); padding: 0 var(--s-5) var(--s-16); }
          }
        `}</style>
      </main>
      <Footer />
    </>
  );
}

// ──────────────────────────────────────────────────────────────────
// Action buttons — server components that check if integrations are ready
// ──────────────────────────────────────────────────────────────────

import { hasSecret } from "@/lib/settings";

async function SubscribeButton({ creatorProfileId }: { creatorProfileId: string }) {
  const stripeReady = await hasSecret("STRIPE_SECRET_KEY");
  return (
    <form action="/api/subscribe" method="post">
      <input type="hidden" name="creator_profile_id" value={creatorProfileId} />
      <button type="submit" className="btn btn--primary" disabled={!stripeReady}>
        Subscribe
      </button>
    </form>
  );
}

async function TipButton({ creatorProfileId }: { creatorProfileId: string }) {
  const stripeReady = await hasSecret("STRIPE_SECRET_KEY");
  return (
    <form action="/api/tip" method="post">
      <input type="hidden" name="creator_profile_id" value={creatorProfileId} />
      <button type="submit" className="btn btn--secondary" disabled={!stripeReady}>
        Tip
      </button>
    </form>
  );
}
