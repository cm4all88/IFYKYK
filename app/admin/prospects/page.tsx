import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { listPendingApprovals, listProspects } from "@/lib/prospects-db";
import { PROSPECT_PLATFORMS, PROSPECT_SOURCES, PROSPECT_STAGES } from "@/lib/prospects";
import ProspectCreateForm from "./ProspectCreateForm";
import ProspectImport from "./ProspectImport";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prospects · Spotlightly Admin" };

const STAGE_LABELS: Record<string, string> = {
  identified: "Identified",
  qualified: "Qualified",
  contacted: "Contacted",
  replied: "Replied",
  page_built: "Page built",
  invited: "Invited",
  joined: "Joined",
  disqualified: "Disqualified",
};

export default async function ProspectsPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (!(await isAdmin())) notFound();
  const sp = await props.searchParams;

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const perPage = 50;

  const [{ rows, total }, pending] = await Promise.all([
    listProspects({
      q: sp.q, stage: sp.stage, source: sp.source, platform: sp.platform, dnc: sp.dnc, page, perPage,
    }),
    listPendingApprovals(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...over })) if (v) p.set(k, v);
    return `?${p.toString()}`;
  };

  return (
    <div>
      <p className="kicker">Admin · Acquisition</p>
      <h1 className="adm-page-title">Creator <em>prospects.</em></h1>
      <p className="adm-page-lede">
        People we&apos;ve identified as potential creators. Nobody here has an account or a page
        until you build one — adding a prospect sends nothing and creates nothing public.
      </p>

      {pending.length > 0 ? (
        <div style={{ margin: "20px 0", padding: "14px 18px", borderRadius: 10, background: "rgba(245,200,66,0.07)", border: "1px solid rgba(245,200,66,0.25)" }}>
          <strong style={{ color: "#f5c842" }}>{pending.length} message{pending.length === 1 ? "" : "s"} awaiting your approval.</strong>{" "}
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
            Nothing is sent until you approve it.{" "}
            {pending.slice(0, 3).map((p, i) => (
              <span key={p.id}>
                {i > 0 ? ", " : ""}
                <Link href={`/admin/prospects/${p.prospect_id}`} style={{ color: "#f5c842" }}>{p.prospect_name}</Link>
              </span>
            ))}
            {pending.length > 3 ? ` and ${pending.length - 3} more` : ""}.
          </span>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "20px 0" }}>
        <Link href="/admin/prospects/funnel" className="adm-btn">View funnel →</Link>
      </div>

      {/* ── Filters ─────────────────────────────────────────────── */}
      <form method="get" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", margin: "24px 0" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={lbl}>Search</span>
          <input name="q" defaultValue={sp.q ?? ""} placeholder="name, email, handle, niche" style={input} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={lbl}>Stage</span>
          <select name="stage" defaultValue={sp.stage ?? ""} style={input}>
            <option value="">All</option>
            {PROSPECT_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={lbl}>Platform</span>
          <select name="platform" defaultValue={sp.platform ?? ""} style={input}>
            <option value="">All</option>
            {PROSPECT_PLATFORMS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={lbl}>Source</span>
          <select name="source" defaultValue={sp.source ?? ""} style={input}>
            <option value="">All</option>
            {PROSPECT_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 8 }}>
          <input type="checkbox" name="dnc" value="1" defaultChecked={sp.dnc === "1"} />
          <span style={lbl}>Do-not-contact only</span>
        </label>
        <button type="submit" className="adm-btn">Filter</button>
        <Link href="/admin/prospects" className="adm-btn">Reset</Link>
      </form>

      <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, margin: "0 0 12px" }}>
        {total} prospect{total === 1 ? "" : "s"}
      </p>

      {/* ── Table ───────────────────────────────────────────────── */}
      <div style={{ overflowX: "auto" }}>
        <table className="adm-table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>Name</th><th>Platform</th><th>Niche</th><th>Followers</th>
              <th>Source</th><th>Stage</th><th>Progress</th><th>Follow-up</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} style={{ color: "rgba(255,255,255,0.4)", padding: "24px 0" }}>
                No prospects match. Add one below, or import a CSV.
              </td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/admin/prospects/${r.id}`} style={{ color: "#f5c842", textDecoration: "none" }}>
                    {r.display_name}
                  </Link>
                  {r.do_not_contact ? <span title="Do not contact" style={pill("#ff6b6b")}>DNC</span> : null}
                  {r.opted_out_at ? <span title="Unsubscribed" style={pill("#ff9f43")}>opted out</span> : null}
                </td>
                <td style={{ color: "rgba(255,255,255,0.6)" }}>
                  {r.platform ?? "—"}{r.platform_handle ? ` @${r.platform_handle}` : ""}
                </td>
                <td style={{ color: "rgba(255,255,255,0.6)" }}>{r.niche ?? "—"}</td>
                <td style={{ color: "rgba(255,255,255,0.6)" }}>
                  {r.follower_count == null ? "—" : r.follower_count.toLocaleString("en-US")}
                </td>
                <td style={{ color: "rgba(255,255,255,0.6)" }}>{r.source}</td>
                <td>{STAGE_LABELS[r.stage] ?? r.stage}</td>
                <td style={{ minWidth: 110 }}>
                  <div title={`Furthest: ${r.activation.furthest}`} style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,0.08)" }}>
                    <div style={{ width: `${r.activation.percent}%`, height: "100%", borderRadius: 4, background: "#f5c842" }} />
                  </div>
                </td>
                <td style={{ color: "rgba(255,255,255,0.6)" }}>
                  {r.follow_up_at ? new Date(r.follow_up_at).toLocaleDateString("en-US") : "—"}
                </td>
                <td>
                  <Link href={`/admin/prospects/${r.id}`} className="adm-btn">Open</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div style={{ display: "flex", gap: 10, margin: "18px 0" }}>
          {page > 1 ? <Link href={qs({ page: String(page - 1) })} className="adm-btn">← Previous</Link> : null}
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, alignSelf: "center" }}>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? <Link href={qs({ page: String(page + 1) })} className="adm-btn">Next →</Link> : null}
        </div>
      ) : null}

      <hr style={{ border: 0, borderTop: "1px solid rgba(255,255,255,0.07)", margin: "40px 0" }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 32 }}>
        <ProspectCreateForm />
        <ProspectImport />
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = {
  fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em",
  textTransform: "uppercase", color: "rgba(255,255,255,0.4)",
};
const input: React.CSSProperties = {
  background: "#111118", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6,
  color: "#e8e8f0", padding: "8px 10px", fontSize: 13, minWidth: 150,
};
function pill(color: string): React.CSSProperties {
  return {
    marginLeft: 8, fontSize: 9, fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em",
    textTransform: "uppercase", color, border: `1px solid ${color}`, borderRadius: 4, padding: "1px 5px",
  };
}
