-- ─────────────────────────────────────────────────────────────────────────────
-- 068_tip_trust_safety.sql
--
-- Tip transaction integrity, fraud review data and creator trust controls.
-- See audit/trust-safety/FRAUD_AUDIT.md.
--
-- ADDITIVE AND IDEMPOTENT. No row is deleted. No existing value is changed
-- except filling the NEW status / tip_source columns on historical tips rows,
-- which are marked legacy_unverified = true so they stay distinguishable from
-- rows confirmed by the new webhook path.
--
-- APPLY BEFORE deploying the matching code. The new /api/tip writes columns and
-- tables created here; without them tips fail closed (503), they do not fail open.
--
-- Every new table is service role only: RLS enabled, no policies, and all
-- privileges revoked from anon and authenticated. IPs, card fingerprints, risk
-- flags and admin review state are never reachable with the browser key.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- ═══ 1. tips: lifecycle ═══════════════════════════════════════════════════════

alter table public.tips add column if not exists post_id uuid;
alter table public.tips add column if not exists status text;
alter table public.tips add column if not exists tip_source text;
alter table public.tips add column if not exists legacy_unverified boolean not null default false;
alter table public.tips add column if not exists status_updated_at timestamptz;
alter table public.tips add column if not exists succeeded_at timestamptz;
alter table public.tips add column if not exists failed_at timestamptz;
alter table public.tips add column if not exists failure_reason text;
alter table public.tips add column if not exists expired_at timestamptz;
alter table public.tips add column if not exists refunded_at timestamptz;
alter table public.tips add column if not exists refunded_amount_cents integer not null default 0;
alter table public.tips add column if not exists disputed_at timestamptz;
alter table public.tips add column if not exists dispute_status text;
alter table public.tips add column if not exists stripe_dispute_id text;
alter table public.tips add column if not exists stripe_charge_id text;
alter table public.tips add column if not exists early_fraud_warning_at timestamptz;
alter table public.tips add column if not exists payment_failure_count integer not null default 0;
alter table public.tips add column if not exists last_payment_failure_code text;

-- Historical rows. Every existing row was written by the old webhook on
-- checkout.session.completed, so each one is a completed checkout. The old
-- handler never checked payment_status, so they are marked unverified until
-- reconciled against Stripe (audit/production-integrity/_tools/tip-reconciliation.mjs).
update public.tips
   set status = 'succeeded',
       legacy_unverified = true,
       succeeded_at = coalesce(succeeded_at, created_at),
       status_updated_at = coalesce(status_updated_at, now())
 where status is null;

update public.tips
   set tip_source = case when post_id is not null then 'post' else 'unknown' end
 where tip_source is null;

