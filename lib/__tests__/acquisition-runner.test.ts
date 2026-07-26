import { describe, expect, it } from "vitest";
import {
  BOUNCE_MIN_SAMPLE,
  MAX_MESSAGES_PER_PROSPECT,
  MAX_NEW_PER_DAY,
  buildInvite,
  extractDetail,
  chooseAvatar,
  firstNameOf,
  initialsFor,
  isUsLocation,
  nextMessage,
  planBatch,
  qualify,
  sendBlock,
  shouldPause,
  type Candidate,
} from "@/lib/acquisition-runner";
import { extractAvatarUrl } from "@/lib/acquisition-service";

const NOW = new Date("2026-07-26T12:00:00Z");
const day = (n: number) => new Date(NOW.getTime() + n * 86400000);

/** A prospect that passes every gate; tests override one field at a time. */
const good = (over: Partial<Candidate> = {}): Candidate => ({
  id: "p1",
  display_name: "Christina Persika",
  email: "christina@persikadesignco.com",
  location: "Milwaukee, WI, USA",
  profile_url: "https://persikadesignco.com/tattoo-tickets",
  platform: "other",
  platform_handle: "persikadesignco",
  niche: "tattoo",
  notes: "Copyright (c) 2026, live cart. Sliding-scale tattoo tickets USD 30-120 plus prints.",
  do_not_contact: false,
  opted_out_at: null,
  history: [],
  ...over,
});

describe("isUsLocation", () => {
  it("accepts explicit US forms", () => {
    for (const l of [
      "Milwaukee, WI, USA",
      "Los Angeles, CA",
      "Nashville, Tennessee",
      "Texas",
      "Somerville, MA, USA",
    ]) {
      expect(isUsLocation(l), l).toBe(true);
    }
  });

  it("rejects foreign and unknown locations", () => {
    for (const l of [
      "Berlin, Germany",
      "London, United Kingdom",
      "Alberta, Canada",
      "Melbourne, VIC, Australia",
      "Italy",
      "",
      null,
      undefined,
    ]) {
      expect(isUsLocation(l as string | null), String(l)).toBe(false);
    }
  });

  /**
   * Regression: the Canada check was ", ca," which matches
   * "San Francisco, CA, USA", and ", de" matches Delaware. Every Californian
   * was silently rejected as foreign.
   */
  it("does not mistake US state codes for country codes", () => {
    expect(isUsLocation("San Francisco, CA, USA")).toBe(true);
    expect(isUsLocation("Los Angeles, CA, USA")).toBe(true);
    expect(isUsLocation("Wilmington, DE, USA")).toBe(true);
    expect(isUsLocation("New Orleans, LA, USA")).toBe(true);
    // "india" is a substring of "Indianapolis"; "china" of "Chinatown".
    expect(isUsLocation("Indianapolis, IN, USA")).toBe(true);
    expect(isUsLocation("Chinatown, San Francisco, CA")).toBe(true);
    // ...while the countries themselves are still caught by name.
    expect(isUsLocation("Toronto, Canada")).toBe(false);
    expect(isUsLocation("Alberta, Canada")).toBe(false);
    expect(isUsLocation("Berlin, Germany")).toBe(false);
  });

  it("lets an explicit foreign country beat a US-looking token", () => {
    // The single most dangerous false positive: a state name inside a
    // non-US string would otherwise qualify someone abroad.
    expect(isUsLocation("Netherlands (originally Washington)")).toBe(false);
    expect(isUsLocation("Washington, UK")).toBe(false);
  });
});

