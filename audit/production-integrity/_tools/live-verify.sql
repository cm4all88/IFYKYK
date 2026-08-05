-- ─────────────────────────────────────────────────────────────────────────────
-- Batch 0 · Phase 1 — Live production verification
--
-- STRICTLY READ ONLY.
--   No INSERT / UPDATE / DELETE / MERGE / TRUNCATE
--   No CREATE / ALTER / DROP / GRANT / REVOKE
--   No ENABLE / DISABLE, no SET, no temp tables, no sequence functions
--   Only catalog inspection helpers, all read-only: pg_get_constraintdef,
--   string_agg, count, exists.
--
-- It is ONE single SELECT statement (a UNION ALL chain), so the Supabase SQL
-- Editor returns exactly ONE result set: three text columns — section, object,
-- detail.
--
-- PRIVACY
--   No row contents are selected anywhere. No claim_code, download_token,
--   referral code, email, address, payment identifier, message, display name
--   or amount is read. The only row-level access is two count(*) aggregates,
--   which reveal quantity and nothing else. Everything else is catalog
--   metadata: table, column, policy, constraint and grant definitions.
--
-- Section 0 answers the decisive questions outright. If the full output is too
-- long to paste, section 0 alone resolves most findings; sections 1 and 2 are
-- the next most valuable.
-- ─────────────────────────────────────────────────────────────────────────────

with t(name) as (
  values
    ('creator_profiles'), ('creator_billing'), ('digital_purchases'),
    ('merch_orders'), ('tips'), ('subscriptions'), ('subscription_payments'),
    ('wishlist_purchases'), ('marketplace_orders'), ('social_addback_orders'),
    ('creator_referrals'), ('subscriber_referrals'), ('billing_credits'),
    ('referral_codes'), ('referral_signups'), ('referral_rewards_claimed'),
    ('post_unlocks'), ('super_tips'), ('early_access_passes'),
    ('gift_subscriptions'), ('live_streams'), ('social_addback_purchases')
),

-- Every public column, cast to plain text so string functions resolve cleanly.
colx(tbl, col, typ, nullable, dflt) as (
  select table_name::text, column_name::text, data_type::text,
         is_nullable::text, coalesce(column_default, 'none')::text
  from information_schema.columns
  where table_schema = 'public'
)

-- ═══ 0. VERDICT — decisive answers, computed ════════════════════════════════
select
  '0. VERDICT'::text                          as section,
  'creator_profiles RLS'::text                as object,
  coalesce((
    select case when c.relrowsecurity then 'ENABLED'
                else 'DISABLED  <-- SL-011 CONFIRMED' end
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'creator_profiles'
  ), 'table not found')::text                 as detail

union all
select '0. VERDICT', 'tables with RLS DISABLED (of ' || (select count(*) from t)::text || ' audited)',
  coalesce((
    select string_agg(c.relname::text, ', ' order by c.relname::text)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname::text in (select name from t)
      and not c.relrowsecurity
  ), 'none — all audited tables have RLS enabled')

union all
select '0. VERDICT', 'permissive anon/public policies allowing WRITE',
  (select count(*) from pg_policies
   where schemaname = 'public' and permissive = 'PERMISSIVE'
     and (roles::text like '%public%' or roles::text like '%anon%')
     and (qual = 'true' or with_check = 'true')
     and cmd in ('ALL','INSERT','UPDATE','DELETE'))::text
  || '   (audit predicted 20 — listed in section 2)'

union all
select '0. VERDICT', 'permissive anon/public policies allowing READ-ALL',
  (select count(*) from pg_policies
   where schemaname = 'public' and permissive = 'PERMISSIVE'
     and (roles::text like '%public%' or roles::text like '%anon%')
     and qual = 'true' and cmd in ('ALL','SELECT'))::text
  || '   (audit predicted 13)'

union all
select '0. VERDICT', 'tips creator reference column  [SL-024]',
  coalesce((select string_agg(col, ' AND ' order by col) from colx
            where tbl = 'tips' and col in ('creator_id','creator_profile_id')),
           'NEITHER — investigate')
  || '   (earnings.ts and the webhook both expect creator_profile_id)'

union all
select '0. VERDICT', 'tips.stripe_session_id  [SL-024]',
  case when exists (select 1 from colx where tbl='tips' and col='stripe_session_id')
       then 'present — webhook insert is valid'
       else 'ABSENT  <-- webhook writes it; SL-024 CONFIRMED' end

union all
select '0. VERDICT', 'tips.creator_receives / platform_receives nullable?  [SL-025]',
  coalesce((select string_agg(col || '=' || nullable, ', ' order by col) from colx
            where tbl='tips' and col in ('creator_receives','platform_receives')),
           'columns absent')
  || '   (NO means the webhook insert fails — it supplies neither)'

union all
select '0. VERDICT', 'subscriptions.updated_at  [SL-009]',
  case when exists (select 1 from colx where tbl='subscriptions' and col='updated_at')
       then 'present — upsert is valid'
       else 'ABSENT  <-- SL-009 CONFIRMED: fan subscriptions never recorded' end

union all
select '0. VERDICT', 'subscriptions.canceled_at  [SL-016]',
  case when exists (select 1 from colx where tbl='subscriptions' and col='canceled_at')
       then 'present' else 'ABSENT  <-- SL-016 CONFIRMED' end

union all
select '0. VERDICT', 'digital_purchases.token_expires_at  [SL-004 guard 1]',
  case when exists (select 1 from colx where tbl='digital_purchases' and col='token_expires_at')
       then 'present' else 'ABSENT  <-- expiry guard is inert' end

