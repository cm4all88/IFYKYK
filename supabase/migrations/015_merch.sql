-- ──────────────────────────────────────────────────────────────────
-- 015_merch.sql
-- Creator merch products and orders via Loudcap
-- ──────────────────────────────────────────────────────────────────

create table if not exists public.merch_products (
  id                  uuid primary key default gen_random_uuid(),
  creator_profile_id  uuid references public.creator_profiles(id) on delete cascade not null,
  loudcap_product_id  text not null,
  name                text not null,
  description         text,
  design_url          text not null,
  retail_price        numeric(10,2) not null,
  base_cost           numeric(10,2) not null,
  platform_cut        numeric(10,2) not null,
  creator_earns       numeric(10,2) not null,
  category            text not null,
  mockup_urls         text[] not null default '{}',
  status              text not null default 'active'
                        check (status in ('active', 'paused', 'sold_out')),
  created_at          timestamptz not null default now()
);

create table if not exists public.merch_orders (
  id                  uuid primary key default gen_random_uuid(),
  merch_product_id    uuid references public.merch_products(id) on delete restrict not null,
  creator_profile_id  uuid references public.creator_profiles(id) on delete restrict not null,
  fan_user_id         uuid references auth.users(id) on delete set null,
  loudcap_order_id    text not null unique,
  variant_id          text not null,
  quantity            integer not null default 1,
  retail_price        numeric(10,2) not null,
  creator_earnings    numeric(10,2) not null,
  platform_earnings   numeric(10,2) not null,
  stripe_payment_id   text,
  status              text not null default 'pending'
                        check (status in ('pending', 'in_production', 'shipped', 'delivered', 'cancelled', 'refunded')),
  tracking_number     text,
  tracking_url        text,
  shipping_name       text not null,
  shipping_line1      text not null,
  shipping_city       text not null,
  shipping_state      text not null,
  shipping_zip        text not null,
  shipping_country    text not null default 'US',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.merch_products enable row level security;
alter table public.merch_orders enable row level security;

create policy "merch_products_public_select" on public.merch_products
  for select using (status = 'active');

create policy "merch_products_creator_manage" on public.merch_products
  for all using (
    creator_profile_id in (select id from public.creator_profiles where user_id = auth.uid())
  );

create policy "merch_orders_creator_select" on public.merch_orders
  for select using (
    creator_profile_id in (select id from public.creator_profiles where user_id = auth.uid())
    or fan_user_id = auth.uid()
  );

create policy "merch_orders_service_all" on public.merch_orders
  for all using (true) with check (true);

create index if not exists merch_products_creator_idx on public.merch_products(creator_profile_id);
create index if not exists merch_orders_creator_idx on public.merch_orders(creator_profile_id);
