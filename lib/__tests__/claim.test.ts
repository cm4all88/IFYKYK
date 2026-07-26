import { describe, expect, it } from "vitest";
import {
  CLAIM_TTL_DAYS,
  claimExpiryFrom,
  claimRejection,
  generateClaimCode,
  isClaimExpired,
  isValidClaimCodeFormat,
} from "@/lib/claim";

describe("isValidClaimCodeFormat", () => {
  it("accepts a real generated code", () => {
    expect(isValidClaimCodeFormat(generateClaimCode())).toBe(true);
  });

  it("accepts exactly 32 lowercase hex characters", () => {
    expect(isValidClaimCodeFormat("0123456789abcdef0123456789abcdef")).toBe(true);
  });

  // The format guard is what stops /claim/<junk> from reaching a
  // service-role query on an unauthenticated route.
  it.each([
    ["empty", ""],
    ["too short", "abc"],
    ["too long", "0123456789abcdef0123456789abcdef0"],
    ["uppercase hex", "0123456789ABCDEF0123456789ABCDEF"],
    ["dashed uuid", "01234567-89ab-cdef-0123-456789abcdef"],
    ["non-hex letters", "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"],
    ["sql-ish payload", "' or 1=1 --                     "],
    ["path traversal", "../../etc/passwd                "],
  ])("rejects %s", (_label, value) => {
    expect(isValidClaimCodeFormat(value)).toBe(false);
  });

  it.each([[null], [undefined], [123], [{}], [[]]])("rejects non-string %s", (value) => {
    expect(isValidClaimCodeFormat(value)).toBe(false);
  });
});

describe("generateClaimCode", () => {
  it("produces distinct codes", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateClaimCode()));
    expect(codes.size).toBe(200);
  });
});

describe("claimExpiryFrom / isClaimExpired", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  it("issues an expiry CLAIM_TTL_DAYS in the future", () => {
    const expiry = new Date(claimExpiryFrom(now)).getTime();
    expect(expiry - now.getTime()).toBe(CLAIM_TTL_DAYS * 86_400_000);
  });

  it("a freshly issued code is not expired", () => {
    expect(isClaimExpired(claimExpiryFrom(now), now)).toBe(false);
  });

  it("expires once the moment passes", () => {
    const expiry = claimExpiryFrom(now);
    const later = new Date(now.getTime() + (CLAIM_TTL_DAYS + 1) * 86_400_000);
    expect(isClaimExpired(expiry, later)).toBe(true);
  });

  it("treats the exact expiry instant as expired", () => {
    const expiry = "2026-01-15T00:00:00.000Z";
    expect(isClaimExpired(expiry, new Date(expiry))).toBe(true);
  });

  // Links issued before the column existed carry NULL and must keep working —
  // this is what stops the migration from locking real creators out.
  it.each([[null], [undefined], [""]])("treats %s as never expiring", (value) => {
    expect(isClaimExpired(value as any, now)).toBe(false);
  });

  it("treats an unparseable timestamp as not expired rather than locking someone out", () => {
    expect(isClaimExpired("not-a-date", now)).toBe(false);
  });
});

describe("claimRejection", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const code = "0123456789abcdef0123456789abcdef";
  const live = { claimed_at: null, claim_expires_at: claimExpiryFrom(now) };

  it("allows a valid, unclaimed, unexpired code", () => {
    expect(claimRejection(code, live, now)).toBeNull();
  });

  it("allows a legacy code with no expiry set", () => {
    expect(claimRejection(code, { claimed_at: null, claim_expires_at: null }, now)).toBeNull();
  });

  it("rejects a malformed code before considering the profile", () => {
    expect(claimRejection("nope", live, now)).toBe("malformed");
  });

  it("reports a missing profile as not_found", () => {
    expect(claimRejection(code, null, now)).toBe("not_found");
    expect(claimRejection(code, undefined, now)).toBe("not_found");
  });

  it("reports an already-claimed page", () => {
    expect(
      claimRejection(code, { claimed_at: "2025-12-01T00:00:00.000Z", claim_expires_at: null }, now)
    ).toBe("already_claimed");
  });

  it("reports an expired invitation", () => {
    expect(
      claimRejection(code, { claimed_at: null, claim_expires_at: "2025-12-01T00:00:00.000Z" }, now)
    ).toBe("expired");
  });

  // Precedence matters for the message the creator sees: someone who already
  // claimed should be told to sign in, not that their link expired.
  it("prefers already_claimed over expired", () => {
    expect(
      claimRejection(
        code,
        { claimed_at: "2025-12-05T00:00:00.000Z", claim_expires_at: "2025-12-01T00:00:00.000Z" },
        now
      )
    ).toBe("already_claimed");
  });
});
