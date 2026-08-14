-- ─────────────────────────────────────────────────────────────────────────────
-- 067_digital_promotions.sql
--
-- Two ways to discount a digital product, sharing one price calculation.
--
--   1. A sale price on the product itself, with an optional window. No code
--      needed. The public card shows the old price struck through.
--   2. A promo code the buyer types at checkout. Percent or fixed amount,
--      scoped to one product or everything the creator sells, with an optional
--      expiry, a redemption cap, and one use per buyer email.
--
-- Why not Stripe's native Coupon object: digital products are 0% to the platform
-- and the fan covers the card fee via grossUpForStripe. A Stripe coupon applies
-- to the already grossed up total, so it would eat into the creator's net rather
-- than only the list price. The discount has to land on the creator's price
-- first, and the gross up runs on the discounted amount. That math lives in
-- lib/promotions.ts and is applied server side in the purchase route, never in
-- the browser.
--
-- Safe to run more than once.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Sale price on the product ─────────────────────────────────────────────

alter table public.digital_products
  add column if not exists sale_price     numeric(10,2),
  add column if not exists sale_starts_at timestamptz,
  add column if not exists sale_ends_at   timestamptz;

comment on column public.digital_products.sale_price is
  'When set and inside the window, this replaces price at checkout. Zero means free for the duration of the sale.';

-- A sale that is not below the list price is not a sale. Zero is allowed on
-- purpose: a free weekend is a real promotion, and the purchase route has a
-- Stripe-free grant path for it.
alter table public.digital_products
  drop constraint if exists digital_products_sale_price_valid;
alter table public.digital_products
  add constraint digital_products_sale_price_valid check (
    sale_price is null or (sale_price >= 0 and sale_price < price)
  );

alter table public.digital_products
  drop constraint if exists digital_products_sale_window_valid;
alter table public.digital_products
  add constraint digital_products_sale_window_valid check (
    sale_starts_at is null or sale_ends_at is null or sale_ends_at > sale_starts_at
  );


-- ── 2. Promo codes ───────────────────────────────────────────────────────────

create table if not exists public.promo_codes (
  id                  uuid primary key default gen_random_uuid(),
  creator_profile_id  uuid references public.creator_profiles(id) on delete cascade not null,
  code                text not null,
  kind                text not null default 'percent' check (kind in ('percent', 'fixed')),
  -- percent: 1 to 100. fixed: dollars off.
  value               numeric(10,2) not null check (value > 0),
  scope               text not null default 'all' check (scope in ('all', 'product')),
  digital_product_id  uuid references public.digital_products(id) on delete cascade,
  max_redemptions     integer check (max_redemptions is null or max_redemptions > 0),
  redemption_count    integer not null default 0,
  starts_at           timestamptz,
  ends_at             timestamptz,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),

  constraint promo_codes_percent_range check (kind <> 'percent' or value <= 100),
  constraint promo_codes_scope_target  check (scope <> 'product' or digital_product_id is not null),
  constraint promo_codes_window_valid  check (starts_at is null or ends_at is null or ends_at > starts_at)
);

-- Codes are matched case insensitively and stored uppercase by the app. The
-- index enforces that a creator cannot own SUMMER and summer as two codes.
create unique index if not exists promo_codes_creator_code_key
  on public.promo_codes (creator_profile_id, upper(code));

create index if not exists promo_codes_creator_idx
  on public.promo_codes (creator_profile_id, active);


-- Every successful use. Doubles as the one-per-buyer guard and as the report a
-- creator reads to see whether a code actually did anything.
create table if not exists public.promo_redemptions (
  id                   uuid primary key default gen_random_uuid(),
  promo_code_id        uuid references public.promo_codes(id) on delete cascade not null,
  creator_profile_id   uuid references public.creator_profiles(id) on delete cascade not null,
  digital_product_id   uuid references public.digital_products(id) on delete set null,
  digital_purchase_id  uuid references public.digital_purchases(id) on delete set null,
  fan_user_id          uuid references auth.users(id) on delete set null,
  fan_email            text not null,
  discount_amount      numeric(10,2) not null default 0,
  created_at           timestamptz not null default now()
);

-- One use per buyer per code. Email rather than user id because most digital
-- buyers check out without an account.
create unique index if not exists promo_redemptions_code_email_key
  on public.promo_redemptions (promo_code_id, lower(fan_email));

create index if not exists promo_redemptions_creator_idx
  on public.promo_redemptions (creator_profile_id, created_at desc);


-- ── 3. What a purchase was actually charged, and why ─────────────────────────
-- amount_paid alone cannot tell a creator whether a sale was discounted or just
-- cheap. Keep the list price and the discount alongside it.

alter table public.digital_purchases
  add column if not exists list_price      numeric(10,2),
  add column if not exists discount_amount numeric(10,2) not null default 0,
  add column if not exists promo_code_id   uuid references public.promo_codes(id) on delete set null;

create index if not exists digital_purchases_promo_idx
  on public.digital_purchases (promo_code_id);


-- ── 4. RLS ───────────────────────────────────────────────────────────────────
-- Deliberately no anon or public read on promo_codes. A visitor who could list
-- this table could read every unpublished code a creator has. Validation runs
-- server side in /api/promo/validate under the service role, which bypasses RLS
-- and answers one question at a time about one code the buyer already typed.

alter table public.promo_codes       enable row level security;
alter table public.promo_redemptions enable row level security;

drop policy if exists "promo_codes_creator_all" on public.promo_codes;
create policy "promo_codes_creator_all" on public.promo_codes
  for all
  using (
    creator_profile_id in (select id from public.creator_profiles where user_id = auth.uid())
  )
  with check (
    creator_profile_id in (select id from public.creator_profiles where user_id = auth.uid())
  );

drop policy if exists "promo_redemptions_creator_read" on public.promo_redemptions;
create policy "promo_redemptions_creator_read" on public.promo_redemptions
  for select
  using (
    creator_profile_id in (select id from public.creator_profiles where user_id = auth.uid())
  );

-- Postgres checks GRANTs before it evaluates RLS, so a missing grant reads back
-- as "this creator has no codes" rather than as an error. See 064.
grant select, insert, update, delete on public.promo_codes       to authenticated;
grant select                        on public.promo_redemptions  to authenticated;


-- ── 5. Verify ────────────────────────────────────────────────────────────────
-- Expect: two rows for the new tables, and sale_price present on products.

select 'promo_codes' as object,
       to_regclass('public.promo_codes') is not null as exists
union all
select 'promo_redemptions',
       to_regclass('public.promo_redemptions') is not null
union all
select 'digital_products.sale_price',
       exists (
         select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name = 'digital_products'
           and column_name = 'sale_price'
       )
union all
select 'digital_purchases.promo_code_id',
       exists (
         select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name = 'digital_purchases'
           and column_name = 'promo_code_id'
       );
