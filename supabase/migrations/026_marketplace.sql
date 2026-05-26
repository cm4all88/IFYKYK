-- Migration 026: Creator marketplace
create table if not exists public.marketplace_listings (
  id                  uuid primary key default gen_random_uuid(),
  creator_profile_id  uuid references public.creator_profiles(id) on delete cascade not null,
  title               text not null,
  description         text,
  price_usd           numeric(10,2) not null check (price_usd >= 1),
  condition           text default 'good' check (condition in ('new','like_new','good','fair')),
  category            text default 'other' check (category in ('clothing','accessories','prints','gear','signed','personal','other')),
  images              text[] default '{}',
  quantity            int default 1 check (quantity >= 0),
  sold                boolean default false,
  subscriber_only     boolean default false,
  personal_note       text,
  autograph           boolean default false,
  status              text default 'active' check (status in ('active','sold','archived')),
  stripe_price_id     text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create table if not exists public.marketplace_orders (
  id                  uuid primary key default gen_random_uuid(),
  listing_id          uuid references public.marketplace_listings(id) on delete set null,
  buyer_user_id       uuid references auth.users(id) on delete set null,
  buyer_email         text,
  buyer_name          text,
  shipping_address    jsonb,
  amount_usd          numeric(10,2) not null,
  platform_fee_usd    numeric(10,2),
  stripe_session_id   text,
  status              text default 'pending' check (status in ('pending','paid','shipped','delivered','refunded')),
  tracking_number     text,
  created_at          timestamptz default now()
);

create index marketplace_listings_creator_idx on public.marketplace_listings(creator_profile_id, status);

alter table public.marketplace_listings enable row level security;
alter table public.marketplace_orders enable row level security;

create policy "Public can view active listings"
  on marketplace_listings for select using (status = 'active');

create policy "Creators manage own listings"
  on marketplace_listings for all using (
    creator_profile_id in (select id from public.creator_profiles where user_id = auth.uid())
  );

create policy "Anyone can create order"
  on marketplace_orders for insert with check (true);

create policy "Buyers see own orders"
  on marketplace_orders for select using (buyer_user_id = auth.uid());

create policy "Creators see orders for their listings"
  on marketplace_orders for select using (
    listing_id in (
      select id from public.marketplace_listings where creator_profile_id in (
        select id from public.creator_profiles where user_id = auth.uid()
      )
    )
  );

create policy "Creators update order status"
  on marketplace_orders for update using (
    listing_id in (
      select id from public.marketplace_listings where creator_profile_id in (
        select id from public.creator_profiles where user_id = auth.uid()
      )
    )
  );
