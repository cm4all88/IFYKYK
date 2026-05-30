-- Migration 028: Add niche to creator_profiles
alter table public.creator_profiles
  add column if not exists niche text;

comment on column public.creator_profiles.niche is
  'Creator niche slug from lib/niches.ts — used for onboarding personalization and discovery.';
