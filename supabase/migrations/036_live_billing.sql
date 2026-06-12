-- Live streaming usage billing.
-- First hour of every stream is free; after that $0.01 per viewer per hour,
-- billed in 15-minute increments and charged to the creator (infra cost).

create table if not exists public.live_viewer_pings (
  stream_id   uuid not null references public.live_streams(id) on delete cascade,
  viewer_key  text not null,
  last_seen   timestamptz not null default now(),
  primary key (stream_id, viewer_key)
);
create index if not exists idx_live_viewer_pings_seen
  on public.live_viewer_pings (stream_id, last_seen);

create table if not exists public.live_usage_charges (
  id                     uuid primary key default gen_random_uuid(),
  stream_id              uuid not null references public.live_streams(id) on delete cascade,
  creator_profile_id     uuid not null references public.creator_profiles(id) on delete cascade,
  sampled_at             timestamptz not null default now(),
  viewer_count           int not null,
  amount_cents           int not null,
  billed                 boolean not null default false,
  stripe_invoice_item_id text,
  created_at             timestamptz not null default now()
);
create index if not exists idx_live_usage_unbilled
  on public.live_usage_charges (stream_id) where billed = false;