describe("qualify", () => {
  it("passes a fully verified US individual", () => {
    const q = qualify(good());
    expect(q.reasons).toEqual([]);
    expect(q.qualified).toBe(true);
    expect(q.evidence.location).toBe("Milwaukee, WI, USA");
  });

  it("treats absent evidence as disqualifying, never as a pass", () => {
    expect(qualify(good({ notes: "" })).reasons).toContain("no_recent_activity");
    expect(qualify(good({ notes: "" })).reasons).toContain("no_monetization");
    expect(qualify(good({ location: null })).reasons).toContain("not_us");
    expect(qualify(good({ email: null })).reasons).toContain("no_email");
    expect(qualify(good({ profile_url: null })).reasons).toContain("no_social_profile");
    expect(qualify(good({ platform_handle: null })).reasons).toContain("no_social_profile");
  });

  it("rejects companies, studios and agencies by their own words", () => {
    for (const n of [
      "one of the largest cosplay companies in the DACH region",
      "Lightning Cosplay Jansen + Zimmermann GbR",
      "EDK Training LLC, a registered company",
      "References a design team rather than a single maker",
      "a studio, not a self-managed creator",
    ]) {
      const q = qualify(good({ notes: `${n}. Copyright (c) 2026. Patreon.` }));
      expect(q.reasons, n).toContain("not_individual");
      expect(q.qualified).toBe(false);
    }
  });

  it("rejects role and placeholder addresses", () => {
    for (const e of [
      "noreply@example.com",
      "no-reply@foo.com",
      "postmaster@foo.com",
      "someone@example.com",
      "filler@godaddy.com",
    ]) {
      const q = qualify(good({ email: e }));
      expect(
        q.reasons.includes("role_or_placeholder_email") || q.reasons.includes("no_email"),
        e
      ).toBe(true);
    }
  });

  it("honours suppression flags", () => {
    expect(qualify(good({ do_not_contact: true })).reasons).toContain("suppressed");
    expect(qualify(good({ opted_out_at: "2026-01-01" })).reasons).toContain("suppressed");
  });
});

describe("sendBlock", () => {
  const p = { email: "a@b.com", do_not_contact: false, opted_out_at: null };

  it("allows a clean prospect with no history", () => {
    expect(sendBlock(p, [])).toBeNull();
  });

  it("stops permanently on any negative signal", () => {
    expect(sendBlock(p, [{ bounced_at: "x" }])).toBe("bounced");
    expect(sendBlock(p, [{ unsubscribed_at: "x" }])).toBe("opted_out");
    expect(sendBlock(p, [{ complained_at: "x" }])).toBe("complained");
    expect(sendBlock(p, [{ replied_at: "x" }])).toBe("replied");
    expect(sendBlock({ ...p, do_not_contact: true }, [])).toBe("do_not_contact");
    expect(sendBlock({ ...p, opted_out_at: "x" }, [])).toBe("opted_out");
  });

  it("caps the sequence at three messages", () => {
    const sent = (n: number) => Array.from({ length: n }, () => ({ sent_at: "2026-07-01" }));
    expect(sendBlock(p, sent(2))).toBeNull();
    expect(sendBlock(p, sent(MAX_MESSAGES_PER_PROSPECT))).toBe("max_messages");
    expect(sendBlock(p, sent(9))).toBe("max_messages");
  });

  it("a bounce outranks having room left in the sequence", () => {
    expect(sendBlock(p, [{ sent_at: "2026-07-01", bounced_at: "2026-07-01" }])).toBe("bounced");
  });
});

describe("nextMessage", () => {
  it("sends the first message immediately", () => {
    const n = nextMessage([], NOW)!;
    expect(n.sequence).toBe(1);
    expect(n.due).toBe(true);
  });

  it("schedules follow-ups at 4 and 9 days from the FIRST send", () => {
    const first = { sent_at: NOW.toISOString() };
    const a = nextMessage([first], day(3))!;
    expect(a.sequence).toBe(2);
    expect(a.due).toBe(false);
    expect(nextMessage([first], day(4))!.due).toBe(true);

    // Second message lands late; the final must still be day 9 from the
    // first, not day 9 from the second.
    const second = { sent_at: day(6).toISOString() };
    const b = nextMessage([first, second], day(9))!;
    expect(b.sequence).toBe(3);
    expect(b.dueAt.toISOString()).toBe(day(9).toISOString());
    expect(b.due).toBe(true);
  });

  it("returns null once three have gone", () => {
    const h = [{ sent_at: NOW.toISOString() }, { sent_at: day(4).toISOString() }, { sent_at: day(9).toISOString() }];
    expect(nextMessage(h, day(30))).toBeNull();
  });
});

