import { describe, it, expect, vi } from "vitest";
import { FakeDb } from "./helpers/fake-supabase";
import { handleTrustEvent } from "@/lib/trust/tip-webhook";
import { DEFAULT_TRUST_CONFIG as C } from "@/lib/trust/config";
import { canTransition, CREDITED_TIP_STATUSES, planSessionPaid } from "@/lib/trust/tip-state";
import { decideOnExistingEvent } from "@/lib/trust/webhook-events";

// Stand in for the webhook route's pre created row + Stripe session.
function seed(tip: Record<string, any> = {}) {
  return new FakeDb({
    tips: [{
      id: "tip_1", creator_profile_id: "c1", fan_user_id: null, amount: 9, creator_receives: 0, platform_receives: 0,
      status: "checkout_created", tip_source: "profile", post_id: null, stripe_session_id: "cs_1", ...tip,
    }],
    creator_profiles: [{ id: "c1", user_id: "u1", stripe_account_id: "acct_1", stripe_onboarded: true }],
    tip_checkout_attempts: [{ id: "a1", creator_profile_id: "c1", stripe_session_id: "cs_1", outcome: "session_created", completed_at: null }],
  });
}
const deps = (db: FakeDb, onTipSucceeded = vi.fn(async () => {})) => ({
  admin: db, config: C, getStripe: async () => null, now: new Date("2026-09-23T12:00:00Z"), onTipSucceeded,
});
const completed = (id: string, over: Record<string, any> = {}) => ({
  id, type: "checkout.session.completed",
  data: { object: { id: "cs_1", payment_status: "paid", payment_intent: "pi_1", amount_total: 957, currency: "usd",
    metadata: { type: "tip", tip_id: "tip_1", creator_profile_id: "c1", amount_usd: "9" }, ...over } },
});
const tip = (db: FakeDb) => db.rows("tips").find((t) => t.id === "tip_1")!;

