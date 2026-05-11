import { createClient } from "@/lib/supabase-server";

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  // Fetch counts in parallel
  const [
    { count: totalCreators },
    { count: spotlightCreators },
    { count: backstageCreators },
    { count: activeSubs },
    { count: flaggedContent },
    { data: recentCreators },
    { data: recentFlags },
    { data: tipStats },
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
      .gte("created_at", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()),
  ]);

  const monthlyRevenue = (tipStats ?? []).reduce(
    (sum: number, t: any) => sum + (parseFloat(t.platform_receives) || 0),
    0
  );

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
          <div className="stat-label">Platform Rev (30d)</div>
          <div className="stat-value" style={{ fontSize: 28 }}>${monthlyRevenue.toFixed(0)}</div>
          <div className="stat-sub">from tip fees only</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Flags</div>
          <div className="stat-value" style={{ color: flaggedContent ? "var(--red)" : "inherit" }}>
            {flaggedContent ?? 0}
          </div>
          <div className="stat-sub">high/critical severity</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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
            { href: "/admin/moderation", label: "Review Flags" },
            { href: "/admin/ads", label: "Manage Featured Slots" },
          ].map((a) => (
            <a key={a.href} href={a.href} className="adm-btn adm-btn--ghost">
              {a.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
