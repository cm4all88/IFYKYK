-- ──────────────────────────────────────────────────────────────────
-- Spotlightly v3 — Database migrations
-- Run this entire file in Supabase SQL Editor.
-- Idempotent — safe to run multiple times.
-- ──────────────────────────────────────────────────────────────────

-- ━━━ platform_settings: key/value store for credentials ━━━━━━━━━

create table if not exists public.platform_settings (
  key text primary key,
  value text,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

alter table public.platform_settings enable row level security;

-- Only the designated admin can read or write
drop policy if exists "Admin can read settings" on public.platform_settings;
create policy "Admin can read settings"
on public.platform_settings
for select
to authenticated
using (auth.uid() = '9b5ac2dc-ea4f-4bac-b2ef-70608562568a'::uuid);

drop policy if exists "Admin can write settings" on public.platform_settings;
create policy "Admin can write settings"
on public.platform_settings
for all
to authenticated
using (auth.uid() = '9b5ac2dc-ea4f-4bac-b2ef-70608562568a'::uuid)
with check (auth.uid() = '9b5ac2dc-ea4f-4bac-b2ef-70608562568a'::uuid);

-- Seed the expected keys (with empty values) so the admin page knows what to render
insert into public.platform_settings (key, value) values
  ('STRIPE_SECRET_KEY', ''),
  ('STRIPE_PUBLISHABLE_KEY', ''),
  ('STRIPE_WEBHOOK_SECRET', ''),
  ('STRIPE_CONNECT_CLIENT_ID', ''),
  ('CCBILL_ACCOUNT_NUMBER', ''),
  ('CCBILL_SUBACCOUNT', ''),
  ('CCBILL_FLEXFORM_ID', ''),
  ('CCBILL_SALT', ''),
  ('BUNNY_STORAGE_ZONE', ''),
  ('BUNNY_STORAGE_KEY', ''),
  ('BUNNY_CDN_HOST', ''),
  ('BUNNY_STREAM_LIBRARY_ID', ''),
  ('BUNNY_STREAM_KEY', ''),
  ('VERIFF_API_KEY', ''),
  ('VERIFF_SECRET', ''),
  ('RESEND_API_KEY', ''),
  ('RESEND_FROM_EMAIL', 'noreply@spotlightly.app'),
  ('CRON_SECRET', '')
on conflict (key) do nothing;

-- ━━━ posts: ensure RLS policies exist ━━━━━━━━━━━━━━━━━━━━━━━━━━

alter table public.posts enable row level security;

drop policy if exists "Posts publicly readable" on public.posts;
create policy "Posts publicly readable"
on public.posts
for select
using (status = 'live');

drop policy if exists "Creators insert their own posts" on public.posts;
create policy "Creators insert their own posts"
on public.posts
for insert
to authenticated
with check (
  creator_profile_id in (
    select id from public.creator_profiles where user_id = auth.uid()
  )
);

drop policy if exists "Creators update their own posts" on public.posts;
create policy "Creators update their own posts"
on public.posts
for update
to authenticated
using (
  creator_profile_id in (
    select id from public.creator_profiles where user_id = auth.uid()
  )
)
with check (
  creator_profile_id in (
    select id from public.creator_profiles where user_id = auth.uid()
  )
);

drop policy if exists "Creators delete their own posts" on public.posts;
create policy "Creators delete their own posts"
on public.posts
for delete
to authenticated
using (
  creator_profile_id in (
    select id from public.creator_profiles where user_id = auth.uid()
  )
);

-- ━━━ channels: RLS policies ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

alter table public.channels enable row level security;

drop policy if exists "Channels publicly readable" on public.channels;
create policy "Channels publicly readable"
on public.channels
for select
using (is_visible is not false);

drop policy if exists "Creators manage own channels" on public.channels;
create policy "Creators manage own channels"
on public.channels
for all
to authenticated
using (
  creator_profile_id in (
    select id from public.creator_profiles where user_id = auth.uid()
  )
)
with check (
  creator_profile_id in (
    select id from public.creator_profiles where user_id = auth.uid()
  )
);

-- ━━━ Parental access tokens for Opening Act ━━━━━━━━━━━━━━━━━━━

create table if not exists public.parental_tokens (
  token uuid primary key default gen_random_uuid(),
  child_user_id uuid not null references auth.users(id) on delete cascade,
  parent_email text not null,
  created_at timestamptz default now(),
  revoked_at timestamptz
);

alter table public.parental_tokens enable row level security;

-- Public can SELECT by token (the URL itself is the auth)
drop policy if exists "Token holders can read" on public.parental_tokens;
create policy "Token holders can read"
on public.parental_tokens
for select
using (revoked_at is null);

-- Only the child can create one for themselves
drop policy if exists "Child creates own parental token" on public.parental_tokens;
create policy "Child creates own parental token"
on public.parental_tokens
for insert
to authenticated
with check (auth.uid() = child_user_id);

-- ━━━ Tip events ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- The tips table already exists per the handoff. Just ensure RLS.
alter table public.tips enable row level security;

drop policy if exists "Tips publicly readable" on public.tips;
create policy "Tips publicly readable"
on public.tips
for select
using (true);

-- ━━━ Done ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select 'Migration complete. ' || count(*) || ' platform_settings keys seeded.'
from public.platform_settings;
