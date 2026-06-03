-- 033_medal_balance.sql
-- Packs + held balance model. Fans buy medal packs (100% Spotlightly revenue,
-- recorded in medal_purchases), hold a balance, and spend one medal per award.
-- Medals have no cash value and never pay out to creators.

create table if not exists public.medal_balances (
  fan_user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0,
  lifetime_purchased integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.medal_purchases (
  id uuid primary key default gen_random_uuid(),
  fan_user_id uuid not null references auth.users(id) on delete cascade,
  pack_id text not null,
  medals integer not null,
  amount_usd numeric(10,2) not null,
  stripe_session text,
  created_at timestamptz not null default now()
);

create index if not exists medal_purchases_fan_idx on public.medal_purchases(fan_user_id);

alter table public.medal_balances enable row level security;
alter table public.medal_purchases enable row level security;

drop policy if exists "own balance" on public.medal_balances;
create policy "own balance" on public.medal_balances for select using (auth.uid() = fan_user_id);

drop policy if exists "own purchases" on public.medal_purchases;
create policy "own purchases" on public.medal_purchases for select using (auth.uid() = fan_user_id);

-- Atomic spend: decrements the caller's balance by one and records the award.
-- The medal_awards insert fires apply_medal_award() (032) to bump leaderboard counters.
create or replace function public.award_medal(p_post_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_creator uuid;
  v_new integer;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'auth');
  end if;

  select creator_profile_id into v_creator from public.posts where id = p_post_id;
  if v_creator is null then
    return json_build_object('ok', false, 'error', 'post');
  end if;

  insert into public.medal_balances (fan_user_id, balance)
    values (v_uid, 0)
    on conflict (fan_user_id) do nothing;

  update public.medal_balances
    set balance = balance - 1, updated_at = now()
    where fan_user_id = v_uid and balance >= 1
    returning balance into v_new;

  if v_new is null then
    return json_build_object('ok', false, 'error', 'insufficient',
      'balance', coalesce((select balance from public.medal_balances where fan_user_id = v_uid), 0));
  end if;

  insert into public.medal_awards (post_id, creator_profile_id, fan_user_id, medal_type, points, amount_usd)
    values (p_post_id, v_creator, v_uid, 'medal', 1, 0);

  return json_build_object('ok', true, 'balance', v_new);
end;
$$;

grant execute on function public.award_medal(uuid) to authenticated;
