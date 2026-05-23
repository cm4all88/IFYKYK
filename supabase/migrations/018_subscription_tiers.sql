-- 018_subscription_tiers.sql
create table if not exists public.subscription_tiers (
  id                  uuid primary key default gen_random_uuid(),
  creator_profile_id  uuid references public.creator_profiles(id) on delete cascade not null,
  name                text not null,
  description         text,
  price_monthly       numeric(10,2) not null,
  price_yearly        numeric(10,2),
  perks               text[] not null default '{}',
  color               text,
  sort_order          integer not null default 0,
  is_active           boolean not null default true,
  subscriber_count    integer not null default 0,
  created_at          timestamptz not null default now()
);

create index if not exists subscription_tiers_creator_idx
  on public.subscription_tiers(creator_profile_id, sort_order);

alter table public.subscription_tiers enable row level security;

create policy "tiers_public_select" on public.subscription_tiers
  for select using (is_active = true);

create policy "tiers_creator_manage" on public.subscription_tiers
  for all using (
    creator_profile_id in (select id from public.creator_profiles where user_id = auth.uid())
  );

alter table public.subscriptions
  add column if not exists tier_id        uuid references public.subscription_tiers(id) on delete set null,
  add column if not exists billing_period text check (billing_period in ('monthly', 'yearly'));
