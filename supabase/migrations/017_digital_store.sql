-- ──────────────────────────────────────────────────────────────────
-- 017_digital_store.sql
-- Creator digital product store — PDFs, presets, courses, templates,
-- beat packs, etc. 10% platform cut on each sale.
-- ──────────────────────────────────────────────────────────────────

create table if not exists public.digital_products (
  id                  uuid primary key default gen_random_uuid(),
  creator_profile_id  uuid references public.creator_profiles(id) on delete cascade not null,
  title               text not null,
  description         text,
  price               numeric(10,2) not null check (price > 0),
  file_url            text not null,
  file_name           text not null,
  file_size_bytes     bigint,
  file_type           text not null default 'other'
                        check (file_type in ('pdf', 'zip', 'mp3', 'mp4', 'epub', 'psd', 'xmp', 'preset', 'other')),
  category            text not null default 'other'
                        check (category in ('ebook', 'preset', 'template', 'audio', 'course', 'video', 'other')),
  preview_image_url   text,
  sales_count         integer not null default 0,
  status              text not null default 'active'
                        check (status in ('active', 'paused', 'deleted')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.digital_purchases (
  id                  uuid primary key default gen_random_uuid(),
  digital_product_id  uuid references public.digital_products(id) on delete restrict not null,
  creator_profile_id  uuid references public.creator_profiles(id) on delete restrict not null,
  fan_user_id         uuid references auth.users(id) on delete set null,
  fan_email           text,
  amount_paid         numeric(10,2) not null,
  platform_fee        numeric(10,2) not null,
  creator_earns       numeric(10,2) not null,
  stripe_session_id   text,
  download_token      uuid not null unique default gen_random_uuid(),
  download_count      integer not null default 0,
  max_downloads       integer not null default 10,
  token_expires_at    timestamptz not null default (now() + interval '1 year'),
  created_at          timestamptz not null default now()
);

alter table public.digital_products enable row level security;
alter table public.digital_purchases enable row level security;

create policy "digital_products_public_select" on public.digital_products
  for select using (status = 'active');

create policy "digital_products_creator_manage" on public.digital_products
  for all using (
    creator_profile_id in (select id from public.creator_profiles where user_id = auth.uid())
  );

create policy "digital_purchases_fan_select" on public.digital_purchases
  for select using (fan_user_id = auth.uid());

create policy "digital_purchases_creator_select" on public.digital_purchases
  for select using (
    creator_profile_id in (select id from public.creator_profiles where user_id = auth.uid())
  );

create policy "digital_purchases_service_insert" on public.digital_purchases
  for insert with check (true);

create policy "digital_purchases_service_update" on public.digital_purchases
  for update using (true);

create index if not exists digital_products_creator_idx
  on public.digital_products(creator_profile_id) where status = 'active';

create index if not exists digital_purchases_token_idx
  on public.digital_purchases(download_token);

create index if not exists digital_purchases_fan_idx
  on public.digital_purchases(fan_user_id);
