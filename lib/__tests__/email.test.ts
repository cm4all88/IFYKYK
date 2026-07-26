import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The unsubscribe helpers read process.env at call time, so each test can set
// its own secret. Import fresh per test to avoid module-level caching surprises.
async function loadEmail() {
  vi.resetModules();
  return import("@/lib/email");
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.EMAIL_UNSUBSCRIBE_SECRET = "test-secret-value";
  process.env.NEXT_PUBLIC_APP_URL = "https://www.spotlightly.app";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("unsubscribe signatures", () => {
  it("verifies a signature it produced", async () => {
    const { unsubscribeSignature, verifyUnsubscribeSignature } = await loadEmail();
    const sig = unsubscribeSignature("Fan@Example.com");
    expect(sig).toBeTruthy();
    expect(verifyUnsubscribeSignature("Fan@Example.com", sig!)).toBe(true);
  });

  it("normalises case and whitespace so the link survives mail clients", async () => {
    const { unsubscribeSignature, verifyUnsubscribeSignature } = await loadEmail();
    const sig = unsubscribeSignature("  FAN@example.com  ");
    expect(verifyUnsubscribeSignature("fan@example.com", sig!)).toBe(true);
  });

  // This is the property that stops one person unsubscribing another.
  it("rejects a signature for a different address", async () => {
    const { unsubscribeSignature, verifyUnsubscribeSignature } = await loadEmail();
    const sig = unsubscribeSignature("victim@example.com");
    expect(verifyUnsubscribeSignature("attacker@example.com", sig!)).toBe(false);
  });

  it.each([["empty", ""], ["garbage", "deadbeef"], ["wrong length", "abc123"]])(
    "rejects a %s signature",
    async (_label, sig) => {
      const { verifyUnsubscribeSignature } = await loadEmail();
      expect(verifyUnsubscribeSignature("fan@example.com", sig)).toBe(false);
    }
  );

  it("cannot be verified once the secret rotates", async () => {
    const first = await loadEmail();
    const sig = first.unsubscribeSignature("fan@example.com")!;
    process.env.EMAIL_UNSUBSCRIBE_SECRET = "a-different-secret";
    const second = await loadEmail();
    expect(second.verifyUnsubscribeSignature("fan@example.com", sig)).toBe(false);
  });
});

describe("unsubscribe URL", () => {
  it("round-trips the address through the encoded parameter", async () => {
    const { unsubscribeUrl, decodeUnsubEmail } = await loadEmail();
    const url = unsubscribeUrl("fan+tag@example.com");
    expect(url).toBeTruthy();
    const e = new URL(url!).searchParams.get("e")!;
    expect(decodeUnsubEmail(e)).toBe("fan+tag@example.com");
  });

  it("produces a URL whose signature verifies against the decoded address", async () => {
    const { unsubscribeUrl, decodeUnsubEmail, verifyUnsubscribeSignature } = await loadEmail();
    const url = new URL(unsubscribeUrl("fan@example.com")!);
    const email = decodeUnsubEmail(url.searchParams.get("e")!)!;
    expect(verifyUnsubscribeSignature(email, url.searchParams.get("s")!)).toBe(true);
  });

  it("is base64url encoded — no characters that break in a mail client", async () => {
    const { unsubscribeUrl } = await loadEmail();
    const e = new URL(unsubscribeUrl("someone.with.a.long+address@example.com")!).searchParams.get("e")!;
    expect(e).not.toMatch(/[+/=]/);
  });

  // The whole point of the change: no dead {{unsubscribe}} token. If we
  // cannot sign a link, we must render no link at all.
  it("returns null when no signing secret is configured", async () => {
    delete process.env.EMAIL_UNSUBSCRIBE_SECRET;
    const { unsubscribeUrl, unsubscribeSignature } = await loadEmail();
    expect(unsubscribeUrl("fan@example.com")).toBeNull();
    expect(unsubscribeSignature("fan@example.com")).toBeNull();
  });

  it("returns null when the secret is blank", async () => {
    process.env.EMAIL_UNSUBSCRIBE_SECRET = "   ";
    const { unsubscribeUrl } = await loadEmail();
    expect(unsubscribeUrl("fan@example.com")).toBeNull();
  });
});

describe("decodeUnsubEmail", () => {
  it.each([["not base64", "!!!!"], ["decodes without an @", "aGVsbG8"], ["empty", ""]])(
    "rejects input that %s",
    async (_label, value) => {
      const { decodeUnsubEmail } = await loadEmail();
      expect(decodeUnsubEmail(value)).toBeNull();
    }
  );
});

describe("footer honesty", () => {
  it("exports the account-relationship wording used as the default", async () => {
    const { ACCOUNT_RELATIONSHIP } = await loadEmail();
    expect(ACCOUNT_RELATIONSHIP).toContain("Spotlightly account");
  });
});
