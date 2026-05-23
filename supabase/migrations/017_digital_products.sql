-- ──────────────────────────────────────────────────────────────────
-- 017_digital_products.sql
-- Creator digital product store.
-- Creators upload files (PDFs, presets, courses, etc.) and sell them.
-- Platform takes 10% via Stripe application fee.
-- ──────────────────────────────────────────────────────────────────

create table if not exists public.digital_products (
  id                  uuid primary key default gen_random_uuid(),
  creator_profile_id  uuid references public.creator_profiles(id) on delete cascade not null,
  title               text not null,
  description         text,
  price               numeric(10,2) not null check (price >= 0.99),
  category            text not null default 'other'
                        check (category in ('guide','course','preset','template','sample_pack','artwork','workout','spreadsheet','bundle','other')),
  file_url            text,           -- private storage URL (BunnyCDN or Supabase)
  file_name           text,           -- original filename shown to buyer
  file_size_bytes     bigint,
  thumbnail_url       text,           -- public preview image
  preview_description text,           -- short "what's inside" description
  download_limit      integer,        -- null = unlimited downloads per purchase
  status              text not null default 'draft'
                        check (status in ('active', 'draft', 'archived')),
  total_sales         integer not null default 0,
  total_revenue       numeric(10,2) not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.digital_purchases (
  id                  uuid primary key default gen_random_uuid(),
  digital_product_id  uuid references public.digital_products(id) on delete restrict not null,
  creator_profile_id  uuid references public.creator_profiles(id) on delete restrict not null,
  fan_user_id         uuid references auth.users(id) on delete set null,
  fan_email           text not null,
  amount_paid         numeric(10,2) not null,
  platform_fee        numeric(10,2) not null,
  creator_receives    numeric(10,2) not null,
  stripe_session_id   text unique,
  download_count      integer not null default 0,
  download_token      text unique default encode(gen_random_bytes(24), 'hex'),
  created_at          timestamptz not null default now()
);

-- Indexes
create index if not exists digital_products_creator_idx
  on public.digital_products(creator_profile_id, status);

create index if not exists digital_purchases_product_idx
  on public.digital_purchases(digital_product_id);

create index if not exists digital_purchases_fan_idx
  on public.digital_purchases(fan_user_id);

create index if not exists digital_purchases_token_idx
  on public.digital_purchases(download_token);

-- RLS
alter table public.digital_products enable row level security;
alter table public.digital_purchases enable row level security;

create policy "digital_products_public_active" on public.digital_products
  for select using (status = 'active');

create policy "digital_products_creator_all" on public.digital_products
  for all using (
    creator_profile_id in (select id from public.creator_profiles where user_id = auth.uid())
  );

create policy "digital_purchases_own" on public.digital_purchases
  for select using (
    fan_user_id = auth.uid()
    or creator_profile_id in (select id from public.creator_profiles where user_id = auth.uid())
  );

create policy "digital_purchases_service_insert" on public.digital_purchases
  for insert with check (true);

create policy "digital_purchases_service_update" on public.digital_purchases
  for update using (true);
