import { describe, it, expect } from "vitest";

/**
 * Integration checks against a real Supabase project.
 *
 * The default `npm test` environment is node-only with no database (see
 * vitest.config.ts), so these SKIP unless credentials are supplied. They are not
 * decoration: several Batch 0 findings are RLS defects that no pure unit test
 * can observe, and this is the suite that proves the migration worked.
 *
 * RUN AFTER APPLYING migration 064:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_ANON_KEY=eyJ... \
 *   npx vitest run lib/__tests__/rls-integration.test.ts
 *
 * Supply the ANON key only — never the service role key, which bypasses RLS and
 * would make every assertion below pass meaninglessly.
 *
 * SAFETY: every write probe is deliberately malformed (a nil uuid that satisfies
 * no foreign key). Postgres evaluates the RLS policy BEFORE constraints, so:
 *     42501 / 401 / 403  -> policy denied      -> SECURE
 *     23502 / 23503 / 23514 / 22P02 -> policy ALLOWED, constraint stopped it -> VULNERABLE
 * No probe can commit a row.
 */

const URL_ = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const enabled = !!URL_ && !!ANON;

const NIL = "00000000-0000-0000-0000-000000000000";

async function rest(method: string, path: string, body?: unknown) {
  const res = await fetch(`${URL_!.replace(/\/$/, "")}/rest/v1${path}`, {
    method,
    headers: {
      apikey: ANON!,
      Authorization: `Bearer ${ANON!}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

/** True when the write was refused by policy rather than by a constraint. */
function deniedByPolicy(r: { status: number; json: any }) {
  if (r.status === 401 || r.status === 403) return true;
  if (r.json?.code === "42501") return true;
  // A 2xx means a row was created — the opposite of denied.
  if (r.status >= 200 && r.status < 300) return false;
  // Constraint codes mean the POLICY let us through.
  return !["23502", "23503", "23514", "23505", "22P02"].includes(r.json?.code);
}

describe.skipIf(!enabled)("RLS — anonymous reads", () => {
  it("cannot read creator_profiles at all [SL-011]", async () => {
    const r = await rest("GET", "/creator_profiles?select=handle&limit=1");
    expect(Array.isArray(r.json) ? r.json.length : 0).toBe(0);
  });

  it("cannot read claim_code — the account-takeover credential [SL-011]", async () => {
    const r = await rest("GET", "/creator_profiles?select=handle,claim_code&claim_code=not.is.null&limit=5");
    const leaked = Array.isArray(r.json) ? r.json.filter((x: any) => x?.claim_code) : [];
    expect(leaked.length).toBe(0);
  });

  it("CAN still read the approved public fields via creator_public", async () => {
    const r = await rest("GET", "/creator_public?select=handle,display_name,avatar_url&limit=1");
    // 200 with an array. Empty is fine on an empty database; the point is that
    // the relation is readable and did not 401/403.
    expect(r.status).toBe(200);
    expect(Array.isArray(r.json)).toBe(true);
  });

  it("creator_public never exposes a forbidden column", async () => {
    for (const col of ["claim_code", "date_of_birth", "first_ip", "shipping_zip", "stripe_account_id", "user_id"]) {
      const r = await rest("GET", `/creator_public?select=${col}&limit=1`);
      // 42703 = column does not exist on the view. That is the pass condition.
      expect(r.json?.code === "42703" || r.status >= 400, `creator_public exposed ${col}`).toBe(true);
    }
  });

  it("cannot read tips [SL-029]", async () => {
    const r = await rest("GET", "/tips?select=amount,fan_user_id&limit=1");
    expect(Array.isArray(r.json) ? r.json.length : 0).toBe(0);
  });

  it("cannot read another buyer's merch shipping address [SL-012]", async () => {
    const r = await rest("GET", "/merch_orders?select=shipping_name,shipping_zip&limit=1");
    expect(Array.isArray(r.json) ? r.json.length : 0).toBe(0);
  });

  it("cannot read live stream broadcast credentials [SL-067]", async () => {
    const r = await rest("GET", "/live_streams?select=stream_key,rtmp_url&limit=1");
    const leaked = Array.isArray(r.json) ? r.json.filter((x: any) => x?.stream_key) : [];
    expect(leaked.length).toBe(0);
  });
});

describe.skipIf(!enabled)("RLS — anonymous writes", () => {
  it("cannot set its own billing to active [SL-001]", async () => {
    const r = await rest("POST", "/creator_billing", { user_id: NIL, status: "active", tier: "starter" });
    expect(deniedByPolicy(r), `creator_billing insert was allowed (code ${r.json?.code})`).toBe(true);
  });

  it("cannot mint billing credit [SL-002]", async () => {
    const r = await rest("POST", "/billing_credits", { creator_profile_id: NIL, amount_usd: 0.01, reason: "test" });
    expect(deniedByPolicy(r), `billing_credits insert was allowed (code ${r.json?.code})`).toBe(true);
  });

  it("cannot forge a digital purchase — the paywall bypass [SL-003]", async () => {
    const r = await rest("POST", "/digital_purchases", {
      digital_product_id: NIL, creator_profile_id: NIL,
      download_token: "integration-probe-must-not-commit", amount_paid: 0,
    });
    expect(deniedByPolicy(r), `digital_purchases insert was allowed (code ${r.json?.code})`).toBe(true);
  });

  it("cannot unlock a paid post for free [SL-013]", async () => {
    const r = await rest("POST", "/post_unlocks", { post_id: NIL, fan_user_id: NIL, amount_paid: 0 });
    expect(deniedByPolicy(r)).toBe(true);
  });

  it("cannot forge a super tip to inflate creator earnings [SL-013]", async () => {
    const r = await rest("POST", "/super_tips", {
      creator_profile_id: NIL, amount_usd: 0, creator_receives: 0, platform_receives: 0,
    });
    expect(deniedByPolicy(r)).toBe(true);
  });

  it("cannot forge a referral [SL-005]", async () => {
    const r = await rest("POST", "/creator_referrals", { referrer_profile_id: NIL, credited: false });
    expect(deniedByPolicy(r)).toBe(true);
  });
});

describe.skipIf(!enabled)("Routes — unauthenticated access", () => {
  const APP = process.env.APP_URL ?? "http://localhost:3000";

  it("legacy download route is gone [SL-004]", async () => {
    const res = await fetch(`${APP}/api/download/anything`);
    expect(res.status).toBe(410);
  });

  it("referral credit cannot be minted without a session [SL-005]", async () => {
    const res = await fetch(`${APP}/api/referrals/creator`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referrerHandle: "anyone" }),
    });
    expect(res.status).toBe(401);
  });

  it("AI routes reject unauthenticated callers [SL-064]", async () => {
    for (const p of ["/api/studio/build", "/api/tiers/assist", "/api/campaigns/assist", "/api/posts/tags", "/api/onboarding", "/api/advisor/bio"]) {
      const res = await fetch(`${APP}${p}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect([401, 403], `${p} returned ${res.status}`).toContain(res.status);
    }
  });

  it("an unpaid digital product cannot be downloaded", async () => {
    const res = await fetch(`${APP}/api/digital/download?token=definitely-not-a-real-token`);
    expect([403, 404]).toContain(res.status);
  });
});

