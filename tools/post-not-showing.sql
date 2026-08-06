-- ─────────────────────────────────────────────────────────────────────────────
-- Why is a post not showing on the public page?
-- Run in the Supabase SQL editor. This bypasses RLS, so it shows you the row as
-- it really is rather than as a visitor sees it.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. THE POST ITSELF
--    The public page only renders posts where status = 'live' AND tier = 'free'
--    (that pair is enforced twice: once by the page query, once by the RLS
--    policy on posts). Anything else is invisible to a logged-out visitor.
select
  p.created_at,
  p.status,              -- must be 'live'. 'scheduled' or 'draft' will not show.
  p.tier,                -- must be 'free' for a public visitor to see it at all
  p.lock_type,
  p.moderation_status,
  p.scheduled_at,        -- if set, it is waiting for the cron
  p.expires_at,          -- if in the past, it is filtered out
  p.campaign_id,
  p.media_url is not null as has_media,
  left(coalesce(p.caption, ''), 40) as caption_start,
  cp.handle              as posted_to_handle,
  cp.kind                as profile_kind
from public.posts p
join public.creator_profiles cp on cp.id = p.creator_profile_id
order by p.created_at desc
limit 10;


-- 2. DID IT LAND ON THE RIGHT PROFILE?
--    If posted_to_handle above is not 'devineplanet', or profile_kind is not
--    'spotlight', the post went to a different profile than the public page
--    reads from. That is the answer.
select id, handle, kind, published, user_id
from public.creator_profiles
order by created_at;


-- 3. WHAT A LOGGED-OUT VISITOR ACTUALLY GETS
--    This is the exact filter the public page applies. If step 1 shows your post
--    and this returns nothing, the mismatch is in one of status/tier/expires_at.
select count(*) as visible_to_public
from public.posts p
join public.creator_profiles cp on cp.id = p.creator_profile_id
where cp.handle = 'devineplanet'
  and p.status = 'live'
  and p.tier = 'free'
  and (p.expires_at is null or p.expires_at > now());
