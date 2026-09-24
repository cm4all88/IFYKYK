-- 068 verification. Read only. Run in the SQL editor after applying 068.

-- 1. Tip status distribution. Legacy rows show legacy_unverified = true.
select status, legacy_unverified, tip_source, count(*), sum(amount)
  from public.tips group by 1,2,3 order by 1,2,3;

-- 2. New tables are locked: expect RLS on, zero policies, no anon/authenticated grants.
select c.relname, c.relrowsecurity,
       (select count(*) from pg_policies p where p.tablename = c.relname) as policies,
       (select string_agg(distinct grantee || ':' || privilege_type, ', ')
          from information_schema.role_table_grants g
         where g.table_name = c.relname and g.grantee in ('anon','authenticated')) as browser_grants
  from pg_class c
 where c.relname in ('stripe_webhook_events','tip_checkout_attempts','creator_trust','creator_trust_events');

-- 3. tips policies: expect creator select + tips_fan_select only; no public read.
select policyname, cmd, roles, qual from pg_policies where tablename = 'tips';

-- 4. EXPOSURE CHECK (pre-existing, see FRAUD_AUDIT.md §5).
--    If this returns a row with roles {public} or {anon}, published creator rows,
--    INCLUDING first_ip / last_ip / date_of_birth / stripe_account_id, are
--    readable with the browser key.
select policyname, cmd, roles, qual from pg_policies where tablename = 'creator_profiles';
select privilege_type from information_schema.role_table_grants
 where table_name = 'creator_profiles' and grantee = 'anon';

-- 5. From the visitor's side (should ERROR with permission denied on each):
-- set role anon;
-- select * from public.creator_trust limit 1;
-- select * from public.tip_checkout_attempts limit 1;
-- select ip from public.tip_checkout_attempts limit 1;
-- reset role;
