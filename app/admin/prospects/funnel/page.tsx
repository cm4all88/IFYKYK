import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { loadFunnelInput } from "@/lib/prospects-db";
import { buildFunnel } from "@/lib/acquisition";

export const dynamic = "force-dynamic";
export const metadata = { title: "Acquisition funnel · Spotlightly Admin" };

export default async function FunnelPage() {
  if (!(await isAdmin())) notFound();

  const prospects = await loadFunnelInput();
  const funnel = buildFunnel(prospects.map((p) => p.activation));
  const total = prospects.length;

  const sources = new Map<string, { total: number; joined: number }>();
  for (const p of prospects) {
    const e = sources.get(p.source) ?? { total: 0, joined: 0 };
    e.total++;
    if (p.activation.reached.joined) e.joined++;
    sources.set(p.source, e);
  }

  const overdue = prospects.filter(
    (p) => p.follow_up_at && new Date(p.follow_up_at) <= new Date() && !p.activation.reached.joined
  );

  return (
    <div>
      <p className="kicker">
        <Link href="/admin/prospects" style={{ color: "inherit" }}>← All prospects</Link>
      </p>
      <h1 className="adm-page-title">Acquisition <em>funnel.</em></h1>
      <p className="adm-page-lede">
        {total} active prospect{total === 1 ? "" : "s"}, excluding disqualified. Every stage from
        &ldquo;Joined&rdquo; onward is derived from the creator&apos;s real account — claimed date,
        onboarding, Stripe status, published posts and live tiers — never set by hand.
      </p>

      {total === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.45)", marginTop: 24 }}>
          No prospects yet. <Link href="/admin/prospects" style={{ color: "#f5c842" }}>Add the first one →</Link>
        </p>
      ) : (
        <>
          <section style={card}>
            {funnel.map((row) => (
              <div key={row.milestone} style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.85)" }}>{row.label}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                    {row.count} · {row.percent_of_total}%
                    {row.conversion_from_previous !== null ? ` · ${row.conversion_from_previous}% step` : ""}
                  </span>
                </div>
                <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                  <div style={{ width: `${row.percent_of_total}%`, height: "100%", background: "#f5c842" }} />
                </div>
              </div>
            ))}
          </section>

          <section style={card}>
            <h2 style={h2}>By source</h2>
            <table className="adm-table" style={{ marginTop: 12 }}>
              <thead><tr><th>Source</th><th>Prospects</th><th>Joined</th><th>Rate</th></tr></thead>
              <tbody>
                {Array.from(sources.entries())
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([source, s]) => (
                    <tr key={source}>
                      <td>{source}</td>
                      <td>{s.total}</td>
                      <td>{s.joined}</td>
                      <td>{s.total === 0 ? "—" : `${Math.round((s.joined / s.total) * 100)}%`}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>

          {overdue.length > 0 ? (
            <section style={card}>
              <h2 style={h2}>Follow-ups due</h2>
              <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 8 }}>
                {overdue.slice(0, 25).map((p) => (
                  <li key={p.id} style={{ fontSize: 14 }}>
                    <Link href={`/admin/prospects/${p.id}`} style={{ color: "#f5c842", textDecoration: "none" }}>
                      {p.display_name}
                    </Link>
                    <span style={{ color: "rgba(255,255,255,0.45)" }}>
                      {" "}— due {new Date(p.follow_up_at!).toLocaleDateString("en-US")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  margin: "24px 0", padding: "22px 24px", borderRadius: 12,
  background: "#111118", border: "1px solid rgba(255,255,255,0.07)",
};
const h2: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: 22, margin: 0, color: "#fff" };
