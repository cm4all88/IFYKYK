-- ──────────────────────────────────────────────────────────────────
-- Migration 054 — Signup presence (location & device)
-- Captures the IP, approximate location (from Vercel's edge geo headers),
-- and user agent the first time we see a creator and the most recent time.
-- Nothing is captured retroactively; existing creators fill in on next visit.
-- Disclose IP/location collection in the privacy policy.
-- Run in the Supabase SQL editor.
-- ──────────────────────────────────────────────────────────────────

alter table public.creator_profiles
  add column if not exists first_ip          text,
  add column if not exists first_country     text,
  add column if not exists first_region      text,
  add column if not exists first_city        text,
  add column if not exists first_user_agent  text,
  add column if not exists first_seen_at     timestamptz,
  add column if not exists last_ip           text,
  add column if not exists last_country      text,
  add column if not exists last_region       text,
  add column if not exists last_city         text,
  add column if not exists last_user_agent   text,
  add column if not exists last_seen_at      timestamptz;

select 'Migration 054 complete — signup presence' as result;