describe("bounce circuit breaker", () => {
  it("ignores a small sample", () => {
    expect(shouldPause(3, 1)).toBe(false);
    expect(shouldPause(BOUNCE_MIN_SAMPLE - 1, BOUNCE_MIN_SAMPLE - 1)).toBe(false);
  });

  it("pauses above 5% once the sample is meaningful", () => {
    expect(shouldPause(100, 5)).toBe(false); // exactly 5% is not "exceeds"
    expect(shouldPause(100, 6)).toBe(true);
    expect(shouldPause(20, 2)).toBe(true);
  });

  it("plans nothing at all while paused", () => {
    const plan = planBatch([good()], { now: NOW, stats: { sent: 100, bounced: 20 } });
    expect(plan.paused).toBe(true);
    expect(plan.send).toEqual([]);
    expect(plan.pauseReason).toMatch(/20\.0% exceeds 5%/);
  });
});

describe("planBatch", () => {
  it("plans a qualified prospect", () => {
    const plan = planBatch([good()], { now: NOW, limit: 10 });
    expect(plan.send).toHaveLength(1);
    expect(plan.send[0].sequence).toBe(1);
  });

  it("never contacts the same person twice through duplicate records", () => {
    const plan = planBatch(
      [good({ id: "a" }), good({ id: "b", display_name: "Christina P" })],
      { now: NOW, limit: 10 }
    );
    expect(plan.send).toHaveLength(1);
    expect(plan.skipped.map((s) => s.reason)).toContain("duplicate_email");
  });

  it("respects an already-contacted list", () => {
    const plan = planBatch([good()], {
      now: NOW,
      limit: 10,
      alreadyContactedEmails: ["CHRISTINA@persikadesignco.com"],
    });
    expect(plan.send).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe("duplicate_email");
  });

  it("enforces the batch limit and the daily cap independently", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      good({ id: `p${i}`, email: `c${i}@persikadesignco.com` })
    );
    expect(planBatch(many, { now: NOW, limit: 10 }).send).toHaveLength(10);

    const capped = planBatch(many, { now: NOW, limit: 30, sentToday: MAX_NEW_PER_DAY - 2 });
    expect(capped.send).toHaveLength(2);
    expect(capped.skipped.some((s) => s.reason === "daily_cap")).toBe(true);
  });

  it("skips unqualified prospects with the reason recorded", () => {
    const plan = planBatch([good({ location: "Berlin, Germany" })], { now: NOW, limit: 10 });
    expect(plan.send).toHaveLength(0);
    expect(plan.skipped[0].reason).toMatch(/^unqualified:.*not_us/);
  });

  it("does not re-qualify a follow-up mid-sequence", () => {
    // Site went quiet after contact; the sequence should still finish.
    const c = good({ notes: "no activity evidence at all", history: [{ sent_at: NOW.toISOString() }] });
    const plan = planBatch([c], { now: day(5), limit: 10 });
    expect(plan.send).toHaveLength(1);
    expect(plan.send[0].sequence).toBe(2);
  });

  it("holds a follow-up that is not due yet", () => {
    const c = good({ history: [{ sent_at: NOW.toISOString() }] });
    const plan = planBatch([c], { now: day(2), limit: 10 });
    expect(plan.send).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe("follow_up_not_due");
  });
});

