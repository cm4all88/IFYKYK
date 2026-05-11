-- ──────────────────────────────────────────────────────────────────
-- Migration 005 — Admin infrastructure tables
-- Coupons, featured slots, admin messages
-- Safe to run multiple times (idempotent)
-- ──────────────────────────────────────────────────────────────────

-- ━━━ COUPONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table if not exists public.coupons (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  description   text,
  discount_type text not null check (discount_type in ('percent', 'flat')),
  discount_value decimal(10,2) not null check (discount_value > 0),
  min_amount    decimal(10,2),                -- minimum order to apply
  max_uses      integer,                       -- null = unlimited
  uses_count    integer not null default 0,
  expires_at    timestamptz,
  applies_to    text not null default 'all' check (applies_to in ('all', 'spotlight', 'backstage')),
  is_active     boolean not null default true,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

alter table public.coupons enable row level security;

-- Only admin can manage coupons
drop policy if exists "Admin manages coupons" on public.coupons;
create policy "Admin manages coupons"
  on public.coupons for all
  to authenticated
  using (auth.uid() = '9b5ac2dc-ea4f-4bac-b2ef-70608562568a'::uuid)
  with check (auth.uid() = '9b5ac2dc-ea4f-4bac-b2ef-70608562568a'::uuid);

-- Public can read active coupons (to validate at checkout)
drop policy if exists "Active coupons publicly readable" on public.coupons;
create policy "Active coupons publicly readable"
  on public.coupons for select
  using (is_active = true and (expires_at is null or expires_at > now()));

create index if not exists idx_coupons_code on public.coupons(code);
create index if not exists idx_coupons_active on public.coupons(is_active);

-- ━━━ FEATURED SLOTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table if not exists public.featured_slots (
  id                  uuid primary key default gen_random_uuid(),
  slot_type           text not null check (slot_type in ('homepage_hero', 'homepage_grid', 'browse_top', 'sidebar')),
  creator_profile_id  uuid references public.creator_profiles(id) on delete cascade,
  headline            text,
  subtext             text,
  cta_label           text,
  starts_at           timestamptz not null default now(),
  ends_at             timestamptz not null,
  is_paid             boolean not null default false,
  payment_amount      decimal(10,2),
  priority            integer not null default 0,  -- higher = shown first
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);

alter table public.featured_slots enable row level security;

drop policy if exists "Admin manages featured slots" on public.featured_slots;
create policy "Admin manages featured slots"
  on public.featured_slots for all
  to authenticated
  using (auth.uid() = '9b5ac2dc-ea4f-4bac-b2ef-70608562568a'::uuid)
  with check (auth.uid() = '9b5ac2dc-ea4f-4bac-b2ef-70608562568a'::uuid);

drop policy if exists "Active featured slots publicly readable" on public.featured_slots;
create policy "Active featured slots publicly readable"
  on public.featured_slots for select
  using (is_active = true and starts_at <= now() and ends_at > now());

create index if not exists idx_featured_slots_active on public.featured_slots(is_active, ends_at);

-- ━━━ ADMIN MESSAGES (announcements / email blasts) ━━━━━━━━━━━━━

create table if not exists public.admin_messages (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('banner', 'email_blast', 'push')),
  target      text not null default 'all' check (target in ('all', 'spotlight', 'backstage', 'subscribers')),
  subject     text,
  body        text not null,
  sent_at     timestamptz,
  status      text not null default 'draft' check (status in ('draft', 'scheduled', 'sent', 'canceled')),
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

alter table public.admin_messages enable row level security;

drop policy if exists "Admin manages messages" on public.admin_messages;
create policy "Admin manages messages"
  on public.admin_messages for all
  to authenticated
  using (auth.uid() = '9b5ac2dc-ea4f-4bac-b2ef-70608562568a'::uuid)
  with check (auth.uid() = '9b5ac2dc-ea4f-4bac-b2ef-70608562568a'::uuid);

-- ━━━ PLATFORM SETTINGS — seed admin keys ━━━━━━━━━━━━━━━━━━━━━━━

-- Feature flags (stored as JSON string)
insert into public.platform_settings (key, value) values
  ('FEATURE_FLAGS', '{"new_signups":true,"backstage":true,"live_streaming":false,"merch":false,"super_tips":true,"gift_subs":false,"ai_advisor":true,"maintenance_mode":false}'),
  ('PLATFORM_FEE_PCT', '15'),
  ('PLATFORM_ANNOUNCEMENT', ''),
  ('ANTHROPIC_API_KEY', '')
on conflict (key) do nothing;

-- Done
select 'Migration 005 complete' as result;
