-- Content moderation log
create table public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('post','chat','dm','live')),
  content_id uuid,
  creator_id uuid references public.creators(id),
  fan_user_id uuid references auth.users(id),
  flagged_text text,
  flag_reason text,
  action_taken text check (action_taken in ('blocked','flagged','warned','stream_ended','account_suspended')),
  severity text check (severity in ('low','medium','high','critical')),
  reviewed_by text default 'ai',
  created_at timestamptz default now()
);

-- PII shield events
create table public.pii_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  creator_id uuid references public.creators(id),
  pii_type text not null,
  direction text check (direction in ('inbound','outbound')),
  created_at timestamptz default now()
);

-- 2257 records (18+ creators only)
create table public.records_2257 (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators(id) not null,
  legal_name text not null,
  date_of_birth date not null,
  id_document_type text not null,
  id_verified_at timestamptz not null,
  id_verified_by text not null default 'veriff',
  veriff_session_id text,
  created_at timestamptz default now()
);

alter table public.records_2257 enable row level security;
-- 2257 records are only accessible by admins (service role)
