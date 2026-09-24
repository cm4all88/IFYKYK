import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { loadTrustConfig } from "@/lib/trust/config";
import { loadTrustOverview } from "@/lib/trust/admin-data";
import { ADMIN_TRUST_ACTIONS, isAdminTrustAction } from "@/lib/trust/admin-actions";
import { executeAdminTrustAction } from "@/lib/trust/admin-execute";
import { getStripeClient } from "@/lib/trust/stripe-client";
import { HOLD_FLAGS } from "@/lib/trust/risk-flags";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  disable_tips: "Disable tipping",
  enable_tips: "Enable tipping",
  place_under_review: "Place monetization under review",
  release_from_review: "Release from review",
  block_monetization: "Block future monetization",
  unblock_monetization: "Unblock (moves to review)",
  hold_payouts: "Hold payouts",
  release_payouts: "Release payouts",
};

async function runAction(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");
  const id = String(formData.get("creator_profile_id") ?? "");
  const action = formData.get("action");
  const reason = String(formData.get("reason") ?? "");
  if (!isAdminTrustAction(action)) redirect(`/admin/trust/${id}?err=${encodeURIComponent("Unknown action")}`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = await createServiceClient();
  const res = await executeAdminTrustAction({
    admin, getStripe: getStripeClient, creatorProfileId: id, action, reason, adminEmail: user?.email ?? "unknown",
  });
  revalidatePath(`/admin/trust/${id}`);
  if (!res.ok) redirect(`/admin/trust/${id}?err=${encodeURIComponent(res.error)}`);
  redirect(`/admin/trust/${id}?ok=1${res.note ? `&note=${encodeURIComponent(res.note)}` : ""}`);
}

const fmt = (d: string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 19).replace("T", " ") : "·");

