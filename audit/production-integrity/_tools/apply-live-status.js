// Applies live-verification outcomes to AUDIT_EVIDENCE.json, then regenerates FINDINGS.md.
const fs = require('fs');
const path = require('path');
const DIR = path.resolve(__dirname, '..');
const P = path.join(DIR, 'AUDIT_EVIDENCE.json');
const j = JSON.parse(fs.readFileSync(P, 'utf8'));

const STATUS = {
  // confirmed in production
  'SL-001': ['confirmed in production', 'pg_policies: creator_billing_service_all — cmd=ALL roles={public} using=true check=true. anon holds UPDATE grant.'],
  'SL-002': ['confirmed in production', 'pg_policies: billing_credits_service — cmd=ALL roles={public} using=true check=true.'],
  'SL-003': ['confirmed in production', 'Live policy names are dpur_insert (INSERT {public} check=true) and dpur_update (UPDATE {public} using=true) — NOT the repo names.'],
  'SL-004': ['confirmed in production', 'digital_purchases.token_expires_at ABSENT, max_downloads ABSENT. Both guards compare against undefined and always pass.'],
  'SL-005': ['confirmed in production', 'Source-confirmed; no DB dependency.'],
  'SL-006': ['confirmed in production', 'Source-confirmed; no DB dependency.'],
  'SL-008': ['confirmed in production', 'Source-confirmed. subscription_payments.status CHECK does permit refunded, but nothing writes it.'],
  'SL-013': ['confirmed in production', 'Anon-insertable confirmed on super_tips, post_unlocks, early_access_passes, gift_subscriptions, live_streams, marketplace_orders, social_addback_orders, merch_orders, wishlist_purchases, creator_referrals, subscriber_referrals.'],
  'SL-014': ['confirmed in production', 'Source-confirmed. Directly responsible for the tips loss (SL-025) going unnoticed.'],
  'SL-015': ['confirmed in production', "Live CHECK: status IN ('trialing','active','past_due','canceled','incomplete'). 'cancelling' absent."],
  'SL-016': ['confirmed in production', 'subscriptions.canceled_at ABSENT in production.'],
  'SL-029': ['confirmed in production', '"Tips publicly readable" — SELECT {public} using=true. Currently 0 rows so nothing exposed yet.'],
  'SL-064': ['confirmed in production', 'Source-confirmed; no DB dependency.'],

  // re-stated
  'SL-011': ['confirmed in production', 'PREMISE CORRECTED: RLS on creator_profiles IS enabled. The exposure is policy "Creators are publicly readable" (SELECT {public} using=true), which exposes every column including claim_code, date_of_birth, first_ip/last_ip, shipping_*, stripe_account_id. 7 profiles currently hold a live unclaimed claim_code.'],

  // escalated
  'SL-025': ['confirmed in production', 'ESCALATED. tips.creator_receives and platform_receives are NOT NULL with no default and are never supplied by the webhook; tips.fan_user_id is NOT NULL while guest tipping is supported. public.tips contains 0 rows. Every tip insert fails 23502 and is swallowed by SL-014.'],

  // narrowed
  'SL-007': ['confirmed in production (narrowed)', 'Live UNIQUE constraints already protect digital_purchases.stripe_session_id, merch_orders.loudcap_order_id, subscription_payments.stripe_invoice_id, post_unlocks(post_id,fan_user_id), early_access_passes(fan_user_id,creator_profile_id), subscriptions(fan_user_id,creator_profile_id). Remains open for tips, super_tips, campaign_donations, wishlist_purchases, medal_purchases.'],
  'SL-012': ['not present in production (write side confirmed)', 'No merch_orders_service_all exists live. merch_orders_select is correctly scoped to creator-owns OR fan_user_id=auth.uid(), so buyer shipping addresses are NOT exposed. Only merch_orders_insert ({public} check=true) is open — forgery, not disclosure. Severity critical -> high.'],

  // not present
  'SL-009': ['not present in production', 'subscriptions.updated_at EXISTS in production. The webhook upsert and /api/gift-subscription/redeem are valid. Withdrawn.'],
  'SL-010': ['not present in production', "Live CHECK is ('pending','transferred','refunded'), not the repo's ('paid_pending_purchase','creator_purchased','refunded'). The webhook's status:'pending' is valid. Withdrawn — but see SL-065, which is the inverse defect."],
  'SL-024': ['not present in production', 'tips has creator_profile_id AND stripe_session_id in production. lib/earnings.ts and the webhook use correct column names. Withdrawn.'],
};