alter table public.tips alter column status set default 'checkout_created';
alter table public.tips alter column status set not null;
alter table public.tips alter column tip_source set default 'profile';
alter table public.tips alter column tip_source set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.tips'::regclass and conname = 'tips_status_check') then
    alter table public.tips add constraint tips_status_check check (status in (
      'checkout_created','payment_pending','succeeded','failed','expired','canceled',
      'refunded','partially_refunded','disputed','dispute_lost'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.tips'::regclass and conname = 'tips_source_check') then
    alter table public.tips add constraint tips_source_check check (tip_source in ('profile','post','live_stream','other','unknown'));
  end if;
  -- A post tip must name its post. 'unknown' exists only for legacy rows.
  if not exists (select 1 from pg_constraint where conrelid = 'public.tips'::regclass and conname = 'tips_post_source_check') then
    alter table public.tips add constraint tips_post_source_check check (tip_source <> 'post' or post_id is not null) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.tips'::regclass and conname = 'tips_post_id_fkey') then
    alter table public.tips add constraint tips_post_id_fkey foreign key (post_id) references public.posts(id) on delete set null not valid;
  end if;
end $$;

create index if not exists tips_creator_status_idx on public.tips (creator_profile_id, status, created_at desc);
create index if not exists tips_succeeded_at_idx on public.tips (creator_profile_id, succeeded_at) where status = 'succeeded';

comment on column public.tips.status is
  'checkout_created is NOT money. Only a verified webhook moves a row to succeeded. Earnings read succeeded only.';
comment on column public.tips.legacy_unverified is
  'Row predates 068. Recorded on checkout.session.completed without a payment_status check. Reconcile against Stripe.';
comment on column public.tips.tip_source is
  'profile | post (post_id set) | live_stream | other. unknown only for rows written before 068.';

-- ═══ 2. Processed webhook events (idempotency) ═══════════════════════════════

create table if not exists public.stripe_webhook_events (
  event_id      text primary key,
  type          text not null,
  account       text,
  status        text not null default 'processing' check (status in ('processing','processed','failed')),
  attempts      integer not null default 1,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  last_error    text
);
create index if not exists stripe_webhook_events_type_idx on public.stripe_webhook_events (type, received_at desc);

-- ═══ 3. Tip checkout attempts (fraud review context, velocity counts) ════════

create table if not exists public.tip_checkout_attempts (
  id                  uuid primary key default gen_random_uuid(),
  kind                text not null check (kind in ('tip','super_tip','live_tip')),
  creator_profile_id  uuid not null references public.creator_profiles(id) on delete cascade,
  fan_user_id         uuid references auth.users(id) on delete set null,
  post_id             uuid,
  tip_source          text,
  tip_id              uuid references public.tips(id) on delete set null,
  amount_usd          numeric(10,2),
  ip                  text,
  country             text,
  region              text,
  user_agent          text,
  outcome             text not null check (outcome in ('session_created','blocked_eligibility','blocked_velocity','stripe_error','internal_error')),
  block_reason        text,
  stripe_session_id   text,
  completed_at        timestamptz,
  card_fingerprint    text,
  card_country        text,
  stripe_risk_level   text,
  stripe_risk_score   integer,
  created_at          timestamptz not null default now()
);
create index if not exists tca_creator_created_idx on public.tip_checkout_attempts (creator_profile_id, created_at desc);
create index if not exists tca_ip_created_idx on public.tip_checkout_attempts (ip, created_at desc) where ip is not null;
create index if not exists tca_fan_created_idx on public.tip_checkout_attempts (fan_user_id, created_at desc) where fan_user_id is not null;
create index if not exists tca_session_idx on public.tip_checkout_attempts (stripe_session_id) where stripe_session_id is not null;
create index if not exists tca_fingerprint_idx on public.tip_checkout_attempts (card_fingerprint) where card_fingerprint is not null;

-- ═══ 4. Creator trust state (admin controls + cached Stripe status) ══════════
-- A side table, not creator_profiles columns: creators can read (and in places
-- update) their own creator_profiles row, and published rows are publicly
-- readable. Review state must be reachable by neither.

create table if not exists public.creator_trust (
  creator_profile_id                 uuid primary key references public.creator_profiles(id) on delete cascade,
  tips_disabled                      boolean not null default false,
  monetization_status                text not null default 'active' check (monetization_status in ('active','under_review','blocked')),
  review_reason                      text,
  review_started_at                  timestamptz,
  review_released_at                 timestamptz,
  blocked_at                         timestamptz,
  payout_hold_active                 boolean not null default false,
  payout_hold_reason                 text,
  payout_hold_set_at                 timestamptz,
  payout_released_at                 timestamptz,
  stripe_onboarded_at                timestamptz,
  stripe_charges_enabled             boolean,
  stripe_payouts_enabled             boolean,
  stripe_details_submitted           boolean,
  stripe_disabled_reason             text,
  stripe_requirements_currently_due  text[] not null default '{}',
  stripe_requirements_past_due       text[] not null default '{}',
  stripe_payout_interval             text,
  stripe_status_updated_at           timestamptz,
  created_at                         timestamptz not null default now(),
  updated_at                         timestamptz not null default now()
);
create index if not exists creator_trust_review_idx on public.creator_trust (monetization_status) where monetization_status <> 'active';
create index if not exists creator_trust_hold_idx on public.creator_trust (payout_hold_active) where payout_hold_active;

-- ═══ 5. Trust history (system signals + admin audit log), append only ════════

create table if not exists public.creator_trust_events (
  id                  uuid primary key default gen_random_uuid(),
  creator_profile_id  uuid not null references public.creator_profiles(id) on delete cascade,
  kind                text not null,
  actor               text not null,
  reason              text,
  detail              jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);
create index if not exists cte_creator_idx on public.creator_trust_events (creator_profile_id, created_at desc);

-- ═══ 6. Lock down every new object ═══════════════════════════════════════════

alter table public.stripe_webhook_events  enable row level security;
alter table public.tip_checkout_attempts  enable row level security;
alter table public.creator_trust          enable row level security;
alter table public.creator_trust_events   enable row level security;

revoke all on public.stripe_webhook_events from anon, authenticated;
revoke all on public.tip_checkout_attempts from anon, authenticated;
revoke all on public.creator_trust         from anon, authenticated;
revoke all on public.creator_trust_events  from anon, authenticated;

grant all on public.stripe_webhook_events to service_role;
grant all on public.tip_checkout_attempts to service_role;
grant all on public.creator_trust         to service_role;
grant all on public.creator_trust_events  to service_role;

-- Append only for everyone, service role included.
create or replace function public.creator_trust_events_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'creator_trust_events is append only';
end $$;
drop trigger if exists trg_creator_trust_events_append_only on public.creator_trust_events;
create trigger trg_creator_trust_events_append_only
  before update or delete on public.creator_trust_events
  for each row execute function public.creator_trust_events_append_only();

-- tips itself: 066 already dropped "Tips publicly readable". Creators read
-- their received tips and fans read tips they sent. Neither may write.
revoke insert, update, delete on public.tips from anon, authenticated;

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (only if 068 must be undone; drops review data, not tips)
--   begin;
--   drop trigger if exists trg_creator_trust_events_append_only on public.creator_trust_events;
--   drop function if exists public.creator_trust_events_append_only();
--   drop table if exists public.creator_trust_events, public.creator_trust,
--                        public.tip_checkout_attempts, public.stripe_webhook_events;
--   alter table public.tips drop constraint if exists tips_status_check,
--                           drop constraint if exists tips_source_check,
--                           drop constraint if exists tips_post_source_check;
--   alter table public.tips alter column status drop not null, alter column status drop default,
--                           alter column tip_source drop not null, alter column tip_source drop default;
--   commit;
-- The added tips columns are left in place on rollback; they hold evidence.
-- ─────────────────────────────────────────────────────────────────────────────
