import { createServiceClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// Never prerender an admin surface: it is authorised per request via isAdmin()
// and reads privileged rows with the service role.
export const dynamic = "force-dynamic";

async function createSlot(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");

  const handle = formData.get("handle") as string;
  const slotType = formData.get("slot_type") as string;
  const headline = formData.get("headline") as string;
  const subtext = formData.get("subtext") as string;
  const ctaLabel = formData.get("cta_label") as string;
  const startsAt = new Date(formData.get("starts_at") as string).toISOString();
  const endsAt = new Date(formData.get("ends_at") as string).toISOString();
  const isPaid = formData.get("is_paid") === "on";
  const paymentAmount = isPaid ? parseFloat(formData.get("payment_amount") as string) : null;
  const priority = parseInt(formData.get("priority") as string) || 0;

  // Service role: this page is gated by isAdmin() in app/admin/layout.tsx, but RLS
  // cannot see that gate. Migration 064 removes the blanket public read on
  // creator_profiles, so admin surfaces read privileged rows explicitly.
  const supabase = await createServiceClient();

  // Look up creator profile id from handle
  const { data: profile } = await (supabase as any)
    .from("creator_profiles")
    .select("id")
    .eq("handle", handle)
    .eq("kind", "spotlight")
    .single();

  if (!profile) {
    redirect("/admin/ads?error=not_found");
  }

  await (supabase as any).from("featured_slots").insert({
    slot_type: slotType,
    creator_profile_id: profile.id,
    headline: headline || null,
    subtext: subtext || null,
    cta_label: ctaLabel || null,
    starts_at: startsAt,
    ends_at: endsAt,
    is_paid: isPaid,
    payment_amount: paymentAmount,
    priority,
    is_active: true,
  });

  revalidatePath("/admin/ads");
  redirect("/admin/ads?created=1");
}

async function deactivateSlot(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");
  const id = formData.get("id") as string;
  // Service role: this page is gated by isAdmin() in app/admin/layout.tsx, but RLS
  // cannot see that gate. Migration 064 removes the blanket public read on
  // creator_profiles, so admin surfaces read privileged rows explicitly.
  const supabase = await createServiceClient();
  await (supabase as any).from("featured_slots").update({ is_active: false }).eq("id", id);
  revalidatePath("/admin/ads");
}

async function deleteSlot(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");
  const id = formData.get("id") as string;
  // Service role: this page is gated by isAdmin() in app/admin/layout.tsx, but RLS
  // cannot see that gate. Migration 064 removes the blanket public read on
  // creator_profiles, so admin surfaces read privileged rows explicitly.
  const supabase = await createServiceClient();
  await (supabase as any).from("featured_slots").delete().eq("id", id);
  revalidatePath("/admin/ads");
}

const SLOT_META: Record<string, string> = {
  homepage_hero: "Homepage Hero — Full-width banner at top of landing page",
  homepage_grid: "Homepage Grid — Card in the featured creators section",
  browse_top: "Browse Top — Pinned at top of creator browse/search",
  sidebar: "Sidebar — Right rail across the platform",
};

export default async function AdsPage(props: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  if (!(await isAdmin())) notFound();
  const sp = await props.searchParams;

  // Service role: this page is gated by isAdmin() in app/admin/layout.tsx, but RLS
  // cannot see that gate. Migration 064 removes the blanket public read on
  // creator_profiles, so admin surfaces read privileged rows explicitly.
  const supabase = await createServiceClient();
  const { data: slots } = await (supabase as any)
    .from("featured_slots")
    .select(`*, creator_profiles(handle, display_name, kind)`)
    .order("created_at", { ascending: false })
    .limit(50);

  const now = new Date();

  // Default dates for the form
  const defaultStart = new Date().toISOString().slice(0, 16);
  const defaultEnd = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 16);

  return (
    <div>
      <p className="kicker">Admin · Featured / Ads</p>
      <h1 className="adm-page-title">Featured <em>Slots.</em></h1>
      <p className="adm-page-lede">
        Promote creators across the platform. Place them in homepage slots, browse pins, or sidebar placements.
        Use this for paid promotions or to surface creators you want to grow.
      </p>

      {sp.created === "1" && <div className="adm-banner adm-banner--ok">✓ Featured slot created.</div>}
      {sp.error === "not_found" && <div className="adm-banner adm-banner--err">Creator handle not found. Check the Spotlight handle spelling.</div>}

      {/* Slot type explainer */}
      <div className="card">
        <div className="card-title">Available Placement Types</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {Object.entries(SLOT_META).map(([key, desc]) => (
            <div key={key} style={{ background: "var(--surface-2)", borderRadius: 3, padding: "12px 16px", border: "1px solid var(--border)" }}>
              <code style={{ fontFamily: "monospace", fontSize: 11, color: "var(--spot)" }}>{key}</code>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Create form */}
      <div className="card">
        <div className="card-title">Create Featured Slot</div>
        <form action={createSlot} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="field-grid">
            <div className="adm-field">
              <label className="adm-label">Creator Spotlight Handle *</label>
              <input name="handle" required placeholder="their-spotlight-handle" className="adm-input" />
            </div>
            <div className="adm-field">
              <label className="adm-label">Placement Type *</label>
              <select name="slot_type" required className="adm-select">
                {Object.keys(SLOT_META).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          </div>

          <div className="field-grid">
            <div className="adm-field">
              <label className="adm-label">Headline (optional)</label>
              <input name="headline" placeholder="Featured Creator" className="adm-input" />
            </div>
            <div className="adm-field">
              <label className="adm-label">Subtext (optional)</label>
              <input name="subtext" placeholder="Short description shown in the slot" className="adm-input" />
            </div>
          </div>

          <div className="field-grid-3">
            <div className="adm-field">
              <label className="adm-label">CTA Button Label</label>
              <input name="cta_label" placeholder="Visit Profile" className="adm-input" />
            </div>
            <div className="adm-field">
              <label className="adm-label">Priority (higher = first)</label>
              <input name="priority" type="number" defaultValue="0" className="adm-input" />
            </div>
          </div>

          <div className="field-grid">
            <div className="adm-field">
              <label className="adm-label">Starts At *</label>
              <input name="starts_at" type="datetime-local" required defaultValue={defaultStart} className="adm-input" />
            </div>
            <div className="adm-field">
              <label className="adm-label">Ends At *</label>
              <input name="ends_at" type="datetime-local" required defaultValue={defaultEnd} className="adm-input" />
            </div>
          </div>

          <div style={{ display: "flex", gap: 24, alignItems: "flex-end" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)", cursor: "pointer" }}>
              <input type="checkbox" name="is_paid" style={{ accentColor: "var(--spot)" }} />
              Paid placement
            </label>
            <div className="adm-field" style={{ maxWidth: 160 }}>
              <label className="adm-label">Amount Paid ($)</label>
              <input name="payment_amount" type="number" min="0" step="0.01" placeholder="0.00" className="adm-input" />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="adm-btn adm-btn--primary">Create Slot</button>
          </div>
        </form>
      </div>

      {/* Active and upcoming slots */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-title" style={{ padding: "20px 24px 16px" }}>All Slots ({(slots ?? []).length})</div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Creator</th>
              <th>Placement</th>
              <th>Headline</th>
              <th>Priority</th>
              <th>Period</th>
              <th>Paid</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(slots ?? []).length === 0 ? (
              <tr><td colSpan={8} style={{ color: "var(--muted)", padding: 24 }}>No slots yet.</td></tr>
            ) : (
              (slots ?? []).map((s: any) => {
                const active = s.is_active && new Date(s.starts_at) <= now && new Date(s.ends_at) > now;
                const upcoming = s.is_active && new Date(s.starts_at) > now;
                const expired = new Date(s.ends_at) <= now;
                return (
                  <tr key={s.id}>
                    <td>
                      <div>@{s.creator_profiles?.handle ?? "—"}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{s.creator_profiles?.display_name}</div>
                    </td>
                    <td><code style={{ fontFamily: "monospace", fontSize: 11, color: "var(--muted)" }}>{s.slot_type}</code></td>
                    <td style={{ fontSize: 12, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.headline || "—"}
                    </td>
                    <td style={{ fontSize: 12 }}>{s.priority}</td>
                    <td style={{ fontSize: 11, color: "var(--muted)" }}>
                      <div>{new Date(s.starts_at).toLocaleDateString()}</div>
                      <div>→ {new Date(s.ends_at).toLocaleDateString()}</div>
                    </td>
                    <td>
                      {s.is_paid ? (
                        <span className="badge badge--green">${parseFloat(s.payment_amount || 0).toFixed(0)}</span>
                      ) : (
                        <span className="badge badge--dim">Free</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${active ? "badge--green" : upcoming ? "badge--yellow" : expired ? "badge--dim" : "badge--red"}`}>
                        {active ? "Live" : upcoming ? "Upcoming" : expired ? "Expired" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        {s.is_active && !expired && (
                          <form action={deactivateSlot}>
                            <input type="hidden" name="id" value={s.id} />
                            <button type="submit" className="adm-btn adm-btn--ghost" style={{ padding: "5px 12px" }}>Pause</button>
                          </form>
                        )}
                        <form action={deleteSlot}>
                          <input type="hidden" name="id" value={s.id} />
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
