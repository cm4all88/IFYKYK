-- Concierge claim links: creator sets their own email + password via a code.
alter table public.creator_profiles
  add column if not exists claim_code text,
  add column if not exists claimed_at timestamptz;
create unique index if not exists idx_creator_profiles_claim_code
  on public.creator_profiles (claim_code) where claim_code is not null;
