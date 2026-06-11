-- 036_social_addbacks_reconcile.sql
-- Reconciles the social_addbacks schema drift between migrations 020 and 025.
--
-- Both 020 and 025 declared `social_addbacks` with `create table if not exists`,
-- so only the first to run took effect and the second silently no-opped its
-- table while still creating its policies. The application code (route.ts +
-- purchase/route.ts) is written against the 025 shape:
--   social_addbacks:        description, delivery_days, platform incl. twitter/spotify
--   social_addback_orders:  fan_user_id, fan_handle, fan_email, status, message
--
-- This migration makes the live database match the 025 (canonical) shape no
-- matter which of 020/025 actually ran. It is fully idempotent.

-- ── social_addbacks: ensure 025 columns exist ───────────────────────────────
alter table public.social_addbacks
  add column if not exists description   text;
alter table public.social_addbacks
  add column if not exists delivery_days integer not null default 3;

-- 020 had a NOT NULL `label` column the code never writes. Make it optional so
-- inserts that omit it (all of them) don't fail. Left in place to preserve any
-- existing data.
alter table public.social_addbacks
  alter column label drop not null;

-- Widen the platform check to the canonical 025 set (twitter + spotify, which
-- 020 lacked). Drop whichever named constraint is present, then re-add.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.social_addbacks'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%platform%'
  loop
    execute format('alter table public.social_addbacks drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.social_addbacks
  add constraint social_addbacks_platform_check
  check (platform in ('instagram','tiktok','youtube','twitter','x','twitch','discord','spotify'));

-- ── social_addback_orders: ensure the canonical orders table exists ──────────
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

create index if not exists social_addback_orders_addback_idx
  on public.social_addback_orders(addback_id, status);

alter table public.social_addback_orders enable row level security;

-- Recreate canonical policies idempotently.
drop policy if exists "Anyone can create an order" on public.social_addback_orders;
create policy "Anyone can create an order"
  on public.social_addback_orders for insert with check (true);

drop policy if exists "Creators see orders for their addbacks" on public.social_addback_orders;
create policy "Creators see orders for their addbacks"
  on public.social_addback_orders for select using (
    addback_id in (
      select id from public.social_addbacks where creator_profile_id in (
        select id from public.creator_profiles where user_id = auth.uid()
      )
    )
  );

drop policy if exists "Fans see own orders" on public.social_addback_orders;
create policy "Fans see own orders"
  on public.social_addback_orders for select using (fan_user_id = auth.uid());

-- ── Clean up the stale 020 purchases table if it's empty ─────────────────────
-- 020 created social_addback_purchases, which the code never references. Drop
-- it only when empty so no data is ever lost; otherwise leave it for manual
-- review.
do $$
begin
  if to_regclass('public.social_addback_purchases') is not null then
    if not exists (select 1 from public.social_addback_purchases limit 1) then
      drop table public.social_addback_purchases;
    end if;
  end if;
end $$;
