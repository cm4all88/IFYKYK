import { createClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import SiteHeader from "@/components/site-header";
import CreatorFooter from "@/components/CreatorFooter";
import BackerCodeBanner from "../../[creator]/BackerCodeBanner";
import CampaignDonateButton from "../../[creator]/CampaignDonateButton";
import CampaignTiers from "../../[creator]/CampaignTiers";
import TheRoom from "../../[creator]/TheRoom";
import TipButton from "../../[creator]/TipButton";
import MessageButton from "../../[creator]/MessageButton";

export const dynamic = "force-dynamic";

// ── Prototype: the adaptive Spotlightly frame with the campaign-first occupant.
// New route so the live creator page stays untouched. Existing data and existing
// action paths only. No override, no other modes, no new systems.

function usd(n: number) {
  return "$" + Math.round(n).toLocaleString("en-US");
}
function firstSentence(s: string) {
  const m = s.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : s).trim();
}
function clamp(s: string, n: number) {
  return s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
}

function SpineLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono, 'DM Mono', monospace)",
        fontSize: 9,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: "var(--muted)",
        textAlign: "center",
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

async function loadCampaignFirst(handle: string) {
  const supabase = await createClient();

  const { data: spotlight } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("kind", "spotlight")
    .eq("handle", handle)
    .maybeSingle();

  if (!spotlight || (spotlight as any).deleted_at) return null;
  const sp: any = spotlight;

  // Auto-detection signal: an active campaign with a goal.
  const { data: campaigns } = await (supabase as any)
    .from("campaigns")
    .select("*, donations:campaign_donations(amount)")
    .eq("creator_profile_id", sp.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const first: any = (campaigns ?? [])[0] ?? null;
  let campaign: any = null;
  if (first) {
    const { data: tiers } = await (supabase as any)
      .from("campaign_tiers")
      .select("*")
      .eq("campaign_id", first.id)
      .order("sort_order", { ascending: true })
      .order("amount", { ascending: true });
    const donations = first.donations ?? [];
    campaign = {
      ...first,
      raised: donations.reduce((s: number, d: any) => s + Number(d.amount), 0),
      backers: donations.length,
      tiers: tiers ?? [],
    };
  }

  const { count: subscriberCount } = await (supabase as any)
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("creator_profile_id", sp.id)
    .eq("status", "active");

  // Proof: a few free, live posts only — never surface locked media.
  const { data: posts } = await supabase
    .from("posts")
    .select("id, caption, media_url, media_type, tier, lock_type, is_pinned, created_at")
    .eq("creator_profile_id", sp.id)
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(12);

  const proof = ((posts ?? []) as any[])
    .filter((p) => (p.lock_type ? p.lock_type === "free" : p.tier === "free"))
    .sort((a, b) => Number(!!b.is_pinned) - Number(!!a.is_pinned))
    .slice(0, 3);

  return { sp, campaign, subscriberCount: subscriberCount ?? 0, proof };
}

export default async function PreviewCreatorPage(props: {
  params: Promise<{ creator: string }>;
}) {
  const { creator } = await props.params;
  const data = await loadCampaignFirst(creator);
  if (!data) notFound();
  const { sp, campaign, subscriberCount, proof } = data;

  return (
    <>
      <SiteHeader />
      <BackerCodeBanner />
      <main style={{ position: "relative", minHeight: "70vh" }}>
        <div style={{ position: "relative", maxWidth: 760, margin: "0 auto", padding: "0 24px" }}>
          {campaign ? (
            <>
              {/* The beam falls on the stage. Same light, every mode. */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: "0 0 auto 0",
                  height: 540,
                  background:
                    "radial-gradient(ellipse 60% 42% at 50% 0%, rgba(242,184,75,0.14), transparent 70%)",
                  pointerEvents: "none",
                }}
              />

              {/* ── STAGE: the campaign is the headliner ───────────────── */}
              <section style={{ position: "relative", textAlign: "center", paddingTop: 64 }}>
                {/* marquee — names the objective in words */}
                <div
                  style={{
                    fontFamily: "var(--font-mono, 'DM Mono', monospace)",
                    fontSize: 11,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "var(--accent)",
                    marginBottom: 20,
                    display: "flex",
                    gap: 8,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
                  Raising now
                </div>

                {/* headline */}
                <h1
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontWeight: 800,
                    fontSize: "clamp(34px, 6vw, 60px)",
                    lineHeight: 1.04,
                    letterSpacing: "-0.02em",
                    color: "var(--text, #fff)",
                    margin: "0 auto 16px",
                    maxWidth: 700,
                  }}
                >
                  {campaign.title}
                </h1>

                {/* why — one line, her voice */}
                {campaign.description ? (
                  <p
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontStyle: "italic",
                      fontSize: 20,
                      lineHeight: 1.5,
                      color: "rgba(247,243,236,0.72)",
                      maxWidth: 560,
                      margin: "0 auto 28px",
                    }}
                  >
                    {firstSentence(String(campaign.description))}
                  </p>
                ) : null}

                {/* credential — the person you are backing, small */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 36 }}>
                  {sp.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sp.avatar_url}
                      alt=""
                      width={34}
                      height={34}
                      style={{ borderRadius: "50%", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface)" }} />
                  )}
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                      {sp.display_name || sp.handle}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>@{sp.handle}</div>
                  </div>
                </div>

                {/* progress instrument — how much, how far */}
                {(() => {
                  const goal = Number(campaign.goal_amount ?? campaign.goal ?? 0);
                  const pct = goal > 0 ? Math.min(100, Math.round((Number(campaign.raised) / goal) * 100)) : 0;
                  return (
                    <div
                      style={{
                        maxWidth: 460,
                        margin: "0 auto 28px",
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 14,
                        padding: "22px 24px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                        <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: 22, color: "var(--text)" }}>
                          {usd(Number(campaign.raised))}
                        </span>
                        <span style={{ fontSize: 13, color: "var(--muted)" }}>raised of {usd(goal)}</span>
                      </div>
                      <div style={{ height: 10, borderRadius: 6, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)", borderRadius: 6 }} />
                      </div>
                      <div
                        style={{
                          marginTop: 10,
                          fontFamily: "var(--font-mono, 'DM Mono', monospace)",
                          fontSize: 12,
                          letterSpacing: "0.04em",
                          color: "var(--muted)",
                        }}
                      >
                        {pct}% · {campaign.backers} {campaign.backers === 1 ? "person" : "people"} backing
                      </div>
                    </div>
                  );
                })()}

                {/* the one gold door */}
                <div style={{ display: "flex", justifyContent: "center", marginBottom: campaign.tiers.length ? 28 : 8 }}>
                  <CampaignDonateButton campaignId={campaign.id} campaignTitle={campaign.title} />
                </div>

                {/* reward ladder — the conversion ladder funnels into the door */}
                {campaign.tiers.length > 0 ? (
                  <div style={{ maxWidth: 560, margin: "0 auto" }}>
                    <CampaignTiers campaignId={campaign.id} campaignTitle={campaign.title} tiers={campaign.tiers} />
                  </div>
                ) : null}
              </section>

              {/* ── PROGRAM SPINE: proof, the room, other ways ─────────── */}
              {proof.length > 0 ? (
                <section style={{ marginTop: 64 }}>
                  <SpineLabel>Her work</SpineLabel>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(proof.length, 3)}, 1fr)`, gap: 12 }}>
                    {proof.map((p: any) => (
                      <div key={p.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                        {p.media_url && String(p.media_type ?? "").startsWith("image") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.media_url} alt="" style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }} />
                        ) : null}
                        {p.caption ? (
                          <div style={{ padding: "12px 14px", fontSize: 13, color: "rgba(247,243,236,0.8)", lineHeight: 1.5 }}>
                            {clamp(String(p.caption), 120)}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section style={{ marginTop: 56 }}>
                <TheRoom subscriberCount={subscriberCount} handle={sp.handle} />
              </section>

              <section style={{ marginTop: 56, paddingBottom: 48, textAlign: "center" }}>
                <SpineLabel>Other ways to support</SpineLabel>
                <p style={{ fontSize: 14, color: "var(--muted)", maxWidth: 460, margin: "0 auto 18px" }}>
                  Prefer to follow along? Subscribe, or follow for free.
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  <TipButton creatorProfileId={sp.id} />
                  <MessageButton creatorProfileId={sp.id} handle={sp.handle} />
                </div>
              </section>
            </>
          ) : (
            // Auto-detection chose no mode this prototype covers.
            <section style={{ textAlign: "center", padding: "120px 0 100px" }}>
              <div
                style={{
                  fontFamily: "var(--font-mono, 'DM Mono', monospace)",
                  fontSize: 11,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  marginBottom: 16,
                }}
              >
                Campaign-first prototype
              </div>
              <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 28, color: "var(--text)", margin: "0 auto 12px", maxWidth: 520 }}>
                No active campaign to headline
              </h1>
              <p style={{ fontSize: 15, color: "var(--muted)", maxWidth: 460, margin: "0 auto" }}>
                @{sp.handle} has no active campaign right now, so the campaign-first mode does not apply. The other modes are out of scope for this prototype.
              </p>
            </section>
          )}
        </div>
      </main>
      <CreatorFooter />
    </>
  );
}
