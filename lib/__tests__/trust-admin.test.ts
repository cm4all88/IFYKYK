import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { FakeDb } from "./helpers/fake-supabase";
import { planAdminAction, DEFAULT_TRUST_STATE } from "@/lib/trust/admin-actions";
import { executeAdminTrustAction } from "@/lib/trust/admin-execute";
import { canAutoReleasePayoutHold, payoutScheduleParams } from "@/lib/trust/payouts";
import { computeRiskFlags, hasHoldFlag, maxInWindow, type RiskStats } from "@/lib/trust/risk-flags";
import { DEFAULT_TRUST_CONFIG as C } from "@/lib/trust/config";

const NOW = new Date("2026-09-23T12:00:00Z");

describe("admin manual controls", () => {
  it("requires a reason", () => {
    expect(planAdminAction(null, "disable_tips", "", NOW).ok).toBe(false);
  });

  it("place under review holds payouts and records before/after", () => {
    const p = planAdminAction(null, "place_under_review", "zero posts, burst of $9 tips", NOW);
    if (!p.ok) throw new Error(p.error);
    expect(p.patch).toMatchObject({ monetization_status: "under_review", payout_hold_active: true, payout_hold_reason: "review" });
    expect(p.stripePayouts).toBe("hold");
    expect(p.audit.before.monetization_status).toBe("active");
  });

  it("release from review does NOT release payouts by itself", () => {
    const held = { ...DEFAULT_TRUST_STATE, monetization_status: "under_review" as const, payout_hold_active: true, payout_hold_reason: "review" };
    const p = planAdminAction(held, "release_from_review", "reviewed, legitimate", NOW);
    if (!p.ok) throw new Error(p.error);
    expect(p.patch).toMatchObject({ monetization_status: "active", payout_hold_active: true });
    expect(p.stripePayouts).toBeNull();
  });

  it("payouts cannot be released while under review or blocked", () => {
    const held = { ...DEFAULT_TRUST_STATE, monetization_status: "under_review" as const, payout_hold_active: true };
    expect(planAdminAction(held, "release_payouts", "try", NOW).ok).toBe(false);
    const active = { ...DEFAULT_TRUST_STATE, payout_hold_active: true, payout_hold_reason: "admin" };
    const p = planAdminAction(active, "release_payouts", "cleared", NOW);
    expect(p.ok && p.stripePayouts).toBe("release");
  });

  it("block stops tips, holds payouts, and unblock lands in review not active", () => {
    const b = planAdminAction(null, "block_monetization", "confirmed fraud", NOW);
    if (!b.ok) throw new Error(b.error);
    expect(b.patch).toMatchObject({ monetization_status: "blocked", tips_disabled: true, payout_hold_active: true });
    const u = planAdminAction({ ...DEFAULT_TRUST_STATE, monetization_status: "blocked" }, "unblock_monetization", "appeal accepted", NOW);
    expect(u.ok && u.patch.monetization_status).toBe("under_review");
  });

  it("executes a hold end to end: state, Stripe manual schedule, audit row, no financial rows touched", async () => {
    const db = new FakeDb({
      creator_profiles: [{ id: "c1", stripe_account_id: "acct_1" }],
      tips: [{ id: "t1", creator_profile_id: "c1", amount: 9, status: "succeeded" }],
    });
    const update = vi.fn(async () => ({ settings: { payouts: { schedule: { interval: "manual" } } } }));
    const r = await executeAdminTrustAction({
      admin: db, getStripe: async () => ({ accounts: { update } }), creatorProfileId: "c1",
      action: "hold_payouts", reason: "incident review", adminEmail: "admin@example.com", now: NOW,
    });
    expect(r.ok).toBe(true);
    expect(update).toHaveBeenCalledWith("acct_1", payoutScheduleParams(true));
    expect(db.rows("creator_trust")[0]).toMatchObject({ payout_hold_active: true, stripe_payout_interval: "manual" });
    expect(db.rows("creator_trust_events")[0]).toMatchObject({ kind: "hold_payouts", actor: "admin:admin@example.com", reason: "incident review" });
    expect(db.rows("tips")).toEqual([{ id: "t1", creator_profile_id: "c1", amount: 9, status: "succeeded" }]);
  });

  it("a release that Stripe refuses is not recorded as released", async () => {
    const db = new FakeDb({
      creator_profiles: [{ id: "c1", stripe_account_id: "acct_1" }],
      creator_trust: [{ creator_profile_id: "c1", monetization_status: "active", tips_disabled: false, payout_hold_active: true, payout_hold_reason: "admin" }],
    });
    const r = await executeAdminTrustAction({
      admin: db, getStripe: async () => ({ accounts: { update: async () => { throw new Error("nope"); } } }),
      creatorProfileId: "c1", action: "release_payouts", reason: "cleared", adminEmail: "a@b.c", now: NOW,
    });
    expect(r.ok).toBe(false);
    expect(db.rows("creator_trust")[0].payout_hold_active).toBe(true);
  });
});

