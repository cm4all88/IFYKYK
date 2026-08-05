import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  PUBLIC_CREATOR_COLUMNS,
  FORBIDDEN_PUBLIC_COLUMNS,
  PUBLIC_CREATOR_SELECT,
  CREATOR_PUBLIC_VIEW,
  isPublicCreatorColumn,
} from "@/lib/creator-public";

// `creator_profiles` carried "Creators are publicly readable" FOR SELECT TO
// public USING (true), exposing every column to the browser key — including
// `claim_code`, a bearer credential. Seven live codes were readable.
//
// These tests police the replacement projection. They are the guard that stops
// a sensitive column being added back to the public view by accident.

const ROOT = path.resolve(__dirname, "../..");
const MIGRATION = path.join(ROOT, "supabase/migrations/064_creator_public_projection.sql");   // additive: the view
const LOCKDOWN  = path.join(ROOT, "supabase/migrations/066_emergency_rls_lockdown.sql");    // destructive: the drops

describe("public creator projection — contents", () => {
  it("exposes nothing from the forbidden list", () => {
    for (const forbidden of FORBIDDEN_PUBLIC_COLUMNS) {
      expect(
        (PUBLIC_CREATOR_COLUMNS as readonly string[]).includes(forbidden),
        `${forbidden} must never be publicly readable`
      ).toBe(false);
    }
  });

  it("specifically excludes the claim credential and claim state", () => {
    for (const c of ["claim_code", "claim_expires_at", "claimed_at"]) {
      expect(isPublicCreatorColumn(c)).toBe(false);
    }
  });

  it("specifically excludes personal and compliance data", () => {
    for (const c of ["date_of_birth", "parental_consent_at", "first_ip", "last_ip", "first_user_agent", "last_user_agent"]) {
      expect(isPublicCreatorColumn(c)).toBe(false);
    }
  });

  it("specifically excludes physical addresses", () => {
    for (const c of ["shipping_name", "shipping_address", "shipping_city", "shipping_state", "shipping_zip", "shipping_country"]) {
      expect(isPublicCreatorColumn(c)).toBe(false);
    }
  });

  it("specifically excludes payment identifiers", () => {
    for (const c of ["stripe_account_id", "ccbill_account_number", "ccbill_sub_account"]) {
      expect(isPublicCreatorColumn(c)).toBe(false);
    }
  });

  it("excludes the internal auth user id", () => {
    expect(isPublicCreatorColumn("user_id")).toBe(false);
  });

  it("still exposes what a public creator page renders", () => {
    for (const c of ["handle", "display_name", "bio", "avatar_url", "cover_url", "subscription_price"]) {
      expect(isPublicCreatorColumn(c)).toBe(true);
    }
  });

  it("has no duplicates", () => {
    const set = new Set(PUBLIC_CREATOR_COLUMNS as readonly string[]);
    expect(set.size).toBe(PUBLIC_CREATOR_COLUMNS.length);
  });

  it("builds a select list with no wildcard", () => {
    expect(PUBLIC_CREATOR_SELECT).not.toContain("*");
    expect(PUBLIC_CREATOR_SELECT.split(", ").length).toBe(PUBLIC_CREATOR_COLUMNS.length);
  });
});

describe("public creator projection — agrees with the SQL view", () => {
  const sql = fs.readFileSync(MIGRATION, "utf8");
  const viewBody = sql.slice(
    sql.indexOf(`create or replace view public.${CREATOR_PUBLIC_VIEW}`),
    sql.indexOf("from public.creator_profiles")
  );

  it("the migration defines the view", () => {
    expect(viewBody.length).toBeGreaterThan(0);
  });

  it("every TypeScript column appears in the view definition", () => {
    for (const c of PUBLIC_CREATOR_COLUMNS) {
      expect(new RegExp(`^\\s*${c},?\\s*$`, "m").test(viewBody), `view is missing ${c}`).toBe(true);
    }
  });

  it("no forbidden column appears in the view definition", () => {
    for (const c of FORBIDDEN_PUBLIC_COLUMNS) {
      // `deleted_at` legitimately appears in the WHERE clause, which is outside
      // the slice we check, and `user_id` appears in other policies further down.
      expect(new RegExp(`^\\s*${c},?\\s*$`, "m").test(viewBody), `view exposes ${c}`).toBe(false);
    }
  });

  it("the view filters soft-deleted profiles", () => {
    expect(sql).toMatch(/from public\.creator_profiles\s+where deleted_at is null/);
  });
});

describe("migration 066 — uses LIVE policy names, not repository names", () => {
  const raw = fs.readFileSync(LOCKDOWN, "utf8");
  // 066 carries a commented-out ROLLBACK block that reproduces the original
  // permissive policies verbatim. Assertions about what the migration DOES must
  // look at executable SQL only.
  const sql = raw.replace(/^\s*--[^\n]*$/gm, "");

  it("drops the live digital_purchases policies", () => {
    // Production named these dpur_insert / dpur_update. Dropping the repository
    // names would have been a silent no-op, leaving the paywall bypass open.
    expect(sql).toContain('drop policy if exists "dpur_insert"');
    expect(sql).toContain('drop policy if exists "dpur_update"');
  });

  it("does NOT try to drop merch_orders_service_all, which does not exist live", () => {
    // The name may appear in a comment explaining why it is absent; what must
    // not exist is an executable drop for it.
    const executable = sql.replace(/^\s*--[^\n]*$/gm, "");
    expect(executable).not.toMatch(/drop policy[^;]*merch_orders_service_all/i);
  });

  it("drops the live merch_orders write policy instead", () => {
    expect(sql).toContain('drop policy if exists "merch_orders_insert"');
  });

  it("removes the creator_profiles public read", () => {
    expect(sql).toContain('drop policy if exists "Creators are publicly readable"');
  });

  it("does not recreate any permissive service-role policy", () => {
    // The service role bypasses RLS; a `*_service_*` policy only ever granted
    // access to anon and authenticated.
    expect(sql).not.toMatch(/create policy[^;]*_service_[^;]*using \(true\)/i);
  });
});
