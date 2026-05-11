-- ─── USERS / CREATORS ────────────────────────────────────────

create table public.creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  handle text unique not null,
  display_name text not null,
  bio text,
  avatar_url text,
  cover_url text,
  location text,
  creator_type text not null check (creator_type in ('sfw', 'adult', 'young')),
  subscription_price decimal(10,2) default 9.99,
  stripe_account_id text,
  ccbill_account_number text,
  veriff_verified boolean default false,
  is_active boolean default true,
  founded boolean default false, -- founding creator badge
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.creators enable row level security;

create policy "Creators are publicly readable"
  on public.creators for select using (true);

create policy "Creators can update their own profile"
  on public.creators for update using (auth.uid() = user_id);

-- ─── CHANNELS ────────────────────────────────────────────────

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators(id) on delete cascade not null,
  name text not null,
  slug text not null,
  description text,
  content_rating text not null default 'G' check (content_rating in ('G','PG','M','R','X')),
  subscription_price decimal(10,2),
  is_visible boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now(),
  unique(creator_id, slug)
);

alter table public.channels enable row level security;

create policy "Channels are publicly readable if visible"
  on public.channels for select using (is_visible = true);

create policy "Creators can manage their channels"
  on public.channels for all using (
    creator_id in (select id from public.creators where user_id = auth.uid())
  );

-- ─── POSTS ───────────────────────────────────────────────────

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators(id) on delete cascade not null,
  channel_id uuid references public.channels(id) on delete set null,
  caption text,
  media_url text,
  media_type text check (media_type in ('image', 'video', 'gallery')),
  tier text not null default 'free' check (tier in ('free', 'premium')),
  content_rating text not null default 'G',
  status text not null default 'live' check (status in ('live', 'archive', 'deleted', 'scheduled')),
  scheduled_at timestamptz,
  archive_reason text,
  likes_count integer default 0,
  views_count integer default 0,
  collab_creator_id uuid references public.creators(id),
  collab_approved boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.posts enable row level security;

create policy "Free posts are publicly readable"
  on public.posts for select using (tier = 'free' and status = 'live');

create policy "Creators can manage their posts"
  on public.posts for all using (
    creator_id in (select id from public.creators where user_id = auth.uid())
  );

-- ─── SUBSCRIPTIONS ───────────────────────────────────────────

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  fan_user_id uuid references auth.users(id) not null,
  creator_id uuid references public.creators(id) not null,
  channel_id uuid references public.channels(id),
  stripe_subscription_id text unique,
  stripe_customer_id text,
  status text not null check (status in ('trialing','active','past_due','canceled','incomplete')),
  tier text not null default 'fan',
  price decimal(10,2),
  trial_end timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  unique(fan_user_id, creator_id)
);

alter table public.subscriptions enable row level security;

create policy "Users can view their own subscriptions"
  on public.subscriptions for select using (fan_user_id = auth.uid());

create policy "Creators can view subscriptions to their page"
  on public.subscriptions for select using (
    creator_id in (select id from public.creators where user_id = auth.uid())
  );

-- ─── TIPS ────────────────────────────────────────────────────

create table public.tips (
  id uuid primary key default gen_random_uuid(),
  fan_user_id uuid references auth.users(id) not null,
  creator_id uuid references public.creators(id) not null,
  post_id uuid references public.posts(id),
  amount decimal(10,2) not null,
  creator_receives decimal(10,2) not null, -- 85%
  platform_receives decimal(10,2) not null, -- 15%
  message text,
  is_live_tip boolean default false,
  stripe_payment_intent_id text,
  created_at timestamptz default now()
);

alter table public.tips enable row level security;

create policy "Creators can view tips they received"
  on public.tips for select using (
    creator_id in (select id from public.creators where user_id = auth.uid())
  );

-- ─── WALLET ──────────────────────────────────────────────────

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  balance decimal(10,2) not null default 0.00,
  parent_user_id uuid references auth.users(id),
  monthly_budget decimal(10,2),
  per_tip_limit decimal(10,2),
  is_young_account boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.wallets enable row level security;

create policy "Users can view their own wallet"
  on public.wallets for select using (user_id = auth.uid() or parent_user_id = auth.uid());

create policy "Users can update their own wallet"
  on public.wallets for update using (user_id = auth.uid() or parent_user_id = auth.uid());

-- ─── INDEXES ─────────────────────────────────────────────────

create index idx_creators_handle on public.creators(handle);
create index idx_posts_creator_id on public.posts(creator_id);
create index idx_posts_status on public.posts(status);
create index idx_subscriptions_fan on public.subscriptions(fan_user_id);
create index idx_subscriptions_creator on public.subscriptions(creator_id);
create index idx_tips_creator on public.tips(creator_id);
