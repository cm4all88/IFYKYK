import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { FakeDb } from "./helpers/fake-supabase";
import { loadTransactions, summarizeTransactions, transactionsToCsv, type Txn } from "@/lib/admin/transactions";
import { executePostAction, planPostAction, type PostModState } from "@/lib/admin/post-moderation";
import { parseDays, parseTxnTypes } from "@/lib/admin/filters";

const T = "2026-09-20T10:00:00Z";

describe("platform transaction ledger", () => {
  const db = () => new FakeDb({
    tips: [
      { id: "t1", creator_profile_id: "c1", amount: 9, platform_receives: 0, status: "succeeded", created_at: T, stripe_payment_intent_id: "pi_1" },
      { id: "t2", creator_profile_id: "c1", amount: 9, platform_receives: 0, status: "expired", created_at: T },
      { id: "t3", creator_profile_id: "c1", amount: 5, platform_receives: 0, status: "refunded", created_at: T },
    ],
    super_tips: [{ id: "s1", creator_profile_id: "c2", amount_usd: 10, creator_receives: 10, platform_receives: 1.5, created_at: T }],
    subscription_payments: [{ id: "p1", creator_profile_id: "c2", gross_usd: 9.99, creator_receives: 9.99, platform_fee_usd: 0, status: "paid", created_at: T }],
    posts: [{ id: "post1", creator_profile_id: "c1" }],
    post_unlocks: [{ id: "u1", post_id: "post1", fan_user_id: "f1", amount_paid: 4, created_at: T }],
    medal_purchases: [{ id: "m1", fan_user_id: "f1", amount_usd: 5, medals: 12, created_at: T }],
    live_streams: [{ id: "ls1", creator_profile_id: "c2" }],
    live_stream_tips: [{ id: "l1", stream_id: "ls1", amount_usd: 3, display_name: "x", created_at: T }],
  });

  it("merges every source, resolves creators through parent rows, newest first", async () => {
    const r = await loadTransactions(db(), { sinceIso: "2026-09-01T00:00:00Z" });
    const byKey = new Map(r.rows.map((x) => [x.key, x]));
    expect(byKey.get("post_unlock:u1")?.creator_profile_id).toBe("c1");
    expect(byKey.get("live_tip:l1")?.creator_profile_id).toBe("c2");
    expect(byKey.get("medals:m1")?.creator_profile_id).toBeNull();
    expect(byKey.get("tip:t1")?.stripe_ref).toBe("pi_1");
  });

  it("totals count settled money only", async () => {
    const r = await loadTransactions(db(), { sinceIso: "2026-09-01T00:00:00Z" });
    const { all, byType } = summarizeTransactions(r.rows);
    const tips = byType.find((t) => t.type === "tip")!;
    expect(tips).toMatchObject({ count: 3, settledCount: 1, gross: 9 });
    // live tips are listed but never totalled (recorded before payment)
    expect(byType.find((t) => t.type === "live_tip")).toMatchObject({ count: 1, settledCount: 0, gross: 0 });
    expect(all.platform).toBe(1.5 + 5); // super tip recognition + medal pack
  });

  it("filters by creator, including parent joined sources", async () => {
    const r = await loadTransactions(db(), { sinceIso: "2026-09-01T00:00:00Z", creatorProfileId: "c1" });
    expect(new Set(r.rows.map((x) => x.creator_profile_id))).toEqual(new Set(["c1"]));
    expect(r.rows.map((x) => x.type)).toContain("post_unlock");
  });

  it("one broken source is reported, not silently zeroed, and the rest still load", async () => {
    const d = db();
    d.failTables.add("super_tips");
    const r = await loadTransactions(d, { sinceIso: "2026-09-01T00:00:00Z" });
    expect(r.failures.map((f) => f.type)).toEqual(["super_tip"]);
    expect(r.rows.some((x) => x.type === "tip")).toBe(true);
  });

  it("CSV escapes quotes and neutralises formula injection", () => {
    const row: Txn = {
      key: "tip:1", type: "tip", id: "1", created_at: T, creator_profile_id: "c1", fan_user_id: null,
      fan_label: '=HYPERLINK("x")', gross: 9, creator_net: 9, platform: 0, status: "succeeded", settled: true,
      stripe_ref: "pi_1", note: 'said "hi", then left',
    };
    const csv = transactionsToCsv([row], new Map([["c1", "angelina"]]));
    const line = csv.split("\n")[1];
    expect(line).toContain("angelina");
    expect(line).toContain(`"'=HYPERLINK(""x"")"`);
    expect(line).toContain(`"said ""hi"", then left"`);
  });

  it("filter params are validated", () => {
    expect(parseDays("30")).toBe(30);
    expect(parseDays("9999")).toBe(30);
    expect(parseTxnTypes("tip,bogus,super_tip")).toEqual(["tip", "super_tip"]);
    expect(parseTxnTypes("bogus")).toBeNull();
  });
});

