import { describe, expect, it } from "vitest";
import {
  ADMIN_SETTABLE_STAGES,
  OUTREACH_REFUSAL_MESSAGES,
  PROSPECT_STAGES,
  canAdminSetStage,
  outreachRefusal,
  renderOutreachTemplate,
  validateProspect,
  type ProspectStage,
} from "@/lib/prospects";

describe("validateProspect", () => {
  it("accepts a minimal prospect with just a name", () => {
    const r = validateProspect({ display_name: "Jane Doe" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.display_name).toBe("Jane Doe");
      expect(r.value.source).toBe("manual");
      expect(r.value.do_not_contact).toBe(false);
    }
  });

  it.each([[""], ["   "], [undefined], [null], [123]])("rejects a missing name (%s)", (v) => {
    const r = validateProspect({ display_name: v as any });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toContain("Name is required");
  });

  it("trims whitespace rather than storing it", () => {
    const r = validateProspect({ display_name: "  Jane  ", niche: "  cooking  " });
    expect(r.ok && r.value.display_name).toBe("Jane");
    expect(r.ok && r.value.niche).toBe("cooking");
  });

  it("lowercases email so the unique index behaves predictably", () => {
    const r = validateProspect({ display_name: "J", email: "  Press@Example.COM " });
    expect(r.ok && r.value.email).toBe("press@example.com");
  });

  it("rejects a malformed email instead of storing junk", () => {
    const r = validateProspect({ display_name: "J", email: "not-an-email" });
    expect(r.ok).toBe(false);
  });

  it("treats a blank email as absent, not invalid", () => {
    const r = validateProspect({ display_name: "J", email: "   " });
    expect(r.ok).toBe(true);
    expect(r.ok && r.value.email).toBeNull();
  });

  it("strips a leading @ from a platform handle", () => {
    const r = validateProspect({ display_name: "J", platform_handle: "@janedoe" });
    expect(r.ok && r.value.platform_handle).toBe("janedoe");
  });

  it("accepts known platforms case-insensitively and rejects unknown ones", () => {
    expect(validateProspect({ display_name: "J", platform: "YouTube" }).ok).toBe(true);
    const bad = validateProspect({ display_name: "J", platform: "myspace" });
    expect(bad.ok).toBe(false);
  });

  it("requires a profile URL to be http(s) — no javascript: payloads", () => {
    expect(validateProspect({ display_name: "J", profile_url: "https://x.com/j" }).ok).toBe(true);
    const bad = validateProspect({ display_name: "J", profile_url: "javascript:alert(1)" });
    expect(bad.ok).toBe(false);
  });

  it("parses follower counts with separators, as CSV exports produce", () => {
    const r = validateProspect({ display_name: "J", follower_count: "1,200" });
    expect(r.ok && r.value.follower_count).toBe(1200);
  });

  it.each([["-5"], ["12.5"], ["many"]])("rejects follower count %s", (v) => {
    expect(validateProspect({ display_name: "J", follower_count: v }).ok).toBe(false);
  });

  it.each([[-1], [101], [50.5]])("rejects out-of-range score %s", (v) => {
    expect(validateProspect({ display_name: "J", score: v }).ok).toBe(false);
  });

  it.each([[0], [50], [100]])("accepts score %s", (v) => {
    expect(validateProspect({ display_name: "J", score: v }).ok).toBe(true);
  });

  it("normalises a follow-up date to ISO", () => {
    const r = validateProspect({ display_name: "J", follow_up_at: "2026-09-01" });
    expect(r.ok && r.value.follow_up_at).toBe(new Date("2026-09-01").toISOString());
  });

  it("rejects an unparseable follow-up date", () => {
    expect(validateProspect({ display_name: "J", follow_up_at: "next tuesday-ish" }).ok).toBe(false);
  });

  it("sanitises a wanted handle to the allowed character set", () => {
    const r = validateProspect({ display_name: "J", handle_wanted: "Jane Doe!!" });
    expect(r.ok && r.value.handle_wanted).toBe("janedoe");
  });

  // Whitelisting matters: the route spreads this object straight into an
  // insert, so an attacker-supplied column must not survive validation.
  it("drops unknown fields rather than passing them through", () => {
    const r = validateProspect({ display_name: "J", stage: "joined", id: "x", creator_profile_id: "y" } as any);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect("stage" in r.value).toBe(false);
      expect("id" in r.value).toBe(false);
      expect("creator_profile_id" in r.value).toBe(false);
    }
  });

  it("reports every problem at once rather than one at a time", () => {
    const r = validateProspect({ display_name: "", email: "bad", score: 900 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe("canAdminSetStage", () => {
  it("allows movement between manual stages, including backwards", () => {
    expect(canAdminSetStage("identified", "qualified")).toBe(true);
    expect(canAdminSetStage("replied", "identified")).toBe(true);
    expect(canAdminSetStage("qualified", "disqualified")).toBe(true);
  });

  // These are consequences of real events, not admin opinions.
  it.each<[ProspectStage]>([["joined"], ["invited"], ["page_built"]])(
    "refuses to let an admin set %s by hand",
    (target) => {
      expect(canAdminSetStage("identified", target)).toBe(false);
    }
  );

  it("locks the pipeline once somebody has joined", () => {
    for (const s of ADMIN_SETTABLE_STAGES) {
      if (s === "joined") continue;
      expect(canAdminSetStage("joined", s)).toBe(false);
    }
  });

  it("treats a no-op as allowed", () => {
    for (const s of PROSPECT_STAGES) expect(canAdminSetStage(s, s)).toBe(true);
  });
});

describe("outreachRefusal — the approval gate", () => {
  const approved = { status: "approved", approved_at: "2026-01-01T00:00:00Z", approved_by: "admin-uuid", sent_at: null };
  const prospect = { email: "press@example.com", do_not_contact: false, opted_out_at: null };

  it("permits a fully approved message to a contactable prospect", () => {
    expect(outreachRefusal(prospect, approved)).toBeNull();
  });

  it("refuses a pending draft", () => {
    expect(outreachRefusal(prospect, { ...approved, status: "pending" })).toBe("not_approved");
  });

  it("refuses a rejected draft", () => {
    expect(outreachRefusal(prospect, { ...approved, status: "rejected" })).toBe("rejected");
  });

  // Approval must name a human. A status flip alone is not approval.
  it("refuses when approved_by is missing even though status says approved", () => {
    expect(outreachRefusal(prospect, { ...approved, approved_by: null })).toBe("not_approved");
  });

  it("refuses when approved_at is missing", () => {
    expect(outreachRefusal(prospect, { ...approved, approved_at: null })).toBe("not_approved");
  });

  it("refuses to send twice", () => {
    expect(outreachRefusal(prospect, { ...approved, sent_at: "2026-01-02T00:00:00Z" })).toBe("already_sent");
    expect(outreachRefusal(prospect, { ...approved, status: "sent" })).toBe("already_sent");
  });

  // Checked at send time, not draft time — somebody may opt out in between.
  it("refuses a do-not-contact prospect even with an approved message", () => {
    expect(outreachRefusal({ ...prospect, do_not_contact: true }, approved)).toBe("do_not_contact");
  });

  it("refuses a prospect who unsubscribed after approval", () => {
    expect(outreachRefusal({ ...prospect, opted_out_at: "2026-01-01T12:00:00Z" }, approved)).toBe("opted_out");
  });

  it.each([[null], [""], ["nonsense"]])("refuses when the email is %s", (email) => {
    expect(outreachRefusal({ ...prospect, email: email as any }, approved)).toBe("no_email");
  });

  it("refuses when there is no record at all", () => {
    expect(outreachRefusal(prospect, null)).toBe("not_approved");
    expect(outreachRefusal(prospect, undefined)).toBe("not_approved");
  });

  it("has a human-readable message for every refusal", () => {
    const reasons = ["no_email", "do_not_contact", "opted_out", "not_approved", "already_sent", "rejected"] as const;
    for (const r of reasons) expect(OUTREACH_REFUSAL_MESSAGES[r]).toBeTruthy();
  });
});

describe("renderOutreachTemplate", () => {
  it("substitutes every supported placeholder", () => {
    const out = renderOutreachTemplate(
      "Hi {{name}}, saw you on {{platform}} as @{{handle}} doing {{niche}}. {{claim_url}}",
      { name: "Jane", platform: "youtube", handle: "janedoe", niche: "cooking", claim_url: "https://x/claim/abc" }
    );
    expect(out).toBe("Hi Jane, saw you on youtube as @janedoe doing cooking. https://x/claim/abc");
  });

  it("tolerates whitespace inside the braces", () => {
    expect(renderOutreachTemplate("Hi {{ name }}", { name: "Jane" })).toBe("Hi Jane");
  });

  it("renders missing values as empty rather than the literal placeholder", () => {
    expect(renderOutreachTemplate("Hi {{name}}{{claim_url}}", { name: "Jane" })).toBe("Hi Jane");
  });

  it("leaves unknown placeholders untouched", () => {
    expect(renderOutreachTemplate("Hi {{unknown}}", { name: "Jane" })).toBe("Hi {{unknown}}");
  });
});
