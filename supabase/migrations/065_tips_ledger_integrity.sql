-- ─────────────────────────────────────────────────────────────────────────────
-- 065_tips_ledger_integrity.sql
--
-- Makes it possible for a tip to be recorded at all.
--
-- LIVE STATE, 2026-08-05 (audit/production-integrity/LIVE_VERIFICATION.md §3):
--     public.tips contains 0 rows.
--     tips.creator_receives   numeric  NOT NULL, no default
--     tips.platform_receives  numeric  NOT NULL, no default
--     tips.fan_user_id        uuid     NOT NULL, no default
--
-- The Stripe webhook inserts only (fan_user_id, creator_profile_id, amount,
-- stripe_session_id). creator_receives and platform_receives are never supplied,
-- so every insert fails 23502. The result was never checked and the handler
-- returned 200, so Stripe recorded the event as delivered and never retried.
--
-- Separately, /api/tip explicitly supports guest tipping ("Auth is optional —
-- guests can tip without an account") while fan_user_id is NOT NULL, so a guest
-- tip could never have been recorded even with the other two columns supplied.
--
-- This migration does NOT backfill. Whether historical tips exist is answered by
-- audit/production-integrity/_tools/tip-reconciliation.mjs against Stripe, and
-- any backfill is a separate, approved step.
--
-- Idempotent and additive. No existing row is modified.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- ── 1. Guest tips ────────────────────────────────────────────────────────────
-- Guest tipping is a supported product path and no ownership decision depends on
-- this column: fan-side reads are policy-scoped by `fan_user_id = auth.uid()`,
-- which simply matches nothing for a guest row. Making it nullable is the
-- smallest change that represents a guest tip honestly. We do NOT invent a
-- placeholder fan id.
alter table public.tips alter column fan_user_id drop not null;

-- ── 2. Money columns the webhook must supply ─────────────────────────────────
-- Defaults are a safety net, not a substitute: the webhook now writes both
-- explicitly (lib/tips.ts). The defaults mean a future caller that forgets one
-- records a conservative 0 rather than losing the whole row.
alter table public.tips alter column creator_receives  set default 0;
alter table public.tips alter column platform_receives set default 0;

-- ── 3. Currency ──────────────────────────────────────────────────────────────
-- Every checkout route hardcodes usd today. Storing it makes that explicit and
-- lets reconciliation detect the day it stops being true.
alter table public.tips
  add column if not exists currency text not null default 'usd';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tips'::regclass and conname = 'tips_currency_check'
  ) then
    alter table public.tips
      add constraint tips_currency_check check (char_length(currency) = 3);
  end if;
end $$;

-- ── 4. Idempotency ───────────────────────────────────────────────────────────
-- Stripe retries on any non-2xx and can redeliver an event by design. Now that
-- the handler correctly returns 500 on a failed write, retries WILL happen, so
-- the uniqueness guard has to exist before that is switched on.
--
-- stripe_session_id is the stable per-tip identifier: one checkout session
-- produces exactly one tip, and every redelivery of checkout.session.completed
-- carries the same session id. A partial index keeps historical NULLs legal.
create unique index if not exists tips_stripe_session_id_key
  on public.tips (stripe_session_id)
  where stripe_session_id is not null;

-- Recorded for reconciliation against Stripe, and as a second idempotency signal.
alter table public.tips
  add column if not exists stripe_event_id text;

create index if not exists tips_stripe_event_id_idx
  on public.tips (stripe_event_id)
  where stripe_event_id is not null;

-- payment_intent is what a Connect transfer is attached to; reconciliation joins
-- on it. Already present, but index it for the reconciliation report.
create index if not exists tips_stripe_payment_intent_idx
  on public.tips (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

comment on column public.tips.currency is
  'ISO-4217, lowercase, as Stripe reports it. All checkout routes hardcode usd.';
comment on column public.tips.stripe_event_id is
  'The Stripe event that produced this row. Reconciliation and duplicate-delivery forensics.';
comment on index public.tips_stripe_session_id_key is
  'Idempotency: one tip per checkout session. The webhook treats 23505 here as already-processed and returns 200.';

commit;