union all
select '0. VERDICT', 'digital_purchases.max_downloads  [SL-004 guard 2]',
  case when exists (select 1 from colx where tbl='digital_purchases' and col='max_downloads')
       then 'present' else 'ABSENT  <-- download limit is inert' end

union all
select '0. VERDICT', 'creator_profiles claim fields present  [SL-011]',
  coalesce((select string_agg(col, ', ' order by col) from colx
            where tbl='creator_profiles'
              and col in ('claim_code','claim_expires_at','claimed_at')),
           'none present')

union all
select '0. VERDICT', 'rows with a live unclaimed claim code  [SL-011 blast radius]',
  (select count(*) from public.creator_profiles
   where claim_code is not null and claimed_at is null)::text
  || '   (COUNT ONLY — no code values are read)'

union all
select '0. VERDICT', 'digital_products.storage_provider  [migration 062]',
  case when exists (select 1 from colx where tbl='digital_products' and col='storage_provider')
       then 'present — 062 applied' else 'ABSENT — 062 NOT applied' end

union all
select '0. VERDICT', 'subscription_payments table  [migration 063]',
  case when exists (select 1 from information_schema.tables
                    where table_schema='public' and table_name='subscription_payments')
       then 'present — 063 applied' else 'ABSENT — 063 NOT applied' end

-- ═══ 1. RLS enabled status ══════════════════════════════════════════════════
union all
select '1. RLS STATUS', c.relname::text,
  'rls_enabled=' || c.relrowsecurity::text
  || '  forced=' || c.relforcerowsecurity::text
  || '  policies=' || (select count(*) from pg_policy p where p.polrelid = c.oid)::text
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname::text in (select name from t)

-- ═══ 2. Policies — roles, command, qual, with_check ═════════════════════════
union all
select '2. POLICY', p.tablename::text || ' :: ' || p.policyname::text,
  p.permissive::text || ' | cmd=' || p.cmd::text
  || ' | roles=' || p.roles::text
  || ' | using=' || coalesce(p.qual, '-')
  || ' | check=' || coalesce(p.with_check, '-')
from pg_policies p
where p.schemaname = 'public' and p.tablename::text in (select name from t)

-- ═══ 3. Columns per table (names only) ══════════════════════════════════════
union all
select '3. COLUMNS', x.tbl,
  string_agg(x.col, ', ' order by x.col)
from colx x
where x.tbl in (select name from t)
group by x.tbl

-- ═══ 4. Constraints and foreign keys ════════════════════════════════════════
union all
select '4. CONSTRAINT', rel.relname::text || ' :: ' || con.conname::text,
  case con.contype when 'p' then 'PK' when 'f' then 'FK'
                   when 'u' then 'UNIQUE' when 'c' then 'CHECK'
                   else con.contype::text end
  || ' | ' || pg_get_constraintdef(con.oid)
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace nsp on nsp.oid = rel.relnamespace
where nsp.nspname = 'public' and rel.relname::text in (select name from t)

-- ═══ 5. Table grants held by anon / authenticated ═══════════════════════════
union all
select '5. GRANT', g.table_name::text || ' -> ' || g.grantee::text,
  string_agg(g.privilege_type::text, ', ' order by g.privilege_type::text)
from information_schema.role_table_grants g
where g.table_schema = 'public'
  and g.grantee::text in ('anon', 'authenticated')
  and g.table_name::text in (select name from t)
group by g.table_name::text, g.grantee::text

-- ═══ 6. tips row count ══════════════════════════════════════════════════════
union all
select '6. TIPS COUNT', 'public.tips', count(*)::text || ' rows   (count only)'
from public.tips

-- ═══ 7. tips columns, with type and nullability ═════════════════════════════
union all
select '7. TIPS COLUMN', x.col,
  x.typ || ' | nullable=' || x.nullable || ' | default=' || x.dflt
from colx x
where x.tbl = 'tips'

-- ═══ 8. Download-token guard columns ════════════════════════════════════════
union all
select '8. DOWNLOAD GUARD', want.col,
  case when exists (select 1 from colx where tbl='digital_purchases' and col=want.col)
       then 'PRESENT' else 'ABSENT' end || ' on digital_purchases'
from (values ('token_expires_at'), ('max_downloads'), ('download_count'),
             ('download_token'), ('stripe_session_id')) as want(col)

-- ═══ 9. Subscription webhook target columns ═════════════════════════════════
union all
select '9. SUBSCRIPTION COLUMN', want.col,
  case when exists (select 1 from colx where tbl='subscriptions' and col=want.col)
       then 'PRESENT' else 'ABSENT' end || ' on subscriptions'
from (values ('updated_at'), ('canceled_at'), ('creator_profile_id'),
             ('creator_id'), ('tier_id'), ('billing_period'),
             ('stripe_subscription_id'), ('status')) as want(col)

-- ═══ 10. Creator claim / sensitive fields (existence only) ══════════════════
union all
select '10. CLAIM FIELD', want.col,
  case when exists (select 1 from colx where tbl='creator_profiles' and col=want.col)
       then 'PRESENT' else 'ABSENT' end
  || ' on creator_profiles   (existence only, no values read)'
from (values ('claim_code'), ('claim_expires_at'), ('claimed_at'),
             ('stripe_account_id'), ('ccbill_account_number'),
             ('first_ip'), ('last_ip'), ('published'), ('deleted_at')) as want(col)

order by section, object;
