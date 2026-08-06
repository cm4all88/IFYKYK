-- ─────────────────────────────────────────────────────────────────────────────
-- 064_public_read_grants.sql
--
-- A logged-out visitor saw no paid subscription tiers, so the page fell back to
-- "Sign up to subscribe" and a creator could not be paid by anyone without an
-- account. The RLS policy was never the problem: tiers_public already grants
-- SELECT to public on is_active = true.
--
-- Postgres checks table GRANTs before it evaluates RLS. If the anon role was
-- never granted SELECT on the table, the query fails with permission denied,
-- PostgREST returns no rows, and the app reads that as "this creator has no
-- tiers". The policy looks perfect the whole time.
--
-- This grants read to anon on the tables a logged-out visitor must be able to
-- see. RLS still decides which ROWS they get; the grant only decides whether
-- they may ask the question at all.
--
-- Safe to run more than once.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. See the problem. Anything missing 'anon' here is invisible to visitors.
select
  c.relname as table_name,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_can_select,
  has_table_privilege('authenticated', c.oid, 'SELECT') as authed_can_select
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'creator_profiles', 'subscription_tiers', 'posts', 'digital_products',
    'campaigns', 'campaign_tiers', 'social_posts', 'merch_products',
    'marketplace_listings', 'live_streams'
  )
order by anon_can_select, c.relname;


-- 2. Fix it. Read only, and only on tables a stranger is meant to browse.
grant select on public.subscription_tiers   to anon, authenticated;
grant select on public.creator_profiles     to anon, authenticated;
grant select on public.posts                to anon, authenticated;
grant select on public.digital_products     to anon, authenticated;
grant select on public.campaigns            to anon, authenticated;
grant select on public.campaign_tiers       to anon, authenticated;
grant select on public.social_posts         to anon, authenticated;
grant select on public.merch_products       to anon, authenticated;
grant select on public.marketplace_listings to anon, authenticated;
grant select on public.live_streams         to anon, authenticated;

-- 3. Stop this recurring. New tables inherit read access from here on, so a
--    table added next month is not silently invisible to visitors.
alter default privileges in schema public grant select on tables to anon, authenticated;


-- 4. Prove it from the visitor's side. Should return her paid tiers.
-- set role anon;
-- select name, price_monthly from public.subscription_tiers where is_active = true;
-- reset role;
