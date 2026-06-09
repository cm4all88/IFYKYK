-- Tracks which accounts have already been emailed the "invite a creator"
-- referral message, so the admin send is idempotent and never double-sends.
create table if not exists public.referral_invite_sends (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now()
);

-- Admin sends run with the service role (which bypasses RLS). Enable RLS with
-- no policies so this table is not readable by regular users.
alter table public.referral_invite_sends enable row level security;
