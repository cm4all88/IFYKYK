import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase-server";
import { loadTransactions, summarizeTransactions, TXN_TYPES } from "@/lib/admin/transactions";
import { DAY_OPTIONS, handleMap, isUuid, parseDays, parseTxnTypes, resolveCreator } from "@/lib/admin/filters";

export const dynamic = "force-dynamic";

const PAGE = 200;
const money = (v: number) => `$${v.toFixed(2)}`;
const when = (d: string) => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "·");

type SP = { days?: string; type?: string; creator?: string; fan?: string; settled?: string; page?: string };

export default async function TransactionsPage(props: { searchParams: Promise<SP> }) {
  if (!(await isAdmin())) notFound();
  const sp = await props.searchParams;
  const admin = await createServiceClient();

  const days = parseDays(sp.days);
  const types = parseTxnTypes(sp.type);
  const creator = await resolveCreator(admin, sp.creator);
  const fan = isUuid(sp.fan) ? sp.fan : null;
  const settledFilter = sp.settled === "yes" || sp.settled === "no" ? sp.settled : "all";
  const page = Math.max(1, Number(sp.page) || 1);

  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { rows: all, failures, truncated } = await loadTransactions(admin, {
    sinceIso: since, types, creatorProfileId: creator?.id ?? null, fanUserId: fan,
  });
  const rows = all.filter((r) => settledFilter === "all" || (settledFilter === "yes" ? r.settled : !r.settled));
  const { byType, all: totals } = summarizeTransactions(rows);
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);
  const handles = await handleMap(admin, shown.map((r) => r.creator_profile_id));

  const qs = (over: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged = { days: String(days), type: sp.type ?? "", creator: sp.creator ?? "", fan: sp.fan ?? "", settled: settledFilter, ...over };
    for (const [k, v] of Object.entries(merged)) if (v && v !== "all") p.set(k, String(v));
    return `?${p.toString()}`;
  };

  return (
    <div>
      <div className="kicker">Money</div>
      <h1 className="adm-page-title">All <em>transactions</em></h1>
      <p className="adm-page-lede">
        Every fan payment across every product, newest first. Totals count settled money only; pending, expired,
        refunded and disputed rows are listed but not totalled. Amounts are before the card fee the fan covers.
      </p>

      {creator === null && sp.creator && <div className="adm-banner adm-banner--err">No creator matches “{sp.creator}”.</div>}
      {failures.map((f) => (
        <div key={f.type} className="adm-banner adm-banner--err">{f.label} could not be read: {f.message}. Totals below exclude it.</div>
      ))}
      {truncated.length > 0 && (
        <div className="adm-banner adm-banner--err">Showing the newest 500 rows for: {truncated.join(", ")}. Narrow the window or filter by creator for the rest.</div>
      )}

      <form className="card" method="get" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label className="adm-field"><span className="adm-label">Window</span>
          <select name="days" defaultValue={String(days)} className="adm-field">
            {DAY_OPTIONS.map((d) => <option key={d} value={d}>{d === 1 ? "24 hours" : `${d} days`}</option>)}
          </select>
        </label>
        <label className="adm-field"><span className="adm-label">Type</span>
          <select name="type" defaultValue={sp.type ?? ""} className="adm-field">
            <option value="">All types</option>
            {TXN_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
          </select>
        </label>
        <label className="adm-field"><span className="adm-label">Creator (@handle or id)</span>
          <input name="creator" defaultValue={sp.creator ?? ""} className="adm-field" placeholder="@handle" />
        </label>
        <label className="adm-field"><span className="adm-label">Fan user id</span>
          <input name="fan" defaultValue={sp.fan ?? ""} className="adm-field" placeholder="uuid" />
        </label>
        <label className="adm-field"><span className="adm-label">Settled</span>
          <select name="settled" defaultValue={settledFilter} className="adm-field">
            <option value="all">All</option><option value="yes">Settled only</option><option value="no">Unsettled only</option>
          </select>
        </label>
        <button type="submit" className="adm-btn adm-btn--primary">Apply</button>
        <Link href="/admin/transactions" className="adm-btn adm-btn--ghost">Reset</Link>
        <a href={`/api/admin/transactions/export${qs({})}`} className="adm-btn adm-btn--ghost">Download CSV</a>
      </form>

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-label">Fan spend (settled)</div><div className="stat-value">{money(totals.gross)}</div><div className="stat-sub">{totals.settledCount} of {totals.count} rows</div></div>
        <div className="stat-card"><div className="stat-label">To creators</div><div className="stat-value">{money(totals.creatorNet)}</div></div>
        <div className="stat-card"><div className="stat-label">Platform revenue</div><div className="stat-value" style={{ color: "var(--spot)" }}>{money(totals.platform)}</div></div>
        <div className="stat-card"><div className="stat-label">Unsettled rows</div><div className="stat-value">{totals.count - totals.settledCount}</div><div className="stat-sub">pending, expired, refunded, disputed</div></div>
      </div>

      <div className="card">
        <div className="card-title">By product</div>
        <table className="adm-table">
          <thead><tr><th>Product</th><th>Rows</th><th>Settled</th><th>Fan spend</th><th>To creators</th><th>Platform</th></tr></thead>
          <tbody>
            {byType.filter((t) => t.count > 0).map((t) => (
              <tr key={t.type}>
                <td><Link href={qs({ type: t.type, page: "1" })}>{t.label}</Link></td>
                <td>{t.count}</td><td>{t.settledCount}</td><td>{money(t.gross)}</td><td>{money(t.creatorNet)}</td><td>{money(t.platform)}</td>
              </tr>
            ))}
            {totals.count === 0 && <tr><td colSpan={6} style={{ color: "var(--muted)" }}>No transactions in this window.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title">Ledger · {rows.length} rows{rows.length > PAGE ? ` · page ${page} of ${Math.ceil(rows.length / PAGE)}` : ""}</div>
        <div style={{ overflowX: "auto" }}>
          <table className="adm-table">
            <thead><tr><th>When (UTC)</th><th>Type</th><th>Creator</th><th>Fan</th><th>Gross</th><th>Creator</th><th>Platform</th><th>Status</th><th>Stripe</th><th>Note</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.key} style={r.settled ? undefined : { opacity: 0.6 }}>
                  <td style={{ whiteSpace: "nowrap" }}>{when(r.created_at)}</td>
                  <td>{TXN_TYPES.find((t) => t.type === r.type)?.label ?? r.type}</td>
                  <td>
                    {r.creator_profile_id ? (
                      <>
                        <Link href={qs({ creator: r.creator_profile_id, page: "1" })}>@{handles.get(r.creator_profile_id) ?? r.creator_profile_id.slice(0, 8)}</Link>
                        {" "}<Link href={`/admin/trust/${r.creator_profile_id}`} title="Trust view" style={{ opacity: 0.6 }}>⛨</Link>
                      </>
                    ) : <span style={{ color: "var(--muted)" }}>platform</span>}
                  </td>
                  <td>
                    {r.fan_user_id
                      ? <Link href={qs({ fan: r.fan_user_id, page: "1" })}><code>{r.fan_user_id.slice(0, 8)}</code></Link>
                      : null}
                    {r.fan_label && <div style={{ fontSize: 11, opacity: 0.7 }}>{r.fan_label}</div>}
                  </td>
                  <td>{money(r.gross)}</td>
                  <td>{money(r.creator_net)}</td>
                  <td>{money(r.platform)}</td>
                  <td><span className={`badge ${r.settled ? "badge--green" : ["disputed", "dispute_lost", "refunded", "failed"].includes(r.status) ? "badge--red" : "badge--dim"}`}>{r.status}</span></td>
                  <td><code style={{ fontSize: 10 }}>{r.stripe_ref ?? "·"}</code></td>
                  <td style={{ fontSize: 11, maxWidth: 220 }}>{r.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > PAGE && (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {page > 1 && <Link className="adm-btn adm-btn--ghost" href={qs({ page: String(page - 1) })}>Newer</Link>}
            {page * PAGE < rows.length && <Link className="adm-btn adm-btn--ghost" href={qs({ page: String(page + 1) })}>Older</Link>}
          </div>
        )}
      </div>
    </div>
  );
}
