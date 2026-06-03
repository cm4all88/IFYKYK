-- 032_medals.sql
-- Medals: fans buy + award medals to standout posts. Money is 100% Spotlightly's
-- (recorded as a platform charge). Creators NEVER redeem medals for cash — medals
-- are a non-cash status tally that feeds the monthly Top 10 wall, drawings, and the
-- year-end award. No stored value, nothing to redeem.

create table if not exists public.medal_awards (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  creator_profile_id uuid not null references public.creator_profiles(id) on delete cascade,
  fan_user_id uuid not null references auth.users(id) on delete cascade,
  medal_type text not null,                 -- bronze | silver | gold | diamond
  points integer not null default 0,        -- leaderboard weight
  amount_usd numeric(10,2) not null default 0,
  stripe_session text,
  created_at timestamptz not null default now()
);

create index if not exists medal_awards_post_idx on public.medal_awards(post_id);
create index if not exists medal_awards_creator_idx on public.medal_awards(creator_profile_id);
create index if not exists medal_awards_created_idx on public.medal_awards(created_at);

alter table public.medal_awards enable row level security;

-- Medal data is public social proof. Reads open; inserts happen server-side via the
-- Stripe webhook (service role), so no user insert policy is granted.
drop policy if exists "medal_awards readable" on public.medal_awards;
create policy "medal_awards readable" on public.medal_awards for select using (true);

-- Denormalized counters
alter table public.creator_profiles add column if not exists medal_points_total integer not null default 0;
alter table public.creator_profiles add column if not exists medal_count_total integer not null default 0;
alter table public.posts add column if not exists medal_count integer not null default 0;

create or replace function public.apply_medal_award()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.creator_profiles
    set medal_points_total = coalesce(medal_points_total, 0) + new.points,
        medal_count_total  = coalesce(medal_count_total, 0) + 1
    where id = new.creator_profile_id;
  update public.posts
    set medal_count = coalesce(medal_count, 0) + 1
    where id = new.post_id;
  return new;
end;
$$;

drop trigger if exists trg_apply_medal_award on public.medal_awards;
create trigger trg_apply_medal_award
after insert on public.medal_awards
for each row execute function public.apply_medal_award();

-- Current-calendar-month leaderboard, joined to creator info for the Top 10 wall.
create or replace view public.creator_medal_month as
select
  ma.creator_profile_id,
  cp.handle,
  cp.display_name,
  cp.avatar_url,
  sum(ma.points)::bigint as points,
  count(*)::bigint as medals
from public.medal_awards ma
join public.creator_profiles cp on cp.id = ma.creator_profile_id
where ma.created_at >= date_trunc('month', now())
group by ma.creator_profile_id, cp.handle, cp.display_name, cp.avatar_url
order by points desc;

grant select on public.creator_medal_month to anon, authenticated;
