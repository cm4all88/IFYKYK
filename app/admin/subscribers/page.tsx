import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import CopyText from "@/components/CopyText";

export const dynamic = "force-dynamic";

// First N creators (by signup order) are "Founding Creators".
const FOUNDER_LIMIT = 100;

export default async function AdminSubscribersPage() {
  if (!(await isAdmin())) notFound();

  const db = await createServiceClient();
  const admin: any = db;

  const [subsRes, creatorsRes, subRefsRes, creatorRefsRes, tiersRes, refCodesRes] = await Promise.all([
    admin.from("subscriptions").select("id, fan_user_id, creator_profile_id, tier, tier_id, status, billing_period, created_at").order("created_at", { ascending: false }),
    admin.from("creator_profiles").select("id, handle, display_name, kind, created_at, deleted_at"),
    admin.from("subscriber_referrals").select("fan_user_id, referrer_profile_id, subscribed"),
    admin.from("creator_referrals").select("referrer_profile_id"),
    admin.from("subscription_tiers").select("id, name"),
    admin.from("referral_codes").select("owner_user_id, code"),
  ]);

  const subs: any[] = subsRes.data ?? [];
  const codeByUser: Record<string, string> = {};
  for (const c of (refCodesRes.data ?? [])) if (c.owner_user_id && c.code) codeByUser[c.owner_user_id] = c.code;
  const creators: any[] = creatorsRes.data ?? [];
  const subRefs: any[] = subRefsRes.data ?? [];
  const creatorRefs: any[] = creatorRefsRes.data ?? [];
  const tiers: any[] = tiersRes.data ?? [];

  // Fan emails (service-role admin auth listing).
  const emailByUser: Record<string, string> = {};
  try {
    const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of usersData?.users ?? []) emailByUser[u.id] = u.email ?? "";
  } catch { /* emails just show as — */ }

  const creatorById: Record<string, any> = {};
  for (const c of creators) creatorById[c.id] = c;

  const tierName: Record<string, string> = {};
  for (const t of tiers) tierName[t.id] = t.name;

  // Which creator referred each fan (how they found us).
  const referrerByFan: Record<string, string> = {};
  for (const r of subRefs) if (r.fan_user_id && r.referrer_profile_id) referrerByFan[r.fan_user_id] = r.referrer_profile_id;

  // Creators-referred count per creator.
  const creatorRefCount: Record<string, number> = {};
  for (const r of creatorRefs) creatorRefCount[r.referrer_profile_id] = (creatorRefCount[r.referrer_profile_id] ?? 0) + 1;

  // Founder set: earliest FOUNDER_LIMIT spotlight creators by created_at.
  const founderIds = new Set(
    creators
      .filter((c) => c.kind === "spotlight")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(0, FOUNDER_LIMIT)
      .map((c) => c.id)
  );

  // Group subscriptions by creator.
  const byCreator: Record<string, any[]> = {};
  for (const s of subs) {
    (byCreator[s.creator_profile_id] ??= []).push(s);
  }

  const groups = Object.entries(byCreator)
    .map(([cid, list]) => ({ creator: creatorById[cid], cid, list }))
    .filter((g) => g.creator)
    .sort((a, b) => b.list.length - a.list.length);

  const totalSubs = subs.length;
  const activeSubs = subs.filter((s) => s.status === "active").length;

  function fmt(d: string) {
    return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
  }
  const statusBadge: Record<string, string> = {
    active: "badge--green", canceled: "badge--red", past_due: "badge--yellow",
    trialing: "badge--purple", incomplete: "badge--dim",
  };

  return (
    <div>
      <p className="kicker">Admin · Subscribers</p>
      <h1 className="adm-page-title">Every <em>subscriber.</em></h1>
      <p className="adm-page-lede">Who subscribes to whom, how they found us, and which creators each creator brought in.</p>

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-label">Total subscribers</div><div className="stat-value">{totalSubs}</div></div>
        <div className="stat-card"><div className="stat-label">Active</div><div className="stat-value" style={{ color: "var(--open)" }}>{activeSubs}</div></div>
        <div className="stat-card"><div className="stat-label">Creators with subs</div><div className="stat-value">{groups.length}</div></div>
      </div>

      {groups.length === 0 && (
        <div className="card"><p style={{ color: "var(--muted)", padding: 8 }}>No subscriptions yet.</p></div>
      )}

      {groups.map(({ creator, cid, list }) => (
        <div key={cid} className="card" style={{ marginBottom: 18, padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "14px 18px", borderBottom: "1px solid var(--border, rgba(255,255,255,0.08))" }}>
            <span style={{ fontFamily: "var(--font-serif, serif)", fontSize: 20, color: "#fff" }}>
              {creator.display_name || creator.handle}
            </span>
            <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11, color: "rgba(242,184,75,0.95)" }}>@{creator.handle}</span>
            {founderIds.has(cid) && (
              <span className="badge badge--purple" style={{ fontSize: 9 }}>★ FOUNDER</span>
            )}
            <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono, monospace)", fontSize: 11, color: "var(--muted)" }}>
              {list.length} subscriber{list.length === 1 ? "" : "s"}
              {creatorRefCount[cid] ? ` · brought in ${creatorRefCount[cid]} creator${creatorRefCount[cid] === 1 ? "" : "s"}` : ""}
            </span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="adm-table">
              <thead>
                <tr><th>Subscriber</th><th>Tier</th><th>Status</th><th>Since</th><th>Found us via</th><th>Their referral link</th></tr>
              </thead>
              <tbody>
                {list.map((s) => {
                  const refId = referrerByFan[s.fan_user_id];
                  const refCreator = refId ? creatorById[refId] : null;
                  return (
                    <tr key={s.id}>
                      <td>{emailByUser[s.fan_user_id] || s.fan_user_id?.slice(0, 8) || "—"}</td>
                      <td>{(s.tier_id && tierName[s.tier_id]) || s.tier || "—"}</td>
                      <td><span className={`badge ${statusBadge[s.status] || "badge--dim"}`}>{s.status}</span></td>
                      <td>{fmt(s.created_at)}</td>
                      <td style={{ color: refCreator ? "rgba(242,184,75,0.95)" : "var(--muted)" }}>
                        {refCreator ? `@${refCreator.handle} (referral)` : "Direct"}
                      </td>
                      <td>
                        {codeByUser[s.fan_user_id] ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11, color: "var(--muted)" }}>{codeByUser[s.fan_user_id]}</span>
                            <CopyText text={`https://spotlightly.app/?ref=${codeByUser[s.fan_user_id]}`} label="Copy link" />
                          </span>
                        ) : <span style={{ color: "var(--muted)", fontSize: 12 }}>none yet</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
