// ──────────────────────────────────────────────────────────────────────────────
// lib/trust/admin-data.ts
//
// Read model for /admin/trust. Service role, called only after isAdmin().
// Aggregation is done here in TypeScript over bounded windows rather than in a
// database view, so it stays readable and needs no extra grants.
//
// Never returns card data. The card fingerprint is summarised as a count of
// distinct cards and never rendered.
// ──────────────────────────────────────────────────────────────────────────────

import type { TrustConfig } from "@/lib/trust/config";
import { computeRiskFlags, maxInWindow, type RiskFlag, type RiskStats } from "@/lib/trust/risk-flags";
import { riskPeriodEnd } from "@/lib/trust/eligibility";
import { networkPrefix } from "@/lib/trust/request-context";

export type CreatorTrustSummary = {
  id: string;
  handle: string | null;
  display_name: string | null;
  stripe_account_id: string | null;
  created_at: string | null;
  onboarded_at: string | null;
  published: boolean | null;
  deleted: boolean;
  post_count: number;
  first_ip_country: string | null;
  last_ip_country: string | null;
  tip_attempts: number;
  blocked_attempts: number;
  tips_succeeded: number;
  tips_succeeded_amount: number;
  guest_tips: number;
  refunds: number;
  disputes: number;
  distinct_cards: number;
  stripe_status: string;
  monetization_status: string;
  tips_disabled: boolean;
  payout_status: string;
  flags: RiskFlag[];
};

const DAY = 86_400_000;
const WINDOW_DAYS = 90;

function stripeLabel(t: any, cp: any): string {
  if (!cp.stripe_account_id) return "not connected";
  if (!t?.stripe_status_updated_at) return cp.stripe_onboarded ? "onboarded (unverified)" : "incomplete";
  if (t.stripe_disabled_reason) return t.stripe_disabled_reason;
  if (!t.stripe_charges_enabled) return "charges disabled";
  if (!t.stripe_payouts_enabled) return "payouts disabled";
  return "active";
}

function payoutLabel(t: any): string {
  if (t?.payout_hold_active) return `held (${t.payout_hold_reason ?? "unspecified"})`;
  if (t?.stripe_payout_interval) return t.stripe_payout_interval === "manual" ? "manual" : `automatic (${t.stripe_payout_interval})`;
  return "automatic (Stripe default)";
}

