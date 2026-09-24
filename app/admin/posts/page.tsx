import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { executePostAction, isPostAction } from "@/lib/admin/post-moderation";
import { DAY_OPTIONS, handleMap, parseDays, resolveCreator } from "@/lib/admin/filters";

export const dynamic = "force-dynamic";

const PAGE = 48;
const when = (d: string | null) => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "·");

type SP = {
  days?: string; creator?: string; status?: string; mod?: string; lock?: string; q?: string; newcreators?: string;
  page?: string; ok?: string; err?: string;
};

async function moderate(formData: FormData) {
  "use server";
  if (!(await isAdmin())) throw new Error("Not authorized");
  const postId = String(formData.get("post_id") ?? "");
  const action = formData.get("action");
  const reason = String(formData.get("reason") ?? "");
  const back = String(formData.get("back") ?? "/admin/posts");
  const safeBack = back.startsWith("/admin/posts") ? back : "/admin/posts";
  const join = safeBack.includes("?") ? "&" : "?";
  if (!isPostAction(action)) redirect(`${safeBack}${join}err=${encodeURIComponent("Unknown action")}`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = await createServiceClient();
  const res = await executePostAction(admin, { postId, action, reason, adminEmail: user?.email ?? "unknown" });
  revalidatePath("/admin/posts");
  const clean = safeBack.replace(/([?&])(ok|err)=[^&]*/g, "$1").replace(/[?&]+$/, "");
  const j = clean.includes("?") ? "&" : "?";
  redirect(res.ok ? `${clean}${j}ok=${action}` : `${clean}${j}err=${encodeURIComponent(res.error)}`);
}

function Media({ p }: { p: any }) {
  const urls: string[] = Array.isArray(p.media_urls) && p.media_urls.length
    ? p.media_urls.map((m: any) => (typeof m === "string" ? m : m?.url)).filter(Boolean)
    : p.media_url ? [p.media_url] : [];
  if (urls.length === 0) return <div style={{ padding: 24, textAlign: "center", fontSize: 11, color: "var(--muted)", border: "1px dashed var(--border)" }}>text only</div>;
  const first = urls[0];
  const isVideo = p.media_type === "video" || /\.(mp4|webm|mov|m3u8)(\?|$)/i.test(first);
  return (
    <div>
      {isVideo
        ? <video src={first} controls preload="metadata" muted playsInline style={{ width: "100%", maxHeight: 260, background: "#000" }} />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={first} alt="" loading="lazy" style={{ width: "100%", maxHeight: 260, objectFit: "cover", display: "block" }} />}
      <div style={{ fontSize: 10, marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {urls.slice(0, 8).map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer">media {i + 1}</a>)}
        {urls.length > 8 && <span>+{urls.length - 8} more</span>}
      </div>
    </div>
  );
}

export default async function AdminPostsPage(props: { searchParams: Promise<SP> }) {
  if (!(await isAdmin())) notFound();
  const sp = await props.searchParams;
  const admin = await createServiceClient();

  const days = parseDays(sp.days, 7);
  const creator = await resolveCreator(admin, sp.creator);
  const page = Math.max(1, Number(sp.page) || 1);
  const status = sp.status ?? "all";
  const mod = sp.mod ?? "all";
  const lock = sp.lock ?? "all";
  const q = (sp.q ?? "").trim().slice(0, 100);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  let newCreatorIds: string[] | null = null;
  if (sp.newcreators === "1") {
    const { data } = await (admin as any).from("creator_profiles").select("id").gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString());
    newCreatorIds = (data ?? []).map((c: any) => c.id);
  }

  let query = (admin as any).from("posts").select("*", { count: "exact" }).gte("created_at", since);
  if (creator) query = query.eq("creator_profile_id", creator.id);
  if (newCreatorIds) query = query.in("creator_profile_id", newCreatorIds.length ? newCreatorIds : ["00000000-0000-0000-0000-000000000000"]);
  if (status === "removed") query = query.not("removed_by_admin_at", "is", null);
  else if (status !== "all") query = query.eq("status", status);
  if (mod !== "all") query = query.eq("moderation_status", mod);
  if (lock !== "all") query = query.eq("lock_type", lock);
  if (q) query = query.ilike("caption", `%${q.replace(/[%_]/g, "")}%`);
  const { data: posts, count, error } = await query.order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);

  const [{ count: pendingCount }, { count: flaggedCount }, { count: removedCount }, { count: total7d }] = await Promise.all([
    (admin as any).from("posts").select("id", { count: "exact", head: true }).eq("moderation_status", "pending"),
    (admin as any).from("posts").select("id", { count: "exact", head: true }).eq("moderation_status", "flagged"),
    (admin as any).from("posts").select("id", { count: "exact", head: true }).not("removed_by_admin_at", "is", null),
    (admin as any).from("posts").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString()),
  ]);

  const list: any[] = posts ?? [];
  const handles = await handleMap(admin, list.map((p) => p.creator_profile_id));
  const { data: creatorsInfo } = list.length
    ? await (admin as any).from("creator_profiles").select("id, display_name, created_at, kind").in("id", Array.from(new Set(list.map((p) => p.creator_profile_id).filter(Boolean))))
    : { data: [] };
  const cinfo = new Map<string, any>((creatorsInfo ?? []).map((c: any) => [c.id, c]));

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ days: String(days), creator: sp.creator, status, mod, lock, q, newcreators: sp.newcreators, page: String(page) })) {
    if (v && v !== "all") params.set(k, v);
  }
  const here = `/admin/posts?${params.toString()}`;
  const link = (over: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(over)) { if (v) p.set(k, v); else p.delete(k); }
    return `/admin/posts?${p.toString()}`;
  };

  return (
    <div>
      <div className="kicker">Content</div>
      <h1 className="adm-page-title">Every <em>post</em></h1>
      <p className="adm-page-lede">
        All posts by all creators, newest first, shown unblurred. Removing a post takes it off the public page and the
        creator cannot republish it. Nothing is deleted; every action is logged.
      </p>

      {sp.ok && <div className="adm-banner adm-banner--ok">Done: {sp.ok}.</div>}
      {sp.err && <div className="adm-banner adm-banner--err">{sp.err}</div>}
      {error && <div className="adm-banner adm-banner--err">Posts could not be read: {error.message}</div>}
      {sp.creator && !creator && <div className="adm-banner adm-banner--err">No creator matches “{sp.creator}”.</div>}

      <div className="stat-grid">
        <Link href={link({ mod: "pending", page: "" })} className="stat-card"><div className="stat-label">Not yet reviewed</div><div className="stat-value">{pendingCount ?? 0}</div></Link>
        <Link href={link({ mod: "flagged", page: "" })} className="stat-card"><div className="stat-label">Flagged</div><div className="stat-value" style={{ color: flaggedCount ? "var(--red)" : undefined }}>{flaggedCount ?? 0}</div></Link>
        <Link href={link({ status: "removed", mod: "", page: "" })} className="stat-card"><div className="stat-label">Removed</div><div className="stat-value">{removedCount ?? 0}</div></Link>
        <div className="stat-card"><div className="stat-label">Posted in 7 days</div><div className="stat-value">{total7d ?? 0}</div></div>
      </div>

      <form className="card" method="get" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label className="adm-field"><span className="adm-label">Window</span>
          <select name="days" defaultValue={String(days)} className="adm-field">
            {DAY_OPTIONS.map((d) => <option key={d} value={d}>{d === 1 ? "24 hours" : `${d} days`}</option>)}
          </select>
        </label>
        <label className="adm-field"><span className="adm-label">Creator</span>
          <input name="creator" defaultValue={sp.creator ?? ""} placeholder="@handle" className="adm-field" />
        </label>
        <label className="adm-field"><span className="adm-label">Status</span>
          <select name="status" defaultValue={status} className="adm-field">
            <option value="all">All</option><option value="live">Live</option><option value="scheduled">Scheduled</option>
            <option value="archive">Archived</option><option value="removed">Removed by admin</option>
          </select>
        </label>
        <label className="adm-field"><span className="adm-label">Review</span>
          <select name="mod" defaultValue={mod} className="adm-field">
            <option value="all">All</option><option value="pending">Not reviewed</option><option value="approved">Approved</option>
            <option value="flagged">Flagged</option><option value="blocked">Blocked</option>
          </select>
        </label>
        <label className="adm-field"><span className="adm-label">Access</span>
          <select name="lock" defaultValue={lock} className="adm-field">
            <option value="all">All</option><option value="free">Free</option><option value="subscription">Subscribers</option><option value="purchase">Pay to unlock</option>
          </select>
        </label>
        <label className="adm-field"><span className="adm-label">Caption contains</span>
          <input name="q" defaultValue={q} className="adm-field" />
        </label>
        <label className="adm-field" style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          <input type="checkbox" name="newcreators" value="1" defaultChecked={sp.newcreators === "1"} /> <span className="adm-label">Creators under 7 days old</span>
        </label>
        <button className="adm-btn adm-btn--primary" type="submit">Apply</button>
        <Link href="/admin/posts" className="adm-btn adm-btn--ghost">Reset</Link>
      </form>

      <p style={{ fontSize: 12, marginBottom: 12 }}>{count ?? 0} posts match{(count ?? 0) > PAGE ? ` · page ${page} of ${Math.ceil((count ?? 0) / PAGE)}` : ""}.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {list.map((p) => {
          const c = cinfo.get(p.creator_profile_id);
          const removed = !!p.removed_by_admin_at;
          const newCreator = c?.created_at && Date.now() - new Date(c.created_at).getTime() < 7 * 86_400_000;
          return (
            <div key={p.id} className="card" style={{ margin: 0, borderColor: removed ? "var(--red)" : p.moderation_status === "flagged" ? "var(--spot)" : undefined }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8, fontSize: 12 }}>
                <div>
                  <Link href={link({ creator: p.creator_profile_id, page: "" })}>@{handles.get(p.creator_profile_id) ?? "unknown"}</Link>
                  {" "}<Link href={`/admin/trust/${p.creator_profile_id}`} title="Trust view" style={{ opacity: 0.6 }}>⛨</Link>
                  {newCreator && <span className="badge badge--yellow" style={{ marginLeft: 6 }}>new creator</span>}
                  <div style={{ fontSize: 11, opacity: 0.7 }}>{c?.display_name ?? ""}</div>
                </div>
                <div style={{ textAlign: "right", fontSize: 11, opacity: 0.8 }}>{when(p.created_at)}</div>
              </div>

              <Media p={p} />

              {p.caption && <p style={{ fontSize: 13, margin: "10px 0", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 160, overflow: "auto" }}>{p.caption}</p>}

              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", margin: "8px 0" }}>
                <span className={`badge ${p.status === "live" ? "badge--green" : "badge--dim"}`}>{removed ? "removed" : p.status}</span>
                <span className={`badge ${p.moderation_status === "flagged" || p.moderation_status === "blocked" ? "badge--red" : p.moderation_status === "approved" ? "badge--green" : "badge--dim"}`}>{p.moderation_status ?? "unreviewed"}</span>
                <span className="badge badge--dim">{p.lock_type ?? p.tier ?? "free"}{p.unlock_price ? ` $${p.unlock_price}` : ""}</span>
                {p.content_rating && <span className={`badge ${["R", "X"].includes(p.content_rating) ? "badge--red" : "badge--dim"}`}>{p.content_rating}</span>}
                {p.post_type && p.post_type !== "post" && <span className="badge badge--dim">{p.post_type}</span>}
                {Array.isArray(p.tags) && p.tags.slice(0, 4).map((t: string) => <span key={t} className="badge badge--dim">#{t}</span>)}
              </div>
              <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 8 }}>
                {p.likes_count ?? 0} likes · <code>{String(p.id).slice(0, 8)}</code>
                {handles.get(p.creator_profile_id) && p.status === "live" && !removed && <> · <a href={`/${handles.get(p.creator_profile_id)}`} target="_blank" rel="noreferrer">public page</a></>}
              </div>
              {(p.moderation_note || p.removed_reason) && <div style={{ fontSize: 11, marginBottom: 8 }}>Note: {p.removed_reason ?? p.moderation_note}</div>}

              <form action={moderate} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <input type="hidden" name="post_id" value={p.id} />
                <input type="hidden" name="back" value={here} />
                <input name="reason" placeholder="Reason (required to flag or remove)" className="adm-field" />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {!removed && <button name="action" value="approve" className="adm-btn adm-btn--ghost">Approve</button>}
                  {!removed && <button name="action" value="flag" className="adm-btn adm-btn--ghost">Flag</button>}
                  {!removed && <button name="action" value="remove" className="adm-btn adm-btn--danger">Remove</button>}
                  {removed && <button name="action" value="restore" className="adm-btn adm-btn--ghost">Restore</button>}
                </div>
              </form>
            </div>
          );
        })}
      </div>
      {list.length === 0 && !error && <div className="card"><p>No posts match these filters.</p></div>}

      {(count ?? 0) > PAGE && (
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {page > 1 && <Link className="adm-btn adm-btn--ghost" href={link({ page: String(page - 1) })}>Newer</Link>}
          {page * PAGE < (count ?? 0) && <Link className="adm-btn adm-btn--ghost" href={link({ page: String(page + 1) })}>Older</Link>}
        </div>
      )}
    </div>
  );
}
