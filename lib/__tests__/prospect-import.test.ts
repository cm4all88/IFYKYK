import { describe, expect, it } from "vitest";
import { MAX_IMPORT_ROWS, dedupeImportRows, parseCsvLine, parseProspectCsv } from "@/lib/prospect-import";

describe("parseCsvLine", () => {
  it("splits a plain line", () => {
    expect(parseCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("keeps commas inside quotes", () => {
    expect(parseCsvLine('Jane,"Doe, Jane",x')).toEqual(["Jane", "Doe, Jane", "x"]);
  });

  it("handles escaped double quotes", () => {
    expect(parseCsvLine('a,"say ""hi""",c')).toEqual(["a", 'say "hi"', "c"]);
  });

  it("preserves empty fields", () => {
    expect(parseCsvLine("a,,c")).toEqual(["a", "", "c"]);
    expect(parseCsvLine(",,")).toEqual(["", "", ""]);
  });

  it("trims surrounding whitespace", () => {
    expect(parseCsvLine(" a , b ")).toEqual(["a", "b"]);
  });
});

describe("parseProspectCsv", () => {
  it("parses a simple file", () => {
    const r = parseProspectCsv("name,platform,handle\nJane Doe,youtube,janedoe");
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].display_name).toBe("Jane Doe");
    expect(r.rows[0].platform).toBe("youtube");
    expect(r.rows[0].source).toBe("csv");
  });

  it("accepts common header aliases", () => {
    const r = parseProspectCsv("Full Name,Network,Username,Email Address,Subscribers\nJane,tiktok,@jane,press@x.com,900");
    expect(r.rows[0]).toMatchObject({
      display_name: "Jane", platform: "tiktok", platform_handle: "jane",
      email: "press@x.com", follower_count: 900,
    });
  });

  it("strips a UTF-8 BOM, which spreadsheet exports add", () => {
    const r = parseProspectCsv("﻿name\nJane");
    expect(r.rows).toHaveLength(1);
  });

  it("handles CRLF line endings", () => {
    const r = parseProspectCsv("name,niche\r\nJane,cooking\r\nBob,music");
    expect(r.rows).toHaveLength(2);
  });

  it("ignores blank and trailing lines without calling them errors", () => {
    const r = parseProspectCsv("name\nJane\n\n\nBob\n\n");
    expect(r.rows).toHaveLength(2);
    expect(r.errors).toEqual([]);
    expect(r.totalDataLines).toBe(2);
  });

  it("refuses a file with no name column", () => {
    const r = parseProspectCsv("email,platform\npress@x.com,youtube");
    expect(r.rows).toHaveLength(0);
    expect(r.errors[0].errors.join(" ")).toContain("No name column");
  });

  it("refuses an empty file", () => {
    expect(parseProspectCsv("").errors[0].errors.join(" ")).toContain("empty");
    expect(parseProspectCsv("   \n  \n").errors[0].errors.join(" ")).toContain("empty");
  });

  it("reports bad rows with their line number and keeps the good ones", () => {
    const r = parseProspectCsv("name,email\nJane,press@x.com\nBob,not-an-email\nSue,sue@x.com");
    expect(r.rows).toHaveLength(2);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].line).toBe(3);
  });

  it("reports unknown headers instead of silently dropping them", () => {
    const r = parseProspectCsv("name,favourite_colour\nJane,blue");
    expect(r.unknownHeaders).toContain("favourite_colour");
    expect(r.rows).toHaveLength(1);
  });

  it("applies the default source to rows that do not specify one", () => {
    const r = parseProspectCsv("name\nJane", "event");
    expect(r.rows[0].source).toBe("event");
  });

  it("lets a row override the default source", () => {
    const r = parseProspectCsv("name,source\nJane,referral", "event");
    expect(r.rows[0].source).toBe("referral");
  });

  it("caps the number of rows per file", () => {
    const lines = ["name", ...Array.from({ length: MAX_IMPORT_ROWS + 10 }, (_, i) => `Person ${i}`)];
    const r = parseProspectCsv(lines.join("\n"));
    expect(r.rows.length).toBeLessThanOrEqual(MAX_IMPORT_ROWS);
    expect(r.errors.some((e) => e.errors.join(" ").includes("limited to"))).toBe(true);
  });

  it("keeps quoted commas out of the wrong column", () => {
    const r = parseProspectCsv('name,location\n"Doe, Jane","Portland, OR"');
    expect(r.rows[0].display_name).toBe("Doe, Jane");
    expect(r.rows[0].location).toBe("Portland, OR");
  });
});

describe("dedupeImportRows", () => {
  const row = (over: Partial<any> = {}) => ({
    display_name: "Jane", platform: null, platform_handle: null, profile_url: null,
    email: null, niche: null, follower_count: null, location: null, handle_wanted: null,
    source: "csv" as const, source_detail: null, score: null, notes: null,
    follow_up_at: null, do_not_contact: false, ...over,
  });

  it("keeps the first of two rows sharing an email", () => {
    const { kept, duplicates } = dedupeImportRows([
      row({ email: "a@x.com", display_name: "First" }),
      row({ email: "a@x.com", display_name: "Second" }),
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0].display_name).toBe("First");
    expect(duplicates).toBe(1);
  });

  it("matches emails case-insensitively", () => {
    const { kept } = dedupeImportRows([row({ email: "a@x.com" }), row({ email: "A@X.COM" })]);
    expect(kept).toHaveLength(1);
  });

  it("dedupes on platform + handle", () => {
    const { kept } = dedupeImportRows([
      row({ platform: "youtube", platform_handle: "jane" }),
      row({ platform: "youtube", platform_handle: "JANE" }),
    ]);
    expect(kept).toHaveLength(1);
  });

  it("treats the same handle on different platforms as different people", () => {
    const { kept } = dedupeImportRows([
      row({ platform: "youtube", platform_handle: "jane" }),
      row({ platform: "tiktok", platform_handle: "jane" }),
    ]);
    expect(kept).toHaveLength(2);
  });

  it("does not collapse rows that share nothing identifying", () => {
    const { kept, duplicates } = dedupeImportRows([row({ display_name: "A" }), row({ display_name: "B" })]);
    expect(kept).toHaveLength(2);
    expect(duplicates).toBe(0);
  });
});
