import { describe, it, expect } from "vitest";
import {
  referralRejection,
  creditsEarned,
  progressToNextCredit,
  REFERRALS_PER_CREDIT,
  CREDIT_AMOUNT_USD,
} from "@/lib/referral-credit";

// `/api/referrals/creator` was unauthenticated, ran with the service role, and
// took the credited creator's handle from the request body. Five unauthenticated
// POSTs minted $29 of credit, repeatable without limit. Its self-referral guard
// was skipped entirely when `referredUserId` was absent, and when present it
// compared the REFERRER's own user_id against it.

const REFERRER_USER = "user-referrer";
const REFERRER_PROFILE = "profile-referrer";
const OTHER_USER = "user-someone-else";

describe("referralRejection — who may be credited", () => {
  it("allows a genuine referral", () => {
    expect(
      referralRejection({
        referrerUserId: REFERRER_USER,
        referrerProfileId: REFERRER_PROFILE,
        referredUserId: OTHER_USER,
      })
    ).toBeNull();
  });

  it("refuses an unauthenticated caller", () => {
    expect(
      referralRejection({ referrerUserId: null, referrerProfileId: REFERRER_PROFILE, referredUserId: OTHER_USER })
    ).toBe("unauthenticated");
    expect(
      referralRejection({ referrerUserId: "   ", referrerProfileId: REFERRER_PROFILE, referredUserId: OTHER_USER })
    ).toBe("unauthenticated");
  });

  it("refuses when the referrer has no creator profile", () => {
    expect(
      referralRejection({ referrerUserId: REFERRER_USER, referrerProfileId: null, referredUserId: OTHER_USER })
    ).toBe("no_creator_profile");
  });

  it("REQUIRES a referred user — the old code skipped its guard without one", () => {
    // This is the exact hole: referredUserId was optional, and when absent the
    // self-referral check never ran, so `{ referrerHandle }` alone minted credit.
    for (const referredUserId of [null, undefined, ""]) {
      expect(
        referralRejection({ referrerUserId: REFERRER_USER, referrerProfileId: REFERRER_PROFILE, referredUserId })
      ).toBe("missing_referred_user");
    }
  });

  it("refuses self-referral", () => {
    expect(
      referralRejection({
        referrerUserId: REFERRER_USER,
        referrerProfileId: REFERRER_PROFILE,
        referredUserId: REFERRER_USER,
      })
    ).toBe("self_referral");
  });

  it("refuses a duplicate referral of the same account", () => {
    expect(
      referralRejection({
        referrerUserId: REFERRER_USER,
        referrerProfileId: REFERRER_PROFILE,
        referredUserId: OTHER_USER,
        alreadyRecorded: true,
      })
    ).toBe("duplicate_referral");
  });

  it("checks unauthenticated before anything else", () => {
    // A caller with no session and a self-referral should read as unauthenticated.
    expect(
      referralRejection({ referrerUserId: null, referrerProfileId: null, referredUserId: null })
    ).toBe("unauthenticated");
  });
});

describe("creditsEarned — how much credit a count has actually earned", () => {
  it("awards nothing below the threshold", () => {
    for (let n = 0; n < REFERRALS_PER_CREDIT; n++) {
      expect(creditsEarned(n)).toEqual({ credits: 0, referralsConsumed: 0, amountUsd: 0 });
    }
  });

  it("awards exactly one credit at the threshold", () => {
    expect(creditsEarned(REFERRALS_PER_CREDIT)).toEqual({
      credits: 1,
      referralsConsumed: REFERRALS_PER_CREDIT,
      amountUsd: CREDIT_AMOUNT_USD,
    });
  });

  it("awards whole credits only, and consumes exactly what it pays for", () => {
    const r = creditsEarned(12); // 2 whole credits from 10 referrals, 2 left over
    expect(r.credits).toBe(2);
    expect(r.referralsConsumed).toBe(10);
    expect(r.amountUsd).toBe(58);
  });

  it("never pays for referrals it does not consume", () => {
    for (const n of [5, 9, 10, 11, 25, 33]) {
      const r = creditsEarned(n);
      expect(r.referralsConsumed).toBe(r.credits * REFERRALS_PER_CREDIT);
      expect(r.referralsConsumed).toBeLessThanOrEqual(n);
    }
  });

  it("is safe against nonsense input", () => {
    for (const bad of [NaN, -5, Infinity as any]) {
      const r = creditsEarned(bad as number);
      expect(r.credits).toBeGreaterThanOrEqual(0);
      expect(r.amountUsd).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("progressToNextCredit", () => {
  it("reports the remainder toward the next credit", () => {
    expect(progressToNextCredit(0)).toBe(0);
    expect(progressToNextCredit(3)).toBe(3);
    expect(progressToNextCredit(5)).toBe(0);
    expect(progressToNextCredit(7)).toBe(2);
  });

  it("never returns a negative", () => {
    expect(progressToNextCredit(-3)).toBe(0);
    expect(progressToNextCredit(NaN)).toBe(0);
  });
});
