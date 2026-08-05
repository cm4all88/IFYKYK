// Compares migrations 064 + 066 against the live policy inventory captured on
// 2026-08-05, and lists every policy dropped / created / left alone.
const fs = require('fs');
const path = require('path');
const FILES = ['064_creator_public_projection.sql', '066_emergency_rls_lockdown.sql'];
const SQL = FILES
  .map((f) => fs.readFileSync(path.resolve(__dirname, '../../../supabase/migrations/', f), 'utf8'))
  .join('\n');

// Live permissive policies granting WRITE to {public}, from LIVE_VERIFICATION.md §2.
const LIVE_WRITE_PUBLIC = [
  ['creator_billing', 'creator_billing_service_all', 'ALL'],
  ['billing_credits', 'billing_credits_service', 'ALL'],
  ['digital_purchases', 'dpur_insert', 'INSERT'],
  ['digital_purchases', 'dpur_update', 'UPDATE'],
  ['merch_orders', 'merch_orders_insert', 'INSERT'],
  ['post_unlocks', 'post_unlocks_service_insert', 'INSERT'],
  ['super_tips', 'super_tips_insert', 'INSERT'],
  ['early_access_passes', 'early_access_insert', 'INSERT'],
  ['early_access_passes', 'early_access_update', 'UPDATE'],
  ['gift_subscriptions', 'gift_sub_insert', 'INSERT'],
  ['gift_subscriptions', 'gift_sub_update', 'UPDATE'],
  ['live_streams', 'live_streams_insert', 'INSERT'],
  ['creator_referrals', 'creator_referrals_insert', 'INSERT'],
  ['creator_referrals', 'creator_referrals_update', 'UPDATE'],
  ['subscriber_referrals', 'subscriber_referrals_insert', 'INSERT'],
  ['subscriber_referrals', 'subscriber_referrals_update', 'UPDATE'],
  ['wishlist_purchases', 'wishlist_purchases_insert', 'INSERT'],
  ['marketplace_orders', 'Anyone can create order', 'INSERT'],
  ['social_addback_orders', 'Anyone can create an order', 'INSERT'],
];

// Live permissive READ-ALL policies over private data.
const LIVE_READ_PUBLIC = [
  ['creator_profiles', 'Creators are publicly readable', 'SELECT'],
  ['tips', 'Tips publicly readable', 'SELECT'],
  ['live_streams', 'live_streams_select', 'SELECT'],
];

// Correctly-scoped live policies that MUST survive.
const MUST_SURVIVE = [
  ['merch_orders', 'merch_orders_select'],
  ['creator_billing', 'creator_billing_own_select'],
  ['digital_purchases', 'dpur_own'],
  ['billing_credits', 'billing_credits_own'],
  ['creator_profiles', 'Creators can update their own profile'],
  ['creator_profiles', 'Users can insert their own profile'],
  ['live_streams', 'live_streams_creator_manage'],
  ['tips', 'Creators can view tips they received'],
  ['subscriptions', 'Users can view their own subscriptions'],
  ['wishlist_purchases', 'wishlist_purchases_update'],
];

const executable = SQL.replace(/^\s*--[^\n]*$/gm, '');
const dropped = (name) => new RegExp(`drop policy if exists "${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(executable);
const created = [...executable.matchAll(/create policy "([^"]+)" on public\.(\w+)/g)].map(m => ({ name: m[1], table: m[2] }));

const rows = [];
console.log('## Policies DROPPED (write access for {public})\n');
console.log('| Table | Policy | Cmd | In migration |');
console.log('|---|---|---|---|');
let missed = 0;
for (const [t, n, c] of LIVE_WRITE_PUBLIC) {
  const ok = dropped(n);
  if (!ok) missed++;
  console.log(`| \`${t}\` | \`${n}\` | ${c} | ${ok ? '✅ dropped' : '❌ NOT DROPPED'} |`);
}

console.log('\n## Policies DROPPED (unrestricted read of private data)\n');
console.log('| Table | Policy | In migration |');
console.log('|---|---|---|');
for (const [t, n] of LIVE_READ_PUBLIC) {
  const ok = dropped(n);
  if (!ok) missed++;
  console.log(`| \`${t}\` | \`${n}\` | ${ok ? '✅ dropped' : '❌ NOT DROPPED'} |`);
}

console.log('\n## Policies CREATED\n');
console.log('| Table | Policy |');
console.log('|---|---|');
for (const c of created) console.log(`| \`${c.table}\` | \`${c.name}\` |`);

console.log('\n## Correctly-scoped policies LEFT UNTOUCHED\n');
console.log('| Table | Policy | Touched by migration |');
console.log('|---|---|---|');
let harmed = 0;
for (const [t, n] of MUST_SURVIVE) {
  const touched = dropped(n);
  if (touched) harmed++;
  console.log(`| \`${t}\` | \`${n}\` | ${touched ? '❌ DROPPED — REGRESSION' : '✅ untouched'} |`);
}

console.log(`\n**Summary:** ${LIVE_WRITE_PUBLIC.length + LIVE_READ_PUBLIC.length - missed}/${LIVE_WRITE_PUBLIC.length + LIVE_READ_PUBLIC.length} dangerous policies dropped, ${created.length} narrow policies created, ${MUST_SURVIVE.length - harmed}/${MUST_SURVIVE.length} good policies preserved.`);
if (missed || harmed) { console.error(`\nFAIL: ${missed} not dropped, ${harmed} regressions.`); process.exit(1); }
