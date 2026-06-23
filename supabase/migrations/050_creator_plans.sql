-- ──────────────────────────────────────────────────────────────────
-- Migration 050 — Creator plans
-- Remembers which parts of their venue a creator wants to set up when
-- they cannot be created in one click (a live show needs a real stream,
-- merch needs a Loudcap product, marketplace needs real items). The
-- studio records the intent and a starter idea; the dashboard turns
-- each into a guided next step. One row per creator.
-- Run in the Supabase SQL editor.
-- ──────────────────────────────────────────────────────────────────

create table if not exists public.creator_plans (
  creator_profile_id  uuid primary key references public.creator_profiles(id) on delete cascade,
  wants_live          boolean not null default false,
  wants_merch         boolean not null default false,
  wants_marketplace   boolean not null default false,
  live_title          text,
  live_at             timestamptz,
  merch_idea          text,
  marketplace_idea    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.creator_plans enable row level security;

create policy "creator_plans_owner" on public.creator_plans
  for all to authenticated
  using (creator_profile_id in (select id from public.creator_profiles where user_id = auth.uid()))
  with check (creator_profile_id in (select id from public.creator_profiles where user_id = auth.uid()));

select 'Migration 050 complete — creator plans' as result;
