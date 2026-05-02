-- CCBill subscriptions for 18+ creators
create table public.ccbill_subscriptions (
  id uuid primary key default gen_random_uuid(),
  ccbill_subscription_id text unique not null,
  creator_id uuid references public.creators(id),
  fan_email text not null,
  status text not null check (status in ('active','canceled','suspended')),
  event_type text,
  last_renewal timestamptz,
  created_at timestamptz default now()
);

-- Referrals
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references public.creators(id) not null,
  referred_id uuid references public.creators(id) not null unique,
  commission_rate decimal(4,3) default 0.10,
  active_months integer default 0,
  max_months integer default 6,
  total_earned decimal(10,2) default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- In-session offers (live offers during streaming)
create table public.live_offers (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators(id) not null,
  service_name text not null,
  regular_price decimal(10,2) not null,
  offer_price decimal(10,2) not null,
  spots_total integer not null,
  spots_claimed integer default 0,
  expires_at timestamptz,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table public.live_offer_claims (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references public.live_offers(id) not null,
  fan_name text not null,
  fan_contact text,
  status text default 'pending' check (status in ('pending','confirmed','canceled')),
  created_at timestamptz default now()
);
