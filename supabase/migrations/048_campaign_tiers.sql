-- ──────────────────────────────────────────────────────────────────
-- Migration 048 — Campaign tiers (Kickstarter-style backing)
-- Layers creator-defined backing tiers on top of the existing
-- keep-what-you-raise campaign model. The creator builds her own tiers
-- and attaches rewards from a typed menu. Physical / discount rewards
-- generate a backer code the creator looks up when the backer redeems.
-- Run in the Supabase SQL editor.
-- ──────────────────────────────────────────────────────────────────

create table if not exists public.campaign_tiers (
  id                  uuid primary key default gen_random_uuid(),
  campaign_id         uuid references public.campaigns(id) on delete cascade not null,
  title               text not null,
  amount              decimal(10,2) not null,
  description         text,
  rewards             jsonb not null default '[]'::jsonb,  -- [{ type, label }]
  backer_limit        int,                                  -- null = unlimited
  sort_order          int not null default 0,
  created_at          timestamptz not null default now()
);

-- A backing can reference a tier (null = "name your own amount" backing).
-- backer_code is set only when the chosen tier carries a real-world perk.
alter table public.campaign_donations
  add column if not exists tier_id     uuid references public.campaign_tiers(id) on delete set null,
  add column if not exists backer_code text;

alter table public.campaign_tiers enable row level security;

-- Tiers of public campaigns are publicly readable (mirrors campaign visibility)
create policy "Campaign tiers are public" on public.campaign_tiers
  for select using (
    campaign_id in (select id from public.campaigns where status in ('active','funded'))
  );

-- Creators manage tiers on their own campaigns
create policy "Creators manage own campaign tiers" on public.campaign_tiers
  for all to authenticated
  using (
    campaign_id in (
      select c.id from public.campaigns c
      join public.creator_profiles p on p.id = c.creator_profile_id
      where p.user_id = auth.uid()
    )
  );

create index if not exists idx_campaign_tiers_campaign on public.campaign_tiers(campaign_id);
create index if not exists idx_donations_tier on public.campaign_donations(tier_id);

select 'Migration 048 complete — campaign tiers' as result;
