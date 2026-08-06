-- ─────────────────────────────────────────────────────────────────────────────
-- Why can a logged-out visitor not see the store or the post?
--
-- Both tables have a correct public policy. The rows just do not qualify:
--   digital_products  → visible only when status = 'active'
--   posts             → visible only when tier = 'free' AND status = 'live'
--
-- As the creator you see everything through the owner policy, so the page looks
-- right to you and empty to everyone else. Run section 1, read it, then run the
-- fix in section 2 for whatever is wrong.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. WHAT A STRANGER ACTUALLY SEES ────────────────────────────────────────

select
  d.title,
  d.status,
  case when d.status = 'active' then 'visible to everyone'
       else 'HIDDEN — nobody but you can see this' end as public_visibility,
  d.price,
  d.file_url is not null as has_file,
  d.storage_provider
from public.digital_products d
join public.creator_profiles cp on cp.id = d.creator_profile_id
where cp.handle = 'devineplanet'
  and d.status <> 'archived'
order by d.created_at desc;

select
  p.created_at,
  p.status,
  p.tier,
  case when p.tier = 'free' and p.status = 'live' then 'visible to everyone'
       else 'HIDDEN — nobody but you can see this' end as public_visibility,
  left(coalesce(p.caption, ''), 50) as caption
from public.posts p
join public.creator_profiles cp on cp.id = p.creator_profile_id
where cp.handle = 'devineplanet'
order by p.created_at desc
limit 10;


-- ── 2. THE FIX ──────────────────────────────────────────────────────────────
-- Only run these after reading section 1. They publish things. Do not run the
-- product one blind if any of those covers are more revealing than you want a
-- stranger to see, and never publish a product with has_file = false: the buyer
-- pays and receives a broken link.

-- Publish every draft product that actually has a file attached.
-- update public.digital_products d
-- set status = 'active'
-- from public.creator_profiles cp
-- where cp.id = d.creator_profile_id
--   and cp.handle = 'devineplanet'
--   and d.status = 'draft'
--   and d.file_url is not null;

-- Or publish one at a time, which is safer:
-- update public.digital_products set status = 'active' where id = 'PASTE_ID';

-- Make one post public. Check the caption in section 1 first.
-- update public.posts set tier = 'free', status = 'live' where id = 'PASTE_ID';


-- ── 3. THE REVERSE ──────────────────────────────────────────────────────────
-- Anything you want taken back out of public view, immediately:
-- update public.digital_products set status = 'draft' where id = 'PASTE_ID';
-- update public.posts set tier = 'premium', lock_type = 'subscription' where id = 'PASTE_ID';
