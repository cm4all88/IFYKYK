import { createClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin";

import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function createCoupon(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");

  const code = (formData.get("code") as string).toUpperCase().trim();
  const discountType = formData.get("discount_type") as string;
  const discountValue = parseFloat(formData.get("discount_value") as string);
  const maxUses = formData.get("max_uses") ? parseInt(formData.get("max_uses") as string) : null;
  const minAmount = formData.get("min_amount") ? parseFloat(formData.get("min_amount") as string) : null;
  const expiresAt = formData.get("expires_at") ? new Date(formData.get("expires_at") as string).toISOString() : null;
  const appliesTo = formData.get("applies_to") as string;
  const description = formData.get("description") as string;

  if (!code || !discountType || isNaN(discountValue)) return;

  const supabase = await createClient();
  await (supabase as any).from("coupons").insert({
    code,
    description,
    discount_type: discountType,
    discount_value: discountValue,
    max_uses: maxUses,
    min_amount: minAmount,
    expires_at: expiresAt,
    applies_to: appliesTo || "all",
    is_active: true,
    created_by: "admin",
  });

  revalidatePath("/admin/coupons");
  redirect("/admin/coupons?created=1");
}

async function toggleCoupon(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";
  const supabase = await createClient();
  await (supabase as any).from("coupons").update({ is_active: !active }).eq("id", id);
  revalidatePath("/admin/coupons");
}

async function deleteCoupon(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");
  const id = formData.get("id") as string;
  const supabase = await createClient();
  await (supabase as any).from("coupons").delete().eq("id", id);
  revalidatePath("/admin/coupons");
}

export default async function CouponsPage(props: {
  searchParams: Promise<{ created?: string }>;
}) {
  if (!(await isAdmin())) notFound();
  const sp = await props.searchParams;

  const supabase = await createClient();
  const { data: coupons } = await (supabase as any)
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });

  const now = new Date();

  return (
    <div>
      <p className="kicker">Admin · Coupons</p>
      <h1 className="adm-page-title">Coupons <em>&amp; Discounts.</em></h1>
      <p className="adm-page-lede">Create discount codes for subscriptions. Fans enter codes at checkout.</p>

      {sp.created === "1" && (
        <div className="adm-banner adm-banner--ok">✓ Coupon created.</div>
      )}

      {/* Create form */}
      <div className="card">
        <div className="card-title">Create New Coupon</div>
        <form action={createCoupon} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="field-grid">
            <div className="adm-field">
              <label className="adm-label">Code *</label>
              <input name="code" required placeholder="SUMMER25" className="adm-input" style={{ textTransform: "uppercase", fontFamily: "monospace" }} />
            </div>
            <div className="adm-field">
              <label className="adm-label">Description</label>
              <input name="description" placeholder="Summer 2026 promo" className="adm-input" />
            </div>
          </div>

          <div className="field-grid-3">
            <div className="adm-field">
              <label className="adm-label">Discount Type *</label>
              <select name="discount_type" required className="adm-select">
                <option value="percent">Percentage (%)</option>
                <option value="flat">Flat amount ($)</option>
              </select>
            </div>
            <div className="adm-field">
              <label className="adm-label">Discount Value *</label>
              <input name="discount_value" type="number" min="0.01" step="0.01" required placeholder="25" className="adm-input" />
            </div>
            <div className="adm-field">
              <label className="adm-label">Applies To</label>
              <select name="applies_to" className="adm-select">
                <option value="all">All tiers</option>
                <option value="spotlight">Spotlight only</option>
                <option value="backstage">Backstage only</option>
              </select>
            </div>
          </div>

          <div className="field-grid-3">
            <div className="adm-field">
              <label className="adm-label">Max Uses (blank = unlimited)</label>
              <input name="max_uses" type="number" min="1" placeholder="100" className="adm-input" />
            </div>
            <div className="adm-field">
              <label className="adm-label">Min Purchase ($)</label>
              <input name="min_amount" type="number" min="0" step="0.01" placeholder="9.99" className="adm-input" />
            </div>
            <div className="adm-field">
              <label className="adm-label">Expires At (blank = never)</label>
              <input name="expires_at" type="datetime-local" className="adm-input" />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="adm-btn adm-btn--primary">Create Coupon</button>
          </div>
        </form>
      </div>

      {/* Coupon list */}
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <div className="card-title" style={{ padding: "20px 24px 16px" }}>Active Coupons ({(coupons ?? []).length})</div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Applies To</th>
              <th>Uses</th>
              <th>Min $</th>
              <th>Expires</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(coupons ?? []).length === 0 ? (
              <tr><td colSpan={8} style={{ color: "var(--muted)", padding: 24 }}>No coupons yet.</td></tr>
            ) : (
              (coupons ?? []).map((c: any) => {
                const expired = c.expires_at && new Date(c.expires_at) < now;
                const exhausted = c.max_uses && c.uses_count >= c.max_uses;
                const effective = c.is_active && !expired && !exhausted;
                return (
                  <tr key={c.id}>
                    <td>
                      <code style={{ fontFamily: "monospace", fontSize: 13, color: "var(--spot)" }}>{c.code}</code>
                    </td>
                    <td>
                      {c.discount_type === "percent"
                        ? `${c.discount_value}% off`
                        : `$${parseFloat(c.discount_value).toFixed(2)} off`}
                    </td>
                    <td>
                      <span className="badge badge--dim">{c.applies_to}</span>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {c.uses_count}
                      {c.max_uses ? ` / ${c.max_uses}` : " / ∞"}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {c.min_amount ? `$${parseFloat(c.min_amount).toFixed(2)}` : "—"}
                    </td>
                    <td style={{ fontSize: 11, color: expired ? "var(--red)" : "var(--muted)" }}>
                      {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "Never"}
                    </td>
                    <td>
                      <span className={`badge ${effective ? "badge--green" : "badge--red"}`}>
                        {!c.is_active ? "Disabled" : expired ? "Expired" : exhausted ? "Exhausted" : "Active"}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <form action={toggleCoupon}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="active" value={String(c.is_active)} />
                          <button type="submit" className="adm-btn adm-btn--ghost" style={{ padding: "5px 12px" }}>
                            {c.is_active ? "Disable" : "Enable"}
                          </button>
                        </form>
                        <form action={deleteCoupon} onSubmit={(e) => {
                          // Note: in server components this onClick won't run; use a confirm param if needed
                        }}>
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit" className="adm-btn adm-btn--danger" style={{ padding: "5px 12px" }}>Delete</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
