-- ──────────────────────────────────────────────────────────────────
-- 033_retention_notif_types.sql
-- Adds the notification types that drive the retention loop: a new post from a
-- creator you follow, a creator going live, and a medal on your post.
-- (Includes all prior types so the constraint is the single source of truth.)
--
-- Run AFTER 032_merch_notif_types.sql.
-- ──────────────────────────────────────────────────────────────────

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'new_subscriber','tip','super_tip','new_comment','campaign_donation',
    'gift_sub','message','live_viewer',
    'merch_order','merch_shipped','merch_delivered',
    'new_post','live_started','new_medal'
  ));
