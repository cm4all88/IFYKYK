import { createClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function cancelSub(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");
  const id = formData.get("id") as string;
  const supabase = await createClient();
  await (supabase as any)
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("id", id);
  revalidatePath("/admin/subscriptions");
}

async function extendSub(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");
  const id = formData.get("id") as string;
  const days = parseInt(formData.get("days") as string) || 30;
  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from("subscriptions")
    .select("current_period_end")
    .eq("id", id)
    .single();
  const base = data?.current_period_end ? new Date(data.current_period_end) : new Date();
  base.setDate(base.getDate() + days);
  await (supabase as any)
    .from("subscriptions")
    .update({ current_period_end: base.toISOString(), status: "active" })
    .eq("id", id);
  revalidatePath("/admin/subscriptions");
}

export default async function SubscriptionsPage(props: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  if (!(await isAdmin())) notFound();
  const sp = await props.searchParams;
  const status = sp.status ?? "active";
  const q = sp.q ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1"));
  const perPage = 30;

  const supabase = await createClient();

  // Get subscription stats
  const [{ count: active }, { count: canceled }, { count: pastDue }] = await Promise.all([
    (supabase as any).from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
    (supabase as any).from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "canceled"),
    (supabase as any).from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "past_due"),
  ]);

  let query = (supabase as any)
    .from("subscriptions")
    .select(`
      id, status, price, tier, created_at, current_period_end, stripe_subscription_id,
      creator_profiles!inner(handle, display_name, kind)
    `, { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (status !== "all") query = query.eq("status", status);

  const { data: subs, count } = await query;
  const totalPages = Math.ceil((count ?? 0) / perPage);

  const statusColor: Record<string, string> = {
    active: "badge--green",
    canceled: "badge--red",
    past_due: "badge--yellow",
    trialing: "badge--purple",
    incomplete: "badge--dim",
  };

  return (
    <div>
      <p className="kicker">Admin · Subscriptions</p>
      <h1 className="adm-page-title">Subscription <em>Management.</em></h1>
      <p className="adm-page-lede">View, cancel, and extend creator subscriptions.</p>

      {/* Stats */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Active</div>
          <div className="stat-value" style={{ color: "var(--open)" }}>{active ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Past Due</div>
          <div className="stat-value" style={{ color: "var(--spot)" }}>{pastDue ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Canceled</div>
          <div className="stat-value" style={{ color: "var(--red)" }}>{canceled ?? 0}</div>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <select name="status" defaultValue={status} className="adm-select" style={{ maxWidth: 160 }}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="past_due">Past Due</option>
          <option value="canceled">Canceled</option>
          <option value="trialing">Trialing</option>
        </select>
        <button type="submit" className="adm-btn adm-btn--ghost">Filter</button>
      </form>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Creator</th>
              <th>Type</th>
              <th>Status</th>
              <th>Price/mo</th>
              <th>Renews</th>
              <th>Stripe ID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(subs ?? []).length === 0 ? (
              <tr><td colSpan={7} style={{ color: "var(--muted)", padding: 24 }}>No subscriptions found.</td></tr>
            ) : (
              (subs ?? []).map((s: any) => (
                <tr key={s.id}>
                  <td>@{s.creator_profiles?.handle ?? "—"}</td>
                  <td>
                    <span className={`badge ${s.creator_profiles?.kind === "backstage" ? "badge--purple" : "badge--yellow"}`}>
                      {s.creator_profiles?.kind ?? "—"}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${statusColor[s.status] ?? "badge--dim"}`}>{s.status}</span>
                  </td>
                  <td>${parseFloat(s.price ?? 0).toFixed(2)}</td>
                  <td style={{ fontSize: 11, color: "var(--muted)" }}>
                    {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}
                  </td>
                  <td style={{ fontSize: 10, color: "var(--muted)", fontFamily: "monospace" }}>
                    {s.stripe_subscription_id ? s.stripe_subscription_id.slice(0, 20) + "…" : "—"}
                  </td>
                  <td>
                    <div className="row-actions">
                      {s.status !== "canceled" && (
                        <form action={cancelSub}>
                          <input type="hidden" name="id" value={s.id} />
                          <button type="submit" className="adm-btn adm-btn--danger" style={{ padding: "5px 12px" }}>Cancel</button>
                        </form>
                      )}
                      <form action={extendSub} style={{ display: "flex", gap: 4 }}>
                        <input type="hidden" name="id" value={s.id} />
                        <select name="days" className="adm-select" style={{ width: 70, padding: "5px 6px", fontSize: 11 }}>
                          <option value="7">+7d</option>
                          <option value="30">+30d</option>
                          <option value="90">+90d</option>
                        </select>
                        <button type="submit" className="adm-btn adm-btn--ghost" style={{ padding: "5px 10px" }}>Extend</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          {page > 1 && <a href={`/admin/subscriptions?status=${status}&page=${page - 1}`} className="adm-btn adm-btn--ghost">← Prev</a>}
          <span style={{ color: "var(--muted)", fontSize: 12, alignSelf: "center" }}>Page {page} of {totalPages}</span>
          {page < totalPages && <a href={`/admin/subscriptions?status=${status}&page=${page + 1}`} className="adm-btn adm-btn--ghost">Next →</a>}
        </div>
      )}
    </div>
  );
}
