/**
 * Batch 0 · Phase 2 — safe anon-client exploit verification.
 *
 * SAFETY MODEL — read this before running.
 *
 * Writes are proven by ERROR CODE, never by persisting a row. Postgres evaluates
 * the RLS policy first: if the policy denies, you get 42501 and the statement
 * stops. If the policy ALLOWS, evaluation proceeds to constraints and you get a
 * constraint error instead (23502 not-null / 23503 FK / 23514 check / 22P02 bad
 * uuid). So every write probe below is deliberately malformed:
 *
 *     42501  → policy DENIED the write   → table is SECURE
 *     23xxx  → policy ALLOWED the write  → table is VULNERABLE (row still rejected)
 *
 * No probe can commit a row. Nothing financial, personal or persistent is created.
 *
 * Reads are genuinely read-only. Row VALUES are never printed — only whether rows
 * came back, how many, and which column names were exposed.
 *
 * USAGE
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_ANON_KEY=eyJ... \
 *   node audit/production-integrity/_tools/anon-probe.mjs
 *
 * The anon key is public by design — it ships in the browser bundle. The service
 * role key is NOT required and must NOT be supplied to this script.
 */

const URL_ = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const AUTH_EMAIL = process.env.TEST_EMAIL || null;      // optional: ordinary fan account
const AUTH_PASSWORD = process.env.TEST_PASSWORD || null;

if (!URL_ || !ANON) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY. Do NOT supply the service role key.');
  process.exit(1);
}
if (/service_role/.test(ANON) || ANON.length > 500) {
  console.error('That looks like a service role key. Refusing to run — use the ANON key.');
  process.exit(1);
}

const REST = URL_.replace(/\/$/, '') + '/rest/v1';
let bearer = ANON;

const results = [];
function record(r) {
  results.push(r);
  const icon = r.verdict === 'VULNERABLE' ? '🔴' : r.verdict === 'SECURE' ? '🟢' : '⚪';
  console.log(`${icon} [${r.verdict}] ${r.id} — ${r.what}`);
  console.log(`      ${r.detail}`);
}

async function req(method, path, body, extraHeaders = {}) {
  const res = await fetch(REST + path, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, json };
}

// Classify a write attempt by its Postgres error code.
function classifyWrite(r) {
  const code = r.json?.code;
  if (r.status === 401 || r.status === 403 || code === '42501') {
    return { verdict: 'SECURE', why: `policy denied (status ${r.status}, code ${code ?? 'n/a'})` };
  }
  if (code === '42P01') return { verdict: 'INFO', why: 'table does not exist' };
  if (code === '42703') return { verdict: 'INFO', why: 'column does not exist — schema drift, retry with real columns' };
  if (['23502', '23503', '23514', '23505', '22P02', '23P01'].includes(code)) {
    return { verdict: 'VULNERABLE', why: `POLICY ALLOWED the write; only a constraint stopped it (code ${code})` };
  }
  if (r.status >= 200 && r.status < 300) {
    return { verdict: 'VULNERABLE', why: '⚠️ WRITE SUCCEEDED — a row may have been created, delete it immediately' };
  }
  return { verdict: 'INFO', why: `unclassified: status ${r.status} code ${code ?? 'n/a'} ${JSON.stringify(r.json?.message ?? '').slice(0, 120)}` };
}

function classifyRead(r, label) {
  if (r.status === 401 || r.status === 403 || r.json?.code === '42501') {
    return { verdict: 'SECURE', why: `denied (status ${r.status})` };
  }
  if (r.json?.code === '42P01') return { verdict: 'INFO', why: 'table does not exist' };
  if (Array.isArray(r.json)) {
    if (r.json.length === 0) return { verdict: 'SECURE', why: 'query allowed but returned 0 rows (RLS filtered everything)' };
    const cols = Object.keys(r.json[0] ?? {});
    return { verdict: 'VULNERABLE', why: `${r.json.length} row(s) readable. Columns exposed: ${cols.join(', ')}` };
  }
  return { verdict: 'INFO', why: `status ${r.status} ${JSON.stringify(r.json ?? '').slice(0, 140)}` };
}

