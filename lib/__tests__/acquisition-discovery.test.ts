/**
 * Extraction tests. The governing rule is EXTRACT, NEVER INFER — so most of
 * these assert that a function returns null on ambiguous input rather than
 * producing a plausible guess. A wrong email mails a stranger; a wrong
 * location contacts the wrong market; a wrong activity signal wakes a
 * dormant account.
 */
import { describe, expect, it } from "vitest";
import {
  assessIndividual,
  buildCandidate,
  extractActivity,
  extractEmails,
  extractMonetization,
  extractSocials,
  extractUsLocation,
} from "@/lib/acquisition-discovery";
import { qualify } from "@/lib/acquisition-runner";

describe("extractEmails", () => {
  it("finds a published address", () => {
    expect(extractEmails("<p>Email me at hello@studio.com for commissions</p>")).toEqual([
      "hello@studio.com",
    ]);
  });

  it("prefers the site's own domain over free mail", () => {
    const html = "contact studioname@gmail.com or hello@studio.com";
    expect(extractEmails(html, "https://www.studio.com/about")[0]).toBe("hello@studio.com");
  });

  it("discards infrastructure, vendor and placeholder addresses", () => {
    const html = `
      noreply@studio.com do-not-reply@x.com postmaster@y.com
      someone@example.com filler@godaddy.com wp@wixpress.com
      real@studio.com`;
    expect(extractEmails(html)).toEqual(["real@studio.com"]);
  });

  it("does not mistake asset filenames for addresses", () => {
    expect(extractEmails("<img src='sprite@2x.png'> logo@3x.jpg")).toEqual([]);
  });
});

describe("extractActivity", () => {
  it("prefers a machine-readable date over a copyright year of the same age", () => {
    const html = `<meta property="article:modified_time" content="2026-05-04T10:00:00Z"> © 2026`;
    const a = extractActivity(html)!;
    expect(a.kind).toBe("datetime");
    expect(a.year).toBe(2026);
  });

  /**
   * Regression from validating against sfkettlebells.com: the page carries a
   * 2025 datetime and a 2026 copyright, and preferring datetime by kind
   * reported the site as a year staler than it is. Recency wins over kind.
   */
  it("does not let a stale timestamp mask a more recent copyright", () => {
    const html = `<time datetime="2025-01-02">old</time><footer>© 2026 Studio</footer>`;
    const a = extractActivity(html)!;
    expect(a.year).toBe(2026);
    expect(a.kind).toBe("copyright");
  });

  it("takes the latest of many timestamps, not the first in source order", () => {
    const html = `<time datetime="2022-01-01">a</time><time datetime="2026-06-01">b</time>`;
    expect(extractActivity(html)!.year).toBe(2026);
  });

  it("reads 'last modified on'", () => {
    const a = extractActivity("<p>Last modified on July 20, 2026</p>")!;
    expect(a.kind).toBe("modified");
    expect(a.year).toBe(2026);
  });

  it("reads copyright in several shapes, including a range", () => {
    for (const [html, year] of [
      ["© 2026 Studio", 2026],
      ["&copy; 2026", 2026],
      ["Copyright (c) 2026 bakka", 2026],
      ["Copyright 2019-2026 Persika", 2026],
      ["© 2021 Spoon Makes", 2021],
    ] as [string, number][]) {
      expect(extractActivity(html)!.year, html).toBe(year);
    }
  });

  it("returns null when the page says nothing about when it was touched", () => {
    expect(extractActivity("<html><body>Welcome to my site</body></html>")).toBeNull();
  });
});

describe("extractUsLocation", () => {
  it("reads a postal-address shape", () => {
    expect(extractUsLocation("<p>Milwaukee, WI 53202</p>")).toBe("Milwaukee, WI, USA");
    expect(extractUsLocation("Studio in Portland, OR")).toBe("Portland, OR, USA");
  });

  it("reads schema.org address markup", () => {
    const html = `{"addressLocality":"Nashville","addressRegion":"TN"}`;
    expect(extractUsLocation(html)).toBe("Nashville, TN, USA");
  });

  it("handles multi-word city names", () => {
    expect(extractUsLocation("San Francisco, CA 94110")).toBe("San Francisco, CA, USA");
  });

  it("refuses a bare state name in prose", () => {
    // "we ship to Washington" says nothing about where the creator is.
    expect(extractUsLocation("<p>We ship anywhere in Washington</p>")).toBeNull();
    expect(extractUsLocation("<p>Serving all of Texas</p>")).toBeNull();
  });

  it("rejects sentence fragments that fit the comma-state shape", () => {
    expect(extractUsLocation("Copyright, CA")).toBeNull();
    expect(extractUsLocation("and, OR")).toBeNull();
  });

  it("returns null when no location is stated", () => {
    expect(extractUsLocation("<p>Handmade with care</p>")).toBeNull();
  });
});

