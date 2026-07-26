-- ──────────────────────────────────────────────────────────────────
-- 060_creator_prospects.sql — Creator Acquisition System, Stage 2.
--
-- A prospect is somebody we have identified as a potential creator and who
-- has agreed to NOTHING. That is why this is its own table rather than a
-- creator_profiles row:
--
--   • inserting into creator_profiles fires trg_provision_free_billing
--     (045) and hands a billing row to a non-customer;
--   • it creates a real auth.users record, which the auth webhook would
--     treat as a signup;
--   • the public page at /{handle} becomes reachable immediately — the
--     `published` flag only hides a page from Explore, it does not gate it;
--   • the handle is consumed permanently.
--
-- A prospect only becomes a creator_profiles row when an admin deliberately
-- builds them a page, at which point creator_profile_id is filled in and the
-- EXISTING createCreator + claim flow takes over unchanged.
--
-- Idempotent. Safe to run more than once.
-- ──────────────────────────────────────────────────────────────────

create table if not exists public.creator_prospects (
  id                  uuid primary key default gen_random_uuid(),

  -- Who they are, publicly. Everything here is information a person has
  -- already published about themselves; nothing is inferred or scraped.
  display_name        text not null,
  platform            text check (platform is null or platform in
                        ('youtube','tiktok','instagram','twitch','substack','x','patreon','other')),
  platform_handle     text,
  profile_url         text,
  email               text,                    -- public business address only
  niche               text,
  follower_count      integer check (follower_count is null or follower_count >= 0),
  location            text,
  handle_wanted       text,                    -- desired Spotlightly handle; NOT reserved

  -- Where the lead came from.
  source              text not null default 'manual'
                        check (source in ('manual','csv','referral','inbound','event','partner','other')),
  source_detail       text,
  utm                 jsonb not null default '{}'::jsonb,
  discovered_by       uuid references auth.users(id),

  -- Pipeline. Authoritative ONLY for states that exist before a creator
  -- account does. Everything from 'joined' onward is derived by joining to
  -- creator_profiles — see lib/acquisition.ts. Storing activation here
  -- would create a second source of truth that silently drifts.
  stage               text not null default 'identified'
                        check (stage in ('identified','qualified','contacted','replied',
                                         'page_built','invited','joined','disqualified')),
  score               integer check (score is null or (score >= 0 and score <= 100)),
  notes               text,
  follow_up_at        timestamptz,
  disqualified_reason text,

  -- Contact controls. Checked at send time, not just in the UI.
  do_not_contact      boolean not null default false,
  opted_out_at        timestamptz,

  -- Retention clock for the personal data of someone who never opted in.
  purge_after         timestamptz,

  -- Set once a page is built. ON DELETE SET NULL so removing a prospect can
  -- never cascade into deleting a real creator.
  creator_profile_id  uuid unique references public.creator_profiles(id) on delete set null,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- One prospect per address, case-insensitively. Partial so many prospects
-- may exist with no email at all.
create unique index if not exists creator_prospects_email_key
  on public.creator_prospects (lower(email)) where email is not null;

-- Dedupe by platform identity as well — the same person found twice on the
-- same platform is one prospect.
create unique index if not exists creator_prospects_platform_key
  on public.creator_prospects (platform, lower(platform_handle))
  where platform is not null and platform_handle is not null;

create index if not exists creator_prospects_stage_idx
  on public.creator_prospects (stage, created_at desc);
create index if not exists creator_prospects_follow_up_idx
  on public.creator_prospects (follow_up_at) where follow_up_at is not null;

-- Service-role only, following the precedent of 035_referral_invite_sends
-- and 059_claim_hardening: RLS on with NO policies means any query through
-- the anon or authenticated client returns zero rows. Every read and write
-- goes through an isAdmin()-gated server path using the service client.
--
-- This matters more than usual here: creator_profiles carries a
-- `SELECT using (true)` policy, so anything placed there is world-readable.
-- Prospect data — names, emails, locations of people who never signed up —
-- must never be exposed that way.
alter table public.creator_prospects enable row level security;

select 'Migration 060 complete — creator_prospects' as result;