describe("tip transaction integrity", () => {
  it("checkout creation is not a completed tip", () => {
    expect(CREDITED_TIP_STATUSES).toEqual(["succeeded"]);
    expect(CREDITED_TIP_STATUSES).not.toContain("checkout_created");
    expect(CREDITED_TIP_STATUSES).not.toContain("payment_pending");
  });

  it("a verified paid webhook moves the row to succeeded and records Stripe ids", async () => {
    const db = seed();
    const spy = vi.fn(async () => {});
    const r = await handleTrustEvent(completed("evt_1"), deps(db, spy));
    expect(r).toMatchObject({ handled: true, status: 200 });
    expect(tip(db)).toMatchObject({
      status: "succeeded", stripe_payment_intent_id: "pi_1", stripe_event_id: "evt_1", creator_receives: 9, platform_receives: 0,
    });
    expect(tip(db).succeeded_at).toBeTruthy();
    expect(db.rows("tip_checkout_attempts")[0].completed_at).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("a duplicate webhook does not double credit or double notify", async () => {
    const db = seed();
    const spy = vi.fn(async () => {});
    await handleTrustEvent(completed("evt_1"), deps(db, spy));
    const r = await handleTrustEvent(completed("evt_1"), deps(db, spy));
    expect(r.status).toBe(200);
    expect(db.rows("tips")).toHaveLength(1);
    expect(tip(db).status).toBe("succeeded");
    expect(spy).toHaveBeenCalledTimes(1);
    // And the route level event log skips a processed event entirely.
    expect(decideOnExistingEvent({ event_id: "evt_1", status: "processed", attempts: 1 })).toBe("skip");
    expect(decideOnExistingEvent({ event_id: "evt_1", status: "failed", attempts: 1 })).toBe("process");
    expect(decideOnExistingEvent(null)).toBe("process");
  });

  it("an unpaid (async) completion is pending, not credited", async () => {
    const db = seed();
    const spy = vi.fn(async () => {});
    await handleTrustEvent(completed("evt_2", { payment_status: "unpaid" }), deps(db, spy));
    expect(tip(db).status).toBe("payment_pending");
    expect(tip(db).creator_receives).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("a failed async payment and an expired session never credit the creator", async () => {
    const db = seed({ status: "payment_pending" });
    await handleTrustEvent({ id: "evt_3", type: "checkout.session.async_payment_failed", data: { object: { id: "cs_1", metadata: { type: "tip", tip_id: "tip_1" } } } }, deps(db));
    expect(tip(db).status).toBe("failed");

    const db2 = seed();
    await handleTrustEvent({ id: "evt_4", type: "checkout.session.expired", data: { object: { id: "cs_1", metadata: { type: "tip", tip_id: "tip_1" } } } }, deps(db2));
    expect(tip(db2).status).toBe("expired");
    expect(tip(db2).creator_receives).toBe(0);
    // A late "paid" cannot resurrect an expired row.
    await handleTrustEvent(completed("evt_5"), deps(db2));
    expect(tip(db2).status).toBe("expired");
  });

  it("declined card attempts inside a session are counted, not terminal", async () => {
    const db = seed();
    const ev = { id: "evt_6", type: "payment_intent.payment_failed", data: { object: { id: "pi_1", metadata: { type: "tip", tip_id: "tip_1" }, last_payment_error: { decline_code: "stolen_card" } } } };
    await handleTrustEvent(ev, deps(db));
    await handleTrustEvent({ ...ev, id: "evt_7" }, deps(db));
    expect(tip(db)).toMatchObject({ status: "checkout_created", payment_failure_count: 2, last_payment_failure_code: "stolen_card" });
  });

  it("a refund updates the transaction and it stops counting as earnings", async () => {
    const db = seed({ status: "succeeded", stripe_payment_intent_id: "pi_1" });
    await handleTrustEvent({ id: "evt_8", type: "charge.refunded", data: { object: { id: "ch_1", payment_intent: "pi_1", refunded: true, amount_refunded: 957 } } }, deps(db));
    expect(tip(db)).toMatchObject({ status: "refunded", refunded_amount_cents: 957, stripe_charge_id: "ch_1" });
    expect(tip(db).refunded_at).toBeTruthy();
    expect(CREDITED_TIP_STATUSES).not.toContain("refunded");
  });

  it("a dispute marks the tip, puts the creator under review and holds payouts", async () => {
    const db = seed({ status: "succeeded", stripe_payment_intent_id: "pi_1" });
    await handleTrustEvent({ id: "evt_9", type: "charge.dispute.created", data: { object: { id: "dp_1", payment_intent: "pi_1", charge: "ch_1", status: "needs_response", amount: 957 } } }, deps(db));
    expect(tip(db)).toMatchObject({ status: "disputed", dispute_status: "needs_response", stripe_dispute_id: "dp_1" });
    expect(db.rows("creator_trust")[0]).toMatchObject({ monetization_status: "under_review", payout_hold_active: true, payout_hold_reason: "chargeback_or_dispute" });
    expect(db.rows("creator_trust_events").map((e) => e.kind)).toContain("chargeback_or_dispute");

    await handleTrustEvent({ id: "evt_10", type: "charge.dispute.closed", data: { object: { id: "dp_1", payment_intent: "pi_1", status: "lost" } } }, deps(db));
    expect(tip(db).status).toBe("dispute_lost");
  });

  it("a Connect account update caches Stripe status and flags a rejection", async () => {
    const db = seed();
    await handleTrustEvent({ id: "evt_11", type: "account.updated", data: { object: {
      id: "acct_1", charges_enabled: false, payouts_enabled: false, details_submitted: true,
      requirements: { disabled_reason: "rejected.fraud", currently_due: [], past_due: [] },
      settings: { payouts: { schedule: { interval: "daily" } } },
    } } }, deps(db));
    expect(db.rows("creator_trust")[0]).toMatchObject({ stripe_disabled_reason: "rejected.fraud", stripe_charges_enabled: false });
    // Already onboarded before this event: onboarding date stays unknown rather than today.
    expect(db.rows("creator_trust")[0].stripe_onboarded_at).toBeUndefined();
    expect(db.rows("creator_trust_events").map((e) => e.kind)).toContain("stripe_rejected");
  });
});

describe("post and profile sources", () => {
  it("a post tip session without a pre created row still records post_id and source", () => {
    const plan = planSessionPaid({
      existing: null, eventId: "evt_x", now: new Date(),
      session: { id: "cs_9", payment_status: "paid", payment_intent: "pi_9", amount_total: 1060, currency: "usd",
        metadata: { type: "tip", creator_profile_id: "c1", amount_usd: "10", post_id: "p-1", tip_source: "post" } },
    });
    expect(plan.kind).toBe("insert");
    if (plan.kind === "insert") expect(plan.row).toMatchObject({ post_id: "p-1", tip_source: "post", status: "succeeded", creator_receives: 10 });
  });

  it("a profile tip records source profile, not a null", () => {
    const plan = planSessionPaid({
      existing: null, eventId: "evt_y", now: new Date(),
      session: { id: "cs_8", payment_status: "paid", payment_intent: "pi_8", amount_total: 530, currency: "usd",
        metadata: { type: "tip", creator_profile_id: "c1", amount_usd: "5", tip_source: "profile" } },
    });
    if (plan.kind !== "insert") throw new Error("expected insert");
    expect(plan.row.tip_source).toBe("profile");
    expect(plan.row.post_id).toBeNull();
  });
});

describe("tip state machine", () => {
  it("never moves backwards", () => {
    expect(canTransition("refunded", "succeeded")).toBe(false);
    expect(canTransition("succeeded", "succeeded")).toBe(false);
    expect(canTransition("expired", "succeeded")).toBe(false);
    expect(canTransition("dispute_lost", "succeeded")).toBe(false);
    expect(canTransition("disputed", "succeeded")).toBe(true); // dispute won
  });
});