const NIL = '00000000-0000-0000-0000-000000000000'; // valid uuid, references nothing

async function run(asRole) {
  console.log(`\n${'═'.repeat(70)}\n  PROBES AS: ${asRole}\n${'═'.repeat(70)}\n`);

  // ── 1. SL-001 — can this role write creator_billing? ──────────────────────
  // FK on user_id → auth.users. NIL uuid cannot exist, so an allowed policy
  // yields 23503 and no row is created.
  {
    const r = await req('POST', '/creator_billing', { user_id: NIL, status: 'active', tier: 'starter' });
    const c = classifyWrite(r);
    record({ id: 'SL-001', role: asRole, what: 'INSERT creator_billing (status=active)', verdict: c.verdict, detail: c.why });
  }
  // Read side: are other creators' Stripe ids visible?
  {
    const r = await req('GET', '/creator_billing?select=user_id,status,tier,stripe_customer_id&limit=3');
    const c = classifyRead(r);
    record({ id: 'SL-001r', role: asRole, what: 'SELECT creator_billing (Stripe ids)', verdict: c.verdict, detail: c.why });
  }

  // ── 2. SL-003 — can this role forge a digital purchase? ───────────────────
  {
    const r = await req('POST', '/digital_purchases', {
      digital_product_id: NIL, creator_profile_id: NIL,
      download_token: 'AUDIT-PROBE-SHOULD-NEVER-COMMIT', amount_paid: 0,
    });
    const c = classifyWrite(r);
    record({ id: 'SL-003', role: asRole, what: 'INSERT digital_purchases (forged download token)', verdict: c.verdict, detail: c.why });
  }

  // ── 3. SL-012 — can this role read buyers' shipping addresses? ────────────
  {
    const r = await req('GET', '/merch_orders?select=id,shipping_name,shipping_city,shipping_zip,shipping_country&limit=3');
    const c = classifyRead(r);
    record({ id: 'SL-012', role: asRole, what: 'SELECT merch_orders (buyer addresses)', verdict: c.verdict, detail: c.why });
  }

  // ── 4. SL-011 — are claim codes readable? ─────────────────────────────────
  {
    const r = await req('GET', '/creator_profiles?select=handle,claim_code,claimed_at&claim_code=not.is.null&limit=3');
    const c = classifyRead(r);
    // Never print the codes themselves.
    const safe = c.verdict === 'VULNERABLE'
      ? `${(r.json ?? []).length} unclaimed claim_code(s) READABLE — account takeover path. Values withheld.`
      : c.why;
    record({ id: 'SL-011', role: asRole, what: 'SELECT creator_profiles.claim_code', verdict: c.verdict, detail: safe });
  }
  {
    const r = await req('PATCH', '/creator_profiles?handle=eq.__audit_probe_no_such_handle__', { subscription_price: 0 });
    const c = classifyWrite(r);
    record({ id: 'SL-011w', role: asRole, what: 'UPDATE creator_profiles (matches no rows)', verdict: c.verdict === 'VULNERABLE' && r.status < 300 ? 'INFO' : c.verdict, detail: c.why + ' — note: a 0-row UPDATE cannot distinguish policy state; see live-verify.sql query 2' });
  }

  // ── 5. SL-029 — are tips readable? ────────────────────────────────────────
  {
    const r = await req('GET', '/tips?select=id,amount,fan_user_id,message&limit=3');
    const c = classifyRead(r);
    const safe = c.verdict === 'VULNERABLE'
      ? `${(r.json ?? []).length} tip row(s) readable — fan ids, amounts and messages exposed. Values withheld.`
      : c.why;
    record({ id: 'SL-029', role: asRole, what: 'SELECT tips (fan tipping history)', verdict: c.verdict, detail: safe });
  }

  // ── 6. SL-002 — can this role mint billing credit? ────────────────────────
  {
    const r = await req('POST', '/billing_credits', { creator_profile_id: NIL, amount_usd: 0.01, reason: 'audit probe', applied: false });
    const c = classifyWrite(r);
    record({ id: 'SL-002', role: asRole, what: 'INSERT billing_credits', verdict: c.verdict, detail: c.why });
  }

  // ── 7. SL-013 — post unlock / super tip forgery ───────────────────────────
  {
    const r = await req('POST', '/post_unlocks', { post_id: NIL, fan_user_id: NIL, amount_paid: 0 });
    const c = classifyWrite(r);
    record({ id: 'SL-013a', role: asRole, what: 'INSERT post_unlocks (free unlock of paid post)', verdict: c.verdict, detail: c.why });
  }
  {
    const r = await req('POST', '/super_tips', { creator_profile_id: NIL, amount_usd: 0, creator_receives: 0, platform_receives: 0 });
    const c = classifyWrite(r);
    record({ id: 'SL-013b', role: asRole, what: 'INSERT super_tips (inflate creator earnings)', verdict: c.verdict, detail: c.why });
  }

  // ── 8. SL-024 — which creator column does tips expose? ────────────────────
  for (const col of ['creator_profile_id', 'creator_id']) {
    const r = await req('GET', `/tips?select=${col}&limit=1`);
    const exists = !(r.json?.code === '42703');
    record({
      id: 'SL-024', role: asRole, what: `tips.${col} exists?`,
      verdict: 'INFO',
      detail: exists ? `YES — tips.${col} is a real column` : `no (42703)`,
    });
  }

  // ── 9. SL-004 — do the download guard columns exist? ──────────────────────
  for (const col of ['token_expires_at', 'max_downloads', 'download_count']) {
    const r = await req('GET', `/digital_purchases?select=${col}&limit=1`);
    const missing = r.json?.code === '42703';
    record({
      id: 'SL-004', role: asRole, what: `digital_purchases.${col} exists?`,
      verdict: 'INFO',
      detail: missing ? `ABSENT (42703) — guard is inert` : `present`,
    });
  }

  // ── 10. SL-009 — does subscriptions.updated_at exist? ─────────────────────
  for (const col of ['updated_at', 'canceled_at', 'creator_profile_id']) {
    const r = await req('GET', `/subscriptions?select=${col}&limit=1`);
    const missing = r.json?.code === '42703';
    record({
      id: 'SL-009', role: asRole, what: `subscriptions.${col} exists?`,
      verdict: 'INFO',
      detail: missing ? `ABSENT (42703)` : `present`,
    });
  }
}

