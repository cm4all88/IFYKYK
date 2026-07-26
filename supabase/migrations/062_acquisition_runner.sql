-- ──────────────────────────────────────────────────────────────────
-- 062_acquisition_runner.sql — delivery outcomes + run log.
--
-- WHY THIS MIGRATION IS NECESSARY. The brief says to avoid migrations unless
-- absolutely required. It is required here: 061 records that a message was
-- SENT, but nothing about what happened to it. Three rules in the brief are
-- unenforceable without that:
--
--   • "Stop after a bounce, unsubscribe, reply" — needs somewhere to record
--     a bounce, an unsubscribe and a reply.
--   • "Automatic pause when bounce rate exceeds 5 percent" — needs a
--     denominator and a numerator that survive a restart.
--   • "Never send more than three messages" — needs a sequence number, so a
--     retry after a crash cannot be mistaken for a fourth message.
--
-- Everything is additive: new nullable columns on prospect_outreach and one
-- new log table. No existing column changes type or meaning, and no existing
-- constraint is dropped.
--
-- Idempotent. Safe to run more than once.
-- ──────────────────────────────────────────────────────────────────

-- ── Delivery outcomes, written by the Resend webhook ─────────────────
alter table public.prospect_outreach
  add column if not exists sequence       smallint not null default 1,
  add column if not exists delivered_at   timestamptz,
  add column if not exists bounced_at     timestamptz,
  add column if not exists bounce_type    text,
  add column if not exists opened_at      timestamptz,
  add column if not exists clicked_at     timestamptz,
  add column if not exists complained_at  timestamptz,
  add column if not exists unsubscribed_at timestamptz,
  add column if not exists replied_at     timestamptz;

-- 1 = initial, 2 = day-4 follow-up, 3 = day-9 final. Nothing beyond 3.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'outreach_sequence_range'
  ) then
    alter table public.prospect_outreach
      add constraint outreach_sequence_range check (sequence between 1 and 3);
  end if;
end $$;

-- One message per prospect per step. This is the structural guarantee behind
-- "never more than three messages": a retry after a timeout collides here
-- instead of sending again.
create unique index if not exists prospect_outreach_sequence_key
  on public.prospect_outreach (prospect_id, sequence);

-- The bounce-rate query reads only sent rows; index them.
create index if not exists prospect_outreach_sent_idx
  on public.prospect_outreach (sent_at desc) where sent_at is not null;

create index if not exists prospect_outreach_provider_idx
  on public.prospect_outreach (provider_id) where provider_id is not null;

-- ── Provenance for the one temporary avatar ──────────────────────────
-- The brief requires recording where an imported image came from, and that
-- the image stays replaceable after claiming. Storing the source URL beside
-- the image is what makes both auditable: a creator can be told exactly which
-- public page it was taken from, and it can be cleared without guessing.
alter table public.creator_profiles
  add column if not exists avatar_source_url text;

comment on column public.creator_profiles.avatar_source_url is
  'Public page an unclaimed concierge avatar was taken from. Null for creator-uploaded avatars. Cleared when the creator replaces the image.';

-- ── Run log ──────────────────────────────────────────────────────────
-- One row per batch, so a failed run leaves evidence rather than silence,
-- and so the daily cap can be computed from history instead of a counter
-- that drifts.
create table if not exists public.acquisition_runs (
  id            uuid primary key default gen_random_uuid(),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  trigger       text not null default 'manual'
                  check (trigger in ('manual','cron','dry_run')),
  dry_run       boolean not null default false,
  batch_size    integer,
  considered    integer not null default 0,
  qualified     integer not null default 0,
  pages_created integer not null default 0,
  emails_sent   integer not null default 0,
  follow_ups    integer not null default 0,
  skipped       integer not null default 0,
  failed        integer not null default 0,
  paused        boolean not null default false,
  pause_reason  text,
  detail        jsonb not null default '{}'::jsonb,
  error         text
);

create index if not exists acquisition_runs_started_idx
  on public.acquisition_runs (started_at desc);

-- Service-role only, following 035/059/060/061: RLS on with NO policies, so
-- any query through the anon or authenticated client returns zero rows. These
-- rows describe people who never signed up; they must not be world-readable
-- the way creator_profiles is.
alter table public.acquisition_runs enable row level security;

-- ── Kill switch ──────────────────────────────────────────────────────
-- Stored in the existing platform_settings key/value store rather than a new
-- column, so it can be flipped from /admin/credentials without a deploy.
-- The runner refuses to send while this is 'off'.
insert into public.platform_settings (key, value)
values ('acquisition_runner_enabled', 'off')
on conflict (key) do nothing;

select 'Migration 062 complete — acquisition runner' as result;
