-- Migration 025: Social add-backs
-- Creators can sell follow-backs on their social platforms
create table if not exists public.social_addbacks (
  id                  uuid primary key default gen_random_uuid(),
  creator_profile_id  uuid references public.creator_profiles(id) on delete cascade not null,
  platform            text not null check (platform in ('instagram','tiktok','youtube','twitter','twitch','discord','spotify')),
  price_usd           numeric(10,2) not null check (price_usd >= 1),
  description         text,
  is_active           boolean default true,
  delivery_days       int default 3,
  created_at          timestamptz default now()
);

create table if not exists public.social_addback_orders (
  id                  uuid primary key default gen_random_uuid(),
  addback_id          uuid references public.social_addbacks(id) on delete cascade not null,
  fan_user_id         uuid references auth.users(id) on delete set null,
  fan_handle          text not null,
  fan_email           text,
  amount_usd          numeric(10,2) not null,
  stripe_session_id   text,
  status              text default 'pending' check (status in ('pending','paid','delivered','refunded')),
  message             text,
  created_at          timestamptz default now()
);

alter table public.social_addbacks enable row level security;
alter table public.social_addback_orders enable row level security;

create policy "Public can view active addbacks"
  on social_addbacks for select using (is_active = true);

create policy "Creators manage own addbacks"
  on social_addbacks for all using (
    creator_profile_id in (select id from public.creator_profiles where user_id = auth.uid())
  );

create policy "Anyone can create an order"
  on social_addback_orders for insert with check (true);

create policy "Creators see orders for their addbacks"
  on social_addback_orders for select using (
    addback_id in (
      select id from public.social_addbacks where creator_profile_id in (
        select id from public.creator_profiles where user_id = auth.uid()
      )
    )
  );

create policy "Fans see own orders"
  on social_addback_orders for select using (fan_user_id = auth.uid());
