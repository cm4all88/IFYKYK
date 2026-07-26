-- ──────────────────────────────────────────────────────────────────
-- 059_claim_hardening.sql — Stage 0 of the Creator Acquisition System.
--
-- Two additions, both required before any prospect outreach exists:
--
--   1. creator_profiles.claim_expires_at — invitation links must expire.
--      NULL means "no expiry", so every claim link already in flight keeps
--      working exactly as it does today. Only newly issued codes get a date.
--
--   2. email_opt_outs — the store behind a real unsubscribe link. The email
--      footer previously rendered href="{{unsubscribe}}", a literal token
--      that nothing substituted, so the opt-out was decorative.
--
-- Idempotent. Safe to run more than once.
-- ──────────────────────────────────────────────────────────────────

alter table public.creator_profiles
  add column if not exists claim_expires_at timestamptz;

comment on column public.creator_profiles.claim_expires_at is
  'When the current claim_code stops being accepted. NULL = never expires (legacy links).';

-- Partial index: the claim route only ever looks at rows with a live code.
create index if not exists idx_creator_profiles_claim_expires
  on public.creator_profiles (claim_expires_at)
  where claim_code is not null;

-- ─── Email opt-outs ───────────────────────────────────────────────
-- Keyed by lowercased email rather than user_id on purpose: a recipient may
-- opt out before they ever hold an account (invited creator prospects), and
-- an opt-out must survive account deletion.
create table if not exists public.email_opt_outs (
  email       text primary key,
  reason      text,
  created_at  timestamptz not null default now()
);

-- Service-role only. Following the precedent set by 035_referral_invite_sends:
-- RLS enabled with no policies means any query through the anon/user client
-- returns zero rows. This table is only ever read and written server-side.
alter table public.email_opt_outs enable row level security;

select 'Migration 059 complete — claim expiry + email opt-outs' as result;
