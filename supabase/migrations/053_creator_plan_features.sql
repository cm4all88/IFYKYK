-- ──────────────────────────────────────────────────────────────────
-- Migration 053 — Creator feature choices
-- Extends creator_plans so a creator can say, during onboarding, which
-- parts of their venue they want. It is their planet: yes or no on each.
-- Run in the Supabase SQL editor.
-- ──────────────────────────────────────────────────────────────────

alter table public.creator_plans
  add column if not exists wants_subscriptions boolean not null default true,
  add column if not exists wants_tips          boolean not null default true,
  add column if not exists wants_messages      boolean not null default false,
  add column if not exists wants_digital        boolean not null default false,
  add column if not exists wants_campaigns      boolean not null default false,
  add column if not exists wants_gifts          boolean not null default false,
  add column if not exists wants_podcast        boolean not null default false;

select 'Migration 053 complete — creator feature choices' as result;
