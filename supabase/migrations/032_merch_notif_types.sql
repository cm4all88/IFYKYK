-- ──────────────────────────────────────────────────────────────────
-- 032_merch_notif_types.sql
-- Adds merch order events to the notification type whitelist so the fan can be
-- told when their order ships / is delivered (the return channel from Loudcap).
-- ──────────────────────────────────────────────────────────────────

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'new_subscriber','tip','super_tip','new_comment','campaign_donation',
    'gift_sub','message','live_viewer',
    'merch_order','merch_shipped','merch_delivered'
  ));