const NEW = [
  {
    id: 'SL-065', severity: 'high', category: 'money',
    title: 'lib/earnings.ts settles wishlist revenue on statuses that cannot exist',
    file: 'lib/earnings.ts', line: 169,
    evidence: "settled: (r) => [\"paid_pending_purchase\", \"creator_purchased\"].includes(r.status)\nLive CHECK: wishlist_purchases.status IN ('pending','transferred','refunded')",
    detail: 'Neither settle value is permitted by the live constraint, so no wishlist_purchases row can ever satisfy it. The inverse of SL-010: the webhook is correct and the earnings module is wrong.',
    impact: 'Wishlist revenue is structurally $0 in every earnings figure, on every surface, permanently.',
    verification: 'CONFIRMED', status: 'confirmed in production',
    recommendation: "Settle on ['pending','transferred'] and exclude 'refunded'.",
  },
  {
    id: 'SL-066', severity: 'critical', category: 'money',
    title: 'tips.fan_user_id is NOT NULL but guest tipping is supported',
    file: 'app/api/webhooks/stripe/route.ts', line: 105,
    evidence: 'fan_user_id: meta.fan_user_id || null\nLive: tips.fan_user_id uuid | nullable=NO | default=none\n/api/tip:24 — "Auth is optional — guests can tip without an account"',
    detail: 'A guest tip carries no fan_user_id, so the webhook writes NULL into a NOT NULL column.',
    impact: 'Even after SL-025 is fixed, guest tips can never be recorded. Guests are an explicitly supported tipping path.',
    verification: 'CONFIRMED', status: 'confirmed in production',
    recommendation: 'Make tips.fan_user_id nullable, or reject guest tips at checkout. The first matches the product intent.',
  },
  {
    id: 'SL-067', severity: 'high', category: 'authorization',
    title: 'live_streams public-read policy exposes stream_key and rtmp_url',
    file: 'supabase/migrations/010_monetization_features.sql', line: 0,
    evidence: 'live_streams_select — SELECT {public} using=true. Live columns include stream_key, rtmp_url, bunny_stream_id, playback_url.',
    detail: 'Not in the original audit. stream_key and rtmp_url are the credentials required to broadcast to a creator\'s stream.',
    impact: 'Anyone with the anon key can read the broadcast credentials for any creator\'s live stream and stream as that creator.',
    verification: 'CONFIRMED', status: 'confirmed in production',
    recommendation: 'Replace with a column-restricted view for public consumption. A using(status=\'live\') narrowing is a stopgap, not a fix — it still exposes keys for live streams.',
  },
  {
    id: 'SL-068', severity: 'medium', category: 'authorization',
    title: 'anon and authenticated hold TRUNCATE and DELETE on every audited table',
    file: 'supabase', line: 0,
    evidence: 'information_schema.role_table_grants: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE — identical for anon and authenticated across all 22 audited tables.',
    detail: 'Supabase default grants. TRUNCATE is not subject to RLS. PostgREST never issues TRUNCATE, so it is not reachable with the anon key today.',
    impact: 'Not currently exploitable, but the grant surface is far wider than the policy surface. RLS is the sole control on every table, and any future direct-connection path would be catastrophic.',
    verification: 'CONFIRMED', status: 'confirmed in production',
    recommendation: 'Revoke TRUNCATE, TRIGGER and REFERENCES from anon and authenticated; grant only the DML each role genuinely needs.',
  },
  {
    id: 'SL-069', severity: 'low', category: 'dead-code',
    title: 'social_addback_purchases does not exist in production',
    file: 'supabase/migrations/020_social_addbacks.sql', line: 0,
    evidence: 'Absent from information_schema.tables, pg_class and pg_policies in production. The live table is social_addback_orders.',
    detail: 'Migration 020 defines a table that was never applied or was later dropped.',
    impact: 'Dead migration; two of the 20 predicted permissive policies do not exist because their table does not.',
    verification: 'CONFIRMED', status: 'not present in production',
    recommendation: 'Remove from the migration history when the baseline schema is committed (SL-036).',
  },
];

let applied = 0;
for (const f of j.findings) {
  if (STATUS[f.id]) {
    f.production_status = STATUS[f.id][0];
    f.production_evidence = STATUS[f.id][1];
    applied++;
    if (f.id === 'SL-012') f.severity = 'high';
  } else if (!f.production_status) {
    f.production_status = 'not verified against production (out of Batch 0 scope)';
  }
}
for (const n of NEW) {
  if (!j.findings.find(x => x.id === n.id)) {
    const { status, ...rest } = n;
    j.findings.push({ ...rest, production_status: status, production_evidence: 'Discovered by live verification 2026-08-05.' });
  }
}

const c = {};
j.findings.forEach(f => c[f.severity] = (c[f.severity] || 0) + 1);
j.audit.counts = { critical: c.critical || 0, high: c.high || 0, medium: c.medium || 0, low: c.low || 0, total: j.findings.length };
j.audit.live_verification = {
  date: '2026-08-05',
  method: 'audit/production-integrity/_tools/live-verify.sql — one read-only SELECT run in the Supabase SQL Editor',
  confirmed_in_production: j.findings.filter(f => /^confirmed in production/.test(f.production_status || '')).map(f => f.id),
  not_present_in_production: j.findings.filter(f => /^not present in production/.test(f.production_status || '')).map(f => f.id),
};
fs.writeFileSync(P, JSON.stringify(j, null, 2));

console.log('statuses applied:', applied, '| new findings added:', NEW.length, '| total:', j.findings.length);
console.log('counts:', JSON.stringify(j.audit.counts));
console.log('confirmed in production:', j.audit.live_verification.confirmed_in_production.join(', '));
console.log('NOT present in production:', j.audit.live_verification.not_present_in_production.join(', '));
