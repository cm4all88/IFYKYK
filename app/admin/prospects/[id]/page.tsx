import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { getProspect, listOutreach } from "@/lib/prospects-db";
import { ACQUISITION_MILESTONES, MILESTONE_LABELS } from "@/lib/acquisition";
import ProspectControls from "./ProspectControls";
import OutreachComposer from "./OutreachComposer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prospect · Spotlightly Admin" };

export default async function ProspectDetailPage(props: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) notFound();
  const { id } = await props.params;

  const prospect = await getProspect(id);
  if (!prospect) notFound();

  const outreach = await listOutreach(id);
  const a = prospect.activation;

  return (
    <div>
      <p className="kicker">
        <Link href="/admin/prospects" style={{ color: "inherit" }}>← All prospects</Link>
      </p>
      <h1 className="adm-page-title">{prospect.display_name}</h1>
      <p className="adm-page-lede">
        {prospect.platform ? `${prospect.platform}` : "No platform recorded"}
        {prospect.platform_handle ? ` · @${prospect.platform_handle}` : ""}
        {prospect.niche ? ` · ${prospect.niche}` : ""}
        {prospect.follower_count != null ? ` · ${prospect.follower_count.toLocaleString("en-US")} followers` : ""}
      </p>

      {/* ── Activation ─────────────────────────────────────────── */}
      <section style={card}>
        <h2 style={h2}>Progress</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {ACQUISITION_MILESTONES.map((m) => {
            const done = a.reached[m];
            return (
              <span key={m} style={{
                fontSize: 12, padding: "5px 11px", borderRadius: 999,
                border: `1px solid ${done ? "#f5c842" : "rgba(255,255,255,0.15)"}`,
                color: done ? "#f5c842" : "rgba(255,255,255,0.4)",
                background: done ? "rgba(245,200,66,0.08)" : "transparent",
              }}>
                {done ? "✓ " : ""}{MILESTONE_LABELS[m]}
              </span>
            );
          })}
        </div>
        <p style={{ ...meta, marginTop: 14 }}>
          {a.percent}% through the funnel. Everything from &ldquo;Joined&rdquo; onward is read from the
          creator&apos;s real account, not set by hand.
          {prospect.profile ? null : " No page has been built yet."}
        </p>
      </section>

      {/* ── Details ────────────────────────────────────────────── */}
      <section style={card}>
        <h2 style={h2}>Details</h2>
        <dl style={dl}>
          <Row k="Email" v={prospect.email ?? "—"} />
          <Row k="Profile URL" v={prospect.profile_url ? <a href={prospect.profile_url} target="_blank" rel="noreferrer noopener" style={link}>{prospect.profile_url}</a> : "—"} />
          <Row k="Location" v={prospect.location ?? "—"} />
          <Row k="Source" v={`${prospect.source}${prospect.source_detail ? ` · ${prospect.source_detail}` : ""}`} />
          <Row k="Score" v={prospect.score == null ? "—" : String(prospect.score)} />
          <Row k="Follow up" v={prospect.follow_up_at ? new Date(prospect.follow_up_at).toLocaleDateString("en-US") : "—"} />
          <Row k="Wanted handle" v={prospect.handle_wanted ?? "—"} />
          <Row k="Added" v={new Date(prospect.created_at).toLocaleString("en-US")} />
          {prospect.disqualified_reason ? <Row k="Disqualified" v={prospect.disqualified_reason} /> : null}
          {prospect.notes ? <Row k="Notes" v={prospect.notes} /> : null}
        </dl>
      </section>

      <ProspectControls
        id={prospect.id}
        stage={prospect.stage}
        doNotContact={prospect.do_not_contact}
        optedOutAt={prospect.opted_out_at}
        handleWanted={prospect.handle_wanted}
        displayName={prospect.display_name}
        creatorProfileId={prospect.creator_profile_id}
        profileHandle={prospect.profile?.handle ?? null}
      />

      <OutreachComposer
        prospectId={prospect.id}
        prospectName={prospect.display_name}
        hasEmail={!!prospect.email}
        doNotContact={prospect.do_not_contact}
        optedOut={!!prospect.opted_out_at}
        hasPage={!!prospect.creator_profile_id}
        outreach={outreach}
      />
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <dt style={dt}>{k}</dt>
      <dd style={dd}>{v}</dd>
    </>
  );
}

const card: React.CSSProperties = {
  margin: "24px 0", padding: "20px 22px", borderRadius: 12,
  background: "#111118", border: "1px solid rgba(255,255,255,0.07)",
};
const h2: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: 22, margin: 0, color: "#fff" };
const dl: React.CSSProperties = { display: "grid", gridTemplateColumns: "160px 1fr", gap: "8px 16px", margin: "14px 0 0" };
const dt: React.CSSProperties = {
  fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em",
  textTransform: "uppercase", color: "rgba(255,255,255,0.4)", alignSelf: "center",
};
const dd: React.CSSProperties = { margin: 0, fontSize: 14, color: "rgba(255,255,255,0.8)", wordBreak: "break-word" };
const meta: React.CSSProperties = { fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 };
const link: React.CSSProperties = { color: "#f5c842" };
