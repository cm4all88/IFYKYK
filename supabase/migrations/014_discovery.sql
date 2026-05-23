-- ──────────────────────────────────────────────────────────────────
-- 014_discovery.sql
-- Creator tags, location, fan interests, full-text search index,
-- and activity tracking for recommendations.
-- ──────────────────────────────────────────────────────────────────

-- Tags and location on creator profiles
alter table public.creator_profiles
  add column if not exists tags          text[]    not null default '{}',
  add column if not exists location_city  text,
  add column if not exists location_country text;

-- GIN index for fast array overlap queries on tags
create index if not exists creator_profiles_tags_gin
  on public.creator_profiles using gin(tags);

-- Full-text search index on handle, display_name, bio, and tags
alter table public.creator_profiles
  add column if not exists search_vector tsvector
    generated always as (
      to_tsvector('english',
        coalesce(display_name, '') || ' ' ||
        coalesce(handle, '') || ' ' ||
        coalesce(bio, '') || ' ' ||
        coalesce(array_to_string(tags, ' '), '')
      )
    ) stored;

create index if not exists creator_profiles_search_idx
  on public.creator_profiles using gin(search_vector);

-- Fan interests — what categories they selected at signup
create table if not exists public.fan_interests (
  id              uuid primary key default gen_random_uuid(),
  fan_user_id     uuid references auth.users(id) on delete cascade not null,
  category        text not null,
  created_at      timestamptz not null default now(),
  unique(fan_user_id, category)
);

alter table public.fan_interests enable row level security;

create policy "fan_interests_own" on public.fan_interests
  for all using (fan_user_id = auth.uid())
  with check (fan_user_id = auth.uid());

-- Fan activity — tracks views/clicks for recommendation engine
create table if not exists public.fan_activity (
  id                  uuid primary key default gen_random_uuid(),
  fan_user_id         uuid references auth.users(id) on delete cascade not null,
  creator_profile_id  uuid references public.creator_profiles(id) on delete cascade not null,
  activity_type       text not null check (activity_type in ('view', 'tip', 'subscribe', 'super_tip', 'unlock')),
  created_at          timestamptz not null default now()
);

create index if not exists fan_activity_fan_idx
  on public.fan_activity(fan_user_id, created_at desc);

create index if not exists fan_activity_creator_idx
  on public.fan_activity(creator_profile_id);

alter table public.fan_activity enable row level security;

create policy "fan_activity_own_insert" on public.fan_activity
  for insert with check (fan_user_id = auth.uid());

create policy "fan_activity_service_select" on public.fan_activity
  for select using (true);

-- Collaborative filtering function
-- Returns creator IDs recommended for a given fan based on shared subscriptions
create or replace function public.recommended_creators(
  p_fan_user_id uuid,
  p_limit integer default 12
)
returns table(creator_profile_id uuid, shared_fans bigint)
language sql stable as $$
  select
    s2.creator_profile_id,
    count(distinct s2.fan_user_id) as shared_fans
  from subscriptions s1
  join subscriptions s2
    on s1.fan_user_id = s2.fan_user_id
    and s1.creator_profile_id != s2.creator_profile_id
  where
    s1.fan_user_id = p_fan_user_id
    and s1.status = 'active'
    and s2.status = 'active'
    and s2.fan_user_id != p_fan_user_id
    and s2.creator_profile_id not in (
      select creator_profile_id
      from subscriptions
      where fan_user_id = p_fan_user_id
      and status = 'active'
    )
  group by s2.creator_profile_id
  order by shared_fans desc
  limit p_limit;
$$;