describe("invitation copy", () => {
  const mail = buildInvite({
    displayName: "Christina Persika",
    detail: "your sliding-scale tattoo tickets",
    claimUrl: "https://spotlightly.app/claim/" + "a".repeat(32),
  });

  it("uses the exact subject and opening", () => {
    expect(mail.subject).toBe("I built a Spotlightly page for Christina Persika");
    expect(mail.text.startsWith("Hi Christina,")).toBe(true);
    expect(mail.text).toContain("I came across your sliding-scale tattoo tickets.");
  });

  it("says unlisted, never private", () => {
    expect(mail.text).toContain("unlisted Spotlightly page");
    expect(mail.text).toContain("not listed in Spotlightly discovery");
    expect(mail.text.toLowerCase()).not.toContain("private");
  });

  it("carries the claim link and no obligation", () => {
    expect(mail.text).toContain("/claim/" + "a".repeat(32));
    expect(mail.text).toContain("claim it, request changes, or ignore it");
    expect(mail.text).toContain("Chris\nFounder, Spotlightly");
  });

  it("drops the opener entirely rather than inventing one", () => {
    const m = buildInvite({ displayName: "Ada", detail: null, claimUrl: "https://x/claim/y" });
    expect(m.text).not.toContain("I came across");
    expect(m.text.startsWith("Hi Ada,")).toBe(true);
  });

  it("escalates politely and promises to stop", () => {
    const url = "https://x/claim/y";
    expect(buildInvite({ displayName: "Ada", claimUrl: url, sequence: 2 }).subject).toMatch(/^Re: /);
    const last = buildInvite({ displayName: "Ada", claimUrl: url, sequence: 3 });
    expect(last.text).toContain("last email I will send");
    expect(last.text).toContain("reply and I will delete it");
  });

  it("derives a sensible first name", () => {
    expect(firstNameOf("Christina Persika")).toBe("Christina");
    expect(firstNameOf("Elise (Porzellan Props)")).toBe("Elise");
    expect(firstNameOf("")).toBe("there");
    expect(firstNameOf(null)).toBe("there");
  });

  /**
   * Regressions from the first dry run, which produced "Hi The," and
   * "Hi lost," and "Hi Ink,". A brand name must be greeted whole.
   */
  it("never splits a brand name into a fake first name", () => {
    expect(firstNameOf("The Geeky Seamstress")).toBe("The Geeky Seamstress");
    expect(firstNameOf("Ink By Faye")).toBe("Ink By Faye");
    expect(firstNameOf("lost boy ?")).toBe("lost boy ?");
    expect(firstNameOf("PlexiCosplay")).toBe("PlexiCosplay");
    expect(firstNameOf("bakka cosplay")).toBe("bakka cosplay");
    expect(firstNameOf("King Of Weighted Coaching")).toBe("King Of Weighted Coaching");
    for (const n of ["The Geeky Seamstress", "Ink By Faye", "lost boy ?"]) {
      expect(buildInvite({ displayName: n, claimUrl: "https://x/c" }).text).not.toMatch(
        /^Hi (The|Ink|lost),/
      );
    }
  });
});

describe("extractDetail", () => {
  it("takes one grammatical clause from the verified notes", () => {
    const d = extractDetail(
      "VERIFIED. MONETIZATION: own shop for handcrafted costumes and patterns, affiliate partnerships (CoscomCosplay) and paid appearances. SOCIALS: x."
    );
    expect(d).toBe("your own shop for handcrafted costumes and patterns");
    expect(`I came across ${d}.`).toBe(
      "I came across your own shop for handcrafted costumes and patterns."
    );
  });

  it("returns null rather than inventing an opener", () => {
    expect(extractDetail("MONETIZATION is a full priced ladder: USD 50 consultation.")).toBeNull();
    expect(extractDetail("no monetization section here")).toBeNull();
    expect(extractDetail("MONETIZATION: short.")).toBeNull();
    expect(extractDetail(null)).toBeNull();
  });

  it("drops the sentence entirely when there is no detail", () => {
    const m = buildInvite({
      displayName: "Ink By Faye",
      detail: extractDetail("no section"),
      claimUrl: "https://x/c",
    });
    expect(m.text).not.toContain("I came across");
  });
});

