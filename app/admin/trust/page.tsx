import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase-server";
import { loadTrustConfig } from "@/lib/trust/config";
import { loadTrustOverview } from "@/lib/trust/admin-data";
import { HOLD_FLAGS } from "@/lib/trust/risk-flags";

export const dynamic = "force-dynamic";

const fmtDate = (d: string | null) => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "·");
const money = (n: number) => `$${n.toFixed(2)}`;

export default async function TrustPage(props: { searchParams: Promise<{ filter?: string }> }) {
  if (!(await isAdmin())) notFound();
  const sp = await props.searchParams;
  const admin = await createServiceClient();
  const config = await loadTrustConfig();

  let rows = await loadTrustOverview(admin, config);
  const filter = sp.filter ?? "flagged";
  if (filter === "flagged") rows = rows.filter((r) => r.flags.some((f) => HOLD_FLAGS.includes(f)) || r.monetization_status !== "active");
  rows.sort((a, b) => b.flags.length - a.flags.length || (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  return (
    <div>
      <div className="kicker">Trust and safety</div>
      <h1 className="adm-page-title">Creator <em>trust</em></h1>
      <p className="adm-page-lede">
        Signals are reasons to look, not verdicts. Location alone is never a flag. Last 90 days of tip activity.
      </p>

      <div className="section-actions" style={{ marginBottom: 20, display: "flex", gap: 8 }}>
        <Link href="/admin/trust?filter=flagged" className={`adm-btn ${filter === "flagged" ? "adm-btn--primary" : "adm-btn--ghost"}`}>Needs review</Link>
        <Link href="/admin/trust?filter=all" className={`adm-btn ${filter === "all" ? "adm-btn--primary" : "adm-btn--ghost"}`}>All monetizing creators</Link>
      </div>

      {rows.length === 0 ? (
        <div className="card"><p>No creators match this view.</p></div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="adm-table">
            <thead>
              <tr>
                <th>Creator</th><th>Created</th><th>Onboarded</th><th>Pub</th><th>Posts</th>
                <th>IP country (first / last)</th><th>Attempts</th><th>Blocked</th><th>Tips ok</th><th>Total</th>
                <th>Guest</th><th>Refunds</th><th>Disputes</th><th>Stripe</th><th>Monetization</th><th>Payouts</th><th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/admin/trust/${r.id}`}>{r.display_name ?? "(no name)"}</Link>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>@{r.handle} · <code>{r.id.slice(0, 8)}</code></div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}><code>{r.stripe_account_id ?? "no stripe"}</code></div>
                  </td>
                  <td>{fmtDate(r.created_at)}</td>
                  <td>{fmtDate(r.onboarded_at)}</td>
                  <td>{r.published ? "yes" : "no"}{r.deleted ? " (deleted)" : ""}</td>
                  <td>{r.post_count}</td>
                  <td>{r.first_ip_country ?? "·"} / {r.last_ip_country ?? "·"}</td>
                  <td>{r.tip_attempts}</td>
                  <td>{r.blocked_attempts}</td>
                  <td>{r.tips_succeeded}</td>
                  <td>{money(r.tips_succeeded_amount)}</td>
                  <td>{r.guest_tips}</td>
                  <td>{r.refunds}</td>
                  <td>{r.disputes}</td>
                  <td>{r.stripe_status}</td>
                  <td>
                    <span className={`badge ${r.monetization_status === "active" ? "badge--green" : r.monetization_status === "blocked" ? "badge--red" : "badge--yellow"}`}>{r.monetization_status}</span>
                    {r.tips_disabled && <div style={{ fontSize: 11 }}>tips off</div>}
                  </td>
                  <td>{r.payout_status}</td>
                  <td style={{ maxWidth: 260 }}>
                    {r.flags.map((f) => (
                      <span key={f} className={`badge ${HOLD_FLAGS.includes(f) ? "badge--red" : "badge--dim"}`} style={{ marginRight: 4, marginBottom: 4, display: "inline-block" }}>{f}</span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
