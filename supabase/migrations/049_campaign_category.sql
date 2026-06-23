-- ──────────────────────────────────────────────────────────────────
-- Migration 049 — Campaign category
-- Stores which guided template a campaign was built from, so the tier
-- builder can keep offering category-aware reward suggestions after
-- creation. Null for older campaigns and "start from scratch" campaigns.
-- Run in the Supabase SQL editor.
-- ──────────────────────────────────────────────────────────────────

alter table public.campaigns
  add column if not exists category text;

select 'Migration 049 complete — campaign category' as result;
