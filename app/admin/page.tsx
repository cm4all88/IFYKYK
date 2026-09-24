import Link from "next/link";
import { createServiceClient } from "@/lib/supabase-server";
import { loadTransactions, summarizeTransactions, TXN_TYPES } from "@/lib/admin/transactions";
import { handleMap } from "@/lib/admin/filters";

// Never prerender an admin surface: it is authorised per request via isAdmin()
// and reads privileged rows with the service role.
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  // Service role: this page is gated by isAdmin() in app/admin/layout.tsx, but RLS
  // cannot see that gate. Migration 064 removes the blanket public read on
  // creator_profiles, so admin surfaces read privileged rows explicitly.
  const supabase = await createServiceClient();

  // Fetch counts in parallel
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const [
    { count: totalCreators },
    { count: spotlightCreators },
    { count: backstageCreators },
    { count: activeSubs },
    { count: flaggedContent },
    { data: recentCreators },
    { data: recentFlags },
    , // 30 day tips row, superseded by loadTransactions below
    { count: newCreators7d },
    { count: newSubs7d },
    { count: publishedCreators },
    { data: recentSubs },
  ] = await Promise.all([
    (supabase as any).from("creator_profiles").select("*", { count: "exact", head: true }),
    (supabase as any).from("creator_profiles").select("*", { count: "exact", head: true }).eq("kind", "spotlight"),
    (supabase as any).from("creator_profiles").select("*", { count: "exact", head: true }).eq("kind", "backstage"),
    (supabase as any).from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
    (supabase as any).from("moderation_events").select("*", { count: "exact", head: true }).in("severity", ["high", "critical"]).is("action_taken", null),
    (supabase as any)
      .from("creator_profiles")
      .select("handle, display_name, kind, creator_type, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    (supabase as any)
      .from("moderation_events")
      .select("content_type, flag_reason, severity, action_taken, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    (supabase as any)
      .from("tips")
      .select("amount, platform_receives, created_at")
      .eq("status", "succeeded")
      .gte("created_at", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()),
    (supabase as any).from("creator_profiles").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
    (supabase as any).from("subscriptions").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
    (supabase as any).from("creator_profiles").select("*", { count: "exact", head: true }).eq("published", true),
    (supabase as any).from("subscriptions").select("creator_profile_id, tier, status, created_at").order("created_at", { ascending: false }).limit(8),
  ]);

  // ── Money, trust and content, all from the same sources as their own pages ──
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const safeCount = async (q: any) => { try { const r = await q; return r.error ? null : (r.count ?? 0); } catch { return null; } };

  const [txns, underReview, payoutsHeld, blocked24h, disputedTips, pendingTips, posts24h, postsUnreviewed, postsFlagged, recentPostsRes] = await Promise.all([
    loadTransactions(supabase, { sinceIso: thirtyDaysAgo, perSourceLimit: 2000 }),
    safeCount((supabase as any).from("creator_trust").select("creator_profile_id", { count: "exact", head: true }).neq("monetization_status", "active")),
    safeCount((supabase as any).from("creator_trust").select("creator_profile_id", { count: "exact", head: true }).eq("payout_hold_active", true)),
    safeCount((supabase as any).from("tip_checkout_attempts").select("id", { count: "exact", head: true }).like("outcome", "blocked%").gte("created_at", dayAgo)),
    safeCount((supabase as any).from("tips").select("id", { count: "exact", head: true }).eq("status", "disputed")),
    safeCount((supabase as any).from("tips").select("id", { count: "exact", head: true }).in("status", ["checkout_created", "payment_pending"]).gte("created_at", dayAgo)),
    safeCount((supabase as any).from("posts").select("id", { count: "exact", head: true }).gte("created_at", dayAgo)),
    safeCount((supabase as any).from("posts").select("id", { count: "exact", head: true }).eq("moderation_status", "pending")),
    safeCount((supabase as any).from("posts").select("id", { count: "exact", head: true }).eq("moderation_status", "flagged")),
    (supabase as any).from("posts").select("id, creator_profile_id, caption, media_url, media_type, lock_type, moderation_status, created_at").order("created_at", { ascending: false }).limit(6),
  ]);
  const money30 = summarizeTransactions(txns.rows);
  const today = summarizeTransactions(txns.rows.filter((r) => r.created_at >= dayAgo));
  const recentTxns = txns.rows.slice(0, 10);
  const recentPosts: any[] = recentPostsRes?.data ?? [];
  const overviewHandles = await handleMap(supabase, [...recentTxns.map((r) => r.creator_profile_id), ...recentPosts.map((p) => p.creator_profile_id)]);
  const usd = (v: number) => `$${v.toFixed(2)}`;
  const n = (v: number | null) => (v === null ? "·" : v);

  // Resolve creator handles for the recent subscribers list
  const subCreatorIds = Array.from(new Set((recentSubs ?? []).map((s: any) => s.creator_profile_id).filter(Boolean)));
  let subHandleMap: Record<string, string> = {};
  if (subCreatorIds.length) {
    const { data: cps } = await (supabase as any).from("creator_profiles").select("id, handle").in("id", subCreatorIds);
    subHandleMap = Object.fromEntries((cps ?? []).map((c: any) => [c.id, c.handle]));
  }


  return (
    <div>
      <p className="kicker">Godmode · Platform Overview</p>
      <h1 className="adm-page-title">
        Platform <em>health.</em>
      </h1>
      <p className="adm-page-lede">Live counts pulled directly from the database.</p>

      {(flaggedContent ?? 0) > 0 && (
        <div className="adm-banner adm-banner--err" style={{ marginBottom: 24 }}>
          ⚐ {flaggedContent} high-severity moderation item{flaggedContent === 1 ? "" : "s"} awaiting review.{" "}
          <a href="/admin/moderation" style={{ color: "inherit", textDecoration: "underline" }}>Review now →</a>
        </div>
      )}

      {/* Stat cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total Creators</div>
          <div className="stat-value">{totalCreators ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Spotlight</div>
          <div className="stat-value" style={{ color: "var(--spot)" }}>{spotlightCreators ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Backstage</div>
          <div className="stat-value" style={{ color: "var(--back)" }}>{backstageCreators ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Subs</div>
          <div className="stat-value">{activeSubs ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">New Creators (7d)</div>
          <div className="stat-value" style={{ color: "var(--accent-open, #6ee7b7)" }}>{newCreators7d ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">New Subs (7d)</div>
          <div className="stat-value" style={{ color: "var(--accent-open, #6ee7b7)" }}>{newSubs7d ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Published</div>
          <div className="stat-value">{publishedCreators ?? 0}</div>
          <div className="stat-sub">of {totalCreators ?? 0} creators</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Platform Rev (30d)</div>
          <div className="stat-value" style={{ fontSize: 28 }}>{usd(money30.all.platform)}</div>
          <div className="stat-sub">all products, settled</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Flags</div>
          <div className="stat-value" style={{ color: flaggedContent ? "var(--red)" : "inherit" }}>
            {flaggedContent ?? 0}
          </div>
          <div className="stat-sub">high/critical severity</div>
        </div>
      </div>

      {txns.failures.length > 0 && (
        <div className="adm-banner adm-banner--err" style={{ marginBottom: 16 }}>
          Money totals are incomplete: {txns.failures.map((f) => f.label).join(", ")} could not be read.
        </div>
      )}

      {/* Money */}
      <div className="card">
        <div className="card-title">Money <Link href="/admin/transactions" style={{ fontSize: 11, marginLeft: 8 }}>all transactions</Link></div>
        <div className="stat-grid" style={{ marginBottom: 12 }}>
          <div className="stat-card"><div className="stat-label">Fan spend (24h)</div><div className="stat-value">{usd(today.all.gross)}</div><div className="stat-sub">{today.all.settledCount} payments</div></div>
          <div className="stat-card"><div className="stat-label">Fan spend (30d)</div><div className="stat-value">{usd(money30.all.gross)}</div><div className="stat-sub">{money30.all.settledCount} payments</div></div>
          <div className="stat-card"><div className="stat-label">To creators (30d)</div><div className="stat-value">{usd(money30.all.creatorNet)}</div></div>
          <div className="stat-card"><div className="stat-label">Platform (30d)</div><div className="stat-value" style={{ color: "var(--spot)" }}>{usd(money30.all.platform)}</div></div>
        </div>
        <table className="adm-table">
          <thead><tr><th>Product (30d)</th><th>Payments</th><th>Fan spend</th><th>To creators</th><th>Platform</th></tr></thead>
          <tbody>
            {money30.byType.filter((t) => t.count > 0).map((t) => (
              <tr key={t.type}>
                <td><Link href={`/admin/transactions?type=${t.type}`}>{t.label}</Link></td>
                <td>{t.settledCount}{t.count !== t.settledCount ? <span style={{ color: "var(--muted)" }}> (+{t.count - t.settledCount} unsettled)</span> : null}</td>
                <td>{usd(t.gross)}</td><td>{usd(t.creatorNet)}</td><td>{usd(t.platform)}</td>
              </tr>
            ))}
            {money30.all.count === 0 && <tr><td colSpan={5} style={{ color: "var(--muted)" }}>No payments in 30 days.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Trust and content */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div className="card">
          <div className="card-title">Trust and safety <Link href="/admin/trust" style={{ fontSize: 11, marginLeft: 8 }}>open</Link></div>
          <table className="adm-table"><tbody>
            <tr><td>Creators under review or blocked</td><td style={{ color: underReview ? "var(--red)" : undefined }}>{n(underReview)}</td></tr>
            <tr><td>Creators with payouts held</td><td>{n(payoutsHeld)}</td></tr>
            <tr><td>Tip checkouts blocked (24h)</td><td>{n(blocked24h)}</td></tr>
            <tr><td>Tips in dispute</td><td style={{ color: disputedTips ? "var(--red)" : undefined }}>{n(disputedTips)}</td></tr>
            <tr><td>Tip checkouts not completed (24h)</td><td>{n(pendingTips)}</td></tr>
          </tbody></table>
        </div>
        <div className="card">
          <div className="card-title">Content <Link href="/admin/posts" style={{ fontSize: 11, marginLeft: 8 }}>all posts</Link></div>
          <table className="adm-table"><tbody>
            <tr><td>Posts in the last 24h</td><td><Link href="/admin/posts?days=1">{n(posts24h)}</Link></td></tr>
            <tr><td>Posts not yet reviewed</td><td><Link href="/admin/posts?mod=pending&days=365">{n(postsUnreviewed)}</Link></td></tr>
            <tr><td>Flagged posts</td><td style={{ color: postsFlagged ? "var(--red)" : undefined }}><Link href="/admin/posts?mod=flagged&days=365">{n(postsFlagged)}</Link></td></tr>
          </tbody></table>
        </div>
      </div>

      {/* Latest activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div className="card">
          <div className="card-title">Latest transactions</div>
          <table className="adm-table">
            <thead><tr><th>When</th><th>Type</th><th>Creator</th><th>Gross</th><th>Status</th></tr></thead>
            <tbody>
              {recentTxns.length === 0 ? <tr><td colSpan={5} style={{ color: "var(--muted)" }}>None yet.</td></tr> : recentTxns.map((r) => (
                <tr key={r.key} style={r.settled ? undefined : { opacity: 0.6 }}>
                  <td style={{ fontSize: 11 }}>{new Date(r.created_at).toLocaleString()}</td>
                  <td style={{ fontSize: 11 }}>{TXN_TYPES.find((t) => t.type === r.type)?.label}</td>
                  <td style={{ fontSize: 11 }}>{r.creator_profile_id ? `@${overviewHandles.get(r.creator_profile_id) ?? "?"}` : "platform"}</td>
                  <td>{usd(r.gross)}</td>
                  <td><span className={`badge ${r.settled ? "badge--green" : "badge--dim"}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="card-title">Latest posts</div>
          <table className="adm-table">
            <thead><tr><th>Creator</th><th>Post</th><th>Access</th><th>Review</th></tr></thead>
            <tbody>
              {recentPosts.length === 0 ? <tr><td colSpan={4} style={{ color: "var(--muted)" }}>No posts yet.</td></tr> : recentPosts.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontSize: 11 }}><Link href={`/admin/posts?creator=${p.creator_profile_id}&days=365`}>@{overviewHandles.get(p.creator_profile_id) ?? "?"}</Link></td>
                  <td style={{ fontSize: 11, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.caption || (p.media_url ? `(${p.media_type ?? "media"})` : "(empty)")}</td>
                  <td style={{ fontSize: 11 }}>{p.lock_type ?? "free"}</td>
                  <td><span className={`badge ${p.moderation_status === "flagged" || p.moderation_status === "blocked" ? "badge--red" : p.moderation_status === "approved" ? "badge--green" : "badge--dim"}`}>{p.moderation_status ?? "unreviewed"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        {/* Recent signups */}
        <div className="card">
          <div className="card-title">Recent Creators</div>
          <table className="adm-table">
            <thead>
              <tr>
                <th>Handle</th>
                <th>Type</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {(recentCreators ?? []).length === 0 ? (
                <tr><td colSpan={3} style={{ color: "var(--muted)" }}>No creators yet.</td></tr>
              ) : (
                (recentCreators ?? []).map((c: any) => (
                  <tr key={c.handle}>
                    <td>@{c.handle}</td>
                    <td>
                      <span className={`badge ${c.kind === "backstage" ? "badge--purple" : "badge--yellow"}`}>
                        {c.kind}
                      </span>
                    </td>
                    <td style={{ color: "var(--muted)", fontSize: 11 }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Recent moderation events */}
        <div className="card">
          <div className="card-title">Recent Flags</div>
          <table className="adm-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Reason</th>
                <th>Severity</th>
              </tr>
            </thead>
            <tbody>
              {(recentFlags ?? []).length === 0 ? (
                <tr><td colSpan={3} style={{ color: "var(--muted)" }}>No flags. ✓</td></tr>
              ) : (
                (recentFlags ?? []).map((f: any, i: number) => (
                  <tr key={i}>
                    <td style={{ fontSize: 11 }}>{f.content_type}</td>
                    <td style={{ fontSize: 11, color: "var(--muted)" }}>{f.flag_reason ?? "—"}</td>
                    <td>
                      <span className={`badge ${f.severity === "critical" || f.severity === "high" ? "badge--red" : "badge--dim"}`}>
                        {f.severity}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent subscribers */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Recent Subscribers</div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Creator</th>
              <th>Tier</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {(recentSubs ?? []).length === 0 ? (
              <tr><td colSpan={3} style={{ color: "var(--muted)" }}>No subscribers yet.</td></tr>
            ) : (
              (recentSubs ?? []).map((s: any, i: number) => (
                <tr key={i}>
                  <td>@{subHandleMap[s.creator_profile_id] ?? "—"}</td>
                  <td style={{ fontSize: 11, color: "var(--muted)" }}>{s.tier ?? "—"}</td>
                  <td style={{ color: "var(--muted)", fontSize: 11 }}>{new Date(s.created_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Quick nav */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Quick Actions</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {[
            { href: "/admin/credentials", label: "Update API Keys" },
            { href: "/admin/flags", label: "Toggle Features" },
            { href: "/admin/coupons", label: "Create Coupon" },
            { href: "/admin/comms", label: "Send Announcement" },
            { href: "/admin/creators", label: "Manage Creators" },
            { href: "/admin/subscribers", label: "View Subscribers" },
            { href: "/admin/subscriptions", label: "Subscriptions" },
            { href: "/admin/moderation", label: "Review Flags" },
            { href: "/admin/posts", label: "All Posts" },
            { href: "/admin/transactions", label: "All Transactions" },
            { href: "/admin/trust", label: "Trust & Safety" },
            { href: "/admin/content", label: "Content Engine" },
            { href: "/admin/ads", label: "Manage Featured Slots" },
            { href: "/admin/roadmap", label: "Roadmap" },
          ].map((a) => (
            <a key={a.href} href={a.href} className="adm-btn adm-btn--ghost">
              {a.label}
            </a>
          ))}
        </div>
      </div>
      {/* ── GO LIVE CHECKLIST ── */}
      <div className="card" style={{ marginTop: 16, borderTop: "2px solid var(--spot)" }}>
        <div className="card-title">🚀 Go Live Checklist</div>
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, lineHeight: 1.6 }}>
          Everything required before Spotlightly is ready for real creators and real money. Do not announce until all critical items are done.
        </p>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--red)", marginBottom: 10 }}>🔴 Critical — Cannot launch without</div>
          {[
            ["Stripe Connect routing", "subscribe/tip APIs must use transfer_data[destination] to route funds to creator accounts, not the platform account"],
            ["stripe_account_id column added", "ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS stripe_account_id text"],
            ["social_links column added", "ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS social_links jsonb"],
            ["006_messages.sql migration run", "Creates message_threads and messages tables with RLS"],
            ["Stripe platform account verified for payouts", "Tahoma Systems LLC — charges and payouts enabled at dashboard.stripe.com"],
            ["Password reset page built", "/forgot-password — users who forget their password are permanently locked out"],
            ["Fan signup flow", "Fans need accounts to subscribe. Currently everyone goes through the creator advisor"],
            ["AI moderation wired to post publish", "Call moderateChatMessage() from lib/advisor.ts before saving any post"],
            ["Welcome email configured", "Set RESEND_API_KEY in credentials, verify spotlightly.app domain in Resend, trigger on signup"],
            ["Email addresses set up", "hello@ · legal@ · privacy@ · support@ · merch@ at spotlightly.app"],
            ["Terms, Privacy, DMCA pages verified live", "Confirm /terms /privacy /dmca all render correctly"],
            ["DMCA agent registered", "Register at dmca.copyright.gov — $6/year — legally required before accepting content"],
          ].map(([item, detail], i) => (
            <div key={i} style={{ display:"grid", gridTemplateColumns:"20px 1fr", gap:12, padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,.04)" }}>
              <div style={{ width:16, height:16, borderRadius:3, border:"1px solid rgba(255,255,255,.2)", marginTop:2, flexShrink:0 }} />
              <div>
                <div style={{ fontSize:13, color:"#fff", fontWeight:600, marginBottom:2 }}>{item}</div>
                <div style={{ fontSize:11, color:"var(--muted)", lineHeight:1.5 }}>{detail}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:10, letterSpacing:".15em", textTransform:"uppercase", color:"#f59e0b", marginBottom:10 }}>🟡 Should have before marketing to creators</div>
          {[
            ["Subscription price setter in dashboard", "Creators need UI to set their own price. Currently only admin can set it"],
            ["Channels CRUD", "Creators can't create channels — can only view them if they exist in DB"],
            ["Media upload in post form", "Upload API works, no file picker wired in the dashboard post editor"],
            ["Success banner on creator page", "?subscribed=1 and ?tipped=1 return params exist but no confirmation shown"],
            ["CCBill credentials save wired", "PaymentsPane UI exists but save button not connected to a DB update"],
            ["Account deletion flow", "Required by CCPA and GDPR"],
            ["og:image meta on all pages", "Every page shares as a blank card on iMessage, Twitter, Discord"],
            ["Stripe webhook secret configured", "Set STRIPE_WEBHOOK_SECRET in admin credentials"],
          ].map(([item, detail], i) => (
            <div key={i} style={{ display:"grid", gridTemplateColumns:"20px 1fr", gap:12, padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,.04)" }}>
              <div style={{ width:16, height:16, borderRadius:3, border:"1px solid rgba(255,255,255,.2)", marginTop:2, flexShrink:0 }} />
              <div>
                <div style={{ fontSize:13, color:"#fff", fontWeight:600, marginBottom:2 }}>{item}</div>
                <div style={{ fontSize:11, color:"var(--muted)", lineHeight:1.5 }}>{detail}</div>
              </div>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:10, letterSpacing:".15em", textTransform:"uppercase", color:"var(--back)", marginBottom:10 }}>🟣 Backstage-specific (don't block Spotlight launch)</div>
          {[
            ["Veriff age verification flow built", "Dashboard UI to complete Veriff check before Backstage is unlocked"],
            ["2257 record collection form", "Legal name, DOB, ID type — required by federal law before any adult content"],
            ["/2257 compliance page", "Public-facing federal compliance statement at a known URL"],
            ["CCBill platform merchant account", "Apply at ccbill.com for Tahoma Systems merchant account"],
          ].map(([item, detail], i) => (
            <div key={i} style={{ display:"grid", gridTemplateColumns:"20px 1fr", gap:12, padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,.04)" }}>
              <div style={{ width:16, height:16, borderRadius:3, border:"1px solid rgba(255,255,255,.2)", marginTop:2, flexShrink:0 }} />
              <div>
                <div style={{ fontSize:13, color:"#fff", fontWeight:600, marginBottom:2 }}>{item}</div>
                <div style={{ fontSize:11, color:"var(--muted)", lineHeight:1.5 }}>{detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MONTHLY CHECKLIST ── */}
      <div className="card" style={{ marginTop: 16, borderTop: "2px solid var(--accent-open)" }}>
        <div className="card-title">📅 Monthly Operations Checklist</div>
        <p style={{ fontSize:13, color:"var(--muted)", marginBottom:16, lineHeight:1.6 }}>Run every month once live. Keep the platform clean, legal, and growing.</p>
        {([
          { cat:"Financial", color:"var(--spot)", items:[
            "Reconcile platform revenue — cross-check Stripe against DB tip/subscription records",
            "Review failed subscription renewals — notify affected creators",
            "Confirm creator payouts processed correctly via Stripe Connect dashboard",
            "Review CCBill settlement reports for Backstage creators",
            "Check for disputed charges or chargebacks — respond within Stripe's window",
          ]},
          { cat:"Moderation & Legal", color:"var(--red)", items:[
            "Review all unresolved high/critical flags in /admin/moderation",
            "Confirm 2257 records on file for all active Backstage creators",
            "Check legal@spotlightly.app for DMCA takedown requests — respond within 24h",
            "Audit accounts flagged for suspicious activity or fraud",
            "Verify Veriff verification status current for all Backstage creators",
          ]},
          { cat:"Platform Health", color:"var(--accent-open)", items:[
            "Review Vercel error logs — check for recurring 500s or API failures",
            "Check BunnyCDN bandwidth usage and costs",
            "Test full flow end-to-end: signup → post → subscribe → payout",
            "Check all external service status: Stripe, Supabase, BunnyCDN, Resend, Veriff",
            "Rotate any API keys that are 90+ days old",
          ]},
          { cat:"Creator Growth", color:"var(--back)", items:[
            "Review signups vs activated (posted + Stripe connected) — activation rate",
            "Identify creators with subscribers but no Stripe — send activation nudge",
            "Check Front Row Message and Super Tip volume — leading engagement indicator",
            "Review support@spotlightly.app for creator issues",
            "Check creators who signed up but never posted — send onboarding nudge",
          ]},
          { cat:"Communications", color:"#f59e0b", items:[
            "Send monthly platform update to all creators",
            "Verify transactional emails delivering (welcome, receipts) via Resend dashboard",
            "Review unsubscribe rates from any email campaigns",
          ]},
        ] as const).map((section) => (
          <div key={section.cat} style={{ marginBottom:20 }}>
            <div style={{ fontFamily:"var(--font-mono)", fontSize:10, letterSpacing:".15em", textTransform:"uppercase", color:section.color, marginBottom:8 }}>{section.cat}</div>
            {section.items.map((item, i) => (
              <div key={i} style={{ display:"grid", gridTemplateColumns:"20px 1fr", gap:12, padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,.04)" }}>
                <div style={{ width:16, height:16, borderRadius:3, border:"1px solid rgba(255,255,255,.2)", marginTop:2, flexShrink:0 }} />
                <div style={{ fontSize:13, color:"rgba(242,242,240,.75)", lineHeight:1.55 }}>{item}</div>
              </div>
            ))}
          </div>
        ))}
      </div>

    </div>
  );
}