import { isAdmin } from "@/lib/admin";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase-server";

import CopyText from "@/components/CopyText";

export const dynamic = "force-dynamic";

function fmtDate(v: any): string {
  if (!v) return "—";
  try { return new Date(v).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }); } catch { return String(v); }
}
function val(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "object") { try { return JSON.stringify(v); } catch { return String(v); } }
  return String(v);
}
function loc(city: any, region: any, country: any): string {
  const parts = [city, region, country].map((x) => (x ? String(x) : "")).filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

const card: React.CSSProperties = { background: "var(--surface, #1E2024)", border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: 10, padding: "18px 20px", marginBottom: 16 };
const kicker: React.CSSProperties = { fontFamily: "var(--font-mono, monospace)", fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--accent, #f0b429)", marginBottom: 12 };
const lbl: React.CSSProperties = { fontSize: 11.5, color: "var(--muted, #888)", textTransform: "uppercase", letterSpacing: "0.04em" };
const valStyle: React.CSSProperties = { fontSize: 14, color: "var(--text, #F7F3EC)", wordBreak: "break-word" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 16, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={lbl}>{label}</div>
      <div style={valStyle}>{children}</div>
    </div>
  );
}

export default async function CreatorDetailsPage(props: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) notFound();
  const { id } = await props.params;
  const admin = await createServiceClient();

  const { data: profile } = await (admin as any).from("creator_profiles").select("*").eq("id", id).maybeSingle();
  if (!profile) notFound();

  const { data: allProfiles } = await (admin as any)
    .from("creator_profiles")
    .select("id, kind, handle, display_name, created_at, claimed_at, claim_code, onboarding_completed_at, is_active, deleted_at, stripe_onboarded")
    .eq("user_id", profile.user_id)
    .order("created_at", { ascending: true });

  let authUser: any = null;
  try {
    const { data } = await (admin as any).auth.admin.getUserById(profile.user_id);
    authUser = data?.user ?? null;
  } catch { authUser = null; }

  const { data: plan } = await (admin as any).from("creator_plans").select("*").eq("creator_profile_id", id).maybeSingle();

  const [{ count: postCount }, { count: subCount }, { count: campCount }, { count: tierCount }] = await Promise.all([
    (admin as any).from("posts").select("id", { count: "exact", head: true }).eq("creator_profile_id", id),
    (admin as any).from("subscriptions").select("id", { count: "exact", head: true }).eq("creator_profile_id", id).eq("status", "active"),
    (admin as any).from("campaigns").select("id", { count: "exact", head: true }).eq("creator_profile_id", id),
    (admin as any).from("subscription_tiers").select("id", { count: "exact", head: true }).eq("creator_profile_id", id),
  ]);

  const provider = authUser?.app_metadata?.provider || (authUser?.app_metadata?.providers || []).join(", ") || "email";

  // Referrals this creator already has.
  const { data: refCode } = await (admin as any).from("referral_codes").select("code").eq("owner_user_id", profile.user_id).maybeSingle();
  const refCodeStr: string | null = refCode?.code ?? null;
  const [cRefsRes, sgRes] = await Promise.all([
    (admin as any).from("creator_referrals").select("credited").eq("referrer_profile_id", id),
    refCodeStr ? (admin as any).from("referral_signups").select("verified").eq("code", refCodeStr) : Promise.resolve({ data: [] }),
  ]);
  const cRefs: any[] = cRefsRes.data ?? [];
  const refsTotal = cRefs.length;
  const refsCredited = cRefs.filter((r: any) => r.credited).length;
  const sgRows: any[] = sgRes.data ?? [];
  const sgVerified = sgRows.filter((x: any) => x.verified).length;
  const sgPending = sgRows.length - sgVerified;
  const inviteLink = `https://spotlightly.app/signup?ref=${profile.handle}`;
  const codeLink = refCodeStr ? `https://spotlightly.app/?ref=${refCodeStr}` : null;

  const planFlags = plan
    ? [
        ["Memberships", plan.wants_subscriptions], ["Tips", plan.wants_tips], ["Live shows", plan.wants_live],
        ["Messages", plan.wants_messages], ["Merch", plan.wants_merch], ["Marketplace", plan.wants_marketplace],
        ["Digital", plan.wants_digital], ["Campaigns", plan.wants_campaigns], ["Gift subs", plan.wants_gifts],
      ]
    : [];

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "32px 24px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif, Georgia, serif)", fontSize: 28, color: "#fff", margin: "0 0 4px" }}>{profile.display_name || profile.handle}</h1>
          <div style={{ fontSize: 13, color: "var(--muted, #888)" }}>@{profile.handle} · {profile.kind}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={`/admin/creators/${id}/build`} className="adm-btn adm-btn--primary" style={{ padding: "8px 14px" }}>Build page →</a>
          <a href={`/${profile.handle}`} target="_blank" className="adm-btn adm-btn--ghost" style={{ padding: "8px 14px" }}>Preview</a>
          <a href="/admin/creators" className="adm-btn adm-btn--ghost" style={{ padding: "8px 14px" }}>← All</a>
        </div>
      </div>

      {/* ACCOUNT LOGIN */}
      <div style={card}>
        <div style={kicker}>Account login</div>
        <Field label="Email">{val(authUser?.email)}</Field>
        <Field label="Email confirmed">{authUser?.email_confirmed_at ? `Yes · ${fmtDate(authUser.email_confirmed_at)}` : "No"}</Field>
        <Field label="Phone">{val(authUser?.phone)}</Field>
        <Field label="Sign-in provider">{val(provider)}</Field>
        <Field label="Account created">{fmtDate(authUser?.created_at)}</Field>
        <Field label="Last sign in">{fmtDate(authUser?.last_sign_in_at)}</Field>
        <Field label="Auth user id">{val(profile.user_id)}</Field>
      </div>

      {/* LOCATION & DEVICE */}
      <div style={card}>
        <div style={kicker}>Location &amp; device (captured)</div>
        <Field label="First seen">{fmtDate(profile.first_seen_at)}</Field>
        <Field label="First IP">{val(profile.first_ip)}</Field>
        <Field label="First location">{loc(profile.first_city, profile.first_region, profile.first_country)}</Field>
        <Field label="Last seen">{fmtDate(profile.last_seen_at)}</Field>
        <Field label="Last IP">{val(profile.last_ip)}</Field>
        <Field label="Last location">{loc(profile.last_city, profile.last_region, profile.last_country)}</Field>
        <Field label="Last device">{val(profile.last_user_agent)}</Field>
        <p style={{ fontSize: 11.5, color: "var(--muted, #888)", margin: "10px 0 0", lineHeight: 1.6 }}>
          Approximate, from the visitor&apos;s connection at the edge. Collected going forward, so it is blank for creators who have not signed in since this was added. Disclose IP and location collection in the privacy policy.
        </p>
      </div>

      {/* WHAT THEY ENTERED */}
      <div style={card}>
        <div style={kicker}>What they entered</div>
        <Field label="Display name">{val(profile.display_name)}</Field>
        <Field label="Handle">@{profile.handle}</Field>
        <Field label="Bio">{val(profile.bio)}</Field>
        <Field label="Tags">{val(profile.tags)}</Field>
        <Field label="Location (city)">{val(profile.location_city)}</Field>
        <Field label="Location (country)">{val(profile.location_country)}</Field>
        <Field label="Offers services">{val(profile.offers_services)}</Field>
        <Field label="Booking URL">{val(profile.booking_url)}</Field>
        <Field label="Wishlist URL">{val(profile.wishlist_url)}</Field>
        <Field label="Social links">{val(profile.social_links)}</Field>
        <Field label="Subscription price">{profile.subscription_price != null ? `$${profile.subscription_price}` : "—"}</Field>
        <Field label="Avatar">{profile.avatar_url ? <a href={profile.avatar_url} target="_blank" style={{ color: "var(--accent)" }}>view</a> : "—"}</Field>
        <Field label="Cover">{profile.cover_url ? <a href={profile.cover_url} target="_blank" style={{ color: "var(--accent)" }}>view</a> : "—"}</Field>
      </div>

      {/* IDENTITIES */}
      <div style={card}>
        <div style={kicker}>Identities on this account ({(allProfiles ?? []).length})</div>
        {(allProfiles ?? []).map((p: any) => (
          <div key={p.id} style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ fontSize: 14, color: "#fff" }}>@{p.handle} <span style={{ color: "var(--muted)", fontSize: 12 }}>· {p.kind}{p.id === id ? " · viewing" : ""}</span></div>
            <div style={{ fontSize: 12, color: "var(--muted, #888)", marginTop: 3 }}>
              created {fmtDate(p.created_at)} · {p.onboarding_completed_at ? `onboarded ${fmtDate(p.onboarding_completed_at)}` : "not onboarded"} · {p.claimed_at ? "claimed" : (p.claim_code ? `unclaimed (code ${p.claim_code})` : "unclaimed")} · stripe {p.stripe_onboarded ? "connected" : "no"} · {p.deleted_at ? "deleted" : (p.is_active === false ? "inactive" : "active")}
            </div>
          </div>
        ))}
      </div>

      {/* FEATURES */}
      <div style={card}>
        <div style={kicker}>Features they want</div>
        {plan ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {planFlags.map(([name, on]) => (
              <span key={String(name)} style={{ fontSize: 12, padding: "5px 11px", borderRadius: 999, border: `1px solid ${on ? "var(--accent-border, rgba(242,184,75,0.4))" : "var(--border)"}`, color: on ? "var(--accent)" : "var(--muted)", background: on ? "rgba(242,184,75,0.08)" : "transparent" }}>
                {on ? "✓" : "○"} {name}
              </span>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>No feature choices recorded yet (set during onboarding).</p>
        )}
      </div>

      {/* REFERRALS */}
      <div style={card}>
        <div style={kicker}>Referrals</div>
        <Field label="Invite link">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12, color: "var(--muted)", wordBreak: "break-all" }}>{inviteLink}</span>
            <CopyText text={inviteLink} />
          </span>
        </Field>
        <Field label="Creators referred">{refsTotal}{refsTotal ? ` (${refsCredited} credited)` : ""}</Field>
        <Field label="Personal code">
          {refCodeStr ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12, color: "var(--muted)" }}>{refCodeStr}</span>
              <CopyText text={codeLink as string} label="Copy link" />
            </span>
          ) : "Not generated yet"}
        </Field>
        <Field label="Code signups">{refCodeStr ? `${sgVerified} verified · ${sgPending} pending` : "—"}</Field>
      </div>

      {/* ACTIVITY */}
      <div style={card}>
        <div style={kicker}>Activity</div>
        <Field label="Posts">{val(postCount ?? 0)}</Field>
        <Field label="Active subscribers">{val(subCount ?? 0)}</Field>
        <Field label="Campaigns">{val(campCount ?? 0)}</Field>
        <Field label="Subscription tiers">{val(tierCount ?? 0)}</Field>
        <Field label="Stripe connected">{val(profile.stripe_onboarded)}</Field>
        <Field label="Onboarding completed">{fmtDate(profile.onboarding_completed_at)}</Field>
      </div>

      {/* RAW */}
      <details style={card}>
        <summary style={{ ...kicker, cursor: "pointer", marginBottom: 0 }}>Raw profile record</summary>
        <pre style={{ fontSize: 11.5, color: "var(--muted, #C8C4BE)", whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 12, fontFamily: "var(--font-mono, monospace)" }}>
          {JSON.stringify(profile, null, 2)}
        </pre>
      </details>
    </div>
  );
}
