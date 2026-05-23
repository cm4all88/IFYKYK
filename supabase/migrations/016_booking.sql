-- ──────────────────────────────────────────────────────────────────
-- 016_booking.sql
-- Booking URL on creator profiles
-- ──────────────────────────────────────────────────────────────────

alter table public.creator_profiles
  add column if not exists booking_url     text,
  add column if not exists booking_label   text,
  add column if not exists offers_services boolean not null default false;
