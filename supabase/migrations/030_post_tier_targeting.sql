-- ──────────────────────────────────────────────────────────────────
-- 030_post_tier_targeting.sql
-- Lets a post be locked to a specific subscription tier (and higher),
-- not just "all subscribers". NULL = no specific tier (free or all-subs,
-- depending on lock_type).
-- ──────────────────────────────────────────────────────────────────

alter table public.posts
  add column if not exists required_tier_id uuid
    references public.subscription_tiers(id) on delete set null;

create index if not exists posts_required_tier_idx
  on public.posts(required_tier_id);
