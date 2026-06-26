import { isAdmin } from "@/lib/admin";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase-server";
import CopyText from "@/components/CopyText";

export const dynamic = "force-dynamic";

const SITE = "https://spotlightly.app";

export default async function AdminReferralsPage() {
  if (!(await isAdmin())) notFound();
  const admin = await createServiceClient();

  const [{ data: creators }, { data: codes }, { data: creatorRefs }, { data: signups }] = await Promise.all([
    (admin as any).from("creator_profiles")
      .select("id, user_id, handle, display_name, kind, created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
    (admin as any).from("referral_codes").select("owner_user_id, code"),
    (admin as any).from("creator_referrals").select("referrer_profile_id, credited"),
    (admin as any).from("referral_signups").select("code, verified"),
  ]);

  // user_id -> personal referral code
  const codeByUser = new Map<string, string>();
  (codes ?? []).forEach((c: any) => { if (c.owner_user_id && c.code) codeByUser.set(c.owner_user_id, c.code); });

  // profile_id -> creators referred (total + credited)
  const refsByProfile = new Map<string, { total: number; credited: number }>();
  (creatorRefs ?? []).forEach((r: any) => {
    const k = r.referrer_profile_id; if (!k) return;
    const cur = refsByProfile.get(k) || { total: 0, credited: 0 };
    cur.total += 1; if (r.credited) cur.credited += 1;
    refsByProfile.set(k, cur);
  });

  // code -> signups via personal code (verified + pending)
  const signupsByCode = new Map<string, { verified: number; pending: number }>();
  (signups ?? []).forEach((s: any) => {
    const k = s.code; if (!k) return;
    const cur = signupsByCode.get(k) || { verified: 0, pending: 0 };
    if (s.verified) cur.verified += 1; else cur.pending += 1;
    signupsByCode.set(k, cur);
  });

  const rows = (creators ?? []).map((c: any) => {
    const code = codeByUser.get(c.user_id) || null;
    const refs = refsByProfile.get(c.id) || { total: 0, credited: 0 };
    const sg = code ? (signupsByCode.get(code) || { verified: 0, pending: 0 }) : { verified: 0, pending: 0 };
    return {
      id: c.id, handle: c.handle, name: c.display_name || c.handle, kind: c.kind,
      inviteLink: `${SITE}/signup?ref=${c.handle}`,
      code, codeLink: code ? `${SITE}/?ref=${code}` : null,
      refsTotal: refs.total, refsCredited: refs.credited,
      sgVerified: sg.verified, sgPending: sg.pending,
    };
  });

  const totalReferred = rows.reduce((a: number, r: any) => a + r.refsTotal, 0);
  const totalCredited = rows.reduce((a: number, r: any) => a + r.refsCredited, 0);

  const th: React.CSSProperties = { textAlign: "left", padding: "8px 12px", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted, #888)", borderBottom: "1px solid var(--border, rgba(255,255,255,0.1))", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "10px 12px", fontSize: 13, color: "var(--text, #F7F3EC)", borderBottom: "1px solid rgba(255,255,255,0.04)", verticalAlign: "top" };
  const mono: React.CSSProperties = { fontFamily: "var(--font-mono, monospace)", fontSize: 11.5, color: "var(--muted, #C8C4BE)", wordBreak: "break-all" };

  return (
    <div style={{ padding: "28px 24px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12, marginBottom: 6 }}>
        <h1 className="adm-page-title" style={{ margin: 0 }}>Referral Links</h1>
        <a href="/admin" className="adm-btn adm-btn--ghost">← Admin</a>
      </div>
      <p style={{ fontSize: 13, color: "var(--muted, #888)", marginBottom: 18, maxWidth: 720, lineHeight: 1.6 }}>
        Every creator&apos;s referral links. The invite link (signup?ref=handle) is the one they share to bring in new creators and earn billing credit. The personal code link is their stable reward code. {rows.length} creators · {totalReferred} creators referred · {totalCredited} credited.
      </p>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
          <thead>
            <tr>
              <th style={th}>Creator</th>
              <th style={th}>Invite link (signup?ref=handle)</th>
              <th style={th}>Creators referred</th>
              <th style={th}>Personal code</th>
              <th style={th}>Code signups</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td style={td} colSpan={5}>No creators yet.</td></tr>
            ) : rows.map((r: any) => (
              <tr key={r.id}>
                <td style={td}>
                  <a href={`/admin/creators/${r.id}`} style={{ color: "var(--text)", textDecoration: "none" }}>
                    <span style={{ display: "block" }}>{r.name}</span>
                    <span style={{ fontSize: 11.5, color: "var(--muted)" }}>@{r.handle} · {r.kind}</span>
                  </a>
                </td>
                <td style={td}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={mono}>{r.inviteLink}</span>
                    <CopyText text={r.inviteLink} />
                  </div>
                </td>
                <td style={td}>
                  {r.refsTotal}
                  {r.refsTotal ? <span style={{ color: "var(--muted)", fontSize: 11.5 }}> ({r.refsCredited} credited)</span> : null}
                </td>
                <td style={td}>
                  {r.code ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={mono}>{r.code}</span>
                      <CopyText text={r.codeLink} label="Copy link" />
                    </div>
                  ) : <span style={{ color: "var(--muted)", fontSize: 12 }}>not generated yet</span>}
                </td>
                <td style={td}>
                  {r.code ? <>{r.sgVerified}<span style={{ color: "var(--muted)", fontSize: 11.5 }}> verified · {r.sgPending} pending</span></> : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 11.5, color: "var(--muted, #888)", marginTop: 14, lineHeight: 1.6, maxWidth: 720 }}>
        The personal code is generated the first time a creator opens their referral panel, so it shows &quot;not generated yet&quot; until then. Showing the most recent 1000 creators.
      </p>
    </div>
  );
}
