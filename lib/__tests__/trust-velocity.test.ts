import { describe, it, expect } from "vitest";
import { evaluateVelocity, isEstablishedCreator, type VelocityCounts } from "@/lib/trust/velocity";
import { DEFAULT_TRUST_CONFIG as C } from "@/lib/trust/config";
import { networkPrefix, requestContextFrom } from "@/lib/trust/request-context";

const zero: VelocityCounts = {
  creator10m: 0, creator1h: 0, creatorUncompleted1h: 0, creatorSucceeded1h: 0,
  guestIp10m: 0, guestIp1h: 0, fan10m: null, fan1h: null,
};

describe("tip velocity limits", () => {
  it("allows normal traffic", () => {
    expect(evaluateVelocity(zero, C, false).allowed).toBe(true);
    expect(evaluateVelocity({ ...zero, creator10m: 4 }, C, false).allowed).toBe(true);
  });

  it("blocks the 6th attempt to one creator in 10 minutes", () => {
    const r = evaluateVelocity({ ...zero, creator10m: 5, creator1h: 5 }, C, false);
    expect(r.allowed).toBe(false);
    expect(r.rule).toBe("creator_attempts_10m");
  });

  it("blocks the 11th attempt to one creator in an hour", () => {
    expect(evaluateVelocity({ ...zero, creator10m: 2, creator1h: 10 }, C, false).rule).toBe("creator_attempts_1h");
  });

  it("the incident burst (28 x $9 in 17 minutes) is stopped at the 6th", () => {
    let allowed = 0;
    for (let i = 0; i < 28; i++) {
      const r = evaluateVelocity({ ...zero, creator10m: allowed, creator1h: allowed }, C, false);
      if (!r.allowed) break;
      allowed++;
    }
    expect(allowed).toBe(5);
  });

  it("guest limit applies per IP", () => {
    const r = evaluateVelocity({ ...zero, guestIp10m: 5 }, C, false);
    expect(r.rule).toBe("guest_ip_attempts_10m");
    expect(evaluateVelocity({ ...zero, guestIp1h: 10 }, C, false).rule).toBe("guest_ip_attempts_1h");
  });

  it("signed in fan limit applies regardless of IP (VPN rotation does not help)", () => {
    const r = evaluateVelocity({ ...zero, guestIp10m: null, guestIp1h: null, fan10m: 5, fan1h: 5 }, C, false);
    expect(r.rule).toBe("fan_attempts_10m");
  });

  it("many uncompleted sessions with no success blocks (card testing shape)", () => {
    expect(evaluateVelocity({ ...zero, creator1h: 8, creatorUncompleted1h: 8, creatorSucceeded1h: 0 }, { ...C, velocity: { ...C.velocity, creatorAttempts1h: 100 } }, false).rule)
      .toBe("creator_uncompleted_sessions_1h");
  });

  it("established creators get a higher per creator ceiling, never a higher fan or IP ceiling", () => {
    expect(evaluateVelocity({ ...zero, creator10m: 5, creator1h: 5 }, C, true).allowed).toBe(true);
    expect(evaluateVelocity({ ...zero, creator10m: 15, creator1h: 15 }, C, true).allowed).toBe(false);
    expect(evaluateVelocity({ ...zero, guestIp10m: 5 }, C, true).allowed).toBe(false);
  });

  it("established means old enough, enough posts, no open flags", () => {
    const now = new Date("2026-09-23T00:00:00Z");
    const old = new Date(now.getTime() - 40 * 86_400_000).toISOString();
    expect(isEstablishedCreator({ createdAt: old, publishedPostCount: 3, hasOpenFlags: false, now }, C)).toBe(true);
    expect(isEstablishedCreator({ createdAt: old, publishedPostCount: 3, hasOpenFlags: true, now }, C)).toBe(false);
    expect(isEstablishedCreator({ createdAt: old, publishedPostCount: 0, hasOpenFlags: false, now }, C)).toBe(false);
  });

  it("refusal message has no dashes", () => {
    const r = evaluateVelocity({ ...zero, creator10m: 99 }, C, false);
    expect(r.userMessage!).not.toMatch(/[\u2012-\u2015-]/);
  });
});

describe("request context", () => {
  it("takes the first forwarded IP and Vercel geo headers", () => {
    const h = new Map([["x-forwarded-for", "103.135.100.7, 10.0.0.1"], ["x-vercel-ip-country", "HK"], ["user-agent", "curl/8"]]);
    const ctx = requestContextFrom({ get: (k) => h.get(k) ?? null });
    expect(ctx).toMatchObject({ ip: "103.135.100.7", country: "HK", userAgent: "curl/8" });
  });
  it("groups IPv4 by /24", () => {
    expect(networkPrefix("103.135.100.7")).toBe("103.135.100.0/24");
    expect(networkPrefix("103.135.100.201")).toBe("103.135.100.0/24");
    expect(networkPrefix(null)).toBeNull();
  });
});