// ── Authenticated pass ───────────────────────────────────────────────────────
// The dropped policies were `TO {public}`, which covers `authenticated` as well
// as `anon`. A logged-in fan must not be able to forge another user's purchase
// or entitlement either. Needs an ordinary throwaway fan account — NOT a creator,
// and NOT an admin.
//
//   TEST_EMAIL=fan@example.com TEST_PASSWORD=... npx vitest run lib/__tests__/rls-integration.test.ts

const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;
const authEnabled = enabled && !!TEST_EMAIL && !!TEST_PASSWORD;

let accessToken: string | null = null;

async function signIn() {
  if (accessToken) return accessToken;
  const res = await fetch(`${URL_!.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON!, "Content-Type": "application/json" },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  const j = await res.json();
  accessToken = j.access_token ?? null;
  return accessToken;
}

async function restAs(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${URL_!.replace(/\/$/, "")}/rest/v1${path}`, {
    method,
    headers: {
      apikey: ANON!,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

describe.skipIf(!authEnabled)("RLS — an ordinary authenticated fan", () => {
  it("cannot read another creator's claim_code", async () => {
    const t = await signIn();
    expect(t, "sign-in failed — check TEST_EMAIL / TEST_PASSWORD").toBeTruthy();
    const r = await restAs(t!, "GET", "/creator_profiles?select=handle,claim_code&claim_code=not.is.null&limit=5");
    const leaked = Array.isArray(r.json) ? r.json.filter((x: any) => x?.claim_code) : [];
    expect(leaked.length).toBe(0);
  });

  it("cannot read a profile that is not their own", async () => {
    const t = await signIn();
    // creator_profiles_own_select is scoped to user_id = auth.uid(). A fan with
    // no creator profile should see nothing at all.
    const r = await restAs(t!, "GET", "/creator_profiles?select=id,handle&limit=5");
    expect(Array.isArray(r.json) ? r.json.length : 0).toBe(0);
  });

  it("cannot forge a digital purchase — entitlement forgery [SL-003]", async () => {
    const t = await signIn();
    const r = await restAs(t!, "POST", "/digital_purchases", {
      digital_product_id: NIL, creator_profile_id: NIL,
      download_token: "authed-probe-must-not-commit", amount_paid: 0,
    });
    expect(deniedByPolicy(r), `allowed (code ${r.json?.code})`).toBe(true);
  });

  it("cannot grant itself an early access pass [SL-013]", async () => {
    const t = await signIn();
    const r = await restAs(t!, "POST", "/early_access_passes", {
      fan_user_id: NIL, creator_profile_id: NIL, status: "active",
    });
    expect(deniedByPolicy(r), `allowed (code ${r.json?.code})`).toBe(true);
  });

  it("cannot unlock a paid post for free [SL-013]", async () => {
    const t = await signIn();
    const r = await restAs(t!, "POST", "/post_unlocks", { post_id: NIL, fan_user_id: NIL, amount_paid: 0 });
    expect(deniedByPolicy(r)).toBe(true);
  });

  it("cannot change anyone's billing state — not even its own [SL-001]", async () => {
    const t = await signIn();
    // creator_billing_own_* permit a user to write their OWN row. A nil user_id
    // is nobody's row, so WITH CHECK (user_id = auth.uid()) must refuse it.
    const r = await restAs(t!, "POST", "/creator_billing", { user_id: NIL, status: "active", tier: "starter" });
    expect(deniedByPolicy(r), `allowed (code ${r.json?.code})`).toBe(true);
  });

  it("cannot mint billing credit [SL-002]", async () => {
    const t = await signIn();
    const r = await restAs(t!, "POST", "/billing_credits", { creator_profile_id: NIL, amount_usd: 999, reason: "probe" });
    expect(deniedByPolicy(r)).toBe(true);
  });

  it("cannot read another buyer's merch shipping address [SL-012]", async () => {
    const t = await signIn();
    const r = await restAs(t!, "GET", "/merch_orders?select=shipping_name,shipping_zip&limit=5");
    // merch_orders_select is scoped to creator-owns OR fan_user_id = auth.uid().
    // A fan with no orders sees nothing.
    expect(Array.isArray(r.json) ? r.json.length : 0).toBe(0);
  });

  it("CAN still read the public projection", async () => {
    const t = await signIn();
    const r = await restAs(t!, "GET", "/creator_public?select=handle,display_name&limit=1");
    expect(r.status).toBe(200);
    expect(Array.isArray(r.json)).toBe(true);
  });
});

describe.skipIf(enabled)("RLS integration (skipped)", () => {
  it("needs SUPABASE_URL and SUPABASE_ANON_KEY — see the file header", () => {
    expect(enabled).toBe(false);
  });
});

describe.skipIf(authEnabled)("Authenticated RLS pass (skipped)", () => {
  it("additionally needs TEST_EMAIL and TEST_PASSWORD for a throwaway fan account", () => {
    expect(authEnabled).toBe(false);
  });
});
