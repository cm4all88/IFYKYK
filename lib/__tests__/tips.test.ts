import { describe, it, expect } from "vitest";
import { buildTipLedgerRow, isDuplicateTip, tipWebhookOutcome } from "@/lib/tips";

// The webhook wrote four columns into a table with three NOT NULL columns it
// never supplied, never checked the result, and returned 200. `public.tips` held
// 0 rows. These tests pin the shape of the row so that cannot recur.

const session = (over: Record<string, any> = {}) => ({
  id: "cs_test_123",
  amount_total: 1053, // $10 tip grossed up for Stripe's card fee
  currency: "usd",
  payment_intent: "pi_test_456",
  metadata: { type: "tip", creator_profile_id: "cp-1", amount_usd: "10", fan_user_id: "fan-1" },
  ...over,
});

describe("buildTipLedgerRow — successful authenticated fan tip", () => {
  const r = buildTipLedgerRow({ session: session(), eventId: "evt_1" });

  it("succeeds", () => {
    expect(r.ok).toBe(true);
  });

  it("supplies every NOT NULL column the live schema requires", () => {
    if (!r.ok) throw new Error("expected ok");
    // These three are NOT NULL with no default in production. Omitting them is
    // what made every tip insert fail with 23502.
    expect(r.row.creator_profile_id).toBe("cp-1");
    expect(r.row.amount).toBe(10);
    expect(r.row.creator_receives).toBe(10);
    expect(r.row.platform_receives).toBe(0);
  });

  it("credits the creator the tip, not the grossed-up charge", () => {
    if (!r.ok) throw new Error("expected ok");
    // amount_total is 1053 (tip + card fee). The creator is credited the tip.
    expect(r.row.amount).toBe(10);
    expect(r.row.amount).not.toBe(10.53);
  });

  it("agrees with lib/earnings.ts, which computes net as amount - platform_receives", () => {
    if (!r.ok) throw new Error("expected ok");
    expect(r.row.amount - r.row.platform_receives).toBe(r.row.creator_receives);
  });

  it("records the identifiers reconciliation needs", () => {
    if (!r.ok) throw new Error("expected ok");
    expect(r.row.stripe_session_id).toBe("cs_test_123");
    expect(r.row.stripe_payment_intent_id).toBe("pi_test_456");
    expect(r.row.stripe_event_id).toBe("evt_1");
    expect(r.row.currency).toBe("usd");
  });
});

describe("buildTipLedgerRow — guest tip", () => {
  it("records a null fan, never a fabricated id", () => {
    const r = buildTipLedgerRow({
      session: session({ metadata: { type: "tip", creator_profile_id: "cp-1", amount_usd: "5" } }),
      eventId: "evt_2",
    });
    if (!r.ok) throw new Error("expected ok");
    expect(r.row.fan_user_id).toBeNull();
    expect(r.row.amount).toBe(5);
  });

  it("treats an empty-string fan id as a guest", () => {
    const r = buildTipLedgerRow({
      session: session({ metadata: { type: "tip", creator_profile_id: "cp-1", amount_usd: "5", fan_user_id: "" } }),
    });
    if (!r.ok) throw new Error("expected ok");
    expect(r.row.fan_user_id).toBeNull();
  });
});

describe("buildTipLedgerRow — missing or bad metadata", () => {
  it("refuses without a creator_profile_id", () => {
    const r = buildTipLedgerRow({ session: session({ metadata: { type: "tip", amount_usd: "10" } }) });
    expect(r).toEqual({ ok: false, reason: "missing_creator_profile_id" });
  });

  it("refuses without a session id", () => {
    const r = buildTipLedgerRow({ session: session({ id: null }) });
    expect(r).toEqual({ ok: false, reason: "missing_session_id" });
  });

  it("refuses a zero or negative amount", () => {
    for (const amount_usd of ["0", "-5"]) {
      const r = buildTipLedgerRow({
        session: session({ amount_total: 0, metadata: { type: "tip", creator_profile_id: "cp-1", amount_usd } }),
      });
      expect(r.ok).toBe(false);
    }
  });

  it("refuses a non-USD currency rather than storing minor units as dollars", () => {
    // JPY is zero-decimal. Dividing by 100 would understate it 100x.
    const r = buildTipLedgerRow({ session: session({ currency: "jpy" }) });
    expect(r).toEqual({ ok: false, reason: "unsupported_currency" });
  });

  it("falls back to amount_total only when metadata has no amount", () => {
    const r = buildTipLedgerRow({
      session: session({ amount_total: 2500, metadata: { type: "tip", creator_profile_id: "cp-1" } }),
    });
    if (!r.ok) throw new Error("expected ok");
    expect(r.row.amount).toBe(25);
  });

  it("rounds to cents", () => {
    const r = buildTipLedgerRow({
      session: session({ metadata: { type: "tip", creator_profile_id: "cp-1", amount_usd: "10.005" } }),
    });
    if (!r.ok) throw new Error("expected ok");
    expect(r.row.amount).toBe(10.01);
    expect(r.row.creator_receives).toBe(10.01);
  });
});

