import { describe, expect, it } from "vitest";
import { ACQUISITION_MILESTONES, activationFor, buildFunnel } from "@/lib/acquisition";

const claimed = { claimed_at: "2026-02-01T00:00:00Z" };

describe("activationFor", () => {
  it("always reaches identified", () => {
    const a = activationFor({});
    expect(a.reached.identified).toBe(true);
    expect(a.furthest).toBe("identified");
  });

  it("counts a sent message as contact", () => {
    const a = activationFor({ first_sent_at: "2026-01-01T00:00:00Z" });
    expect(a.reached.contacted).toBe(true);
    expect(a.reached.replied).toBe(false);
  });

  it("counts a replied stage as contact too", () => {
    const a = activationFor({ stage: "replied" });
    expect(a.reached.contacted).toBe(true);
    expect(a.reached.replied).toBe(true);
  });

  // Somebody recruited before this system existed has no outreach row, but
  // they self-evidently were contacted.
  it("implies contact and reply from having joined", () => {
    const a = activationFor({ profile: claimed });
    expect(a.reached.contacted).toBe(true);
    expect(a.reached.replied).toBe(true);
    expect(a.reached.joined).toBe(true);
  });

  it("reads joined from claimed_at, not from stage", () => {
    expect(activationFor({ stage: "joined", profile: null }).reached.joined).toBe(false);
    expect(activationFor({ stage: "identified", profile: claimed }).reached.joined).toBe(true);
  });

  // The trap this test exists for: stripe_account_id is set the moment a
  // Connect account is created, long before the creator can be paid.
  it("does NOT count Stripe as connected when only stripe_onboarded is false", () => {
    const a = activationFor({ profile: { ...claimed, stripe_onboarded: false } });
    expect(a.reached.stripe_connected).toBe(false);
  });

  it("counts Stripe as connected only when stripe_onboarded is true", () => {
    const a = activationFor({ profile: { ...claimed, stripe_onboarded: true } });
    expect(a.reached.stripe_connected).toBe(true);
  });

  it("reads onboarding completion from its timestamp", () => {
    const a = activationFor({ profile: { ...claimed, onboarding_completed_at: "2026-02-02T00:00:00Z" } });
    expect(a.reached.onboarding_completed).toBe(true);
  });

  describe("activated", () => {
    const base = { ...claimed, stripe_onboarded: true };

    it("requires Stripe, a live post, and an active tier together", () => {
      const a = activationFor({ profile: base, live_post_count: 2, active_tier_count: 1 });
      expect(a.reached.activated).toBe(true);
      expect(a.furthest).toBe("activated");
    });

    it.each([
      ["no posts", { profile: base, live_post_count: 0, active_tier_count: 1 }],
      ["no tiers", { profile: base, live_post_count: 3, active_tier_count: 0 }],
      ["no stripe", { profile: { ...claimed, stripe_onboarded: false }, live_post_count: 3, active_tier_count: 1 }],
    ])("is not activated with %s", (_label, input) => {
      expect(activationFor(input as any).reached.activated).toBe(false);
    });

    // Activation measures whether we onboarded them, not whether fans showed up.
    it("does not require a first transaction", () => {
      const a = activationFor({ profile: base, live_post_count: 1, active_tier_count: 1 });
      expect(a.reached.activated).toBe(true);
      expect(a.has_first_transaction).toBe(false);
    });

    it("reports a first transaction separately when present", () => {
      const a = activationFor({ profile: base, first_transaction_at: "2026-03-01T00:00:00Z" });
      expect(a.has_first_transaction).toBe(true);
    });
  });

  it("treats profile completeness as avatar AND bio", () => {
    expect(activationFor({ profile: { ...claimed, avatar_url: "x" } }).profile_complete).toBe(false);
    expect(activationFor({ profile: { ...claimed, bio: "hi" } }).profile_complete).toBe(false);
    expect(activationFor({ profile: { ...claimed, avatar_url: "x", bio: "hi" } }).profile_complete).toBe(true);
  });

  it("scores percent from milestones reached", () => {
    expect(activationFor({}).percent).toBe(Math.round((1 / ACQUISITION_MILESTONES.length) * 100));
    const full = activationFor({
      profile: { ...claimed, onboarding_completed_at: "x", stripe_onboarded: true },
      live_post_count: 1, active_tier_count: 1,
    });
    expect(full.percent).toBe(100);
  });

  it("handles a null profile without throwing", () => {
    expect(() => activationFor({ profile: null, stage: "qualified" })).not.toThrow();
  });
});

describe("buildFunnel", () => {
  const identified = activationFor({});
  const contacted = activationFor({ first_sent_at: "2026-01-01T00:00:00Z" });
  const joined = activationFor({ profile: claimed });
  const activated = activationFor({
    profile: { ...claimed, onboarding_completed_at: "x", stripe_onboarded: true },
    live_post_count: 1, active_tier_count: 1,
  });

  it("returns one row per milestone in order", () => {
    const f = buildFunnel([identified]);
    expect(f.map((r) => r.milestone)).toEqual([...ACQUISITION_MILESTONES]);
  });

  it("counts cumulatively — an activated creator counts at every earlier step", () => {
    const f = buildFunnel([activated]);
    for (const row of f) expect(row.count).toBe(1);
  });

  it("computes percentage of total", () => {
    const f = buildFunnel([identified, contacted, joined, activated]);
    expect(f.find((r) => r.milestone === "identified")!.percent_of_total).toBe(100);
    expect(f.find((r) => r.milestone === "contacted")!.percent_of_total).toBe(75);
    expect(f.find((r) => r.milestone === "joined")!.percent_of_total).toBe(50);
  });

  it("computes step conversion against the previous milestone", () => {
    const f = buildFunnel([identified, contacted, joined, activated]);
    expect(f.find((r) => r.milestone === "identified")!.conversion_from_previous).toBeNull();
    // 3 of 4 identified were contacted.
    expect(f.find((r) => r.milestone === "contacted")!.conversion_from_previous).toBe(75);
  });

  it("does not divide by zero on an empty set", () => {
    const f = buildFunnel([]);
    expect(f.every((r) => r.count === 0 && r.percent_of_total === 0)).toBe(true);
  });
});
