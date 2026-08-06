-- ─────────────────────────────────────────────────────────────────────────────
-- 065_creator_profiles_public_read.sql
--
-- creator_profiles had no public SELECT policy. Every policy on it was scoped to
-- {authenticated}, and the only SELECT policy was user_id = auth.uid(). A
-- logged-out visitor was granted nothing on the central table of a public
-- creator platform.
--
-- The visible symptom was elsewhere, which is why it took so long to find. The
-- tiers_creator policy on subscription_tiers is FOR ALL to public and its
-- expression reads creator_profiles. Postgres evaluates every permissive policy
-- on a SELECT, not only the one that would pass, so an anon query against
-- subscription_tiers failed while evaluating tiers_creator. tiers_public would
-- have allowed it and never got the chance. The page read the resulting empty
-- response as "this creator has no tiers" and showed a signup prompt instead of
-- a price list, so no visitor could pay a creator without an account.
--
-- Anything whose RLS expression touches creator_profiles has the same fault.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. CHECK FIRST ──────────────────────────────────────────────────────────
-- The policy below publishes only rows where published = true. If a creator's
-- page currently works and this returns false for them, DO NOT run section 2
-- yet: it would hide a page that is live today. Fix the flag first.
select handle, kind, published
from public.creator_profiles
order by created_at;


-- ── 2. THE POLICY ───────────────────────────────────────────────────────────
-- A published creator page is public by definition. Unpublished profiles stay
-- invisible, and RLS keeps deciding which rows anyone sees.
drop policy if exists "creator_profiles_public_select" on public.creator_profiles;
create policy "creator_profiles_public_select" on public.creator_profiles
  for select
  to public
  using (published = true);

-- Postgres checks the table grant before it evaluates any policy. Without this
-- the policy above never runs.
grant select on public.creator_profiles to anon, authenticated;


-- ── 3. VERIFY FROM THE VISITOR'S SIDE ───────────────────────────────────────
-- Both of these should now return rows. The second is the query that was
-- failing, and it should stop failing once creator_profiles is readable.
-- set role anon;
-- select handle, display_name from public.creator_profiles where published = true;
-- select name, price_monthly from public.subscription_tiers where is_active = true;
-- reset role;


-- ── 4. NOTE ─────────────────────────────────────────────────────────────────
-- This exposes the columns on a published creator row to anyone, which is what
-- a public profile means. If any column on that table is genuinely private
-- (internal notes, an email, a provider id), it does not belong on a table that
-- is read directly by the browser: move it to a private side table rather than
-- narrowing this policy, or the page breaks again in a different way.
