import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { isUnclaimedPreview, shouldSuppressWelcomeEmail } from "@/lib/claim";

describe("isUnclaimedPreview", () => {
  it("is true for a prepared page nobody has claimed", () => {
    expect(isUnclaimedPreview({ published: false, claimed_at: null })).toBe(true);
  });

  // The moment the creator claims it, the page is theirs and should behave
  // like any other creator page — indexable, rich preview card, the lot.
  it("is false once claimed, even while still unpublished", () => {
    expect(isUnclaimedPreview({ published: false, claimed_at: "2026-01-01T00:00:00Z" })).toBe(false);
  });

  it("is false for a normal published page", () => {
    expect(isUnclaimedPreview({ published: true, claimed_at: null })).toBe(false);
    expect(isUnclaimedPreview({ published: true, claimed_at: "2026-01-01T00:00:00Z" })).toBe(false);
  });

  // `published` defaults to true for every row that predates migration 037,
  // so a missing/undefined value must not be read as "unpublished".
  it.each([[undefined], [null]])("is false when published is %s", (published) => {
    expect(isUnclaimedPreview({ published: published as any, claimed_at: null })).toBe(false);
  });

  it.each([[null], [undefined]])("is false for %s input", (value) => {
    expect(isUnclaimedPreview(value as any)).toBe(false);
  });
});

describe("shouldSuppressWelcomeEmail", () => {
  // The core guarantee: an admin preparing a page for somebody must never
  // cause that person to receive mail.
  it("suppresses for an unclaimed concierge profile", () => {
    expect(
      shouldSuppressWelcomeEmail({
        email: "real.person@gmail.com",
        claim_code: "0123456789abcdef0123456789abcdef",
        claimed_at: null,
      })
    ).toBe(true);
  });

  it("suppresses on the synthetic address even with no profile loaded", () => {
    expect(shouldSuppressWelcomeEmail({ email: "concierge_someband@spotlightly.app" })).toBe(true);
  });

  it("matches the synthetic address case-insensitively", () => {
    expect(shouldSuppressWelcomeEmail({ email: "Concierge_SomeBand@Spotlightly.App" })).toBe(true);
  });

  it("does NOT suppress a normal signup", () => {
    expect(
      shouldSuppressWelcomeEmail({ email: "new.creator@gmail.com", claim_code: null, claimed_at: null })
    ).toBe(false);
  });

  // Once claimed, the person has set their own email and password — they are
  // a real user and the ordinary welcome path applies again.
  it("does NOT suppress once the page has been claimed", () => {
    expect(
      shouldSuppressWelcomeEmail({
        email: "real.person@gmail.com",
        claim_code: null,
        claimed_at: "2026-01-01T00:00:00Z",
      })
    ).toBe(false);
  });

  it("does not treat a lookalike address as concierge", () => {
    expect(shouldSuppressWelcomeEmail({ email: "concierge@spotlightly.app" })).toBe(false);
    expect(shouldSuppressWelcomeEmail({ email: "concierge_x@evil.example.com" })).toBe(false);
  });

  it.each([[null], [undefined], [""]])("does not suppress for %s email with no claim code", (email) => {
    expect(shouldSuppressWelcomeEmail({ email: email as any })).toBe(false);
  });
});

// Regression guard for the defect this stage fixed: the footer used to render
// href="{{unsubscribe}}", a literal token nothing ever substituted, so every
// recipient got an opt-out link that went nowhere.
describe("email templates", () => {
  it("contain no unsubstituted {{unsubscribe}} token", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../email.ts"), "utf8");
    expect(src).not.toContain("{{unsubscribe}}");
  });
});
