-- ──────────────────────────────────────────────────────────────────
-- 061_prospect_outreach.sql — Creator Acquisition System, Stage 3.
--
-- One immutable row per outreach attempt. This table is the approval gate
-- and the audit trail at the same time.
--
-- The CHECK constraints are the point. Approval-before-send is a compliance
-- control, and a control that lives only in application code is one refactor
-- away from being gone. `outreach_requires_approval` makes a sent-but-
-- unapproved row impossible to represent, so no route, no script, and no
-- future maintainer can bypass it — including via the SQL editor.
--
-- Idempotent. Safe to run more than once.
-- ──────────────────────────────────────────────────────────────────

create table if not exists public.prospect_outreach (
  id              uuid primary key default gen_random_uuid(),
  prospect_id     uuid not null references public.creator_prospects(id) on delete cascade,

  channel         text not null default 'email'
                    check (channel in ('email','dm','manual')),
  subject         text,
  body            text not null,

  -- The exact link that was mailed. Without this nobody can answer
  -- "who was sent this claim code, by whom, and when" — a question the
  -- claim flow has never been able to answer.
  claim_url_sent  text,

  status          text not null default 'pending'
                    check (status in ('pending','approved','sent','failed','rejected')),

  approved_at     timestamptz,
  approved_by     uuid references auth.users(id),
  sent_at         timestamptz,
  sent_by         uuid references auth.users(id),
  provider_id     text,
  error           text,

  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),

  -- Nothing may be marked sent unless a named human approved it first.
  constraint outreach_requires_approval
    check (sent_at is null or (approved_at is not null and approved_by is not null)),

  -- status and sent_at can never disagree about whether it went out.
  constraint outreach_status_consistent
    check ((status = 'sent') = (sent_at is not null)),

  -- An approval must record who gave it.
  constraint outreach_approval_complete
    check ((approved_at is null) = (approved_by is null))
);

create index if not exists prospect_outreach_prospect_idx
  on public.prospect_outreach (prospect_id, created_at desc);
create index if not exists prospect_outreach_status_idx
  on public.prospect_outreach (status, created_at desc);

-- Service-role only, as with creator_prospects.
alter table public.prospect_outreach enable row level security;

select 'Migration 061 complete — prospect_outreach' as result;
