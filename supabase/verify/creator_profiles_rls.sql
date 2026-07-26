-- ──────────────────────────────────────────────────────────────────
-- Stage 0 verification — creator_profiles row level security
--
-- WHY THIS EXISTS
-- `creator_profiles` has no CREATE TABLE and no CREATE POLICY in any file
-- under supabase/migrations/. The migration history is therefore not a
-- complete record of this table, and its RLS state cannot be determined by
-- reading this repository. That matters because the table holds `claim_code`,
-- a bearer secret: whoever has one can set the email and password on a
-- pre-created creator account.
--
-- Stage 0 removed the anon-client read of claim_code in the admin UI
-- (app/admin/creators/page.tsx now uses the service client), so the app no
-- longer depends on RLS to protect those codes. This script confirms whether
-- PostgREST does.
--
-- HOW TO RUN
-- Paste into the Supabase SQL Editor and read the three result sets.
-- ──────────────────────────────────────────────────────────────────

-- 1. Is RLS switched on at all?
--    Expected: rowsecurity = true.
--    If false, EVERY column of this table is readable by any client holding
--    the anon key, which is shipped to browsers. That includes claim_code.
select
  c.relname                          as table_name,
  c.relrowsecurity                   as rls_enabled,
  c.relforcerowsecurity              as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('creator_profiles', 'email_opt_outs');

-- 2. What policies exist, and what do they actually allow?
--    Look hard at any SELECT policy whose qualifier is `true` — that is a
--    public read of every column, claim_code included.
select
  polname                                        as policy_name,
  case polcmd
    when 'r' then 'SELECT' when 'a' then 'INSERT'
    when 'w' then 'UPDATE' when 'd' then 'DELETE'
    else 'ALL'
  end                                            as command,
  pg_get_expr(polqual, polrelid)                 as using_expression,
  pg_get_expr(polwithcheck, polrelid)            as with_check_expression
from pg_policy
where polrelid = 'public.creator_profiles'::regclass
order by policy_name;

-- 3. Which roles hold direct grants on the table?
--    `anon` appearing here with SELECT is the exposure that matters, because
--    RLS is the only thing standing between it and every row.
select
  grantee,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'creator_profiles'
group by grantee
order by grantee;

-- ── WHAT TO DO WITH THE ANSWERS ───────────────────────────────────
--
-- RLS enabled, no permissive public SELECT policy
--   → Nothing further needed. Record the result and move on.
--
-- RLS disabled, OR a SELECT policy with `using (true)`, OR anon holding a
-- direct SELECT grant
--   → Every unclaimed claim_code in the table is readable by anyone with the
--     anon key. Treat as an incident:
--       a) Rotate live codes:
--            update public.creator_profiles
--               set claim_code = null, claim_expires_at = null
--             where claim_code is not null and claimed_at is null;
--          then re-issue from /admin/creators for prospects still in flight.
--       b) Add a restrictive policy before storing any further codes. The
--          app does not read claim_code through the anon client any more,
--          so a policy that excludes it costs nothing:
--            alter table public.creator_profiles enable row level security;
--            create policy "public reads published creator pages"
--              on public.creator_profiles for select
--              using (published is true and deleted_at is null);
--          Verify the public creator page, Explore, and search still work
--          before considering this done — those read through the anon client.