export async function loadTrustOverview(admin: any, config: TrustConfig, now = new Date(), opts: { creatorIds?: string[]; limit?: number } = {}): Promise<CreatorTrustSummary[]> {
  const since = new Date(now.getTime() - WINDOW_DAYS * DAY).toISOString();

  let cq = admin.from("creator_profiles")
    .select("id, handle, display_name, stripe_account_id, stripe_onboarded, created_at, published, deleted_at, first_ip, first_country, last_country")
    .eq("kind", "spotlight");
  cq = opts.creatorIds ? cq.in("id", opts.creatorIds) : cq.not("stripe_account_id", "is", null).order("created_at", { ascending: false }).limit(opts.limit ?? 300);
  const { data: creators, error } = await cq;
  if (error) throw new Error(`trust overview creators: ${error.message}`);
  const list: any[] = creators ?? [];
  if (list.length === 0) return [];
  const ids = list.map((c) => c.id);

  const [trustRes, postsRes, tipsRes, attemptsRes, netRes, eventsRes] = await Promise.all([
    admin.from("creator_trust").select("*").in("creator_profile_id", ids),
    admin.from("posts").select("creator_profile_id, status, archived_at").in("creator_profile_id", ids),
    admin.from("tips").select("creator_profile_id, status, amount, fan_user_id, created_at, succeeded_at, disputed_at, refunded_at").in("creator_profile_id", ids).gte("created_at", since),
    admin.from("tip_checkout_attempts").select("creator_profile_id, outcome, completed_at, created_at, stripe_risk_level, card_fingerprint").in("creator_profile_id", ids).gte("created_at", since),
    admin.from("creator_profiles").select("id, first_ip, created_at").gte("created_at", new Date(now.getTime() - config.sameNetworkWindowDays * DAY).toISOString()),
    admin.from("creator_trust_events").select("creator_profile_id, kind").in("creator_profile_id", ids).in("kind", ["early_fraud_warning", "stripe_high_risk"]),
  ]);
  for (const [name, r] of [["creator_trust", trustRes], ["posts", postsRes], ["tips", tipsRes], ["attempts", attemptsRes]] as const) {
    if ((r as any).error) throw new Error(`trust overview ${name}: ${(r as any).error.message}`);
  }

  const group = <T,>(rows: T[] | null, key: (r: T) => string) => {
    const m = new Map<string, T[]>();
    for (const r of rows ?? []) { const k = key(r); m.set(k, [...(m.get(k) ?? []), r]); }
    return m;
  };
  const trustBy = new Map<string, any>((trustRes.data ?? []).map((t: any) => [t.creator_profile_id, t]));
  const postsBy = group<any>(postsRes.data, (p) => p.creator_profile_id);
  const tipsBy = group<any>(tipsRes.data, (t) => t.creator_profile_id);
  const attemptsBy = group<any>(attemptsRes.data, (a) => a.creator_profile_id);
  const eventsBy = group<any>(eventsRes.data, (e) => e.creator_profile_id);
  const netCounts = new Map<string, number>();
  for (const c of netRes.data ?? []) {
    const p = networkPrefix(c.first_ip);
    if (p) netCounts.set(p, (netCounts.get(p) ?? 0) + 1);
  }

  return list.map((cp) => {
    const t = trustBy.get(cp.id) ?? null;
    const posts = (postsBy.get(cp.id) ?? []).filter((p: any) => p.status === "live" && !p.archived_at);
    const tips = tipsBy.get(cp.id) ?? [];
    const attempts = attemptsBy.get(cp.id) ?? [];
    const succeeded = tips.filter((x: any) => x.status === "succeeded" || x.status === "refunded" || x.status === "partially_refunded" || x.status === "disputed" || x.status === "dispute_lost");
    const succTimes = succeeded.map((x: any) => x.succeeded_at ?? x.created_at);
    const guest = succeeded.filter((x: any) => !x.fan_user_id);
    const day = now.getTime() - DAY;
    const created24 = attempts.filter((a: any) => a.outcome === "session_created" && new Date(a.created_at).getTime() > day);
    const prefix = networkPrefix(cp.first_ip);
    const endsAt = riskPeriodEnd(cp, t, config);

    const stats: RiskStats = {
      createdAt: cp.created_at,
      riskPeriodEndsAt: endsAt ? endsAt.toISOString() : null,
      publishedPostCount: posts.length,
      succeededTips: succeeded.length,
      maxSucceeded10m: maxInWindow(succTimes, 10 * 60_000),
      maxSucceeded1h: maxInWindow(succTimes, 3600_000),
      guestSucceededTips: guest.length,
      maxGuestSucceeded1h: maxInWindow(guest.map((x: any) => x.succeeded_at ?? x.created_at), 3600_000),
      uncompletedSessions24h: created24.filter((a: any) => !a.completed_at).length,
      succeededTips24h: succTimes.filter((s: string) => new Date(s).getTime() > day).length,
      stripeChargesEnabled: t?.stripe_status_updated_at ? t.stripe_charges_enabled === true : null,
      stripeDetailsSubmitted: t?.stripe_status_updated_at ? t.stripe_details_submitted === true : null,
      stripeDisabledReason: t?.stripe_disabled_reason ?? null,
      stripeHighRiskCount: attempts.filter((a: any) => a.stripe_risk_level === "elevated" || a.stripe_risk_level === "highest").length
        + (eventsBy.get(cp.id) ?? []).filter((e: any) => e.kind === "stripe_high_risk").length,
      // Other creators on the same /24 inside the window (this creator excluded).
      sameNetworkCreatorCount: prefix ? Math.max(0, (netCounts.get(prefix) ?? 0) - (new Date(cp.created_at).getTime() >= now.getTime() - config.sameNetworkWindowDays * DAY ? 1 : 0)) : 0,
      disputeCount: tips.filter((x: any) => x.disputed_at).length,
      earlyFraudWarningCount: (eventsBy.get(cp.id) ?? []).filter((e: any) => e.kind === "early_fraud_warning").length,
      // Legacy rows carry no post timeline; a creator with zero posts today who received tips is the signal.
      succeededTipsWhileZeroPosts: posts.length === 0 ? succeeded.length : 0,
      monetizationStatus: t?.monetization_status ?? "active",
    };

    return {
      id: cp.id,
      handle: cp.handle,
      display_name: cp.display_name,
      stripe_account_id: cp.stripe_account_id,
      created_at: cp.created_at,
      onboarded_at: t?.stripe_onboarded_at ?? null,
      published: cp.published,
      deleted: !!cp.deleted_at,
      post_count: posts.length,
      first_ip_country: cp.first_country ?? null,
      last_ip_country: cp.last_country ?? null,
      tip_attempts: attempts.filter((a: any) => a.outcome === "session_created").length || tips.length,
      blocked_attempts: attempts.filter((a: any) => String(a.outcome).startsWith("blocked")).length,
      tips_succeeded: tips.filter((x: any) => x.status === "succeeded").length,
      tips_succeeded_amount: Math.round(tips.filter((x: any) => x.status === "succeeded").reduce((s: number, x: any) => s + Number(x.amount || 0), 0) * 100) / 100,
      guest_tips: guest.length,
      refunds: tips.filter((x: any) => x.refunded_at).length,
      disputes: stats.disputeCount,
      distinct_cards: new Set(attempts.map((a: any) => a.card_fingerprint).filter(Boolean)).size,
      stripe_status: stripeLabel(t, cp),
      monetization_status: t?.monetization_status ?? "active",
      tips_disabled: !!t?.tips_disabled,
      payout_status: payoutLabel(t),
      flags: computeRiskFlags(stats, config, now),
    };
  });
}
