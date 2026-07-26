import { createServiceClient } from "@/lib/supabase-server";
import ClaimLinkButton from "./ClaimLinkButton";
import { isAdmin } from "@/lib/admin";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { claimExpiryFrom, generateClaimCode } from "@/lib/claim";
import { createConciergeCreator } from "@/lib/concierge-create";

async function toggleActive(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";
  const supabase = await createServiceClient();
  const { error } = await (supabase as any)
    .from("creator_profiles")
    .update({ is_active: !active, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/creators");
}

async function toggleVerified(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");
  const id = formData.get("id") as string;
  const verified = formData.get("verified") === "true";
  const supabase = await createServiceClient();
  const { error } = await (supabase as any)
    .from("creator_profiles")
    .update({ veriff_verified: !verified, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/creators");
}

async function togglePublished(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");
  const id = formData.get("id") as string;
  const published = formData.get("published") === "true";
  const supabase = await createServiceClient();
  const { error } = await (supabase as any)
    .from("creator_profiles")
    .update({ published: !published, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/creators");
}

async function createCreator(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");
  const email = ((formData.get("email") as string) || "").trim().toLowerCase();
  const handle = ((formData.get("handle") as string) || "").trim();
  const displayName = ((formData.get("display_name") as string) || "").trim();

  // Shared with the prospect pipeline (lib/concierge-create.ts) so both
  // routes into a prepared page use one implementation and one rollback.
  const result = await createConciergeCreator({ handle, displayName, email });

  if (!result.ok) {
    const map: Record<string, string> = {
      missing_fields: "missing", handle_taken: "handle",
      email_taken: "email", auth_failed: "auth", profile_failed: "profile",
    };
    const code = map[result.error ?? ""] ?? "auth";
    const detail = result.detail ? `&detail=${encodeURIComponent(result.detail.slice(0, 160))}` : "";
    redirect(`/admin/creators?err=${code}${detail}`);
  }

  revalidatePath("/admin/creators");
  redirect(`/admin/creators?created=${encodeURIComponent(result.handle ?? "")}&id=${result.profileId ?? ""}`);
}

async function regenClaim(formData: FormData) {
  "use server";
  if (!(await isAdmin())) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  const admin = await createServiceClient();
  const code = generateClaimCode();
  await (admin as any).from("creator_profiles")
    .update({ claim_code: code, claimed_at: null, claim_expires_at: claimExpiryFrom() })
    .eq("id", id);
  revalidatePath("/admin/creators");
  redirect("/admin/creators?relink=1");
}

async function updateSubPrice(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");
  const id = formData.get("id") as string;
  const price = parseFloat(formData.get("price") as string);
  if (isNaN(price) || price < 0) return;
  const supabase = await createServiceClient();
  const { error } = await (supabase as any)
    .from("creator_profiles")
    .update({ subscription_price: price, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
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
  const createdId = (sp as any).id as string | undefined;
  const relink = (sp as any).relink as string | undefined;
  const errCode = (sp as any).err as string | undefined;
  const detail = (sp as any).detail as string | undefined;

  // Service client, not the cookie/anon client: this query selects claim_code,
  // a live bearer secret. Reading it through the anon client would mean the
  // rows are only protected by creator_profiles' RLS policy — which is not
  // defined in any migration in this repo and therefore cannot be relied on.
  // The isAdmin() gate above is what authorises this read.
  const supabase = await createServiceClient();
  let query = (supabase as any)
    .from("creator_profiles")
    .select("id, handle, display_name, kind, creator_type, is_active, veriff_verified, subscription_price, stripe_account_id, published, claim_code, claimed_at, claim_expires_at, created_at", { count: "exact" })
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
      <p className="adm-page-lede">Create concierge accounts, build their pages, and manage every creator.</p>

      {created && (
        <div className="adm-banner adm-banner--ok" style={{ marginBottom: 24, lineHeight: 1.7 }}>
          <strong>Preview account created for @{created}.</strong> Build their page, then send the claim link (it is on the Build page and on their row below). Go live when ready.
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {createdId && (
              <a href={`/admin/creators/${createdId}/build`} className="adm-btn adm-btn--primary" style={{ padding: "6px 14px" }}>Build their page →</a>
            )}
            <a href={`/${created}`} target="_blank" className="adm-btn adm-btn--ghost" style={{ padding: "6px 14px" }}>Preview</a>
          </div>
        </div>
      )}
      {relink && (
        <div className="adm-banner adm-banner--ok" style={{ marginBottom: 24 }}>
          New claim link generated. Copy it from the creator&apos;s row below, then send it to them. The old link (if any) no longer works.
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

      <details className="card" style={{ marginBottom: 24, padding: "16px 20px" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 15 }}>+ Create a creator (concierge)</summary>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "10px 0 0" }}>
          Makes a preview account you build from here. Email is optional, they set their own when they claim it.
        </p>
        <form action={createCreator} style={{ display: "grid", gap: 10, marginTop: 14, maxWidth: 420 }}>
          <input name="email" type="email" placeholder="Their email (optional)" className="adm-input" />
          <input name="handle" placeholder="Handle (no @)" className="adm-input" required />
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
                      <a
                        href={`/admin/creators/${c.id}`}
                        className="adm-btn adm-btn--ghost"
                        style={{ padding: "5px 12px" }}
                      >
                        Details
                      </a>
                      <a
                        href={`/admin/creators/${c.id}/build`}
                        className="adm-btn adm-btn--ghost"
                        style={{ padding: "5px 12px" }}
                      >
                        Build
                      </a>
                      {c.claimed_at ? (
                        <>
                          <span style={{ fontSize: 11, color: "var(--accent-open)", alignSelf: "center" }}>Claimed</span>
                          <form action={regenClaim}>
                            <input type="hidden" name="id" value={c.id} />
                            <button type="submit" className="adm-btn adm-btn--ghost" style={{ padding: "5px 12px" }} title="Issue a fresh link so they can re-claim with a new email/password">Re-issue link</button>
                          </form>
                        </>
                      ) : c.claim_code ? (
                        <>
                          <ClaimLinkButton code={c.claim_code} />
                          <form action={regenClaim}>
                            <input type="hidden" name="id" value={c.id} />
                            <button type="submit" className="adm-btn adm-btn--ghost" style={{ padding: "5px 12px" }} title="Generate a new link, invalidates the old one">New</button>
                          </form>
                        </>
                      ) : (
                        <form action={regenClaim}>
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit" className="adm-btn adm-btn--primary" style={{ padding: "5px 12px" }}>Generate claim link</button>
                        </form>
                      )}
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
