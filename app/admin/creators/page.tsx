import { createClient, createServiceClient } from "@/lib/supabase-server";
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

async function togglePublished(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");
  const id = formData.get("id") as string;
  const published = formData.get("published") === "true";
  const supabase = await createClient();
  await (supabase as any)
    .from("creator_profiles")
    .update({ published: !published, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/admin/creators");
}

async function createCreator(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");
  let email = ((formData.get("email") as string) || "").trim().toLowerCase();
  const handle = ((formData.get("handle") as string) || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  const displayName = ((formData.get("display_name") as string) || "").trim();
  if (!handle || !displayName) redirect("/admin/creators?err=missing");
  if (!email) email = `concierge_${handle}@spotlightly.app`;

  const admin = await createServiceClient();
  const { data: existing } = await (admin as any)
    .from("creator_profiles").select("id").eq("handle", handle).maybeSingle();
  if (existing) redirect("/admin/creators?err=handle");

  const tempPassword = "Sl" + Math.random().toString(36).slice(2, 9) + Math.floor(Math.random() * 90 + 10) + "!";
  const claimCode = (globalThis.crypto as any).randomUUID().replace(/-/g, "");
  const { data: created, error: cErr } = await (admin as any).auth.admin.createUser({
    email, password: tempPassword, email_confirm: true,
  });
  if (cErr || !created?.user) {
    const msg = (cErr as any)?.message || "auth returned no user";
    const m = msg.toLowerCase();
    const dup = m.includes("already") || m.includes("registered") || m.includes("exists");
    redirect(`/admin/creators?err=${dup ? "email" : "auth"}&detail=${encodeURIComponent(String(msg).slice(0, 160))}`);
  }

  const { error: pErr } = await (admin as any).from("creator_profiles").insert({
    user_id: created.user.id, handle, display_name: displayName,
    creator_type: "spotlight", kind: "spotlight", published: false,
    claim_code: claimCode,
  });
  if (pErr) {
    try { await (admin as any).auth.admin.deleteUser(created.user.id); } catch {}
    redirect(`/admin/creators?err=profile&detail=${encodeURIComponent(((pErr as any).message || "").slice(0, 140))}`);
  }

  revalidatePath("/admin/creators");
  redirect(`/admin/creators?created=${encodeURIComponent(handle)}&temp=${encodeURIComponent(tempPassword)}&email=${encodeURIComponent(email)}&claim=${encodeURIComponent(claimCode)}`);
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
  const created = (sp as any).created as string | undefined;
  const tempPw = (sp as any).temp as string | undefined;
  const createdEmail = (sp as any).email as string | undefined;
  const errCode = (sp as any).err as string | undefined;
  const detail = (sp as any).detail as string | undefined;
  const claimCodeParam = (sp as any).claim as string | undefined;

  const supabase = await createClient();
  let query = (supabase as any)
    .from("creator_profiles")
    .select("id, handle, display_name, kind, creator_type, is_active, veriff_verified, subscription_price, stripe_account_id, published, created_at", { count: "exact" })
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

      {created && (
        <div className="adm-banner adm-banner--ok" style={{ marginBottom: 20, lineHeight: 1.8 }}>
          <strong style={{ display: "block", marginBottom: 6 }}>Preview created for @{created}</strong>
          Send them this to claim it (they set their own email and password):<br />
          <a href={`/claim/${claimCodeParam}`} target="_blank" style={{ color: "var(--spot)", wordBreak: "break-all" }}>spotlightly.app/claim/{claimCodeParam}</a>
          <br /><br />
          To build the page yourself first, log in as them with email <code>{createdEmail}</code> and temp password <code>{tempPw}</code>.<br />
          Preview link (not in Explore yet): <a href={`/${created}`} target="_blank" style={{ color: "var(--spot)" }}>spotlightly.app/{created}</a><br />
          When ready, hit Go live on their row below.
        </div>
      )}
      {errCode && (
        <div className="adm-banner adm-banner--err" style={{ marginBottom: 20 }}>
          {errCode === "handle" ? "That handle is taken."
            : errCode === "missing" ? "Handle and display name are required."
            : (
              <>
                <strong>Create failed (code: {errCode}).</strong>
                {detail ? <><br />Reason: {detail}</> : null}
                <br />
                {/claim_code|published|column/i.test(detail || "") ? "That column is missing, so run the latest migration (037 and 038) in Supabase." :
                 errCode === "email" ? "That email already has an account. Use a different email, or delete the old login in Supabase Authentication." :
                 "Check Supabase migrations 037 and 038 have run, and that there is no leftover login on this handle in Authentication."}
              </>
            )}
        </div>
      )}

      <details className="card" style={{ marginBottom: 20 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Create a creator (concierge)</summary>
        <form action={createCreator} style={{ display: "grid", gap: 10, marginTop: 14, maxWidth: 420 }}>
          <input name="email" type="email" placeholder="Their email (optional, add later)" className="adm-input" />
          <input name="handle" placeholder="handle (no @)" className="adm-input" required />
          <input name="display_name" placeholder="Display name" className="adm-input" required />
          <button type="submit" className="adm-btn adm-btn--primary">Create preview account</button>
        </form>
      </details>

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
                      <form action={togglePublished}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="published" value={String(c.published)} />
                        <button
                          type="submit"
                          className={`adm-btn ${c.published ? "adm-btn--ghost" : "adm-btn--primary"}`}
                          style={{ padding: "5px 12px" }}
                        >
                          {c.published ? "Unpublish" : "Go live"}
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
                        href={`/${c.handle}`}
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
