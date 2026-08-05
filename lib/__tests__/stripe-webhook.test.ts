import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import Stripe from "stripe";

// The webhook route used a hand-rolled HMAC that fed the `t` timestamp into the
// signature but never compared it against the clock, so a captured request
// stayed replayable forever. It also threw a RangeError rather than returning
// false when `v1` had an unexpected length.
//
// These tests exercise the REAL verifier now used by the route
// (`verifyWebhook` -> `stripe.webhooks.constructEvent`). Pure crypto, no
// network, no Stripe account.

const SECRET = "whsec_test_secret_do_not_use_anywhere";
const stripe = new Stripe("sk_test_dummy", { apiVersion: "2024-04-10" });

function sign(payload: string, timestampSeconds: number, secret = SECRET) {
  const signed = `${timestampSeconds}.${payload}`;
  const v1 = crypto.createHmac("sha256", secret).update(signed).digest("hex");
  return `t=${timestampSeconds},v1=${v1}`;
}

const BODY = JSON.stringify({
  id: "evt_test_1",
  type: "checkout.session.completed",
  data: { object: { id: "cs_test_1", metadata: { type: "tip" } } },
});

const nowSec = () => Math.floor(Date.now() / 1000);

describe("Stripe webhook verification", () => {
  it("accepts a correctly signed, current request", () => {
    const header = sign(BODY, nowSec());
    const event = stripe.webhooks.constructEvent(BODY, header, SECRET, 300);
    expect(event.id).toBe("evt_test_1");
    expect(event.type).toBe("checkout.session.completed");
  });

  it("rejects a forged signature", () => {
    const header = sign(BODY, nowSec(), "whsec_the_wrong_secret");
    expect(() => stripe.webhooks.constructEvent(BODY, header, SECRET, 300)).toThrow();
  });

  it("rejects a STALE request — the replay window", () => {
    // This is the defect. Signed correctly, but captured 10 minutes ago. The old
    // hand-rolled verifier accepted this forever.
    const tenMinutesAgo = nowSec() - 600;
    const header = sign(BODY, tenMinutesAgo);

    expect(() => stripe.webhooks.constructEvent(BODY, header, SECRET, 300)).toThrow(
      /timestamp|tolerance|too old/i
    );
  });

  it("still accepts a request inside the tolerance window", () => {
    const header = sign(BODY, nowSec() - 60);
    expect(() => stripe.webhooks.constructEvent(BODY, header, SECRET, 300)).not.toThrow();
  });

  it("rejects a tampered body even with a valid-looking header", () => {
    const header = sign(BODY, nowSec());
    const tampered = BODY.replace("cs_test_1", "cs_attacker_1");
    expect(() => stripe.webhooks.constructEvent(tampered, header, SECRET, 300)).toThrow();
  });

  it("returns false rather than throwing RangeError on a malformed v1", () => {
    // crypto.timingSafeEqual throws when buffer lengths differ. The old verifier
    // called it unguarded, turning a bad signature into a 500 instead of a 400.
    const header = `t=${nowSec()},v1=deadbeef`;
    expect(() => stripe.webhooks.constructEvent(BODY, header, SECRET, 300)).toThrow(
      Stripe.errors.StripeSignatureVerificationError
    );
  });

  it("rejects a header with no timestamp", () => {
    const v1 = crypto.createHmac("sha256", SECRET).update(BODY).digest("hex");
    expect(() => stripe.webhooks.constructEvent(BODY, `v1=${v1}`, SECRET, 300)).toThrow();
  });

  it("verifies against the RAW body — re-serialised JSON must not validate", () => {
    const header = sign(BODY, nowSec());
    // Same object, different byte sequence (key order / whitespace).
    const reserialised = JSON.stringify(JSON.parse(BODY), null, 2);
    expect(reserialised).not.toBe(BODY);
    expect(() => stripe.webhooks.constructEvent(reserialised, header, SECRET, 300)).toThrow();
  });
});