export default async function TrustDetail(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string; note?: string }>;
}) {
  if (!(await isAdmin())) notFound();
  const { id } = await props.params;
  const sp = await props.searchParams;
  const admin = await createServiceClient();
  const config = await loadTrustConfig();

  const [summary] = await loadTrustOverview(admin, config, new Date(), { creatorIds: [id] });
  if (!summary) notFound();

  const [{ data: trust }, { data: tips }, { data: attempts }, { data: events }, { data: cp }] = await Promise.all([
    (admin as any).from("creator_trust").select("*").eq("creator_profile_id", id).maybeSingle(),
    (admin as any).from("tips")
      .select("id, fan_user_id, post_id, tip_source, amount, status, legacy_unverified, stripe_session_id, stripe_payment_intent_id, payment_failure_count, dispute_status, created_at, succeeded_at")
      .eq("creator_profile_id", id).order("created_at", { ascending: false }).limit(100),
    (admin as any).from("tip_checkout_attempts")
      .select("id, kind, fan_user_id, ip, country, outcome, block_reason, stripe_session_id, completed_at, card_country, stripe_risk_level, created_at")
      .eq("creator_profile_id", id).order("created_at", { ascending: false }).limit(100),
    (admin as any).from("creator_trust_events").select("kind, actor, reason, detail, created_at")
      .eq("creator_profile_id", id).order("created_at", { ascending: false }).limit(100),
    (admin as any).from("creator_profiles").select("first_ip, last_ip, first_seen_at, last_seen_at").eq("id", id).maybeSingle(),
  ]);

  return (
    <div>
      <Link href="/admin/trust" className="adm-btn adm-btn--ghost" style={{ marginBottom: 16, display: "inline-block" }}>Back to trust</Link>
      <div className="kicker">Creator trust</div>
      <h1 className="adm-page-title">{summary.display_name ?? "(no name)"} <em>@{summary.handle}</em></h1>
      <p className="adm-page-lede"><code>{summary.id}</code> · Stripe <code>{summary.stripe_account_id ?? "none"}</code></p>

      {sp.err && <div className="adm-banner adm-banner--err">{sp.err}</div>}
      {sp.ok && <div className="adm-banner adm-banner--ok">Saved.{sp.note ? ` ${sp.note}` : ""}</div>}

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-label">Posts</div><div className="stat-value">{summary.post_count}</div></div>
        <div className="stat-card"><div className="stat-label">Successful tips</div><div className="stat-value">{summary.tips_succeeded}</div><div className="stat-sub">${summary.tips_succeeded_amount.toFixed(2)}</div></div>
        <div className="stat-card"><div className="stat-label">Attempts / blocked</div><div className="stat-value">{summary.tip_attempts} / {summary.blocked_attempts}</div></div>
        <div className="stat-card"><div className="stat-label">Guest tips</div><div className="stat-value">{summary.guest_tips}</div></div>
        <div className="stat-card"><div className="stat-label">Refunds / disputes</div><div className="stat-value">{summary.refunds} / {summary.disputes}</div></div>
        <div className="stat-card"><div className="stat-label">Distinct cards</div><div className="stat-value">{summary.distinct_cards}</div></div>
      </div>

      <div className="card">
        <div className="card-title">State</div>
        <table className="adm-table"><tbody>
          <tr><td>Created</td><td>{fmt(summary.created_at)}</td></tr>
          <tr><td>Stripe onboarded</td><td>{fmt(summary.onboarded_at)}</td></tr>
          <tr><td>Published</td><td>{summary.published ? "yes" : "no"}{summary.deleted ? " (deleted)" : ""}</td></tr>
          <tr><td>IP (first / last)</td><td>{cp?.first_ip ?? "·"} ({summary.first_ip_country ?? "·"}) / {cp?.last_ip ?? "·"} ({summary.last_ip_country ?? "·"})</td></tr>
          <tr><td>Stripe status</td><td>{summary.stripe_status}{trust?.stripe_requirements_past_due?.length ? ` · past due: ${trust.stripe_requirements_past_due.join(", ")}` : ""}</td></tr>
          <tr><td>Monetization</td><td>{summary.monetization_status}{trust?.review_reason ? ` · ${trust.review_reason}` : ""}</td></tr>
          <tr><td>Tipping</td><td>{summary.tips_disabled ? "disabled by admin" : "allowed if eligible"}</td></tr>
          <tr><td>Payouts</td><td>{summary.payout_status}</td></tr>
          <tr><td>Flags</td><td>{summary.flags.length === 0 ? "none" : summary.flags.map((f) => (
            <span key={f} className={`badge ${HOLD_FLAGS.includes(f) ? "badge--red" : "badge--dim"}`} style={{ marginRight: 4 }}>{f}</span>
          ))}</td></tr>
        </tbody></table>
      </div>

      <div className="card">
        <div className="card-title">Actions</div>
        <p style={{ fontSize: 12, marginBottom: 12 }}>Every action needs a reason and is written to the history below. Nothing here deletes, refunds or edits a financial record.</p>
        <form action={runAction}>
          <input type="hidden" name="creator_profile_id" value={summary.id} />
          <div className="field-grid">
            <label className="adm-field"><span className="adm-label">Action</span>
              <select name="action" className="adm-field" defaultValue="place_under_review">
                {ADMIN_TRUST_ACTIONS.map((a) => <option key={a} value={a}>{LABELS[a]}</option>)}
              </select>
            </label>
            <label className="adm-field"><span className="adm-label">Reason (required)</span>
              <textarea name="reason" className="adm-textarea" rows={2} required minLength={3} />
            </label>
          </div>
          <button type="submit" className="adm-btn adm-btn--primary" style={{ marginTop: 10 }}>Apply</button>
        </form>
      </div>

      <div className="card">
        <div className="card-title">Recent tips</div>
        <div style={{ overflowX: "auto" }}>
          <table className="adm-table">
            <thead><tr><th>Tip</th><th>Fan</th><th>Source</th><th>Amount</th><th>Status</th><th>Session</th><th>PaymentIntent</th><th>Card fails</th><th>Created</th></tr></thead>
            <tbody>
              {(tips ?? []).map((t: any) => (
                <tr key={t.id}>
                  <td><code>{t.id.slice(0, 8)}</code></td>
                  <td>{t.fan_user_id ? <code>{t.fan_user_id.slice(0, 8)}</code> : "guest"}</td>
                  <td>{t.tip_source}{t.post_id ? <> · <code>{t.post_id.slice(0, 8)}</code></> : null}</td>
                  <td>${Number(t.amount).toFixed(2)}</td>
                  <td>{t.status}{t.legacy_unverified ? " (legacy)" : ""}{t.dispute_status ? ` · ${t.dispute_status}` : ""}</td>
                  <td><code>{t.stripe_session_id ?? "·"}</code></td>
                  <td><code>{t.stripe_payment_intent_id ?? "·"}</code></td>
                  <td>{t.payment_failure_count ?? 0}</td>
                  <td>{fmt(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Recent checkout attempts</div>
        <div style={{ overflowX: "auto" }}>
          <table className="adm-table">
            <thead><tr><th>When</th><th>Kind</th><th>Fan</th><th>IP</th><th>Country</th><th>Outcome</th><th>Completed</th><th>Card country</th><th>Stripe risk</th></tr></thead>
            <tbody>
              {(attempts ?? []).map((a: any) => (
                <tr key={a.id}>
                  <td>{fmt(a.created_at)}</td>
                  <td>{a.kind}</td>
                  <td>{a.fan_user_id ? <code>{a.fan_user_id.slice(0, 8)}</code> : "guest"}</td>
                  <td><code>{a.ip ?? "·"}</code></td>
                  <td>{a.country ?? "·"}</td>
                  <td>{a.outcome}{a.block_reason ? ` · ${a.block_reason}` : ""}</td>
                  <td>{a.completed_at ? "yes" : "no"}</td>
                  <td>{a.card_country ?? "·"}</td>
                  <td>{a.stripe_risk_level ?? "·"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-title">History</div>
        <table className="adm-table">
          <thead><tr><th>When</th><th>Event</th><th>By</th><th>Reason</th></tr></thead>
          <tbody>
            {(events ?? []).map((e: any, i: number) => (
              <tr key={i}><td>{fmt(e.created_at)}</td><td>{e.kind}</td><td>{e.actor}</td><td>{e.reason ?? "·"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