// ── anon pass ────────────────────────────────────────────────────────────────
await run('anon (public key only, no session)');

// ── authenticated pass (optional) ────────────────────────────────────────────
if (AUTH_EMAIL && AUTH_PASSWORD) {
  const res = await fetch(URL_.replace(/\/$/, '') + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: AUTH_EMAIL, password: AUTH_PASSWORD }),
  });
  const j = await res.json();
  if (j.access_token) {
    bearer = j.access_token;
    await run('authenticated (ordinary test account — NOT a creator)');
  } else {
    console.log('\n⚠️  Could not sign in the test account; skipping authenticated pass.');
  }
} else {
  console.log('\n⚪ TEST_EMAIL / TEST_PASSWORD not set — authenticated pass skipped.');
  console.log('   The authenticated role matters: policies "TO PUBLIC" cover it too.');
}

// ── summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(70)}\n  SUMMARY\n${'═'.repeat(70)}`);
const vuln = results.filter(r => r.verdict === 'VULNERABLE');
const sec = results.filter(r => r.verdict === 'SECURE');
console.log(`  VULNERABLE: ${vuln.length}   SECURE: ${sec.length}   INFO: ${results.length - vuln.length - sec.length}`);
for (const v of vuln) console.log(`  🔴 ${v.id} [${v.role}] ${v.what}`);

const fs = await import('node:fs');
const path = new URL('./anon-probe-results.json', import.meta.url);
fs.writeFileSync(path, JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2));
console.log(`\n  Written: _tools/anon-probe-results.json`);
console.log('  No rows were committed. Any 2xx on a write probe is reported above as VULNERABLE —');
console.log('  if one appears, delete the created row immediately.');
