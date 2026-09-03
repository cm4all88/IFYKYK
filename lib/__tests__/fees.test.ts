import { describe, expect, it } from "vitest";
import {
  STRIPE_FIXED_CENTS,
  STRIPE_PCT,
  appFeePercentForGrossUp,
  grossUpForStripe,
} from "@/lib/fees";

describe("grossUpForStripe", () => {
  it("nets the creator at least the original amount after Stripe's fee", () => {
    for (const net of [100, 500, 999, 1500, 2999, 350000]) {
      const gross = grossUpForStripe(net);
      const afterStripe = gross - gross * STRIPE_PCT - STRIPE_FIXED_CENTS;
      expect(afterStripe).toBeGreaterThanOrEqual(net);
    }
  });

  it("returns whole cents", () => {
    for (const net of [100, 999, 1234, 2999]) {
      expect(Number.isInteger(grossUpForStripe(net))).toBe(true);
    }
  });
});

describe("appFeePercentForGrossUp", () => {
  // Stripe rejects application_fee_percent with more than two decimal places
  // ("Invalid decimal: 5.7547; must contain at maximum two decimal places"),
  // which broke subscription checkout entirely. Sweep every price from $0.50
  // to $500 to prove no price can produce a >2-decimal percentage.
  it("never has more than two decimal places", () => {
    for (let net = 50; net <= 50000; net += 1) {
      const pct = appFeePercentForGrossUp(net);
      expect(Math.round(pct * 100) / 100).toBe(pct);
    }
  });

  it("matches what toFixed(2) sends to Stripe exactly", () => {
    // The subscribe route serializes with toFixed(2); flooring in the helper
    // means serialization can never re-round the value.
    for (const net of [999, 500, 2999, 1500]) {
      const pct = appFeePercentForGrossUp(net);
      expect(Number(pct.toFixed(2))).toBe(pct);
    }
  });

  it("is floored, so the creator never receives less than their sticker price", () => {
    for (let net = 50; net <= 50000; net += 7) {
      const gross = grossUpForStripe(net);
      const pct = appFeePercentForGrossUp(net);
      const appFeeCents = gross * (pct / 100);
      // Creator receives gross - application fee on a destination charge.
      expect(gross - appFeeCents).toBeGreaterThanOrEqual(net);
    }
  });

  it("handles the reported failing case (a $9.99 subscription)", () => {
    // Raw value here is 5.7547…% — the exact "Invalid decimal" from production.
    expect(appFeePercentForGrossUp(999)).toBe(5.75);
  });
});
