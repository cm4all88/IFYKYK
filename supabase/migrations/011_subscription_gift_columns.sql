-- ──────────────────────────────────────────────────────────────────
-- 011_subscription_gift_columns.sql
-- Add gift_subscription_id and expires_at to subscriptions table.
-- Required for gift subscription redemption.
-- ──────────────────────────────────────────────────────────────────

alter table public.subscriptions
  add column if not exists gift_subscription_id uuid references public.gift_subscriptions(id) on delete set null,
  add column if not exists expires_at timestamptz;

-- Index for fast expiry checks
create index if not exists subscriptions_expires_at
  on public.subscriptions(expires_at)
  where expires_at is not null;
