-- Caches narrative analysis of creator media so the same image is never analyzed
-- twice. media_url is the stable key.
create table if not exists creator_media_analysis (
  id uuid primary key default gen_random_uuid(),
  creator_profile_id uuid not null references creator_profiles(id) on delete cascade,
  media_url text not null,
  source_type text,
  source_id text,
  analysis_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (media_url)
);

create index if not exists idx_creator_media_analysis_creator
  on creator_media_analysis (creator_profile_id);

-- Service role only: the admin Video Studio route uses the service client. No
-- public policies are added, so RLS denies all client access by default.
alter table creator_media_analysis enable row level security;
