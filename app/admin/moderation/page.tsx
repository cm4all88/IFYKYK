import { createClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

async function takeAction(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");
  const eventId = formData.get("event_id") as string;
  const action = formData.get("action") as string;
  const creatorId = formData.get("creator_id") as string;

  const supabase = await createClient();

  // Mark event as reviewed
  await (supabase as any)
    .from("moderation_events")
    .update({ action_taken: action, reviewed_by: "admin" })
    .eq("id", eventId);

  // Additional actions
  if (action === "account_suspended" && creatorId) {
    await (supabase as any)
      .from("creator_profiles")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", creatorId);
  }

  revalidatePath("/admin/moderation");
}

async function dismissFlag(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");
  const eventId = formData.get("event_id") as string;
  const supabase = await createClient();
  await (supabase as any)
    .from("moderation_events")
    .update({ action_taken: "dismissed", reviewed_by: "admin" })
    .eq("id", eventId);
  revalidatePath("/admin/moderation");
}

export default async function ModerationPage(props: {
  searchParams: Promise<{ severity?: string; reviewed?: string }>;
}) {
  if (!(await isAdmin())) notFound();
  const sp = await props.searchParams;
  const severity = sp.severity ?? "";
  const reviewed = sp.reviewed === "1";

  const supabase = await createClient();

  // Stats
  const [{ count: critical }, { count: high }, { count: medium }, { count: pending }] = await Promise.all([
    (supabase as any).from("moderation_events").select("*", { count: "exact", head: true }).eq("severity", "critical"),
    (supabase as any).from("moderation_events").select("*", { count: "exact", head: true }).eq("severity", "high"),
    (supabase as any).from("moderation_events").select("*", { count: "exact", head: true }).eq("severity", "medium"),
    (supabase as any).from("moderation_events").select("*", { count: "exact", head: true }).is("action_taken", null),
  ]);

  let query = (supabase as any)
    .from("moderation_events")
    .select(`
      id, content_type, flag_reason, flagged_text, action_taken,
      severity, reviewed_by, created_at, creator_id,
      creator_profiles(handle, display_name)
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  if (severity) query = query.eq("severity", severity);
  if (!reviewed) query = query.is("action_taken", null);
  else query = query.not("action_taken", "is", null);

  const { data: events } = await query;

  const severityColor: Record<string, string> = {
    critical: "badge--red",
    high: "badge--red",
    medium: "badge--yellow",
    low: "badge--dim",
  };

  return (
    <div>
      <p className="kicker">Admin · Moderation</p>
      <h1 className="adm-page-title">Content <em>Moderation.</em></h1>
      <p className="adm-page-lede">Review flagged content. Take action on violations.</p>

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Pending Review</div>
          <div className="stat-value" style={{ color: pending ? "var(--red)" : "inherit" }}>{pending ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Critical</div>
          <div className="stat-value" style={{ color: "var(--red)" }}>{critical ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">High</div>
          <div className="stat-value" style={{ color: "var(--spot)" }}>{high ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Medium</div>
          <div className="stat-value">{medium ?? 0}</div>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <select name="severity" defaultValue={severity} className="adm-select" style={{ maxWidth: 160 }}>
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)" }}>
          <input type="checkbox" name="reviewed" value="1" defaultChecked={reviewed} style={{ accentColor: "var(--spot)" }} />
          Show reviewed
        </label>
        <button type="submit" className="adm-btn adm-btn--ghost">Filter</button>
      </form>

      {/* Events */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(events ?? []).length === 0 ? (
          <div className="card" style={{ textAlign: "center", color: "var(--muted)" }}>
            {reviewed ? "No reviewed events." : "✓ No pending flags. Queue is clear."}
          </div>
        ) : (
          (events ?? []).map((e: any) => (
            <div key={e.id} className="card" style={{ borderLeft: `3px solid ${e.severity === "critical" || e.severity === "high" ? "var(--red)" : e.severity === "medium" ? "var(--spot)" : "var(--border)"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className={`badge ${severityColor[e.severity] ?? "badge--dim"}`}>{e.severity}</span>
                  <span className="badge badge--dim">{e.content_type}</span>
                  {e.creator_profiles && (
                    <a href={`/${e.creator_profiles.handle}`} target="_blank" style={{ fontSize: 12, color: "var(--spot)", textDecoration: "none" }}>
                      @{e.creator_profiles.handle}
                    </a>
                  )}
                </div>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{new Date(e.created_at).toLocaleString()}</span>
              </div>

              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
                <strong style={{ color: "var(--text)" }}>Reason:</strong> {e.flag_reason ?? "—"}
              </div>

              {e.flagged_text && (
                <div style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 3, padding: "8px 12px", fontSize: 12, color: "rgba(232,232,240,0.7)", marginBottom: 12, fontFamily: "monospace" }}>
                  "{e.flagged_text}"
                </div>
              )}

              {e.action_taken ? (
                <div style={{ fontSize: 11, color: "var(--open)" }}>
                  ✓ Action taken: <strong>{e.action_taken}</strong> by {e.reviewed_by}
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { action: "flagged", label: "Flag for Review", cls: "adm-btn--ghost" },
                    { action: "warned", label: "Warn Creator", cls: "adm-btn--ghost" },
                    { action: "blocked", label: "Remove Content", cls: "adm-btn--danger" },
                    { action: "account_suspended", label: "Suspend Account", cls: "adm-btn--danger" },
                  ].map(({ action, label, cls }) => (
                    <form action={takeAction} key={action}>
                      <input type="hidden" name="event_id" value={e.id} />
                      <input type="hidden" name="action" value={action} />
                      {e.creator_id && <input type="hidden" name="creator_id" value={e.creator_id} />}
                      <button type="submit" className={`adm-btn ${cls}`} style={{ padding: "6px 14px" }}>{label}</button>
                    </form>
                  ))}
                  <form action={dismissFlag}>
                    <input type="hidden" name="event_id" value={e.id} />
                    <button type="submit" className="adm-btn adm-btn--ghost" style={{ padding: "6px 14px" }}>Dismiss</button>
                  </form>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
