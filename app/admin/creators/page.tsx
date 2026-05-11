import { createClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function toggleActive(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";
  const supabase = await createClient();
  await (supabase as any)
    .from("creator_profiles")
    .update({ is_active: !active, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/admin/creators");
}

async function toggleVerified(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");
  const id = formData.get("id") as string;
  const verified = formData.get("verified") === "true";
  const supabase = await createClient();
  await (supabase as any)
    .from("creator_profiles")
    .update({ veriff_verified: !verified, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/admin/creators");
}

async function updateSubPrice(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");
  const id = formData.get("id") as string;
  const price = parseFloat(formData.get("price") as string);
  if (isNaN(price) || price < 0) return;
  const supabase = await createClient();
  await (supabase as any)
    .from("creator_profiles")
    .update({ subscription_price: price, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/admin/creators");
}

export default async function CreatorsPage(props: {
  searchParams: Promise<{ q?: string; kind?: string; page?: string }>;
}) {
  if (!(await isAdmin())) notFound();
  const sp = await props.searchParams;
  const q = sp.q ?? "";
  const kind = sp.kind ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1"));
  const perPage = 25;

  const supabase = await createClient();
  let query = (supabase as any)
    .from("creator_profiles")
    .select("id, handle, display_name, kind, creator_type, is_active, veriff_verified, subscription_price, stripe_account_id, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (q) query = query.or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`);
  if (kind) query = query.eq("kind", kind);

  const { data: creators, count } = await query;
  const totalPages = Math.ceil((count ?? 0) / perPage);

  return (
    <div>
      <p className="kicker">Admin · Creators</p>
      <h1 className="adm-page-title">Creator <em>Management.</em></h1>
      <p className="adm-page-lede">Search, ban, verify, and adjust subscription prices for any creator.</p>

      {/* Filters */}
      <form method="GET" style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input name="q" defaultValue={q} placeholder="Search handle or name…" className="adm-input" style={{ maxWidth: 260 }} />
        <select name="kind" defaultValue={kind} className="adm-select" style={{ maxWidth: 160 }}>
          <option value="">All types</option>
          <option value="spotlight">Spotlight</option>
          <option value="backstage">Backstage</option>
        </select>
        <button type="submit" className="adm-btn adm-btn--ghost">Filter</button>
        {(q || kind) && <a href="/admin/creators" className="adm-btn adm-btn--ghost">Clear</a>}
      </form>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Handle</th>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Verified</th>
              <th>Sub Price</th>
              <th>Stripe</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(creators ?? []).length === 0 ? (
              <tr><td colSpan={9} style={{ color: "var(--muted)", padding: 24 }}>No creators found.</td></tr>
            ) : (
              (creators ?? []).map((c: any) => (
                <tr key={c.id}>
                  <td>@{c.handle}</td>
                  <td style={{ color: "var(--muted)" }}>{c.display_name}</td>
                  <td>
                    <span className={`badge ${c.kind === "backstage" ? "badge--purple" : "badge--yellow"}`}>
                      {c.kind}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${c.is_active ? "badge--green" : "badge--red"}`}>
                      {c.is_active ? "Active" : "Banned"}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${c.veriff_verified ? "badge--green" : "badge--dim"}`}>
                      {c.veriff_verified ? "Verified" : "Unverified"}
                    </span>
                  </td>
                  <td>
                    <form action={updateSubPrice} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input type="hidden" name="id" value={c.id} />
                      <input
                        name="price"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={c.subscription_price ?? 9.99}
                        className="adm-input"
                        style={{ width: 80, padding: "6px 8px", fontSize: 12 }}
                      />
                      <button type="submit" className="adm-btn adm-btn--ghost" style={{ padding: "6px 10px", fontSize: 10 }}>Set</button>
                    </form>
                  </td>
                  <td style={{ fontSize: 11 }}>
                    <span className={`badge ${c.stripe_account_id ? "badge--green" : "badge--dim"}`}>
                      {c.stripe_account_id ? "Connected" : "None"}
                    </span>
                  </td>
                  <td style={{ color: "var(--muted)", fontSize: 11 }}>
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div className="row-actions">
                      <form action={toggleActive}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="active" value={String(c.is_active)} />
                        <button
                          type="submit"
                          className={`adm-btn ${c.is_active ? "adm-btn--danger" : "adm-btn--ghost"}`}
                          style={{ padding: "5px 12px" }}
                        >
                          {c.is_active ? "Ban" : "Unban"}
                        </button>
                      </form>
                      {!c.veriff_verified && (
                        <form action={toggleVerified}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="verified" value="false" />
                          <button type="submit" className="adm-btn adm-btn--ghost" style={{ padding: "5px 12px" }}>
                            Verify
                          </button>
                        </form>
                      )}
                      <a
                        href={`/c/${c.handle}`}
                        target="_blank"
                        className="adm-btn adm-btn--ghost"
                        style={{ padding: "5px 12px" }}
                      >
                        View ↗
                      </a>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          {page > 1 && (
            <a href={`/admin/creators?q=${q}&kind=${kind}&page=${page - 1}`} className="adm-btn adm-btn--ghost">← Prev</a>
          )}
          <span style={{ color: "var(--muted)", fontSize: 12, alignSelf: "center" }}>
            Page {page} of {totalPages} ({count} total)
          </span>
          {page < totalPages && (
            <a href={`/admin/creators?q=${q}&kind=${kind}&page=${page + 1}`} className="adm-btn adm-btn--ghost">Next →</a>
          )}
        </div>
      )}
    </div>
  );
}
