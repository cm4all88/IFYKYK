-- ──────────────────────────────────────────────────────────────────
-- Migration 006 — Messaging system
-- message_threads + messages tables
-- ──────────────────────────────────────────────────────────────────

create table if not exists public.message_threads (
  id                  uuid primary key default gen_random_uuid(),
  creator_profile_id  uuid references public.creator_profiles(id) on delete cascade not null,
  fan_user_id         uuid references auth.users(id) not null,
  last_message_at     timestamptz not null default now(),
  creator_unread      integer not null default 0,
  fan_unread          integer not null default 0,
  created_at          timestamptz not null default now(),
  unique(creator_profile_id, fan_user_id)
);

create table if not exists public.messages (
  id                  uuid primary key default gen_random_uuid(),
  thread_id           uuid references public.message_threads(id) on delete cascade not null,
  sender_user_id      uuid references auth.users(id) not null,
  creator_profile_id  uuid references public.creator_profiles(id) on delete cascade not null,
  content             text not null,
  is_front_row        boolean not null default false,
  front_row_amount    decimal(10,2),
  read_at             timestamptz,
  created_at          timestamptz not null default now()
);

-- RLS
alter table public.message_threads enable row level security;
alter table public.messages enable row level security;

-- Creators can see threads for their profiles
create policy "Creator sees own threads" on public.message_threads
  for select to authenticated
  using (
    creator_profile_id in (
      select id from public.creator_profiles where user_id = auth.uid()
    )
    or fan_user_id = auth.uid()
  );

create policy "Creator sees own messages" on public.messages
  for select to authenticated
  using (
    creator_profile_id in (
      select id from public.creator_profiles where user_id = auth.uid()
    )
    or sender_user_id = auth.uid()
  );

create policy "Authenticated users can send messages" on public.messages
  for insert to authenticated
  with check (sender_user_id = auth.uid());

create index if not exists idx_messages_thread on public.messages(thread_id, created_at desc);
create index if not exists idx_threads_creator on public.message_threads(creator_profile_id, last_message_at desc);

-- Also add archived status to posts if not present
alter table public.posts add column if not exists archived_at timestamptz;

select 'Migration 006 complete' as result;