describe("isDuplicateTip — duplicate webhook delivery must not double count", () => {
  it("recognises the unique violation by SQLSTATE", () => {
    expect(isDuplicateTip({ code: "23505", message: "duplicate key value" })).toBe(true);
  });

  it("recognises it by constraint name when no code is present", () => {
    expect(isDuplicateTip({ message: 'duplicate key value violates unique constraint "tips_stripe_session_id_key"' })).toBe(true);
  });

  it("does not mistake a real failure for a duplicate", () => {
    // 23502 is the not-null violation that lost every tip. It must be retried,
    // never acknowledged as an already-processed duplicate.
    expect(isDuplicateTip({ code: "23502", message: 'null value in column "creator_receives"' })).toBe(false);
    expect(isDuplicateTip({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isDuplicateTip(null)).toBe(false);
  });
});

// ── The decision the old handler was missing ─────────────────────────────────
// It ignored the insert result and returned 200, so Stripe marked every event
// delivered and never retried. These tests pin the retry contract.

const okBuild = () => buildTipLedgerRow({ session: session(), eventId: "evt_1" });

describe("tipWebhookOutcome — failed database insert is RETRYABLE", () => {
  it("returns 500 and asks for a retry when the insert fails", () => {
    // 23502 is the exact not-null violation that lost every tip.
    const d = tipWebhookOutcome(okBuild(), { code: "23502", message: 'null value in column "creator_receives"' });
    expect(d.status).toBe(500);
    expect(d.retryable).toBe(true);
    expect(d.outcome).toBe("write_failed");
    expect(d.notify).toBe(false);
  });

  it("retries on an RLS denial too", () => {
    const d = tipWebhookOutcome(okBuild(), { code: "42501", message: "permission denied for table tips" });
    expect(d.status).toBe(500);
    expect(d.retryable).toBe(true);
  });

  it("retries on a transient failure with no SQLSTATE", () => {
    // A connection reset or timeout carries no code. It must still come back.
    const d = tipWebhookOutcome(okBuild(), { message: "fetch failed: ECONNRESET" });
    expect(d.status).toBe(500);
    expect(d.retryable).toBe(true);
  });

  it("never returns 2xx on a failed write — the defect that lost every tip", () => {
    for (const err of [{ code: "23502" }, { code: "42501" }, { code: "08006" }, { message: "timeout" }]) {
      expect(tipWebhookOutcome(okBuild(), err).status).toBeGreaterThanOrEqual(500);
    }
  });
});

describe("tipWebhookOutcome — retry after a temporary failure succeeds cleanly", () => {
  it("first delivery fails retryably, the retry records and notifies once", () => {
    const first = tipWebhookOutcome(okBuild(), { message: "ECONNRESET" });
    expect(first.retryable).toBe(true);
    expect(first.notify).toBe(false);

    // Stripe redelivers the same event; this time the insert succeeds.
    const retry = tipWebhookOutcome(okBuild(), null);
    expect(retry.status).toBe(200);
    expect(retry.outcome).toBe("recorded");
    expect(retry.notify).toBe(true);
  });

  it("a retry AFTER the row already landed does not double count or double notify", () => {
    // The write succeeded but the response was lost, so Stripe retries. The
    // unique index on stripe_session_id turns it into 23505.
    const d = tipWebhookOutcome(okBuild(), { code: "23505", message: "duplicate key value" });
    expect(d.status).toBe(200);
    expect(d.retryable).toBe(false);
    expect(d.outcome).toBe("duplicate");
    expect(d.notify).toBe(false); // one tip, one email
  });
});

describe("tipWebhookOutcome — unprocessable events are not retried", () => {
  it("returns 422 without a retry when metadata is malformed", () => {
    const bad = buildTipLedgerRow({ session: session({ metadata: { type: "tip" } }) });
    const d = tipWebhookOutcome(bad, null);
    expect(d.status).toBe(422);
    expect(d.retryable).toBe(false);
    expect(d.outcome).toBe("unprocessable");
  });

  it("does not notify the creator about a tip it could not record", () => {
    const bad = buildTipLedgerRow({ session: session({ id: null }) });
    expect(tipWebhookOutcome(bad, null).notify).toBe(false);
  });
});

describe("tipWebhookOutcome — the happy path", () => {
  it("returns 200 and notifies exactly once", () => {
    const d = tipWebhookOutcome(okBuild(), null);
    expect(d).toEqual({ status: 200, retryable: false, notify: true, outcome: "recorded" });
  });
});