describe("triage verdicts outrank the keyword heuristics", () => {
  const dormant = {
    id: "x",
    display_name: "The Geeky Seamstress",
    email: "a@b.com",
    location: "Texas, USA",
    profile_url: "https://thegeekyseamstress.com/costume-commissions/",
    platform: "other",
    platform_handle: "thegeekyseamstress",
    notes:
      "Commissions are open. Copyright (c) 2026. Patreon. " +
      "TRIAGE 2026-07-26: REJECT. Inactive - newest dated content is April 2025.",
  };

  it("refuses somebody a human reviewer rejected", () => {
    const q = qualify(dormant);
    expect(q.reasons).toContain("triage_rejected");
    expect(q.qualified).toBe(false);
    expect(planBatch([{ ...dormant, history: [] }], { now: NOW, limit: 10 }).send).toHaveLength(0);
  });

  it("still qualifies somebody the reviewer kept", () => {
    const kept = { ...dormant, notes: dormant.notes.replace("REJECT.", "PRIORITY (score 93).") };
    expect(qualify(kept).reasons).not.toContain("triage_rejected");
  });
});

describe("avatar selection", () => {
  it("prefers the creator's own website", () => {
    const a = chooseAvatar({
      displayName: "Ada Lovelace",
      websiteAvatarUrl: "https://site.com/avatar.png",
      websiteSourceUrl: "https://site.com/about",
      socialAvatarUrl: "https://cdn.social/pic.jpg",
    });
    expect(a.source).toBe("website");
    expect(a.sourceUrl).toBe("https://site.com/about");
  });

  it("falls back to social, then to initials", () => {
    expect(chooseAvatar({ displayName: "A", socialAvatarUrl: "https://cdn/x.png" }).source).toBe("social");
    const p = chooseAvatar({ displayName: "Ada Lovelace" });
    expect(p.source).toBe("placeholder");
    expect(p.initials).toBe("AL");
    expect(p.url).toBeNull();
  });

  it("refuses post, gallery and product imagery", () => {
    for (const u of [
      "https://site.com/posts/2024/pic.jpg",
      "https://site.com/gallery/shot.png",
      "https://site.com/products/thing.jpg",
      "https://site.com/uploads/2025/img.png",
    ]) {
      expect(chooseAvatar({ displayName: "Ada", websiteAvatarUrl: u }).source, u).toBe("placeholder");
    }
  });

  it("refuses non-https images", () => {
    expect(chooseAvatar({ displayName: "Ada", websiteAvatarUrl: "http://site.com/a.png" }).source)
      .toBe("placeholder");
  });

  it("builds initials from awkward names", () => {
    expect(initialsFor("Mo's Parlor")).toBe("MP");
    expect(initialsFor("bakka cosplay")).toBe("BC");
    expect(initialsFor("TIFFY")).toBe("TI");
    expect(initialsFor("")).toBe("?");
  });
});

describe("extractAvatarUrl", () => {
  it("prefers an icon over og:image", () => {
    const html =
      `<link rel="apple-touch-icon" href="/icon.png">` +
      `<meta property="og:image" content="https://site.com/products/hero.jpg">`;
    expect(extractAvatarUrl(html, "https://site.com/about")).toBe("https://site.com/icon.png");
  });

  it("resolves relative URLs and rejects non-https", () => {
    expect(extractAvatarUrl(`<link rel="icon" href="/a.png">`, "https://s.com/x")).toBe("https://s.com/a.png");
    expect(extractAvatarUrl(`<link rel="icon" href="http://s.com/a.png">`, "https://s.com/x")).toBeNull();
  });

  it("returns null when there is nothing", () => {
    expect(extractAvatarUrl("<html><body>hi</body></html>", "https://s.com")).toBeNull();
  });
});
