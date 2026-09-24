import { describe, it, expect } from "vitest";
import { evaluateTipEligibility, type EligibilityCreator, type TrustRow } from "@/lib/trust/eligibility";
import { DEFAULT_TRUST_CONFIG as C, mergeTrustConfig } from "@/lib/trust/config";
import { classifyStripeAccount, normalizeStripeAccount } from "@/lib/trust/stripe-status";

const NOW = new Date("2026-09-23T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

const creator = (o: Partial<EligibilityCreator> = {}): EligibilityCreator => ({
  id: "c1", kind: "spotlight", published: true, is_active: true, deleted_at: null,
  created_at: daysAgo(60), stripe_account_id: "acct_1", stripe_onboarded: true, wants_tips: true, ...o,
});
const trust = (o: Partial<TrustRow> = {}): TrustRow => ({
  creator_profile_id: "c1", tips_disabled: false, monetization_status: "active", payout_hold_active: false,
  stripe_onboarded_at: null, stripe_status_updated_at: hoursAgo(1),
  stripe_charges_enabled: true, stripe_payouts_enabled: true, stripe_details_submitted: true,
  stripe_disabled_reason: null, stripe_requirements_currently_due: [], stripe_requirements_past_due: [],
  stripe_payout_interval: "daily", ...o,
});
const run = (c: EligibilityCreator | null, t: TrustRow | null, posts = 3) =>
  evaluateTipEligibility({ creator: c, trust: t, publishedPostCount: posts, now: NOW }, C);

describe("canCreatorReceiveTips (pure core)", () => {
  it("eligible established creator can receive tips", () => {
    const r = run(creator(), trust());
    expect(r.eligible).toBe(true);
    expect(r.reason).toBeNull();
    expect(r.acceptedUnderPayoutHold).toBe(false);
  });

  it("zero post creator cannot receive tips, even fully onboarded", () => {
    const r = run(creator(), trust(), 0);
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe("no_published_posts");
  });

  it("the incident profile is refused: minutes old, zero posts, automatic payouts", () => {
    const r = run(creator({ created_at: hoursAgo(0.1) }), trust({ stripe_onboarded_at: hoursAgo(0.05) }), 0);
    expect(r.eligible).toBe(false);
  });

  it("rejected Stripe account cannot receive tips", () => {
    const r = run(creator(), trust({ stripe_disabled_reason: "rejected.fraud", stripe_charges_enabled: false }));
    expect(r.reason).toBe("stripe_rejected");
  });

  it("restricted account cannot receive tips while Stripe has a disabled_reason", () => {
    expect(run(creator(), trust({ stripe_disabled_reason: "requirements.past_due" })).reason).toBe("stripe_restricted");
    expect(run(creator(), trust({ stripe_disabled_reason: "under_review" })).reason).toBe("stripe_restricted");
  });

  it("payouts disabled alone does not block tips (Stripe is holding the money)", () => {
    expect(run(creator(), trust({ stripe_payouts_enabled: false })).eligible).toBe(true);
  });

  it("charges disabled blocks tips", () => {
    expect(run(creator(), trust({ stripe_charges_enabled: false })).reason).toBe("stripe_charges_disabled");
  });

  it("fails closed when Stripe status has never been read", () => {
    expect(run(creator(), null).reason).toBe("stripe_status_unknown");
    expect(run(creator(), trust({ stripe_status_updated_at: null })).reason).toBe("stripe_status_unknown");
  });

  it("unpublished, deleted, inactive and backstage profiles are refused", () => {
    expect(run(creator({ published: false }), trust()).reason).toBe("unpublished");
    expect(run(creator({ deleted_at: daysAgo(1) }), trust()).reason).toBe("deleted");
    expect(run(creator({ is_active: false }), trust()).reason).toBe("inactive");
    expect(run(creator({ kind: "backstage" }), trust()).reason).toBe("not_spotlight");
    expect(run(null, null).reason).toBe("not_found");
  });

  it("Stripe onboarding alone is not enough", () => {
    expect(run(creator({ stripe_onboarded: false }), trust()).reason).toBe("stripe_not_connected");
  });

  it("admin review, block and tip disable all refuse", () => {
    expect(run(creator(), trust({ monetization_status: "under_review" })).reason).toBe("monetization_under_review");
    expect(run(creator(), trust({ monetization_status: "blocked" })).reason).toBe("monetization_blocked");
    expect(run(creator(), trust({ tips_disabled: true })).reason).toBe("tips_disabled_by_admin");
  });

  it("user facing messages never name the fraud signal and contain no dashes", () => {
    for (const t of [trust({ monetization_status: "blocked" }), trust({ stripe_disabled_reason: "rejected.fraud" }), trust()]) {
      const r = run(creator(), t, 0);
      expect(r.userMessage).toBeTruthy();
      expect(r.userMessage!).not.toMatch(/fraud|review|block|reject|stripe/i);
      expect(r.userMessage!).not.toMatch(/[\u2012-\u2015-]/);
    }
  });
});

describe("new creator risk period", () => {
  it("refuses tips inside the window when payouts are automatic", () => {
    const r = run(creator({ created_at: hoursAgo(5) }), trust({ stripe_payout_interval: "daily" }));
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe("new_creator_risk_period");
    expect(r.riskPeriod.active).toBe(true);
  });

  it("accepts tips inside the window only when payouts are held (manual)", () => {
    const r = run(creator({ created_at: hoursAgo(5) }), trust({ stripe_payout_interval: "manual" }));
    expect(r.eligible).toBe(true);
    expect(r.acceptedUnderPayoutHold).toBe(true);
  });

  it("window starts at the LATER of profile creation and onboarding", () => {
    // Profile is 10 days old but Stripe onboarding finished 2 hours ago: still new.
    const r = run(creator({ created_at: daysAgo(10) }), trust({ stripe_onboarded_at: hoursAgo(2) }));
    expect(r.reason).toBe("new_creator_risk_period");
    expect(new Date(r.riskPeriod.endsAt!).getTime()).toBe(new Date(hoursAgo(2)).getTime() + 24 * 3_600_000);
  });

  it("ends after the configured duration", () => {
    expect(run(creator({ created_at: hoursAgo(25) }), trust()).eligible).toBe(true);
    const cfg48 = mergeTrustConfig({ newCreatorRiskHours: 48 });
    const r = evaluateTipEligibility({ creator: creator({ created_at: hoursAgo(25) }), trust: trust(), publishedPostCount: 3, now: NOW }, cfg48);
    expect(r.reason).toBe("new_creator_risk_period");
  });
});

describe("config", () => {
  it("rejects zero, negative and garbage overrides instead of loosening limits", () => {
    const c = mergeTrustConfig({ velocity: { creatorAttempts10m: 0, guestIpAttempts1h: -5, fanAttempts10m: "x" }, newCreatorRiskHours: "abc" });
    expect(c.velocity.creatorAttempts10m).toBe(5);
    expect(c.velocity.guestIpAttempts1h).toBe(10);
    expect(c.velocity.fanAttempts10m).toBe(5);
    expect(c.newCreatorRiskHours).toBe(24);
  });
  it("clamps tip session expiry to Stripe's 30 minute minimum", () => {
    expect(mergeTrustConfig({ tipSessionExpiryMinutes: 5 }).tipSessionExpiryMinutes).toBe(30);
  });
  it("defaults match the documented thresholds", () => {
    expect(C.newCreatorRiskHours).toBe(24);
    expect(C.velocity).toMatchObject({ creatorAttempts10m: 5, creatorAttempts1h: 10, guestIpAttempts10m: 5, guestIpAttempts1h: 10, fanAttempts10m: 5 });
  });
});

describe("Stripe account classification", () => {
  it("normalizes an account object and classifies it", () => {
    const s = normalizeStripeAccount({
      charges_enabled: false, payouts_enabled: false, details_submitted: true,
      requirements: { disabled_reason: "rejected.fraud", currently_due: [], past_due: ["x"] },
      settings: { payouts: { schedule: { interval: "manual" } } },
    });
    expect(s.stripe_payout_interval).toBe("manual");
    expect(classifyStripeAccount(s)).toBe("rejected");
    expect(classifyStripeAccount({ stripe_charges_enabled: true, stripe_details_submitted: true, stripe_disabled_reason: null })).toBe("ok");
    expect(classifyStripeAccount({ stripe_charges_enabled: false, stripe_details_submitted: false, stripe_disabled_reason: null })).toBe("incomplete");
  });
});
