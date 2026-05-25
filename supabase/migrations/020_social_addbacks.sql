-- Migration 020: Social Add-backs
-- Creators can sell follow-backs on their social channels (Instagram, TikTok, etc.)
-- Platform takes 0% cut — creator keeps everything minus Stripe processing

create table if not exists public.social_addbacks (
  id                  uuid primary key default gen_random_uuid(),
  creator_profile_id  uuid references public.creator_profiles(id) on delete cascade not null,
  platform            text not null check (platform in ('instagram','tiktok','youtube','x','twitch','discord')),
  label               text not null,              -- e.g. "I'll follow you back on Instagram"
  price_usd           numeric(10,2) not null,     -- creator sets price
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);

create index if not exists social_addbacks_creator_idx
  on public.social_addbacks(creator_profile_id, is_active);

create table if not exists public.social_addback_purchases (
  id                  uuid primary key default gen_random_uuid(),
  addback_id          uuid references public.social_addbacks(id) on delete cascade not null,
  buyer_user_id       uuid references auth.users(id) on delete set null,
  buyer_handle        text,
  amount_usd          numeric(10,2) not null,
  stripe_payment_id   text,
  fulfilled           boolean not null default false,
  fulfilled_at        timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists social_addback_purchases_addback_idx
  on public.social_addback_purchases(addback_id, fulfilled);

alter table public.social_addbacks          enable row level security;
alter table public.social_addback_purchases  enable row level security;

-- Creators manage their own addbacks
create policy "social_addbacks_own" on public.social_addbacks
  for all using (
    creator_profile_id in (
      select id from public.creator_profiles where user_id = auth.uid()
    )
  );

-- Public can view active addbacks
create policy "social_addbacks_public_read" on public.social_addbacks
  for select using (is_active = true);

-- Purchases visible to creator and buyer
create policy "social_addback_purchases_creator" on public.social_addback_purchases
  for select using (
    addback_id in (
      select id from public.social_addbacks
      where creator_profile_id in (
        select id from public.creator_profiles where user_id = auth.uid()
      )
    )
  );

create policy "social_addback_purchases_buyer" on public.social_addback_purchases
  for select using (buyer_user_id = auth.uid());

create policy "social_addback_purchases_insert" on public.social_addback_purchases
  for insert with check (true);

create policy "social_addback_purchases_update" on public.social_addback_purchases
  for update using (true);