describe("post moderation", () => {
  const live: PostModState = { status: "live", moderation_status: "pending", removed_by_admin_at: null, removed_reason: null, status_before_removal: null };
  const now = new Date("2026-09-23T00:00:00Z");

  it("remove takes a post off the public page and remembers where it was", () => {
    const p = planPostAction(live, "remove", "nudity on Spotlight", now);
    if (!p.ok) throw new Error(p.error);
    expect(p.patch).toMatchObject({ status: "archive", moderation_status: "blocked", status_before_removal: "live", removed_reason: "nudity on Spotlight" });
  });

  it("remove and flag need a reason; approve does not", () => {
    expect(planPostAction(live, "remove", "", now).ok).toBe(false);
    expect(planPostAction(live, "flag", "", now).ok).toBe(false);
    expect(planPostAction(live, "approve", "", now).ok).toBe(true);
  });

  it("restore puts it back exactly as it was", () => {
    const removed = { ...live, status: "archive", moderation_status: "blocked", removed_by_admin_at: now.toISOString(), status_before_removal: "scheduled" };
    const p = planPostAction(removed, "restore", "", now);
    if (!p.ok) throw new Error(p.error);
    expect(p.patch).toMatchObject({ status: "scheduled", moderation_status: "approved", removed_by_admin_at: null });
    expect(planPostAction(removed, "approve", "", now).ok).toBe(false);
  });

  it("executes with an audit row and never deletes the post", async () => {
    const d = new FakeDb({ posts: [{ id: "p1", creator_profile_id: "c1", status: "live", moderation_status: "pending", removed_by_admin_at: null, removed_reason: null, status_before_removal: null }] });
    const r = await executePostAction(d, { postId: "p1", action: "remove", reason: "spam links", adminEmail: "admin@x.com", now });
    expect(r.ok).toBe(true);
    expect(d.rows("posts")).toHaveLength(1);
    expect(d.rows("posts")[0].status).toBe("archive");
    expect(d.rows("admin_post_actions")[0]).toMatchObject({ post_id: "p1", action: "remove", admin_email: "admin@x.com", reason: "spam links" });
  });

  describe("migration 069", () => {
    const sql = readFileSync(path.resolve(__dirname, "../../supabase/migrations/069_admin_post_moderation.sql"), "utf8");
    it("creators cannot undo a moderation decision", () => {
      expect(sql).toMatch(/auth\.role\(\), ''\) in \('anon', 'authenticated'\)/);
      expect(sql).toMatch(/new\.moderation_status\s+:= old\.moderation_status/);
      expect(sql).toMatch(/cannot be republished/);
    });
    it("audit table is service role only and append only", () => {
      expect(sql).toMatch(/alter table public\.admin_post_actions enable row level security/);
      expect(sql).toMatch(/revoke all on public\.admin_post_actions from anon, authenticated/);
      expect(sql).toMatch(/admin_post_actions is append only/);
    });
    it("deletes nothing", () => {
      expect(sql.replace(/--.*$/gm, "")).not.toMatch(/\bdelete from\b|\btruncate\b|drop table/i);
    });
  });
});
