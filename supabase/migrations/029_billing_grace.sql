-- Card-required billing: 7-day grace window on a declined card + daily-dunning tracking.
-- A declined renewal puts the account into `past_due` with a 7-day grace_ends_at;
-- the dunning cron warns daily and locks (status -> 'cancelled') when grace expires.

alter table public.creator_billing
  add column if not exists grace_ends_at          timestamptz,
  add column if not exists last_dunning_warned_at timestamptz;

-- Quick lookup for the dunning cron.
create index if not exists creator_billing_grace
  on public.creator_billing(grace_ends_at)
  where status = 'past_due';