describe("payout hold release", () => {
  const base = {
    payoutHoldActive: true, payoutHoldReason: "new_account", monetizationStatus: "active",
    riskPeriodStart: new Date(NOW.getTime() - 8 * 86_400_000), publishedPostCount: 2, flags: [] as any[], now: NOW,
  };
  it("releases a clean new account after the hold period", () => {
    expect(canAutoReleasePayoutHold(base, C).release).toBe(true);
  });
  it("keeps holding inside the period, with flags, or for non automatic reasons", () => {
    expect(canAutoReleasePayoutHold({ ...base, riskPeriodStart: new Date(NOW.getTime() - 2 * 86_400_000) }, C).reason).toBe("hold_period_running");
    expect(canAutoReleasePayoutHold({ ...base, flags: ["high_tip_velocity"] }, C).reason).toBe("review_flags_present");
    expect(canAutoReleasePayoutHold({ ...base, payoutHoldReason: "chargeback_or_dispute" }, C).reason).toBe("manual_release_required");
    expect(canAutoReleasePayoutHold({ ...base, payoutHoldReason: "admin" }, C).release).toBe(false);
    expect(canAutoReleasePayoutHold({ ...base, publishedPostCount: 0 }, C).release).toBe(false);
  });
  it("hold means manual, release means daily", () => {
    expect(payoutScheduleParams(true).settings.payouts.schedule.interval).toBe("manual");
    expect(payoutScheduleParams(false).settings.payouts.schedule.interval).toBe("daily");
  });
});

describe("risk flags", () => {
  const stats = (o: Partial<RiskStats> = {}): RiskStats => ({
    createdAt: "2026-01-01T00:00:00Z", riskPeriodEndsAt: null, publishedPostCount: 5, succeededTips: 0,
    maxSucceeded10m: 0, maxSucceeded1h: 0, guestSucceededTips: 0, maxGuestSucceeded1h: 0,
    uncompletedSessions24h: 0, succeededTips24h: 0, stripeChargesEnabled: true, stripeDetailsSubmitted: true,
    stripeDisabledReason: null, stripeHighRiskCount: 0, sameNetworkCreatorCount: 0, disputeCount: 0,
    earlyFraudWarningCount: 0, succeededTipsWhileZeroPosts: 0, monetizationStatus: "active", ...o,
  });

  it("a normal creator has no flags", () => {
    expect(computeRiskFlags(stats(), C, NOW)).toEqual([]);
  });

  it("the incident profile raises the expected signals", () => {
    const f = computeRiskFlags(stats({
      publishedPostCount: 0, succeededTips: 28, maxSucceeded10m: 20, maxSucceeded1h: 28, guestSucceededTips: 26,
      maxGuestSucceeded1h: 26, succeededTipsWhileZeroPosts: 28, sameNetworkCreatorCount: 3, stripeHighRiskCount: 5,
    }), C, NOW);
    expect(f).toEqual(expect.arrayContaining([
      "zero_content_creator", "high_tip_velocity", "high_guest_tip_velocity", "tips_while_empty",
      "multiple_accounts_same_network", "stripe_high_risk",
    ]));
    expect(hasHoldFlag(f)).toBe(true);
  });

  it("location alone is never a flag", () => {
    // Nothing in RiskStats carries country; one creator on a network is not a cluster.
    expect(computeRiskFlags(stats({ sameNetworkCreatorCount: 1 }), C, NOW)).toEqual([]);
  });

  it("zero content alone does not hold payouts", () => {
    expect(hasHoldFlag(computeRiskFlags(stats({ publishedPostCount: 0 }), C, NOW))).toBe(false);
  });

  it("maxInWindow finds the densest burst", () => {
    const t0 = Date.parse("2026-09-01T00:00:00Z");
    const ts = Array.from({ length: 28 }, (_, i) => new Date(t0 + i * 36_000).toISOString()); // 28 in ~16 min
    expect(maxInWindow(ts, 10 * 60_000)).toBe(17);
    expect(maxInWindow(ts, 3600_000)).toBe(28);
  });
});

describe("financial and fraud fields are protected (migration 068, static)", () => {
  const sql = readFileSync(path.resolve(__dirname, "../../supabase/migrations/068_tip_trust_safety.sql"), "utf8");
  const tables = ["stripe_webhook_events", "tip_checkout_attempts", "creator_trust", "creator_trust_events"];

  it.each(tables)("%s has RLS on and no browser grants", (t) => {
    expect(sql).toMatch(new RegExp(`alter table public\\.${t}\\s+enable row level security`));
    expect(sql).toMatch(new RegExp(`revoke all on public\\.${t}\\s+from anon, authenticated`));
    expect(sql).not.toMatch(new RegExp(`create policy[^;]*on public\\.${t}`, "i"));
    expect(sql).not.toMatch(new RegExp(`grant [^;]*on public\\.${t}[^;]*to (anon|authenticated)`, "i"));
  });

  it("browser roles cannot write tips", () => {
    expect(sql).toMatch(/revoke insert, update, delete on public\.tips from anon, authenticated/);
  });

  it("IP, card fingerprint and review state live only in the locked tables", () => {
    expect(sql).not.toMatch(/alter table public\.tips add column if not exists (ip|card_fingerprint|monetization_status)/);
    expect(sql).not.toMatch(/alter table public\.creator_profiles/);
  });

  it("migration deletes nothing", () => {
    expect(sql.replace(/--.*$/gm, "")).not.toMatch(/\bdelete from\b|\btruncate\b|drop table/i);
  });
});
