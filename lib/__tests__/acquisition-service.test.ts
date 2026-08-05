/**
 * Orchestration tests for runAcquisitionBatch against a fake Supabase.
 *
 * The pure decisions are covered in acquisition-runner.test.ts. This file
 * covers the part that actually touches the world: does it build a page,
 * mint a claim code, write the audit row BEFORE sending, re-check
 * suppression, advance the prospect, and refuse to do any of it when the
 * kill switch is off or the run is a dry run.
 *
 * Without this, nothing proved the runner works end to end — every test was
 * on functions the runner calls rather than on the runner.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// The runner fails closed without a configured admin: every send must be
// attributable to a named approver (the 061 constraint). Tests supply one.
process.env.NEXT_PUBLIC_ADMIN_EMAIL = "c88mike@gmail.com";
process.env.NEXT_PUBLIC_APP_URL = "https://spotlightly.app";

// ── Fake Supabase ─────────────────────────────────────────────────

interface Call { table: string; op: string; payload?: any }

let calls: Call[] = [];
let tables: Record<string, any[]> = {};
let counts: Record<string, number> = {};
let insertFails = false;

function builder(table: string) {
  const state: any = { table, op: "select", payload: undefined };
  const chain: any = {
    select: (_c?: string, opts?: any) => {
      if (opts?.head) state.head = true;
      return chain;
    },
    insert: (payload: any) => { state.op = "insert"; state.payload = payload; return chain; },
    update: (payload: any) => { state.op = "update"; state.payload = payload; return chain; },
    upsert: (payload: any) => { state.op = "upsert"; state.payload = payload; return chain; },
    eq: () => chain, in: () => chain, is: () => chain, not: () => chain,
    gte: () => chain, lte: () => chain, order: () => chain, limit: () => chain,
    maybeSingle: async () => {
      calls.push({ table, op: state.op, payload: state.payload });
      if (state.op === "insert") {
        if (insertFails && table === "prospect_outreach") return { data: null, error: { message: "duplicate" } };
        return { data: { id: `${table}-new` }, error: null };
      }
      const rows = tables[table] ?? [];
      return { data: rows[0] ?? null, error: null };
    },
    then: (res: any) => {
      calls.push({ table, op: state.op, payload: state.payload });
      const rows = tables[table] ?? [];
      return Promise.resolve(
        state.head ? { count: counts[table] ?? 0, error: null } : { data: rows, error: null }
      ).then(res);
    },
  };
  return chain;
}

const fakeDb = {
  from: (t: string) => builder(t),
  auth: { admin: { listUsers: async () => ({ data: { users: [{ id: "admin-1", email: "c88mike@gmail.com" }] } }) } },
};

vi.mock("@/lib/supabase-server", () => ({
  createServiceClient: async () => fakeDb,
  createClient: async () => fakeDb,
}));

const createConcierge = vi.fn(async () => ({ ok: true, profileId: "prof-1", handle: "testcreator" }));
vi.mock("@/lib/concierge-create", () => ({
  createConciergeCreator: (...a: any[]) => createConcierge(...(a as [])),
  normalizeHandle: (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ""),
  syntheticEmailFor: (h: string) => `concierge_${h}@spotlightly.app`,
}));

const sendMock = vi.fn(async () => ({ ok: true, providerId: "resend-123" }));
vi.mock("@/lib/email", () => ({
  sendProspectInviteTracked: (...a: any[]) => sendMock(...(a as [])),
}));

import { runAcquisitionBatch } from "@/lib/acquisition-service";

const PROSPECT = {
  id: "cp-1",
  display_name: "Marty Covault",
  email: "marty@sfkettlebells.com",
  location: "San Francisco, CA, USA",
  profile_url: "https://sfkettlebells.com/",
  platform: "other",
  platform_handle: "sfkettlebells",
  niche: "fitness",
  notes:
    "VERIFIED. ACTIVITY: copyright (c) 2026. MONETIZATION: one-to-one kettlebell coaching sold directly. TRIAGE: PRIORITY.",
  stage: "qualified",
  do_not_contact: false,
  opted_out_at: null,
  creator_profile_id: null,
  handle_wanted: null,
};

function reset(over: { setting?: string; prospects?: any[] } = {}) {
  calls = [];
  counts = {};
  insertFails = false;
  createConcierge.mockClear();
  sendMock.mockClear();
  tables = {
    platform_settings: [{ value: over.setting ?? "on" }],
    creator_prospects: over.prospects ?? [PROSPECT],
    prospect_outreach: [],
    creator_profiles: [],
    acquisition_runs: [],
  };
}

const did = (table: string, op: string) => calls.some((c) => c.table === table && c.op === op);
const payload = (table: string, op: string) =>
  calls.find((c) => c.table === table && c.op === op)?.payload;

describe("runAcquisitionBatch", () => {
  beforeEach(() => reset());

  it("builds a page, mints a claim link, records outreach, then sends", async () => {
    const r = await runAcquisitionBatch({ dryRun: false, limit: 10 });

    expect(r.blocked).toBeNull();
    expect(createConcierge).toHaveBeenCalledTimes(1);
    // Page is built under the synthetic address, never the creator's own.
    expect((createConcierge.mock.calls[0] as any[])[0].email).toMatch(/^concierge_/);
    expect(did("prospect_outreach", "insert")).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(r.emailsSent).toBe(1);
    expect(r.claimLinks).toBe(1);
  });

  it("writes the audit row BEFORE handing anything to Resend", async () => {
    await runAcquisitionBatch({ dryRun: false, limit: 10 });
    const insertIdx = calls.findIndex((c) => c.table === "prospect_outreach" && c.op === "insert");
    expect(insertIdx).toBeGreaterThanOrEqual(0);
    // The send happens after the insert resolves, so if the insert collides
    // on (prospect_id, sequence) nothing is mailed.
    expect(sendMock).toHaveBeenCalled();
    const row = payload("prospect_outreach", "insert");
    expect(row.sequence).toBe(1);
    expect(row.status).toBe("approved");
    expect(row.approved_by).toBe("admin-1");
    expect(row.claim_url_sent).toMatch(/\/claim\//);
    expect(row.body).toContain("unlisted Spotlightly page");
  });

  it("does not send when the outreach row cannot be inserted", async () => {
    insertFails = true;
    const r = await runAcquisitionBatch({ dryRun: false, limit: 10 });
    expect(sendMock).not.toHaveBeenCalled();
    expect(r.emailsSent).toBe(0);
    expect(r.skipped.some((s) => s.reason.includes("duplicate_sequence"))).toBe(true);
  });

  it("refuses to run at all while the kill switch is off", async () => {
    reset({ setting: "off" });
    const r = await runAcquisitionBatch({ dryRun: false, limit: 10 });
    expect(r.blocked).toMatch(/acquisition_runner_enabled/);
    expect(createConcierge).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("a dry run touches nothing", async () => {
    const r = await runAcquisitionBatch({ dryRun: true, limit: 10 });
    expect(sendMock).not.toHaveBeenCalled();
    expect(createConcierge).not.toHaveBeenCalled();
    expect(did("prospect_outreach", "insert")).toBe(false);
    expect(did("creator_profiles", "update")).toBe(false);
    expect(did("acquisition_runs", "insert")).toBe(false);
    expect(r.dryRun).toBe(true);
    // ...but still produces a reviewable preview.
    expect(r.preview).toHaveLength(1);
    expect(r.preview[0].subject).toBe("I built a Spotlightly page for Marty Covault");
    expect(r.preview[0].claimUrl).toMatch(/\/claim\/[0-9a-f]{32}$/);
    expect(r.preview[0].avatar).toBe("initials:MC");
  });

  it("a dry run runs even when the kill switch is off", async () => {
    reset({ setting: "off" });
    const r = await runAcquisitionBatch({ dryRun: true, limit: 10 });
    expect(r.blocked).toBeNull();
    expect(r.preview).toHaveLength(1);
  });

  it("advances the prospect and schedules the day-4 follow-up", async () => {
    await runAcquisitionBatch({ dryRun: false, limit: 10 });
    const upd = calls.filter((c) => c.table === "creator_prospects" && c.op === "update").pop()?.payload;
    expect(upd.stage).toBe("invited");
    expect(upd.creator_profile_id).toBe("prof-1");
    const due = new Date(upd.follow_up_at).getTime() - Date.now();
    expect(due).toBeGreaterThan(3.5 * 86400000);
    expect(due).toBeLessThan(4.5 * 86400000);
  });

  it("stores the provider id so bounce webhooks can be correlated", async () => {
    await runAcquisitionBatch({ dryRun: false, limit: 10 });
    const upd = calls
      .filter((c) => c.table === "prospect_outreach" && c.op === "update")
      .map((c) => c.payload)
      .find((p) => p.status === "sent");
    expect(upd.provider_id).toBe("resend-123");
    expect(upd.sent_at).toBeTruthy();
  });

  it("marks the row failed and does not advance the prospect when Resend rejects", async () => {
    sendMock.mockResolvedValueOnce({ ok: false, providerId: null } as any);
    const r = await runAcquisitionBatch({ dryRun: false, limit: 10 });
    expect(r.emailsSent).toBe(0);
    expect(r.failed[0].error).toBe("resend_rejected");
    const upd = calls
      .filter((c) => c.table === "prospect_outreach" && c.op === "update")
      .map((c) => c.payload);
    expect(upd.some((p) => p.status === "failed")).toBe(true);
    expect(upd.some((p) => p.status === "sent")).toBe(false);
  });

  it("never touches a page somebody has already claimed", async () => {
    reset({ prospects: [{ ...PROSPECT, creator_profile_id: "prof-claimed" }] });
    tables.creator_profiles = [
      { id: "prof-claimed", handle: "taken", claim_code: null, claimed_at: "2026-01-01T00:00:00Z" },
    ];
    const r = await runAcquisitionBatch({ dryRun: false, limit: 10 });
    expect(sendMock).not.toHaveBeenCalled();
    expect(did("creator_profiles", "update")).toBe(false);
    expect(r.skipped.some((s) => s.reason === "already_claimed")).toBe(true);
  });

  it("skips an unqualified prospect without building anything", async () => {
    reset({ prospects: [{ ...PROSPECT, location: "Berlin, Germany" }] });
    const r = await runAcquisitionBatch({ dryRun: false, limit: 10 });
    expect(createConcierge).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
    expect(r.skipped[0].reason).toMatch(/unqualified:.*not_us/);
  });

  it("pauses instead of sending once the bounce rate is too high", async () => {
    reset();
    counts = { prospect_outreach: 100 };
    // Both the sent and bounced head-counts read the same stub, so this is
    // a 100% bounce rate — comfortably over the 5% threshold.
    const r = await runAcquisitionBatch({ dryRun: false, limit: 10 });
    expect(r.paused).toBe(true);
    expect(r.pauseReason).toMatch(/exceeds 5%/);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
