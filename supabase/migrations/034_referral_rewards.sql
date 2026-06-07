-- 034_referral_rewards.sql
-- Fan referral codes + attribution + a reward ladder that fires on VERIFIED
-- referrals (referred account confirms + opens the app), never on raw signups.
-- Reward granting is idempotent (one grant per rung per referrer) so nothing
-- double-fires. Medal grants increment medal_balances (033). The shirt rung is
-- recorded unfulfilled for manual admin fulfillment.

-- One stable referral code per user (fan or creator).
create table if not exists public.referral_codes (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  code text unique not null,
  created_at timestamptz not null default now()
);

-- Each person who signs up via a code. One attribution per referred user (first wins).
create table if not exists public.referral_signups (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.referral_codes(code) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  referred_account_type text not null default 'fan',
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);
create index if not exists referral_signups_code_idx on public.referral_signups(code);

-- Idempotent record of which ladder rungs have fired for a referrer.
-- fulfilled = false means a human still has to act (the shirt).
create table if not exists public.referral_rewards_claimed (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  milestone integer not null,
  reward text not null,
  fulfilled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (referrer_user_id, milestone)
);
create index if not exists referral_rewards_referrer_idx on public.referral_rewards_claimed(referrer_user_id);

alter table public.referral_codes enable row level security;
alter table public.referral_signups enable row level security;
alter table public.referral_rewards_claimed enable row level security;

drop policy if exists "own code" on public.referral_codes;
create policy "own code" on public.referral_codes for select using (auth.uid() = owner_user_id);

drop policy if exists "own referrals" on public.referral_signups;
create policy "own referrals" on public.referral_signups for select using (
  auth.uid() = referred_user_id
  or exists (select 1 from public.referral_codes c where c.code = referral_signups.code and c.owner_user_id = auth.uid())
);

drop policy if exists "own rewards" on public.referral_rewards_claimed;
create policy "own rewards" on public.referral_rewards_claimed for select using (auth.uid() = referrer_user_id);

-- Get-or-create the caller-supplied user's referral code.
create or replace function public.ensure_referral_code(p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  select code into v_code from public.referral_codes where owner_user_id = p_user;
  if v_code is not null then
    return v_code;
  end if;
  loop
    v_code := lower(substr(md5(gen_random_uuid()::text), 1, 8));
    begin
      insert into public.referral_codes (owner_user_id, code) values (p_user, v_code);
      return v_code;
    exception when unique_violation then
      select code into v_code from public.referral_codes where owner_user_id = p_user;
      if v_code is not null then
        return v_code;
      end if;
      -- otherwise the code collided; loop and try a new one
    end;
  end loop;
end;
$$;

-- Record an attribution at signup. No-op on bad/self/duplicate.
create or replace function public.record_referral(p_code text, p_referred uuid, p_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if p_code is null or p_referred is null then
    return;
  end if;
  select owner_user_id into v_owner from public.referral_codes where code = p_code;
  if v_owner is null or v_owner = p_referred then
    return;
  end if;
  insert into public.referral_signups (code, referred_user_id, referred_account_type)
    values (p_code, p_referred, coalesce(p_type, 'fan'))
    on conflict (referred_user_id) do nothing;
end;
$$;

-- Grant any unclaimed ladder rungs a referrer has now earned (by verified count).
create or replace function public.grant_referral_rewards(p_referrer uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
    from public.referral_signups s
    join public.referral_codes c on c.code = s.code
    where c.owner_user_id = p_referrer and s.verified = true;

  -- Rung 1 — 12 medals
  if v_count >= 1 and not exists (
    select 1 from public.referral_rewards_claimed where referrer_user_id = p_referrer and milestone = 1
  ) then
    insert into public.referral_rewards_claimed (referrer_user_id, milestone, reward, fulfilled)
      values (p_referrer, 1, '12 medals', true);
    insert into public.medal_balances (fan_user_id, balance) values (p_referrer, 12)
      on conflict (fan_user_id) do update set balance = medal_balances.balance + 12, updated_at = now();
  end if;

  -- Rung 3 — 30 medals + Founding Audience badge
  if v_count >= 3 and not exists (
    select 1 from public.referral_rewards_claimed where referrer_user_id = p_referrer and milestone = 3
  ) then
    insert into public.referral_rewards_claimed (referrer_user_id, milestone, reward, fulfilled)
      values (p_referrer, 3, '30 medals + Founding Audience badge', true);
    insert into public.medal_balances (fan_user_id, balance) values (p_referrer, 30)
      on conflict (fan_user_id) do update set balance = medal_balances.balance + 30, updated_at = now();
  end if;

  -- Rung 5 — 30 medals + 1 month Early Access
  if v_count >= 5 and not exists (
    select 1 from public.referral_rewards_claimed where referrer_user_id = p_referrer and milestone = 5
  ) then
    insert into public.referral_rewards_claimed (referrer_user_id, milestone, reward, fulfilled)
      values (p_referrer, 5, '30 medals + 1 month Early Access', true);
    insert into public.medal_balances (fan_user_id, balance) values (p_referrer, 30)
      on conflict (fan_user_id) do update set balance = medal_balances.balance + 30, updated_at = now();
  end if;

  -- Rung 10 — free Spotlight shirt (manual fulfillment -> fulfilled = false)
  if v_count >= 10 and not exists (
    select 1 from public.referral_rewards_claimed where referrer_user_id = p_referrer and milestone = 10
  ) then
    insert into public.referral_rewards_claimed (referrer_user_id, milestone, reward, fulfilled)
      values (p_referrer, 10, 'Free Spotlight shirt', false);
  end if;
end;
$$;

-- Mark the caller's pending referral verified, then fire the referrer's rewards.
create or replace function public.verify_referral(p_referred uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_owner uuid;
begin
  update public.referral_signups
    set verified = true, verified_at = now()
    where referred_user_id = p_referred and verified = false
    returning code into v_code;
  if v_code is null then
    return;
  end if;
  select owner_user_id into v_owner from public.referral_codes where code = v_code;
  if v_owner is not null then
    perform public.grant_referral_rewards(v_owner);
  end if;
end;
$$;

-- Status payload for the UI: the user's own code + their referral progress.
create or replace function public.referral_status(p_user uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_verified integer;
  v_pending integer;
  v_milestones integer[];
begin
  v_code := public.ensure_referral_code(p_user);
  select
    count(*) filter (where s.verified),
    count(*) filter (where not s.verified)
    into v_verified, v_pending
    from public.referral_signups s
    join public.referral_codes c on c.code = s.code
    where c.owner_user_id = p_user;
  select coalesce(array_agg(milestone order by milestone), array[]::integer[])
    into v_milestones
    from public.referral_rewards_claimed where referrer_user_id = p_user;
  return json_build_object(
    'code', v_code,
    'verified', coalesce(v_verified, 0),
    'pending', coalesce(v_pending, 0),
    'milestones', v_milestones
  );
end;
$$;

grant execute on function public.ensure_referral_code(uuid) to authenticated, anon, service_role;
grant execute on function public.record_referral(text, uuid, text) to authenticated, anon, service_role;
grant execute on function public.grant_referral_rewards(uuid) to authenticated, service_role;
grant execute on function public.verify_referral(uuid) to authenticated, service_role;
grant execute on function public.referral_status(uuid) to authenticated, service_role;