describe("extractMonetization", () => {
  it("identifies platforms and a published price", () => {
    const m = extractMonetization(
      `<a href="https://patreon.com/x">Patreon</a> commissions from $250`
    )!;
    expect(m.kinds).toContain("patreon");
    expect(m.kinds).toContain("commissions");
    expect(m.price).toContain("250");
  });

  it("recognises coaching as monetization", () => {
    expect(extractMonetization("One-to-one coaching, $89/month")!.kinds).toContain("coaching");
  });

  it("returns null when nothing is for sale", () => {
    expect(extractMonetization("<p>A blog about my dog</p>")).toBeNull();
  });
});

describe("extractSocials", () => {
  it("pulls handles from links", () => {
    const s = extractSocials(
      `<a href="https://instagram.com/maker.co">ig</a><a href="https://www.tiktok.com/@maker">tt</a>`
    );
    expect(s).toContainEqual({ platform: "instagram", handle: "maker.co" });
    expect(s).toContainEqual({ platform: "tiktok", handle: "maker" });
  });

  it("ignores share and intent URLs that are not profiles", () => {
    const s = extractSocials(`<a href="https://twitter.com/intent/tweet?url=x">share</a>`);
    expect(s.find((x) => x.platform === "x")).toBeUndefined();
  });
});

describe("assessIndividual", () => {
  it("detects solo language", () => {
    expect(assessIndividual("<p>I make every piece by hand</p>")!.individual).toBe(true);
    expect(assessIndividual("<p>JoyGothic is just me and some clay</p>")!.individual).toBe(true);
  });

  it("lets team language win, including a registered entity", () => {
    expect(assessIndividual("<p>I make things. EDK Training LLC</p>")!.individual).toBe(false);
    expect(assessIndividual("<p>Our team of artists</p>")!.individual).toBe(false);
  });

  it("returns null when the page says neither", () => {
    expect(assessIndividual("<p>Custom wigs, worldwide shipping</p>")).toBeNull();
  });
});

describe("buildCandidate", () => {
  const GOOD = `<html><body>
    <p>I'm Marty, and I coach kettlebell one-to-one. Coaching from $120/month.</p>
    <p>San Francisco, CA 94110</p>
    <a href="https://instagram.com/sfkettlebells">Instagram</a>
    <p>Email Marty@sfkettlebells.com</p>
    <footer>© 2026 SF Kettlebells</footer>
  </body></html>`;

  it("assembles a record that passes qualification unchanged", () => {
    const c = buildCandidate(GOOD, "https://sfkettlebells.com/");
    expect(c.email).toBe("marty@sfkettlebells.com");
    expect(c.location).toBe("San Francisco, CA, USA");
    expect(c.activity!.year).toBe(2026);
    expect(c.individual).toBe(true);
    expect(c.missing).toEqual([]);

    // The whole point: a discovered candidate flows into the existing
    // qualifier with no special-casing.
    const q = qualify({
      display_name: "Marty Covault",
      email: c.email,
      location: c.location,
      profile_url: c.profile_url,
      platform: "other",
      platform_handle: c.socials[0]?.handle,
      notes: c.notes,
    });
    expect(q.reasons).toEqual([]);
    expect(q.qualified).toBe(true);
  });

  it("lists exactly what is missing instead of guessing it", () => {
    const c = buildCandidate("<html><body><p>Custom wigs</p></body></html>", "https://x.com/");
    expect(c.email).toBeNull();
    expect(c.location).toBeNull();
    expect(c.activity).toBeNull();
    expect(c.individual).toBeNull();
    expect(c.missing).toEqual([
      "business email",
      "US location",
      "activity evidence",
      "monetization evidence",
      "social profile",
      "individual-vs-company evidence",
    ]);
    expect(c.notes).toContain("NOT ESTABLISHED:");
  });

  it("a candidate missing anything does not qualify", () => {
    const noEmail = GOOD.replace("Email Marty@sfkettlebells.com", "DM me on Instagram");
    const c = buildCandidate(noEmail, "https://sfkettlebells.com/");
    expect(c.email).toBeNull();
    const q = qualify({
      display_name: "Marty Covault",
      email: c.email,
      location: c.location,
      profile_url: c.profile_url,
      platform: "other",
      platform_handle: "sfkettlebells",
      notes: c.notes,
    });
    expect(q.reasons).toContain("no_email");
  });

  it("records team language so the company filter can act on it", () => {
    const team = GOOD.replace("I'm Marty, and I coach", "Our team coaches");
    const c = buildCandidate(team, "https://sfkettlebells.com/");
    expect(c.individual).toBe(false);
    expect(c.notes).toContain("TEAM LANGUAGE");
  });
});
