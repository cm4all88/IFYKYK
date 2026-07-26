/**
 * Guards the triage data artifacts: the discovered CSV and the SQL that
 * applies the triage to already-imported prospects.
 *
 * These are data files, not code, but they carry hard invariants — the
 * 15/10/75 split, one transaction, and no destructive statements — that are
 * easy to break silently when the CSV is regenerated.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { dedupeImportRows, parseProspectCsv } from "@/lib/prospect-import";
import { PROSPECT_STAGES } from "@/lib/prospects";

const root = path.resolve(__dirname, "../..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const CSV = "data/creator-prospects-discovered.csv";
const APPLY = "data/apply-creator-triage.sql";

describe("discovered prospect CSV", () => {
  const parsed = parseProspectCsv(read(CSV), "csv");

  it("parses cleanly with no duplicates", () => {
    expect(parsed.errors).toEqual([]);
    expect(parsed.unknownHeaders).toEqual([]);
    expect(parsed.rows).toHaveLength(100);
    expect(dedupeImportRows(parsed.rows).duplicates).toBe(0);
  });

  it("carries no invented follower counts and no placeholder emails", () => {
    for (const r of parsed.rows) {
      expect(r.follower_count).toBeNull();
      if (r.email) {
        expect(r.email).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i);
        expect(r.email).not.toMatch(/filler@|example\.com|noreply|donotreply/i);
      }
    }
  });

  it("every row carries a triage verdict and an in-range score", () => {
    const verdicts = parsed.rows.map((r) => {
      const m = /TRIAGE 2026-07-26: (PRIORITY|BACKUP|REJECT)/.exec(r.notes ?? "");
      expect(m, `no verdict for ${r.display_name}`).toBeTruthy();
      expect(r.score).not.toBeNull();
      expect(r.score!).toBeGreaterThanOrEqual(0);
      expect(r.score!).toBeLessThanOrEqual(100);
      return m![1];
    });
    expect(verdicts.filter((v) => v === "PRIORITY")).toHaveLength(15);
    expect(verdicts.filter((v) => v === "BACKUP")).toHaveLength(10);
    expect(verdicts.filter((v) => v === "REJECT")).toHaveLength(75);
  });
});

describe("apply-creator-triage.sql", () => {
  const sql = read(APPLY);
  const code = sql
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("--"))
    .join("\n")
    .toLowerCase();

  const stageCount = (stage: string) =>
    (sql.match(new RegExp(`, '${stage}', `, "g")) ?? []).length;

  it("applies exactly 15 / 10 / 75", () => {
    expect(stageCount("qualified")).toBe(15);
    expect(stageCount("identified")).toBe(10);
    expect(stageCount("disqualified")).toBe(75);
    expect((sql.match(/^ {2}\('/gm) ?? []).length).toBe(100);
  });

  it("runs in exactly one transaction", () => {
    expect(sql.match(/^begin;$/gm)).toHaveLength(1);
    expect(sql.match(/^commit;$/gm)).toHaveLength(1);
    expect(sql.split("$$")).toHaveLength(3); // one balanced DO block
  });

  it("contains no destructive or schema-changing statement", () => {
    for (const bad of [
      "delete from",
      "truncate",
      "on conflict",
      "alter table",
      "create table public",
      "drop table public",
      "insert into public",
    ]) {
      expect(code, `must not contain ${bad}`).not.toContain(bad);
    }
  });

  it("aborts unless all 100 prospects match uniquely", () => {
    expect(code).toContain("preflight failed");
    expect(sql).toMatch(/raise exception[\s\S]{0,120}matched % of 100/);
    expect(code).toContain("count(distinct id)");
  });

  it("only ever targets rows resolved by the preflight match", () => {
    expect(code).toContain("update public.creator_prospects");
    expect(code).toMatch(/where\s+p\.id\s*=\s*m\.id/);
  });

  it("uses only stage values the admin filter already offers", () => {
    for (const s of ["qualified", "identified", "disqualified"]) {
      expect(PROSPECT_STAGES as readonly string[]).toContain(s);
    }
  });
});
